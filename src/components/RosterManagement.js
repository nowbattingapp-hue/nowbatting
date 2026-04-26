import React, { useState, useEffect } from 'react';
import { useSpotify } from '../contexts/SpotifyContext';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function RosterManagement({ players, addPlayer, deletePlayer, onSelectPlayer }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newWalkUpSong, setNewWalkUpSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 400);
  const { connected, search } = useSpotify();

  useEffect(() => {
    if (!debouncedQuery.trim() || !connected) { setSearchResults([]); return; }
    setSearching(true);
    search(debouncedQuery).then(results => {
      setSearchResults(results);
      setSearching(false);
    });
  }, [debouncedQuery, connected, search]);

  const handleSelectTrack = (track) => {
    setNewWalkUpSong({
      id: track.id,
      name: track.name,
      artist: track.artists?.[0]?.name || '',
      albumArt: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || null,
      previewUrl: track.preview_url,
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = addPlayer({
      name: newName.trim(),
      jerseyNumber: newNumber.trim(),
      position: newPosition.trim(),
      nickname: newNickname.trim(),
      walkUpSong: newWalkUpSong,
    });
    setNewName(''); setNewNumber(''); setNewPosition(''); setNewNickname('');
    setNewWalkUpSong(null); setSearchQuery(''); setSearchResults([]);
    setShowAdd(false);
  };

  const handleCancelAdd = () => {
    setShowAdd(false);
    setNewName(''); setNewNumber(''); setNewPosition(''); setNewNickname('');
    setNewWalkUpSong(null); setSearchQuery(''); setSearchResults([]);
  };

  return (
    <div className="screen" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '22px', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffffff' }}>Roster</h1>
        <button
          onClick={showAdd ? handleCancelAdd : () => setShowAdd(true)}
          style={{ flex: '0 0 auto',
            background: showAdd ? 'transparent' : '#c8102e',
            border: showAdd ? '1px solid rgba(255,255,255,0.2)' : 'none',
            borderRadius: 0,
            color: '#ffffff',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
            fontSize: '13px',
            letterSpacing: '1.5px',
            padding: '6px 14px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {showAdd ? '✕ CANCEL' : '+ ADD PLAYER'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#1a1a1a', border: '1px solid #cc1111', borderLeft: '4px solid #cc1111', borderRadius: '4px', padding: '16px', marginBottom: '14px', animation: 'slide-up 0.15s ease' }}>
          <div className="section-label" style={{ color: '#cc1111' }}>New Player</div>
          <div className="input-group">
            <label className="input-label">Name *</label>
            <input className="input-field" placeholder="Player name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label"># Jersey</label>
              <input className="input-field" placeholder="00" value={newNumber} onChange={e => setNewNumber(e.target.value)} maxLength={3} />
            </div>
            <div className="input-group" style={{ flex: 2 }}>
              <label className="input-label">Position</label>
              <input className="input-field" placeholder="e.g. Shortstop, Pitcher, Catcher" value={newPosition} onChange={e => setNewPosition(e.target.value)} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Nickname</label>
            <input className="input-field" placeholder="e.g. Jakey, The Rocket, Big Mike" value={newNickname} onChange={e => setNewNickname(e.target.value)} />
          </div>

          {/* Walk-Up Song */}
          <div className="input-group">
            <label className="input-label">Walk-Up Song</label>
            {!connected ? (
              <div style={{ fontSize: '12px', color: '#555', padding: '8px 0' }}>
                Connect Spotify in Settings to add a walk-up song
              </div>
            ) : newWalkUpSong ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0d1f0d', border: '1px solid #1a4a1a', borderRadius: '4px', padding: '8px 10px' }}>
                {newWalkUpSong.albumArt && (
                  <img src={newWalkUpSong.albumArt} alt="" style={{ width: '36px', height: '36px', borderRadius: '4px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {newWalkUpSong.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#1DB954', marginTop: '2px' }}>{newWalkUpSong.artist}</div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => { setNewWalkUpSong(null); }}>✕</button>
              </div>
            ) : (
              <>
                <input
                  className="input-field"
                  placeholder="Search Spotify tracks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searching && (
                  <div style={{ textAlign: 'center', padding: '8px', color: '#555', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', marginTop: '6px' }}>
                    {searchResults.map(track => (
                      <button
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: '#111', border: '1px solid #2a2a2a',
                          borderRadius: '4px', padding: '8px 10px',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                        }}
                      >
                        {track.album?.images?.[2]?.url && (
                          <img src={track.album.images[2].url} alt="" style={{ width: '36px', height: '36px', borderRadius: '4px', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {track.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                            {track.artists?.[0]?.name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={handleAdd}
            style={{
              width: '100%',
              background: '#c8102e',
              border: 'none',
              borderRadius: 0,
              color: '#ffffff',
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '2px',
              padding: '12px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              marginTop: '4px',
            }}
          >
            ADD PLAYER
          </button>
        </div>
      )}

      {players.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚾</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '22px', letterSpacing: '1px', textTransform: 'uppercase', color: '#444', marginBottom: '6px' }}>No Players</div>
          <div style={{ fontSize: '13px', color: '#333' }}>Tap + Add to build your roster</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {players.map((player, idx) => (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                minHeight: '60px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              {/* Jersey number */}
              <div style={{
                width: '52px',
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: '22px',
                  color: '#ffffff',
                  lineHeight: 1,
                }}>
                  {player.jerseyNumber || idx + 1}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, padding: '10px 10px 10px 4px', minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}>
                  {player.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {player.position && (
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: '9px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      color: '#ffffff',
                      background: '#c8102e',
                      borderRadius: '3px',
                      padding: '2px 6px',
                    }}>
                      {player.position}
                    </span>
                  )}
                  {player.walkUpSong && (
                    <span style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.35)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px',
                    }}>
                      {player.walkUpSong.name}{player.walkUpSong.artist ? ` · ${player.walkUpSong.artist}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Icons + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '12px' }}>
                {player.customAnnouncement && <span style={{ fontSize: '11px', opacity: 0.35 }}>🎤</span>}
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#333' }}>
          {players.length} {players.length === 1 ? 'Player' : 'Players'} · USA ★
        </div>
      )}
    </div>
  );
}
