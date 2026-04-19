import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStoredToken, refreshAccessToken, clearTokens, hasRefreshToken } from '../utils/spotifyAuth';

const SpotifyContext = createContext(null);

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

  // Web Audio API refs for preview-URL path volume control
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const walkUpAudioRef = useRef(null);

  // SDK ramp interval ref
  const sdkRampIntervalRef = useRef(null);

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

  // Load Web Playback SDK once we have a token
  useEffect(() => {
    if (!token) return;

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
    closeAudioCtx();
    if (playerRef.current && sdkReadyRef.current) {
      playerRef.current.pause().catch(() => {});
    }
  }, []); // stable — reads from refs

  // Start walk-up song at a soft volume (for crossfade with announcement)
  const startWalkUpSoft = useCallback(async (track, initialVol = 0.15) => {
    stopWalkUp();
    if (!track) return;

    const ready   = sdkReadyRef.current;
    const did     = deviceIdRef.current;
    const premium = isPremiumRef.current;

    console.log('[Spotify] startWalkUpSoft:', track.name, '| premium:', premium, '| sdkReady:', ready, '| deviceId:', did);

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

    console.log('[Spotify] rampWalkUpToFull | premium:', premium, '| sdkReady:', ready);

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
      search,
      startWalkUpSoft,
      rampWalkUpToFull,
      stopWalkUp,
      disconnect,
      onTokensReceived,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}
