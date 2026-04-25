import React, { useState, useEffect, useCallback } from 'react';
import AnnouncementPlayer from './AnnouncementPlayer';
import { useSpotify } from '../contexts/SpotifyContext';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PlayerProfile({ player, updatePlayer, deletePlayer, onBack }) {
  const [form, setForm] = useState({ ...player });
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 400);
  const { connected, search } = useSpotify();

  useEffect(() => { setForm({ ...player }); }, [player]);

  useEffect(() => {
    if (!debouncedQuery.trim() || !connected) { setSearchResults([]); return; }
    setSearching(true);
    search(debouncedQuery).then(results => {
      setSearchResults(results);
      setSearching(false);
    });
  }, [debouncedQuery, connected, search]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    updatePlayer(player.id, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm(`Remove ${player.name} from roster?`)) {
      deletePlayer(player.id);
      onBack();
    }
  };

  const handleSaveRecording = useCallback((audioData) => {
    const updates = { customAnnouncement: audioData };
    setForm(f => ({ ...f, ...updates }));
    updatePlayer(player.id, updates);
  }, [player.id, updatePlayer]);

  const handleSelectTrack = (track) => {
    const song = {
      id: track.id,
      name: track.name,
      artist: track.artists?.[0]?.name || '',
      albumArt: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || null,
      previewUrl: track.preview_url,
    };
    const updates = { walkUpSong: song };
    setForm(f => ({ ...f, ...updates }));
    updatePlayer(player.id, updates);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveSong = () => {
    const updates = { walkUpSong: null };
    setForm(f => ({ ...f, ...updates }));
    updatePlayer(player.id, updates);
  };

  const previewPlayer = { ...player, ...form };

  return (
    <div className="screen">
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h1 style={{ margin: 0, flex: 1, fontFamily: "'Anton', sans-serif", fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase', color: '#e8e8e8' }}>
          {player.name || 'Player Profile'}
        </h1>
      </div>

      {/* Name + Jersey */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
        <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="input-label">Name *</label>
          <input className="input-field" value={form.name} onChange={set('name')} placeholder="Full name" />
        </div>
        <div className="input-group" style={{ width: '80px', marginBottom: 0 }}>
          <label className="input-label"># Jersey</label>
          <input className="input-field" value={form.jerseyNumber} onChange={set('jerseyNumber')} placeholder="00" maxLength={3} />
        </div>
      </div>

      <div className="input-group" style={{ marginTop: '14px' }}>
        <label className="input-label">Phonetic Spelling <span style={{ color: '#555', textTransform: 'none', fontWeight: '400', fontFamily: 'sans-serif' }}>(for announcements)</span></label>
        <input className="input-field" value={form.phoneticName} onChange={set('phoneticName')} placeholder='e.g. "Muh-KAY-luh"' />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">Position</label>
          <input className="input-field" value={form.position || ''} onChange={set('position')} placeholder="e.g. Shortstop, Pitcher, Catcher" />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">Nickname</label>
          <input className="input-field" value={form.nickname || ''} onChange={set('nickname')} placeholder="e.g. Jakey, The Rocket, Big Mike" />
        </div>
      </div>

      {/* Announcement section */}
      <div style={{ borderTop: '1px solid #2a2a2a', margin: '20px 0', paddingTop: '20px' }}>
        <div className="section-label">Announcement</div>
        <AnnouncementPlayer player={previewPlayer} onSaveRecording={handleSaveRecording} />
      </div>

      {/* Walk-Up Song section */}
      <div style={{ borderTop: '1px solid #2a2a2a', margin: '20px 0', paddingTop: '20px' }}>
        <div className="section-label">Walk-Up Song</div>

        {!connected ? (
          <div style={{
            background: '#111',
            border: '1px dashed #333',
            borderRadius: '4px',
            padding: '16px',
            textAlign: 'center',
            color: '#555',
            fontSize: '13px',
          }}>
            Connect Spotify in Settings to search for walk-up songs
          </div>
        ) : (
          <>
            {form.walkUpSong && !showSearch && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: '#0d1f0d',
                border: '1px solid #1a4a1a',
                borderRadius: '4px', padding: '10px 12px', marginBottom: '10px',
              }}>
                {form.walkUpSong.albumArt && (
                  <img src={form.walkUpSong.albumArt} alt="" style={{ width: '44px', height: '44px', borderRadius: '6px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {form.walkUpSong.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#1DB954', marginTop: '2px' }}>{form.walkUpSong.artist}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowSearch(true)}>Change</button>
                  <button className="btn btn-sm btn-danger" onClick={handleRemoveSong}>✕</button>
                </div>
              </div>
            )}

            {(!form.walkUpSong || showSearch) && (
              <>
                <input
                  className="input-field"
                  placeholder="Search Spotify tracks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus={showSearch}
                  style={{ marginBottom: '8px' }}
                />
                {showSearch && (
                  <button className="btn btn-ghost btn-sm" style={{ marginBottom: '8px' }} onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                    Cancel
                  </button>
                )}
                {searching && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#555', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                    {searchResults.map(track => (
                      <button
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: '#1a1a1a', border: '1px solid #2a2a2a',
                          borderRadius: '4px', padding: '8px 10px',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'border-color 0.12s',
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
          </>
        )}
      </div>

      {/* Save / Delete */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button className="btn btn-primary" style={{ flex: 1, fontFamily: "'Anton', sans-serif", letterSpacing: '2px' }} onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Player'}
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}
