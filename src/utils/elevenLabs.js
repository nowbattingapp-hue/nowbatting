const VOICE_ID = 'nPczCjzI2devNBz1zQrb'; // Brian — deep, energetic announcer
const MODEL_ID = 'eleven_turbo_v2_5';

const _apiKey = process.env.REACT_APP_ELEVENLABS_API_KEY;
console.log('[ElevenLabs] API key status:', _apiKey ? `present (${_apiKey.slice(0, 8)}…)` : 'MISSING — check .env and restart dev server');

// Session-level cache: announcement text → blob URL
const audioCache = new Map();

export async function generateAnnouncement(text) {
  if (audioCache.has(text)) {
    console.log('[ElevenLabs] Cache hit for:', text);
    return audioCache.get(text);
  }
  const apiKey = process.env.REACT_APP_ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('No ElevenLabs API key — check .env and restart');
  console.log('[ElevenLabs] Calling API for:', text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  });
  console.log('[ElevenLabs] Response status:', res.status);
  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`ElevenLabs ${res.status}: ${err}`);
  }
  const blob = await res.blob();
  console.log('[ElevenLabs] Audio blob received, size:', blob.size, 'type:', blob.type);
  const url = URL.createObjectURL(blob);
  audioCache.set(text, url);
  return url;
}

// Play an announcement via ElevenLabs, falling back to browser TTS on any failure.
// onHalfway fires when ~50% of the audio has elapsed so the caller can start the
// walk-up song softly underneath the announcement.
// Returns a cancel function.
export function playWithFallback(text, { onEnd, onStart, onHalfway } = {}) {
  let audio = null;
  let cancelled = false;

  generateAnnouncement(text)
    .then(url => {
      if (cancelled) {
        console.log('[ElevenLabs] Cancelled before playback');
        return;
      }
      console.log('[ElevenLabs] Playing audio…');
      audio = new Audio(url);

      // Fire onHalfway at the 50% mark using timeupdate
      if (onHalfway) {
        let halfwayFired = false;
        audio.addEventListener('timeupdate', () => {
          if (!halfwayFired && audio.duration > 0 && audio.currentTime / audio.duration >= 0.5) {
            halfwayFired = true;
            console.log('[ElevenLabs] Halfway point reached — starting walk-up soft');
            onHalfway();
          }
        });
      }

      audio.onended = () => { console.log('[ElevenLabs] Audio ended'); onEnd?.(); };
      audio.onerror = (e) => { console.error('[ElevenLabs] Playback error:', e); onEnd?.(); };
      onStart?.();
      audio.play().catch(err => {
        console.error('[ElevenLabs] audio.play() rejected:', err.message, '— falling back to TTS');
        fallback(text, { onEnd, onStart, onHalfway });
      });
    })
    .catch(err => {
      console.warn('[ElevenLabs] Generation failed, falling back to browser TTS:', err.message);
      if (!cancelled) fallback(text, { onEnd, onStart, onHalfway });
    });

  return () => {
    console.log('[ElevenLabs] Cancelled');
    cancelled = true;
    if (audio) { audio.pause(); audio = null; }
    window.speechSynthesis?.cancel();
  };
}

function fallback(text, { onEnd, onStart, onHalfway } = {}) {
  console.log('[ElevenLabs] Using browser TTS fallback');
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  utterance.onstart = () => {
    console.log('[ElevenLabs] Browser TTS started');
    onStart?.();
    // TTS doesn't expose duration, so fire onHalfway after a fixed delay.
    // Typical announcement is ~2.5–3.5s at 0.9 rate; 1.2s ≈ halfway.
    if (onHalfway) setTimeout(() => { console.log('[ElevenLabs] TTS halfway (fixed 1.2s)'); onHalfway(); }, 1200);
  };
  utterance.onend = () => { console.log('[ElevenLabs] Browser TTS ended'); onEnd?.(); };
  utterance.onerror = (e) => { console.error('[ElevenLabs] Browser TTS error:', e.error); onEnd?.(); };
  try {
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('[ElevenLabs] speechSynthesis.speak() threw:', e.message);
    onEnd?.();
  }
}
