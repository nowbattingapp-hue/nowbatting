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
  DEFAULT_SCRIPT_TEMPLATE_CLASSIC,
  DEFAULT_SCRIPT_TEMPLATE_HYPE,
  WALKUP_DURATIONS,
  DEFAULT_WALKUP_DURATION,
} from '../utils/announcementScript';
import { generateAnnouncement } from '../utils/elevenLabs';
import { startHypeSound } from '../utils/hypeSound';
import { HYPE_SOUNDS, getTeamHypeSound, saveTeamHypeSound } from '../utils/hypeSounds';
import { getActiveTeamId } from '../utils/teamStorage';

export default function AnnouncementSettings() {
  const { activeTeam, roster } = useTeam();
  const [settings, setSettings] = useState(null);
  const [saved, setSaved]       = useState(false);
  const [previewState, setPreviewState] = useState('idle'); // idle | loading | playing | error
  const [hypeSoundId, setHypeSoundId] = useState(() => getTeamHypeSound(getActiveTeamId()));
  const previewAudioRef = useRef(null);
  const previewHypeRef = useRef(null);
  const previewCancelledRef = useRef(false);

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

  // Instant-apply: updates state AND persists to localStorage immediately.
  // Used for voice and delivery style so Preview always uses the live selection.
  function updateAndSave(changes) {
    setSettings(s => {
      const next = { ...s, ...changes };
      saveTeamAnnouncementSettings(activeTeam.id, next);
      return next;
    });
  }

  function handleSave() {
    saveTeamAnnouncementSettings(activeTeam.id, settings);
    saveTeamHypeSound(activeTeam.id, hypeSoundId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function stopPreview() {
    previewCancelledRef.current = true;
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    const hype = previewHypeRef.current;
    previewHypeRef.current = null;
    if (hype && hype !== 'loading') hype.fadeOut(1.0);
    setPreviewState('idle');
  }

  async function handleFullPreview() {
    if (previewState === 'loading' || previewState === 'playing') { stopPreview(); return; }

    previewCancelledRef.current = false;
    setPreviewState('loading');

    // Start background hype sound immediately
    const hypeSound = HYPE_SOUNDS.find(s => s.id === hypeSoundId) || HYPE_SOUNDS[0];
    previewHypeRef.current = 'loading';
    startHypeSound(0.25, hypeSound.url).then(ctrl => {
      if (previewCancelledRef.current) { ctrl?.stop(); return; }
      previewHypeRef.current = ctrl;
    });

    try {
      const scriptText = resolveScript(settings.scriptTemplate, previewPlayer, activeTeam);
      const { text, voiceSettings, isSSML } = buildAnnouncementPrompt(scriptText, settings.deliveryStyle);
      console.log('[AnnouncementSettings] Preview voice_id:', settings.voiceId, '| deliveryStyle:', settings.deliveryStyle, '| isSSML:', isSSML, '| text:', text);
      const url = await generateAnnouncement(text, voiceSettings, settings.voiceId, isSSML);

      console.log('[AnnouncementSettings] Blob URL received, cancelled:', previewCancelledRef.current);
      if (previewCancelledRef.current) {
        // User stopped while generating — hype already stopped by stopPreview()
        return;
      }

      const audio = new Audio(url);
      previewAudioRef.current = audio;

      audio.onplay = () => {
        console.log('[AnnouncementSettings] Audio started playing');
        setPreviewState('playing');
      };
      audio.onended = () => {
        console.log('[AnnouncementSettings] Audio ended — fading out hype');
        const hype = previewHypeRef.current;
        previewHypeRef.current = null;
        if (hype && hype !== 'loading') hype.fadeOut(1.5);
        setPreviewState('idle');
      };
      audio.onerror = (e) => {
        console.error('[AnnouncementSettings] Audio error:', e);
        stopPreview();
        setPreviewState('error');
      };

      console.log('[AnnouncementSettings] Calling audio.play()');
      await audio.play();
    } catch (e) {
      console.error('[AnnouncementSettings] Preview failed:', e);
      stopPreview();
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

      {/* 1. Announcer Voice */}
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
              onClick={() => updateAndSave({ voiceId: voice.id })}
            >
              <span style={styles.voiceEmoji}>{voice.emoji}</span>
              <span style={styles.voiceName}>{voice.name}</span>
              <span style={styles.voiceDesc}>{voice.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Delivery Style */}
      <div style={styles.field}>
        <label style={styles.label}>DELIVERY STYLE</label>
        <div style={styles.toggleRow}>
          <button
            style={{
              ...styles.styleBtn,
              ...(settings.deliveryStyle === DELIVERY_STYLES.classic ? styles.styleBtnActive : {}),
            }}
            onClick={() => updateAndSave({ deliveryStyle: DELIVERY_STYLES.classic, scriptTemplate: DEFAULT_SCRIPT_TEMPLATE_CLASSIC })}
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
            onClick={() => updateAndSave({ deliveryStyle: DELIVERY_STYLES.hype, scriptTemplate: DEFAULT_SCRIPT_TEMPLATE_HYPE })}
          >
            <span style={styles.styleBtnIcon}>🔥</span>
            <span style={styles.styleBtnTitle}>HYPE</span>
            <span style={styles.styleBtnSub}>ESPN Energy</span>
          </button>
        </div>
      </div>

      {/* 3. Announcement Script */}
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
        <div style={styles.previewBox}>
          <div style={styles.previewLabel}>SCRIPT PREVIEW</div>
          <div style={styles.previewText}>"{previewText}"</div>
          {roster?.length > 0 && (
            <div style={styles.previewMeta}>
              Using {previewPlayer.firstName} {previewPlayer.lastName} as example
            </div>
          )}
        </div>
      </div>

      {/* 4. Background Sound */}
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

      {/* 5. Full Preview */}
      <div style={styles.field}>
        <button
          style={{
            ...styles.previewBtn,
            ...((previewState === 'loading') ? styles.previewBtnDisabled : {}),
            ...(previewState === 'playing' ? styles.previewBtnPlaying : {}),
          }}
          onClick={handleFullPreview}
          disabled={previewState === 'loading'}
        >
          {previewState === 'loading' ? 'GENERATING...'
            : previewState === 'playing' ? '■ STOP PREVIEW'
            : previewState === 'error'   ? '⚠ TRY AGAIN'
            : '▶ PREVIEW FULL ANNOUNCEMENT'}
        </button>
      </div>

      {/* 6. Walk-Up Duration */}
      <div style={styles.field}>
        <label style={styles.label}>WALK-UP SONG DURATION</label>
        <div style={styles.toggleRow}>
          {WALKUP_DURATIONS.map(sec => {
            const isSelected = (settings.walkUpDuration ?? DEFAULT_WALKUP_DURATION) === sec;
            return (
              <button
                key={sec}
                style={{ ...styles.styleBtn, ...(isSelected ? styles.styleBtnActive : {}) }}
                onClick={() => update({ walkUpDuration: sec })}
              >
                <span style={styles.styleBtnTitle}>{sec}s</span>
              </button>
            );
          })}
        </div>
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
    padding: '20px 16px',
    fontFamily: "'Barlow', sans-serif",
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
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
    gap: 4,
    padding: '12px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#fff',
  },
  voiceCardActive: {
    background: 'rgba(200,16,46,0.1)',
    border: '1px solid #c8102e',
  },
  voiceEmoji: {
    fontSize: 18,
  },
  voiceName: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#fff',
  },
  voiceDesc: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 400,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 1.3,
    textTransform: 'none',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
  },
  styleBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '12px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#fff',
  },
  styleBtnActive: {
    background: 'rgba(200,16,46,0.1)',
    border: '1px solid #c8102e',
  },
  styleBtnIcon: {
    fontSize: 20,
  },
  styleBtnTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#fff',
  },
  styleBtnSub: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 400,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'none',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#fff',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
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
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  },
  tokenChip: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 3,
    color: '#c8102e',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '1px',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  previewBox: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '14px 16px',
    marginBottom: 20,
  },
  previewLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  previewText: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 400,
    fontSize: 16,
    color: '#fff',
    lineHeight: 1.4,
  },
  previewMeta: {
    fontFamily: "'Barlow', sans-serif",
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },
  previewBtn: {
    width: '100%',
    marginTop: 10,
    background: 'transparent',
    border: '1px solid #c8102e',
    borderRadius: 4,
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '10px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  previewBtnDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  previewBtnPlaying: {
    background: 'rgba(200,16,46,0.15)',
    borderColor: '#c8102e',
  },
  saveBtn: {
    width: '100%',
    background: '#c8102e',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
