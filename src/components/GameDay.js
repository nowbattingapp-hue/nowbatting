import React, { useState, useRef, useEffect } from 'react';
import { buildAnnouncementText } from '../hooks/useSpeech';
import { playWithFallback } from '../utils/elevenLabs';
import { useSpotify } from '../contexts/SpotifyContext';
import { preloadHypeSound, startHypeSound } from '../utils/hypeSound';
import { HYPE_SOUNDS, getTeamHypeSound } from '../utils/hypeSounds';
import { useTeam } from '../context/TeamContext';
import { getActiveTeamId } from '../utils/teamStorage';
import { getTeamAnnouncementSettings, resolveScript, buildAnnouncementPrompt } from '../utils/announcementScript';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePlayerRow({ player, idx, announce, activeId, phase, connected, dragOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const isActive = activeId === player.id;
  const thisIsLoading = isActive && phase === 'loading';
  const thisIsAnnouncing = isActive && phase === 'announcing';
  const thisIsWalkUp = isActive && phase === 'walkup';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const accentColor = idx % 2 === 0 ? '#c8102e' : '#4a90d9';
  const activeBorderColor = thisIsWalkUp ? '#1DB954' : '#c8102e';

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: isActive ? 'rgba(200,16,46,0.1)' : 'rgba(255,255,255,0.04)',
          borderLeft: `3px solid ${isActive ? activeBorderColor : accentColor}`,
          borderRadius: '0 6px 6px 0',
          transition: 'background 0.15s',
          animation: thisIsAnnouncing ? 'pulse-red 1.2s ease infinite' : 'none',
          minHeight: '60px',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            width: '28px',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'grab',
            color: 'rgba(255,255,255,0.2)',
            fontSize: '12px',
            touchAction: 'none',
          }}
        >
          ☰
        </div>

        {/* Jersey number */}
        <div style={{
          width: '40px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            color: thisIsWalkUp ? '#1DB954' : isActive ? '#c8102e' : '#ffffff',
            lineHeight: 1,
          }}>
            {thisIsLoading ? '…' : thisIsAnnouncing ? '🔊' : thisIsWalkUp ? '🎵' : (player.jerseyNumber || idx + 1)}
          </span>
        </div>

        {/* Player info */}
        <div style={{ flex: 1, padding: '10px 10px 10px 6px', minWidth: 0 }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
            fontSize: '14px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}>
            {player.name}
          </div>
          {player.walkUpSong && !thisIsWalkUp && (
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: '10px',
              color: 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '2px',
            }}>
              {player.walkUpSong.name}{player.walkUpSong.artist ? ` · ${player.walkUpSong.artist}` : ''}
            </div>
          )}
          {thisIsWalkUp && player.walkUpSong && (
            <div style={{ fontSize: '10px', color: '#1DB954', marginTop: '2px', fontFamily: "'Barlow', sans-serif" }}>
              ♫ {player.walkUpSong.name}
            </div>
          )}
        </div>

        {/* Play / Stop button */}
        <div style={{ paddingRight: '10px', flexShrink: 0 }}>
          <button
            onClick={() => announce(player)}
            style={{
              background: '#c8102e',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: '10px',
              letterSpacing: '1px',
              padding: '5px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isActive ? '■ STOP' : '▶ PLAY'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GameDay({ players }) {
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState(null);
  const stopAnnouncementRef = useRef(null);
  const hypeSoundRef = useRef(null);
  const { startWalkUpSoft, rampWalkUpToFull, stopWalkUp, connected, isPremium, sdkReady, isIOS, primeWalkUpAudio } = useSpotify();
  const { activeTeam } = useTeam();

  // ── Lineup order ─────────────────────────────────────────────────────────────
  const orderKey = `gameday_order_${getActiveTeamId()}`;
  const [orderedIds, setOrderedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(orderKey);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Derive display order: saved order first, then any new players appended
  const orderedPlayers = orderedIds
    ? [
        ...orderedIds.map(id => players.find(p => p.id === id)).filter(Boolean),
        ...players.filter(p => !orderedIds.includes(p.id)),
      ]
    : players;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedPlayers.findIndex(p => p.id === active.id);
    const newIndex = orderedPlayers.findIndex(p => p.id === over.id);
    const newOrder = arrayMove(orderedPlayers, oldIndex, newIndex).map(p => p.id);
    setOrderedIds(newOrder);
    localStorage.setItem(orderKey, JSON.stringify(newOrder));
  }

  // Warm up the hype sound bytes as soon as the Game Day tab is shown
  useEffect(() => { preloadHypeSound(); }, []);

  function stopEverything() {
    stopAnnouncementRef.current?.();
    stopAnnouncementRef.current = null;
    // 'loading' is a sentinel meaning "fetch in flight"; the .then() below checks for null
    const hype = hypeSoundRef.current;
    hypeSoundRef.current = null;
    if (hype && hype !== 'loading') hype.stop();
    stopWalkUp();
    setActiveId(null);
    setPhase(null);
  }

  const announce = (player) => {
    console.log('[GameDay] announce() — player:', player.name, '| isIOS:', isIOS, '| walkUpSong:', player.walkUpSong?.name ?? 'none', '| previewUrl:', player.walkUpSong?.previewUrl ? 'YES' : 'none', '| customAnnouncement:', player.customAnnouncement ? 'YES' : 'no');
    if (activeId === player.id) { stopEverything(); return; }
    stopEverything();
    setActiveId(player.id);

    // On iOS, pre-unlock the walk-up audio element RIGHT NOW while we're still
    // inside the synchronous user-gesture call stack. iOS blocks audio.play()
    // called from async callbacks (like onHalfway via timeupdate).
    if (player.walkUpSong) {
      console.log('[GameDay] calling primeWalkUpAudio for:', player.walkUpSong.name);
      primeWalkUpAudio(player.walkUpSong);
    }

    // Mark as loading before the async call so stopEverything can signal cancellation.
    // The .then() below checks: if hypeSoundRef.current is null, stopEverything() ran
    // while we were loading — kill the ctrl immediately instead of playing it.
    hypeSoundRef.current = 'loading';
    const soundId = getTeamHypeSound(getActiveTeamId());
    const hypeSound = HYPE_SOUNDS.find(s => s.id === soundId) || HYPE_SOUNDS[0];
    console.log('[GameDay] startHypeSound() dispatched, sound:', hypeSound.id);
    startHypeSound(0.25, hypeSound.url).then(ctrl => {
      console.log('[GameDay] startHypeSound() resolved, ctrl:', ctrl ? 'OK' : 'null', '| ref:', hypeSoundRef.current);
      if (hypeSoundRef.current === null) {
        // stopEverything() fired while we were loading
        ctrl?.stop();
        return;
      }
      hypeSoundRef.current = ctrl;
    });

    // Halfway through announcement: walk-up song sneaks in, hype fades out
    const onHalfway = () => {
      console.log('[GameDay] onHalfway — hype ref:', hypeSoundRef.current === 'loading' ? 'still loading' : hypeSoundRef.current ? 'ready' : 'null');
      if (player.walkUpSong) {
        console.log('[GameDay] starting walk-up soft:', player.walkUpSong.name);
        startWalkUpSoft(player.walkUpSong);
      }
      const hype = hypeSoundRef.current;
      hypeSoundRef.current = null;
      if (hype && hype !== 'loading') hype.fadeOut(1.5);
    };

    // Announcement ends: ramp walk-up to full (hype already gone by now)
    const onEnd = () => {
      console.log('[GameDay] onEnd — hype ref:', hypeSoundRef.current === 'loading' ? 'still loading' : hypeSoundRef.current ? 'ready' : 'null');
      // Ensure hype is gone even if onHalfway never fired
      const hype = hypeSoundRef.current;
      hypeSoundRef.current = null;
      if (hype && hype !== 'loading') hype.stop();
      if (player.walkUpSong) {
        setPhase('walkup');
        rampWalkUpToFull(2);
      } else {
        setActiveId(null);
        setPhase(null);
      }
    };

    if (player.customAnnouncement) {
      console.log('[GameDay] using custom announcement recording');
      setPhase('announcing');
      const audio = new Audio(player.customAnnouncement);

      // Halfway detection for custom recording
      let halfwayFired = false;
      audio.addEventListener('timeupdate', () => {
        if (!halfwayFired && audio.duration > 0 && audio.currentTime / audio.duration >= 0.5) {
          halfwayFired = true;
          onHalfway();
        }
      });

      audio.onended = onEnd;
      audio.onerror = () => { stopEverything(); };
      audio.play().catch(() => { stopEverything(); });
      stopAnnouncementRef.current = () => { audio.pause(); };
    } else {
      console.log('[GameDay] calling playWithFallback (ElevenLabs)');
      setPhase('loading');
      const teamId = getActiveTeamId();
      const announceSettings = getTeamAnnouncementSettings(teamId);
      const scriptText = resolveScript(announceSettings.scriptTemplate, player, activeTeam);
      const { text, voiceSettings } = buildAnnouncementPrompt(scriptText, announceSettings.deliveryStyle);
      const { voiceId } = announceSettings;
      console.log('[GameDay] announcement text:', text);
      const stop = playWithFallback(text, {
        onStart: () => setPhase('announcing'),
        onHalfway,
        onEnd,
        voiceSettings,
        voiceId,
      });
      stopAnnouncementRef.current = stop;
    }
  };

  if (orderedPlayers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚾</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '28px', letterSpacing: '2px', textTransform: 'uppercase', color: '#e8e8e8', marginBottom: '8px' }}>No Players Yet</div>
        <div style={{ color: '#555', fontSize: '14px' }}>Add players in the Roster tab</div>
      </div>
    );
  }

  const activePlayer = players.find(p => p.id === activeId);
  const isAnnouncing = phase === 'announcing';
  const isWalkUp = phase === 'walkup';
  const isLoading = phase === 'loading';

  return (
    <div>
      {/* NOW BATTING banner */}
      {activePlayer && (
        <div style={{
          background: isWalkUp ? '#0d2a0d' : '#cc1111',
          borderBottom: isWalkUp ? '3px solid #1DB954' : '3px solid #8a0000',
          padding: '14px 16px 12px',
          textAlign: 'center',
          animation: 'slide-up 0.15s ease',
        }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '11px', letterSpacing: '4px', color: isWalkUp ? '#1DB954' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
            {isLoading ? '● GENERATING' : isAnnouncing ? '● LIVE' : '♫ WALK-UP'}
          </div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '32px', letterSpacing: '2px', color: '#ffffff', textTransform: 'uppercase', lineHeight: 1, animation: isAnnouncing ? 'blink 1s ease infinite' : 'none' }}>
            {isLoading ? 'Now Batting...' : 'Now Batting'}
          </div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '22px', letterSpacing: '1px', color: isWalkUp ? '#1DB954' : 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginTop: '2px' }}>
            {activePlayer.jerseyNumber ? `#${activePlayer.jerseyNumber} ` : ''}{activePlayer.name}
          </div>
        </div>
      )}

      {/* Spotify status */}
      {connected && (
        <div style={{ padding: '8px 16px', background: '#0f0f0f', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sdkReady || isIOS ? '#1DB954' : '#ffd700', display: 'inline-block', animation: sdkReady || isIOS ? 'none' : 'blink 1.5s ease infinite' }} />
          <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: sdkReady ? '#1DB954' : isIOS ? '#1DB954' : '#888' }}>
            {sdkReady ? 'Spotify Ready' : isIOS ? 'Spotify — Preview Mode' : isPremium ? 'Spotify Connecting…' : 'Spotify — Premium Required'}
          </span>
        </div>
      )}

      {/* Tap instruction when idle */}
      {!activePlayer && (
        <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase', color: '#e8e8e8' }}>Lineup</span>
          <span style={{ fontSize: '11px', color: '#444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Tap to announce</span>
        </div>
      )}

      {/* Player list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedPlayers.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {orderedPlayers.map((player, idx) => (
              <SortablePlayerRow
                key={player.id}
                player={player}
                idx={idx}
                announce={announce}
                activeId={activeId}
                phase={phase}
                connected={connected}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Stop button */}
      {activeId && (
        <div style={{ padding: '10px 12px 0' }}>
          <button className="btn btn-danger" style={{ width: '100%', letterSpacing: '2px', fontFamily: "'Anton', sans-serif", fontSize: '14px' }} onClick={stopEverything}>
            ⏹ STOP
          </button>
        </div>
      )}
    </div>
  );
}
