import React from 'react';
import { useSpotify } from '../contexts/SpotifyContext';
import { useTeam } from '../context/TeamContext';
import { initiateLogin } from '../utils/spotifyAuth';

export default function Settings({ players }) {
  const { connected, isPremium, sdkReady, disconnect } = useSpotify();
  const { updateRoster } = useTeam();

  const handleClearRoster = () => {
    if (window.confirm('Clear all roster data? This cannot be undone.')) {
      updateRoster([]);
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(players, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nowbatting-roster.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>

      {/* App stats */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #222' }}>
          <div className="section-label">App Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            {[
              ['Version', '1.0.0'],
              ['Players', players.length],
              ['Custom Recordings', players.filter(p => p.customAnnouncement).length],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#555', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>{label}</span>
                <span style={{ color: '#e8e8e8', fontFamily: "'Anton', sans-serif", fontSize: '16px', letterSpacing: '1px' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spotify */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #222' }}>
          <div className="section-label">Spotify</div>
          {connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#0d1f0d', border: '1px solid #1a4a1a', borderRadius: '4px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1DB954', display: 'inline-block' }} />
                  <span style={{ color: '#1DB954', fontWeight: '700', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Connected</span>
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginLeft: '14px' }}>
                  {isPremium ? 'Premium — full SDK playback' : 'Free account'}{sdkReady ? ' · SDK ready' : ''}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={disconnect}>
                Disconnect Spotify
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
                Connect Spotify to search and play walk-up songs. Requires a Premium account for full playback.
              </p>
              <button
                className="btn"
                style={{ width: '100%', background: '#1DB954', color: '#000', fontWeight: '800', letterSpacing: '1px' }}
                onClick={initiateLogin}
              >
                Connect Spotify
              </button>
            </div>
          )}
        </div>

        {/* Data */}
        <div style={{ padding: '14px 16px' }}>
          <div className="section-label">Data</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleExport}>
              Export Roster (JSON)
            </button>
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleClearRoster}>
              Clear All Data
            </button>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#333', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '20px' }}>
        NowBatting ★ USA ⚾
      </div>
    </div>
  );
}
