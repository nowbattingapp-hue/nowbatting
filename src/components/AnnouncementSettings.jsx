// AnnouncementSettings.jsx — Script template + delivery style editor
// Add this to your team Settings page.
// Matches NowBatting's Anton font / dark red hype theme.

import React, { useState, useEffect, useRef } from 'react';
import { useTeam } from '../context/TeamContext';
import {
  getTeamAnnouncementSettings,
  saveTeamAnnouncementSettings,
  resolveScript,
  buildAnnouncementPrompt,
  AVAILABLE_VARIABLES,
  ANNOUNCER_VOICES,
  DELIVERY_STYLES,
  DEFAULT_SCRIPT_TEMPLATE,
} from '../utils/announcementScript';
import { generateAnnouncement } from '../utils/elevenLabs';
import { HYPE_SOUNDS, getTeamHypeSound, saveTeamHypeSound } from '../utils/hypeSounds';
import { getActiveTeamId } from '../utils/teamStorage';

export default function AnnouncementSettings() {
  const { activeTeam, roster } = useTeam();
  const [settings, setSettings] = useState(null);
  const [saved, setSaved]       = useState(false);
  const [previewState, setPreviewState] = useState('idle'); // idle | loading | error
  const [hypeSoundId, setHypeSoundId] = useState(() => getTeamHypeSound(getActiveTeamId()));
  const previewAudioRef = useRef(null);

  useEffect(() => {
    if (activeTeam) {
      setSettings(getTeamAnnouncementSettings(activeTeam.id));
    }
  }, [activeTeam]);

  if (!settings || !activeTeam) return null;

  function update(changes) {
    setSettings(s => ({ ...s, ...changes }));
    setSaved(false);
  }

  function handleSave() {
    saveTeamAnnouncementSettings(activeTeam.id, settings);
    saveTeamHypeSound(activeTeam.id, hypeSoundId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleVoicePreview() {
    if (previewState === 'loading') return;
    previewAudioRef.current?.pause();
    setPreviewState('loading');
    try {
      const scriptText = resolveScript(settings.scriptTemplate, previewPlayer, activeTeam);
      const { text, voiceSettings } = buildAnnouncementPrompt(scriptText, settings.deliveryStyle);
      const url = await generateAnnouncement(text, voiceSettings, settings.voiceId);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewState('idle');
      audio.onerror = () => setPreviewState('error');
      audio.play();
      setPreviewState('idle');
    } catch {
      setPreviewState('error');
    }
  }

  function insertToken(token) {
    update({ scriptTemplate: (settings.scriptTemplate || '') + token });
  }

  // Preview using first roster player, or a dummy player
  const previewPlayer = roster?.[0] || {
    firstName: 'Jake',
    lastName: 'Miller',
    number: '7',
    position: 'Shortstop',
    nickname: 'Jakey',
  };
  const previewText = resolveScript(settings.scriptTemplate, previewPlayer, activeTeam);

  return (
    <div style={styles.container}>
      <div style={styles.sectionTitle}>ANNOUNCEMENT SETTINGS</div>

      {/* Voice Selector */}
      <div style={styles.field}>
        <label style={styles.label}>ANNOUNCER VOICE</label>
        <div style={styles.voiceGrid}>
          {ANNOUNCER_VOICES.map(voice => (
            <button
              key={voice.id}
              style={{
                ...styles.voiceCard,
                ...(settings.voiceId === voice.id ? styles.voiceCardActive : {}),
              }}
              onClick={() => update({ voiceId: voice.id })}
            >
              <span style={styles.voiceEmoji}>{voice.emoji}</span>
              <span style={styles.voiceName}>{voice.name}</span>
              <span style={styles.voiceDesc}>{voice.description}</span>
            </button>
          ))}
        </div>
        <button
          style={{
            ...styles.previewBtn,
            ...(previewState === 'loading' ? styles.previewBtnDisabled : {}),
          }}
          onClick={handleVoicePreview}
          disabled={previewState === 'loading'}
        >
          {previewState === 'loading' ? 'GENERATING...' : previewState === 'error' ? '⚠ TRY AGAIN' : '▶ PREVIEW VOICE'}
        </button>
      </div>

      {/* Background Sound Selector */}
      <div style={styles.field}>
        <label style={styles.label}>BACKGROUND SOUND</label>
        <div style={styles.toggleRow}>
          {HYPE_SOUNDS.map(sound => (
            <button
              key={sound.id}
              style={{
                ...styles.styleBtn,
                ...(hypeSoundId === sound.id ? styles.styleBtnActive : {}),
              }}
              onClick={() => {
                setHypeSoundId(sound.id);
                saveTeamHypeSound(activeTeam.id, sound.id);
              }}
            >
              <span style={styles.styleBtnIcon}>{sound.emoji}</span>
              <span style={styles.styleBtnTitle}>{sound.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Style Toggle */}
      <div style={styles.field}>
        <label style={styles.label}>DELIVERY STYLE</label>
        <div style={styles.toggleRow}>
          <button
            style={{
              ...styles.styleBtn,
              ...(settings.deliveryStyle === DELIVERY_STYLES.classic ? styles.styleBtnActive : {}),
            }}
            onClick={() => update({ deliveryStyle: DELIVERY_STYLES.classic })}
          >
            <span style={styles.styleBtnIcon}>🎩</span>
            <span style={styles.styleBtnTitle}>CLASSIC</span>
            <span style={styles.styleBtnSub}>Bob Sheppard</span>
          </button>
          <button
            style={{
              ...styles.styleBtn,
              ...(settings.deliveryStyle === DELIVERY_STYLES.hype ? styles.styleBtnActive : {}),
            }}
            onClick={() => update({ deliveryStyle: DELIVERY_STYLES.hype })}
          >
            <span style={styles.styleBtnIcon}>🔥</span>
            <span style={styles.styleBtnTitle}>HYPE</span>
            <span style={styles.styleBtnSub}>ESPN Energy</span>
          </button>
        </div>
      </div>

      {/* Script Template */}
      <div style={styles.field}>
        <label style={styles.label}>ANNOUNCEMENT SCRIPT</label>
        <textarea
          style={styles.textarea}
          value={settings.scriptTemplate}
          onChange={e => update({ scriptTemplate: e.target.value })}
          placeholder={DEFAULT_SCRIPT_TEMPLATE}
          rows={3}
          spellCheck={false}
        />

        {/* Variable chips */}
        <div style={styles.tokenRow}>
          <span style={styles.tokenLabel}>INSERT:</span>
          {AVAILABLE_VARIABLES.map(v => (
            <button
              key={v.token}
              style={styles.tokenChip}
              onClick={() => insertToken(v.token)}
              title={`Insert ${v.label}`}
            >
              {v.token}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div style={styles.previewBox}>
        <div style={styles.previewLabel}>PREVIEW</div>
        <div style={styles.previewText}>"{previewText}"</div>
        {roster?.length > 0 && (
          <div style={styles.previewMeta}>
            Using {previewPlayer.firstName} {previewPlayer.lastName} as example
          </div>
        )}
      </div>

      {/* Save */}
      <button style={styles.saveBtn} onClick={handleSave}>
        {saved ? '✓ SAVED!' : 'SAVE SETTINGS'}
      </button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: '20px 0',
    fontFamily: "'Anton', impact, sans-serif",
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: '0.14em',
    color: '#C8102E',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  voiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  voiceCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '10px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#fff',
  },
  voiceCardActive: {
    background: 'rgba(200,16,46,0.2)',
    border: '1.5px solid #C8102E',
  },
  voiceEmoji: {
    fontSize: 20,
  },
  voiceName: {
    fontSize: 13,
    letterSpacing: '0.08em',
    color: '#fff',
  },
  voiceDesc: {
    fontSize: 9,
    letterSpacing: '0.03em',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'sans-serif',
    fontWeight: 400,
    textTransform: 'none',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  toggleRow: {
    display: 'flex',
    gap: 10,
  },
  styleBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '12px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#fff',
  },
  styleBtnActive: {
    background: 'rgba(200,16,46,0.2)',
    border: '1.5px solid #C8102E',
  },
  styleBtnIcon: {
    fontSize: 22,
  },
  styleBtnTitle: {
    fontSize: 14,
    letterSpacing: '0.08em',
    color: '#fff',
  },
  styleBtnSub: {
    fontSize: 10,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'sans-serif',
    fontWeight: 400,
    textTransform: 'none',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#fff',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 15,
    letterSpacing: '0.04em',
    padding: '10px 12px',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  tokenRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.35)',
  },
  tokenChip: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    color: '#C8102E',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 11,
    letterSpacing: '0.04em',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  previewBox: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 10,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  previewText: {
    fontSize: 17,
    color: '#fff',
    letterSpacing: '0.03em',
    lineHeight: 1.4,
  },
  previewMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
    fontFamily: 'sans-serif',
    fontWeight: 400,
  },
  previewBtn: {
    width: '100%',
    marginTop: 10,
    background: 'transparent',
    border: '1.5px solid #C8102E',
    borderRadius: 10,
    color: '#fff',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 15,
    letterSpacing: '0.1em',
    padding: '12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  previewBtnDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  saveBtn: {
    width: '100%',
    background: '#C8102E',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 16,
    letterSpacing: '0.1em',
    padding: '14px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
