import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStoredToken, refreshAccessToken, clearTokens, hasRefreshToken } from '../utils/spotifyAuth';

const SpotifyContext = createContext(null);

// Detect iOS (iPhone/iPad/iPod) — Spotify Web Playback SDK is not supported on iOS.
//
// Pitfalls:
//   - M1/M2 Macs: navigator.maxTouchPoints can be 5 (multi-touch trackpad)
//   - iPadOS 13+: reports as "MacIntel" to fake a desktop UA
//   - Safari on Mac: may have 'ontouchstart' in window via the Magic Trackpad
//
// Most reliable distinguisher: navigator.standalone is defined ONLY on iOS/iPadOS.
// On macOS (including M-series) it is always undefined, even in Safari.
const isIOS = /iPhone|iPod/.test(navigator.userAgent) ||
  /iPad/.test(navigator.userAgent) ||
  // iPadOS 13+ fakes a Mac UA — navigator.standalone is iOS-only, never macOS
  (typeof navigator.standalone !== 'undefined' && navigator.maxTouchPoints > 1);

export function useSpotify() {
  return useContext(SpotifyContext);
}

export function SpotifyProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [connected, setConnected] = useState(() => hasRefreshToken() || !!getStoredToken());
  const [isPremium, setIsPremium] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  // Refs that mirror state so callbacks always read the latest values
  // without needing to be in dependency arrays (avoids stale closures)
  const isPremiumRef = useRef(false);
  const sdkReadyRef = useRef(false);
  const deviceIdRef = useRef(null);

  const playerRef = useRef(null);

  // Web Audio API refs for preview-URL path volume control (non-iOS)
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const walkUpAudioRef = useRef(null);

  // SDK ramp interval ref (non-iOS premium path)
  const sdkRampIntervalRef = useRef(null);

  // iOS-specific refs
  // iosWalkUpAudioRef holds a pre-unlocked Audio element primed in the tap gesture
  const iosWalkUpAudioRef = useRef(null);
  // iosRampRef holds the setInterval ID for iOS volume ramping
  const iosRampRef = useRef(null);

  const setIsPremiumBoth = (val) => { isPremiumRef.current = val; setIsPremium(val); };
  const setSdkReadyBoth  = (val) => { sdkReadyRef.current  = val; setSdkReady(val);  };
  const setDeviceIdBoth  = (val) => { deviceIdRef.current  = val; setDeviceId(val);  };

  const getToken = useCallback(async () => {
    let t = getStoredToken();
    if (!t && hasRefreshToken()) {
      t = await refreshAccessToken();
    }
    if (t) {
      setToken(t);
      setConnected(true);
    } else {
      setConnected(false);
    }
    return t;
  }, []);

  // Initialize on mount if we already have stored credentials
  useEffect(() => {
    if (hasRefreshToken() || getStoredToken()) {
      getToken().then(t => { if (t) checkPremium(t); });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkPremium(t) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      const premium = data.product === 'premium';
      console.log('[Spotify] Account type:', data.product, '| isPremium:', premium);
      setIsPremiumBoth(premium);
    } catch (e) {
      console.warn('[Spotify] checkPremium failed:', e.message);
    }
  }

  // Load Web Playback SDK once we have a token.
  // Skipped on iOS — the SDK is not supported there at all.
  useEffect(() => {
    if (!token) return;

    if (isIOS) {
      console.log('[Spotify SDK] iOS detected — Web Playback SDK not supported, skipping load');
      return;
    }

    function initPlayer() {
      if (playerRef.current) {
        console.log('[Spotify SDK] initPlayer called but player already exists — skipping');
        return;
      }
      console.log('[Spotify SDK] Initializing player…');
      const player = new window.Spotify.Player({
        name: 'NowBatting',
        getOAuthToken: async (cb) => {
          const t = await getToken();
          if (t) cb(t);
        },
        volume: 0,
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('[Spotify SDK] Ready — device_id:', device_id);
        setDeviceIdBoth(device_id);
        setSdkReadyBoth(true);
      });
      player.addListener('not_ready', ({ device_id }) => {
        console.warn('[Spotify SDK] Not ready — device_id:', device_id);
        setSdkReadyBoth(false);
      });
      player.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify SDK] Initialization error:', message);
      });
      player.addListener('authentication_error', ({ message }) => {
        console.error('[Spotify SDK] Authentication error:', message);
        setConnected(false);
      });
      player.addListener('account_error', ({ message }) => {
        console.error('[Spotify SDK] Account error (Premium required):', message);
        setIsPremiumBoth(false);
      });
      player.addListener('playback_error', ({ message }) => {
        console.error('[Spotify SDK] Playback error:', message);
      });

      player.connect().then(success => {
        console.log('[Spotify SDK] connect() result:', success);
      });
      playerRef.current = player;
    }

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.getElementById('spotify-sdk')) {
        console.log('[Spotify SDK] Loading SDK script…');
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(script);
      }
    }
  }, [token, getToken]);

  const search = useCallback(async (query) => {
    if (!query?.trim()) return [];
    const t = await getToken();
    if (!t) return [];
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.tracks?.items || [];
    } catch { return []; }
  }, [getToken]);

  function clearRamp() {
    if (sdkRampIntervalRef.current) {
      clearInterval(sdkRampIntervalRef.current);
      sdkRampIntervalRef.current = null;
    }
  }

  function clearIOSRamp() {
    if (iosRampRef.current) {
      clearInterval(iosRampRef.current);
      iosRampRef.current = null;
    }
  }

  function closeAudioCtx() {
    if (walkUpAudioRef.current) {
      walkUpAudioRef.current.pause();
      walkUpAudioRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  const stopWalkUp = useCallback(() => {
    clearRamp();
    clearIOSRamp();
    // Clean up iOS pre-primed audio if it was never used
    if (iosWalkUpAudioRef.current) {
      iosWalkUpAudioRef.current.audio?.pause();
      iosWalkUpAudioRef.current = null;
    }
    closeAudioCtx();
    if (playerRef.current && sdkReadyRef.current) {
      playerRef.current.pause().catch(() => {});
    }
  }, []); // stable — reads from refs

  /**
   * iOS only: call this synchronously in the user-gesture handler to pre-unlock
   * an Audio element for the walk-up song. iOS blocks audio.play() outside of a
   * direct user gesture; by playing-then-immediately-pausing here, the element
   * becomes "unlocked" and can be .play()'d again later from onHalfway.
   */
  const primeWalkUpAudio = useCallback((track) => {
    if (!isIOS || !track?.previewUrl) return;
    const audio = new Audio(track.previewUrl);
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {}); // best-effort unlock; errors here are non-fatal
    iosWalkUpAudioRef.current = { audio, url: track.previewUrl };
    console.log('[Spotify iOS] Walk-up audio pre-unlocked for:', track.name);
  }, []);

  // Start walk-up song at a soft volume (for crossfade with announcement)
  const startWalkUpSoft = useCallback(async (track, initialVol = 0.15) => {
    stopWalkUp();
    if (!track) return;

    const ready   = sdkReadyRef.current;
    const did     = deviceIdRef.current;
    const premium = isPremiumRef.current;

    console.log('[Spotify] startWalkUpSoft:', track.name, '| iOS:', isIOS, '| premium:', premium, '| sdkReady:', ready, '| deviceId:', did);

    // ── iOS path ──────────────────────────────────────────────────────────────
    // Bypass Web Audio API entirely. Use the pre-unlocked Audio element that was
    // primed in the tap handler, and control volume via audio.volume directly.
    if (isIOS) {
      if (!track.previewUrl) {
        console.warn('[Spotify iOS] No preview URL for:', track.name);
        return;
      }
      const primed = iosWalkUpAudioRef.current;
      let audio;
      if (primed?.url === track.previewUrl) {
        audio = primed.audio;
        iosWalkUpAudioRef.current = null;
        console.log('[Spotify iOS] Using pre-unlocked audio element');
      } else {
        // Priming didn't happen or URL mismatch — create a new element.
        // play() may fail on older iOS here, but it's the best we can do.
        audio = new Audio(track.previewUrl);
        console.warn('[Spotify iOS] No pre-unlocked audio found — created new element (may be blocked)');
      }
      audio.volume = initialVol;
      audio.currentTime = 0;
      walkUpAudioRef.current = audio;
      await audio.play().catch(e => console.error('[Spotify iOS] Preview play error:', e.message));
      console.log('[Spotify iOS] Walk-up started at volume', initialVol);
      return;
    }

    // ── Non-iOS paths ─────────────────────────────────────────────────────────
    const t = await getToken();
    if (!t) { console.warn('[Spotify] No token'); return; }

    if (premium && ready && did) {
      // SDK path: set volume low, then start playback
      try {
        await playerRef.current.setVolume(initialVol);
        const res = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${did}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [`spotify:track:${track.id}`] }),
          }
        );
        if (res.ok || res.status === 204) {
          console.log('[Spotify] SDK walk-up started soft at', initialVol);
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('[Spotify] SDK play failed:', res.status, err);
        }
      } catch (e) {
        console.error('[Spotify] startWalkUpSoft SDK error:', e.message);
      }
    } else if (track.previewUrl) {
      // Preview path: Web Audio API for smooth volume control
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(initialVol, ctx.currentTime);
        gain.connect(ctx.destination);

        const audio = new Audio(track.previewUrl);
        audio.crossOrigin = 'anonymous';
        const source = ctx.createMediaElementSource(audio);
        source.connect(gain);

        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        walkUpAudioRef.current = audio;

        await audio.play().catch(e => console.error('[Spotify] Preview play error:', e.message));
        console.log('[Spotify] Preview walk-up started soft at', initialVol);
      } catch (e) {
        console.error('[Spotify] startWalkUpSoft preview error:', e.message);
      }
    } else {
      console.warn('[Spotify] No SDK and no preview URL — cannot play walk-up for:', track.name);
    }
  }, [getToken, stopWalkUp]);

  // Ramp the walk-up song from its current volume up to 100% over durationSec
  const rampWalkUpToFull = useCallback((durationSec = 2) => {
    const premium = isPremiumRef.current;
    const ready   = sdkReadyRef.current;

    console.log('[Spotify] rampWalkUpToFull | iOS:', isIOS, '| premium:', premium, '| sdkReady:', ready);

    // ── iOS path: interval ramp on audio.volume ──────────────────────────────
    if (isIOS && walkUpAudioRef.current) {
      const audio = walkUpAudioRef.current;
      const startVol = audio.volume;
      const steps = 20;
      const intervalMs = (durationSec * 1000) / steps;
      const volStep = (1.0 - startVol) / steps;
      let step = 0;
      clearIOSRamp();
      iosRampRef.current = setInterval(() => {
        step++;
        audio.volume = Math.min(startVol + volStep * step, 1.0);
        if (step >= steps) {
          clearInterval(iosRampRef.current);
          iosRampRef.current = null;
          console.log('[Spotify iOS] Volume ramp complete');
        }
      }, intervalMs);
      return;
    }

    if (premium && ready && playerRef.current) {
      // SDK: interval-based ramp (Web Audio scheduling not available for SDK)
      clearRamp();
      const steps = 20;
      const intervalMs = (durationSec * 1000) / steps;

      const doRamp = (startVol) => {
        let step = 0;
        const volStep = (1.0 - startVol) / steps;
        sdkRampIntervalRef.current = setInterval(async () => {
          step++;
          const newVol = Math.min(startVol + volStep * step, 1.0);
          await playerRef.current?.setVolume(newVol).catch(() => {});
          if (step >= steps) {
            clearInterval(sdkRampIntervalRef.current);
            sdkRampIntervalRef.current = null;
            console.log('[Spotify] SDK ramp complete');
          }
        }, intervalMs);
      };

      playerRef.current.getVolume().then(vol => doRamp(vol ?? 0.15)).catch(() => doRamp(0.15));
    } else if (gainNodeRef.current && audioCtxRef.current) {
      // Web Audio: smooth scheduled linear ramp
      const gain = gainNodeRef.current;
      const ctx = audioCtxRef.current;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + durationSec);
      console.log('[Spotify] Preview ramping to full over', durationSec, 's');
    } else {
      console.warn('[Spotify] rampWalkUpToFull: no active playback to ramp');
    }
  }, []);

  // Fade the walk-up song out over durationSec, then stop it.
  // Safe to call at any time — cancels any in-progress ramp first.
  const fadeOutWalkUp = useCallback((durationSec = 1.5) => {
    const steps = 30;
    const intervalMs = (durationSec * 1000) / steps;

    // ── iOS path ──────────────────────────────────────────────────────────────
    if (isIOS && walkUpAudioRef.current) {
      const audio = walkUpAudioRef.current;
      clearIOSRamp();
      const startVol = audio.volume;
      const volStep = startVol / steps;
      let step = 0;
      iosRampRef.current = setInterval(() => {
        step++;
        audio.volume = Math.max(startVol - volStep * step, 0);
        if (step >= steps) {
          clearInterval(iosRampRef.current);
          iosRampRef.current = null;
          audio.pause();
          audio.volume = 1.0;
          walkUpAudioRef.current = null;
        }
      }, intervalMs);
      return;
    }

    // ── SDK path ──────────────────────────────────────────────────────────────
    const premium = isPremiumRef.current;
    const ready   = sdkReadyRef.current;
    if (premium && ready && playerRef.current) {
      clearRamp();
      let step = 0;
      playerRef.current.getVolume().then(startVol => {
        const vol = startVol ?? 1.0;
        const volStep = vol / steps;
        sdkRampIntervalRef.current = setInterval(async () => {
          step++;
          const newVol = Math.max(vol - volStep * step, 0);
          await playerRef.current?.setVolume(newVol).catch(() => {});
          if (step >= steps) {
            clearInterval(sdkRampIntervalRef.current);
            sdkRampIntervalRef.current = null;
            playerRef.current?.pause().catch(() => {});
            playerRef.current?.setVolume(1.0).catch(() => {});
          }
        }, intervalMs);
      }).catch(() => {
        playerRef.current?.pause().catch(() => {});
      });
      return;
    }

    // ── Web Audio path ────────────────────────────────────────────────────────
    if (gainNodeRef.current && audioCtxRef.current) {
      const gain = gainNodeRef.current;
      const ctx  = audioCtxRef.current;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec);
      setTimeout(() => {
        if (walkUpAudioRef.current) {
          walkUpAudioRef.current.pause();
          walkUpAudioRef.current = null;
        }
        closeAudioCtx();
      }, durationSec * 1000);
      return;
    }

    // Fallback: hard stop if no active path found
    stopWalkUp();
  }, [stopWalkUp]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(() => {
    stopWalkUp();
    clearTokens();
    playerRef.current?.disconnect();
    playerRef.current = null;
    setToken(null);
    setConnected(false);
    setDeviceIdBoth(null);
    setSdkReadyBoth(false);
    setIsPremiumBoth(false);
  }, [stopWalkUp]);

  const onTokensReceived = useCallback((accessToken) => {
    setToken(accessToken);
    setConnected(true);
    checkPremium(accessToken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SpotifyContext.Provider value={{
      connected,
      isPremium,
      sdkReady,
      deviceId,
      isIOS,
      search,
      primeWalkUpAudio,
      startWalkUpSoft,
      rampWalkUpToFull,
      stopWalkUp,
      fadeOutWalkUp,
      disconnect,
      onTokensReceived,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}
