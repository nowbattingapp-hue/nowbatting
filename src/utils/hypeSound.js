// CC0 public domain crowd+bell — Red Library via Internet Archive
// https://archive.org/details/Red_Library_Crowds_Sports
// Fallback: CC0 drum roll — Pixabay
const HYPE_URLS = [
  'https://archive.org/download/Red_Library_Crowds_Sports/R07-13-Crowd%20and%20Boxing%20Bell.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d82b.mp3', // crowd cheer, CC0
];

// Cache the raw bytes so we fetch only once per session.
// We pass bytes.slice(0) to decodeAudioData because that call transfers
// (detaches) its input buffer, which would corrupt the cache.
let cachedBytes = null;
let fetchPromise = null; // deduplicate concurrent calls

async function fetchHypeBytes() {
  if (cachedBytes) {
    console.log('[HypeSound] getBytes: using cache, size:', cachedBytes.byteLength);
    return cachedBytes;
  }
  if (fetchPromise) {
    console.log('[HypeSound] getBytes: awaiting in-flight fetch');
    return fetchPromise;
  }

  fetchPromise = (async () => {
    for (let i = 0; i < HYPE_URLS.length; i++) {
      const url = HYPE_URLS[i];
      console.log(`[HypeSound] Fetching URL ${i + 1}/${HYPE_URLS.length}:`, url);
      try {
        const res = await fetch(url);
        console.log(`[HypeSound] Fetch response: ${res.status} ${res.statusText}, type: ${res.headers.get('content-type')}`);
        if (!res.ok) { console.warn('[HypeSound] Non-OK status, trying next'); continue; }
        const bytes = await res.arrayBuffer();
        console.log('[HypeSound] Fetched successfully, byteLength:', bytes.byteLength);
        cachedBytes = bytes;
        fetchPromise = null;
        return cachedBytes;
      } catch (e) {
        console.warn(`[HypeSound] Fetch error for URL ${i + 1}:`, e.name, e.message);
      }
    }
    fetchPromise = null;
    throw new Error('All hype sound URLs failed');
  })();

  return fetchPromise;
}

/**
 * Call on Game Day mount to warm up the bytes before the first tap.
 * Fetch doesn't need user interaction — only AudioContext creation does.
 */
export function preloadHypeSound() {
  console.log('[HypeSound] preloadHypeSound() called');
  fetchHypeBytes().catch(e => console.warn('[HypeSound] Preload failed:', e.message));
}

/**
 * Start the hype sound. Returns a controller { fadeOut(durationSec), stop }
 * or null if the sound could not be loaded/decoded.
 *
 * Must be called from a user-gesture handler (tap) so AudioContext is allowed.
 */
export async function startHypeSound(volume = 0.55) {
  console.log('[HypeSound] startHypeSound() called, volume:', volume);

  let audioCtx = null;
  let gainNode = null;
  let sourceNode = null;
  let stopped = false;

  const cleanup = (reason) => {
    if (stopped) return;
    stopped = true;
    console.log('[HypeSound] cleanup(), reason:', reason);
    try { sourceNode?.stop(); } catch (_) {}
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    gainNode = null;
    sourceNode = null;
  };

  // CRITICAL for iOS: create AudioContext synchronously in the user-gesture call
  // stack, BEFORE any await. On iOS, an AudioContext created after an await is
  // immediately suspended and cannot play audio until another tap.
  try {
    audioCtx = new AudioContext();
    console.log('[HypeSound] AudioContext state:', audioCtx.state, '| sampleRate:', audioCtx.sampleRate);
    // Fire-and-forget resume — don't await (would break iOS gesture chain)
    if (audioCtx.state === 'suspended') {
      console.log('[HypeSound] AudioContext suspended — calling resume() (fire-and-forget)');
      audioCtx.resume();
    }
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);
  } catch (e) {
    console.error('[HypeSound] AudioContext creation failed:', e.message);
    return null;
  }

  try {
    const bytes = await fetchHypeBytes();

    if (stopped) {
      console.log('[HypeSound] Cancelled before decode');
      return null;
    }

    // Re-check context state after the async fetch. Some desktop Chrome versions
    // start AudioContext suspended even from a click handler; ensure it's running
    // before decoding so sourceNode.start() produces sound immediately.
    if (audioCtx.state === 'suspended') {
      console.log('[HypeSound] AudioContext still suspended after fetch — awaiting resume()');
      await audioCtx.resume();
      console.log('[HypeSound] AudioContext state after resume:', audioCtx.state);
    }

    console.log('[HypeSound] Decoding audio data, byteLength:', bytes.byteLength);
    // .slice(0) copies the bytes; decodeAudioData would otherwise detach/corrupt the cache
    const decoded = await audioCtx.decodeAudioData(bytes.slice(0));
    console.log('[HypeSound] Decoded OK — duration:', decoded.duration.toFixed(2), 's, channels:', decoded.numberOfChannels, ', sampleRate:', decoded.sampleRate);

    if (stopped) {
      console.log('[HypeSound] Cancelled after decode');
      return null;
    }

    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = decoded;
    sourceNode.loop = true;
    sourceNode.connect(gainNode);
    sourceNode.start();
    console.log('[HypeSound] Playback started, looping ✓');

    return {
      fadeOut(durationSec = 1.5) {
        if (stopped || !audioCtx) { console.log('[HypeSound] fadeOut() skipped — already stopped'); return; }
        console.log('[HypeSound] fadeOut() over', durationSec, 's');
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + durationSec);
        setTimeout(() => cleanup('fadeOut complete'), (durationSec + 0.25) * 1000);
      },
      stop() {
        console.log('[HypeSound] stop() called');
        cleanup('hard stop');
      },
    };
  } catch (e) {
    console.error('[HypeSound] startHypeSound() failed:', e.name, e.message);
    cleanup('error');
    return null;
  }
}
