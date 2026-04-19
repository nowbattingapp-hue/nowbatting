import React, { useState, useRef, useEffect } from 'react';
import { buildAnnouncementText } from '../hooks/useSpeech';
import { playWithFallback } from '../utils/elevenLabs';

export default function AnnouncementPlayer({ player, onSaveRecording }) {
  const [previewState, setPreviewState] = useState('idle'); // idle | loading | playing
  const [recording, setRecording] = useState(false);
  const [hasCustom, setHasCustom] = useState(!!player.customAnnouncement);
  const [playingCustom, setPlayingCustom] = useState(false);
  const stopPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const customAudioRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    setHasCustom(!!player.customAnnouncement);
  }, [player.customAnnouncement]);

  // Stop preview when component unmounts
  useEffect(() => () => stopPreviewRef.current?.(), []);

  const announcementText = buildAnnouncementText(player);

  const handlePreview = () => {
    if (previewState === 'playing' || previewState === 'loading') {
      stopPreviewRef.current?.();
      stopPreviewRef.current = null;
      setPreviewState('idle');
      return;
    }

    setPreviewState('loading');

    const stop = playWithFallback(announcementText, {
      onStart: () => setPreviewState('playing'),
      onEnd: () => setPreviewState('idle'),
    });
    stopPreviewRef.current = stop;
  };

  const handlePlayCustom = () => {
    if (!player.customAnnouncement) return;
    if (playingCustom && customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      setPlayingCustom(false);
      return;
    }
    const audio = new Audio(player.customAnnouncement);
    customAudioRef.current = audio;
    audio.onended = () => setPlayingCustom(false);
    audio.play();
    setPlayingCustom(true);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onSaveRecording(reader.result);
          setHasCustom(true);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setRecording(true);
    } catch {
      alert('Microphone access denied');
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleDeleteRecording = () => {
    onSaveRecording(null);
    setHasCustom(false);
  };

  const previewLabel = previewState === 'loading'
    ? '⏳ Generating…'
    : previewState === 'playing'
    ? '⏹ Stop'
    : '🔊 Preview';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Announcement text preview */}
      <div style={{
        background: '#111',
        borderRadius: '4px',
        padding: '12px 14px',
        fontSize: '14px',
        color: '#888',
        fontStyle: 'italic',
        border: '1px solid #2a2a2a',
        lineHeight: 1.5,
      }}>
        "{announcementText}"
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${previewState !== 'idle' ? 'btn-danger' : 'btn-ghost'}`}
          onClick={handlePreview}
          style={{ flex: 1 }}
          disabled={previewState === 'loading'}
        >
          {previewLabel}
        </button>

        {!recording ? (
          <button className="btn btn-sm btn-ghost" onClick={handleStartRecording} style={{ flex: 1 }}>
            🎤 Record
          </button>
        ) : (
          <button className="btn btn-sm btn-danger" onClick={handleStopRecording} style={{ flex: 1 }}>
            ⏺ Stop Rec
          </button>
        )}
      </div>

      {hasCustom && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            flex: 1,
            background: '#0d1f0d',
            border: '1px solid #1a4a1a',
            borderRadius: '4px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#1DB954',
            fontWeight: '700',
            letterSpacing: '0.5px',
          }}>
            ✓ Custom recording saved
          </div>
          <button
            className="btn btn-sm"
            onClick={handlePlayCustom}
            style={{ background: '#1DB954', color: '#000', minWidth: '60px' }}
          >
            {playingCustom ? '⏹' : '▶ Play'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDeleteRecording}>✕</button>
        </div>
      )}
    </div>
  );
}
