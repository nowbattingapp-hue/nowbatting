import React, { useState } from 'react';

export default function RosterManagement({ players, addPlayer, deletePlayer, onSelectPlayer }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newNickname, setNewNickname] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = addPlayer({ name: newName.trim(), jerseyNumber: newNumber.trim(), position: newPosition.trim(), nickname: newNickname.trim() });
    setNewName(''); setNewNumber(''); setNewPosition(''); setNewNickname('');
    setShowAdd(false);
    onSelectPlayer(id);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Roster</h1>
        <button className={`btn btn-sm ${showAdd ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '✕ Cancel' : '+ Add'}
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
          <button className="btn btn-primary" style={{ width: '100%', fontFamily: "'Anton', sans-serif", fontSize: '15px', letterSpacing: '2px' }} onClick={handleAdd}>Add Player</button>
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
            <div key={player.id} className="player-card" style={{ display: 'flex', alignItems: 'stretch', minHeight: '60px' }} onClick={() => onSelectPlayer(player.id)}>
              {/* Jersey number */}
              <div style={{ width: '52px', minHeight: '60px', background: '#111', borderRight: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Anton', sans-serif", fontSize: '24px', color: '#cc1111', lineHeight: 1 }}>
                  {player.jerseyNumber || idx + 1}
                </span>
              </div>
              {/* Info */}
              <div style={{ flex: 1, padding: '10px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase', color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                  {player.name}
                </div>
                {(player.position || player.phoneticName) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                    {player.position && (
                      <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#1a3a8f', background: 'rgba(26,58,143,0.15)', padding: '2px 6px', borderRadius: '2px', border: '1px solid rgba(26,58,143,0.3)' }}>
                        {player.position}
                      </span>
                    )}
                    {player.phoneticName && <span style={{ fontSize: '11px', color: '#555' }}>"{player.phoneticName}"</span>}
                  </div>
                )}
              </div>
              {/* Icons + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '12px' }}>
                {player.customAnnouncement && <span style={{ fontSize: '11px', opacity: 0.4 }}>🎤</span>}
                {player.walkUpSong && <span style={{ fontSize: '11px', opacity: 0.4 }}>🎵</span>}
                <span style={{ color: '#333', fontSize: '18px' }}>›</span>
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
