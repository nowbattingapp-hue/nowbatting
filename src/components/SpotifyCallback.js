import { useEffect, useRef, useState } from 'react';
import { exchangeCodeForToken } from '../utils/spotifyAuth';
import { useSpotify } from '../contexts/SpotifyContext';

export default function SpotifyCallback({ onDone }) {
  const [status, setStatus] = useState('Connecting to Spotify...');
  const { onTokensReceived } = useSpotify();
  const didExchange = useRef(false);

  useEffect(() => {
    // StrictMode mounts twice in development — guard against double execution
    if (didExchange.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('Spotify login cancelled.');
      setTimeout(onDone, 1500);
      return;
    }

    if (!code) {
      setStatus('No auth code found.');
      setTimeout(onDone, 1500);
      return;
    }

    // Mark as in-progress and strip the code from the URL immediately
    // so a reload or second render can't reuse it
    didExchange.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    console.log('[Spotify] Callback received. code:', `${code.slice(0, 10)}…`);
    console.log('[Spotify] Current origin:', window.location.origin);

    exchangeCodeForToken(code)
      .then(data => {
        onTokensReceived(data.access_token);
        setStatus('Connected! Redirecting...');
        setTimeout(onDone, 800);
      })
      .catch((err) => {
        console.error('[Spotify] Callback error:', err.message);
        setStatus(`Connection failed: ${err.message}`);
        setTimeout(onDone, 4000);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      gap: '16px',
    }}>
      <div style={{ fontSize: '48px' }}>🎵</div>
      <div style={{ fontSize: '18px', fontWeight: '700' }}>{status}</div>
    </div>
  );
}
