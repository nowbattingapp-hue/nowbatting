import React, { useState, useRef, useEffect } from 'react';
import { buildAnnouncementText } from '../hooks/useSpeech';
import { playWithFallback } from '../utils/elevenLabs';
import { useSpotify } from '../contexts/SpotifyContext';
import { preloadHypeSound, startHypeSound } from '../utils/hypeSound';

export default function GameDay({ players }) {
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState(null);
  const stopAnnouncementRef = useRef(null);
  const hypeSoundRef = useRef(null);
  const { startWalkUpSoft, rampWalkUpToFull, stopWalkUp, connected, isPremium, sdkReady, isIOS, primeWalkUpAudio } = useSpotify();

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
    console.log('[GameDay] startHypeSound() dispatched');
    startHypeSound(0.55).then(ctrl => {
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
      const text = buildAnnouncementText(player);
      console.log('[GameDay] announcement text:', text);
      const stop = playWithFallback(text, {
        onStart: () => setPhase('announcing'),
        onHalfway,
        onEnd,
      });
      stopAnnouncementRef.current = stop;
    }
  };

  if (players.length === 0) {
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
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {players.map((player, idx) => {
          const isActive = activeId === player.id;
          const thisIsLoading = isActive && phase === 'loading';
          const thisIsAnnouncing = isActive && phase === 'announcing';
          const thisIsWalkUp = isActive && phase === 'walkup';

          return (
            <button
              key={player.id}
              onClick={() => announce(player)}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                background: isActive ? '#1a0a0a' : '#1a1a1a',
                border: `1px solid ${isActive ? '#cc1111' : '#2a2a2a'}`,
                borderLeft: `4px solid ${thisIsWalkUp ? '#1DB954' : isActive ? '#cc1111' : '#1a3a8f'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                animation: thisIsAnnouncing ? 'pulse-red 1.2s ease infinite' : 'none',
                width: '100%',
                textAlign: 'left',
                minHeight: '68px',
                overflow: 'hidden',
              }}
            >
              {/* Jersey number */}
              <div style={{
                width: '56px',
                minHeight: '68px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: thisIsWalkUp ? '#0d2a0d' : isActive ? '#2a0000' : '#111',
                borderRight: `1px solid ${isActive ? '#cc1111' : '#222'}`,
              }}>
                <span style={{ fontFamily: "'Anton', sans-serif", fontSize: thisIsLoading ? '18px' : '28px', color: thisIsWalkUp ? '#1DB954' : isActive ? '#cc1111' : '#888', lineHeight: 1 }}>
                  {thisIsLoading ? '…' : thisIsAnnouncing ? '🔊' : thisIsWalkUp ? '🎵' : (player.jerseyNumber || idx + 1)}
                </span>
              </div>

              {/* Player info */}
              <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '22px', letterSpacing: '1px', textTransform: 'uppercase', color: isActive ? '#ffffff' : '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                  {player.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {player.position && (
                    <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#1a3a8f', background: 'rgba(26,58,143,0.15)', padding: '2px 6px', borderRadius: '2px', border: '1px solid rgba(26,58,143,0.3)' }}>
                      {player.position}
                    </span>
                  )}
                  {thisIsWalkUp && player.walkUpSong && (
                    <span style={{ fontSize: '11px', color: '#1DB954', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                      ♫ {player.walkUpSong.name}
                    </span>
                  )}
                  {!isActive && (
                    <span style={{ display: 'flex', gap: '4px', opacity: 0.4, fontSize: '12px' }}>
                      {player.customAnnouncement && '🎤'}
                      {player.walkUpSong && connected && '🎵'}
                    </span>
                  )}
                </div>
              </div>

              {/* Right indicator */}
              {isActive && (
                <div style={{ display: 'flex', alignItems: 'center', paddingRight: '14px' }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '10px', letterSpacing: '1px', color: thisIsWalkUp ? '#1DB954' : '#cc1111', textTransform: 'uppercase', animation: thisIsAnnouncing ? 'blink 0.8s ease infinite' : 'none' }}>
                    {thisIsLoading ? '...' : thisIsAnnouncing ? 'LIVE' : 'MUSIC'}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

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
