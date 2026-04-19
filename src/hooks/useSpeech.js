import { useState, useCallback, useRef } from 'react';

export function buildAnnouncementText(player) {
  const displayName = player.phoneticName?.trim() || player.name?.trim();
  const num = player.jerseyNumber?.trim();
  if (num) {
    return `Now batting, number ${num}, ${displayName}!`;
  }
  return `Now batting, ${displayName}!`;
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}
