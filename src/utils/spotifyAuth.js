const KEYS = {
  accessToken: 'sp_access_token',
  refreshToken: 'sp_refresh_token',
  expiresAt: 'sp_expires_at',
  codeVerifier: 'sp_code_verifier',
};

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function initiateLogin() {
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
  const verifier = generateRandomString(64);
  const challenge = base64urlEncode(await sha256(verifier));
  localStorage.setItem(KEYS.codeVerifier, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state',
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCodeForToken(code) {
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
  const verifier = localStorage.getItem(KEYS.codeVerifier);

  console.log('[Spotify] exchangeCodeForToken called');
  console.log('[Spotify] clientId:', clientId ? `${clientId.slice(0, 6)}…` : 'MISSING');
  console.log('[Spotify] redirectUri:', redirectUri);
  console.log('[Spotify] code:', code ? `${code.slice(0, 10)}…` : 'MISSING');
  console.log('[Spotify] verifier from localStorage:', verifier ? `${verifier.slice(0, 10)}… (length ${verifier.length})` : 'NULL — possible origin mismatch (localhost vs 127.0.0.1)');

  if (!verifier) throw new Error('Token exchange failed: code verifier missing (origin mismatch?)');

  // Remove verifier before the fetch so any accidental second call fails fast
  // rather than hitting Spotify with a spent auth code
  localStorage.removeItem(KEYS.codeVerifier);

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error('[Spotify] Token exchange failed:', res.status, errBody);
    throw new Error(`Token exchange failed: ${res.status} ${errBody.error} — ${errBody.error_description}`);
  }

  const data = await res.json();
  saveTokens(data);
  return data;
}

export async function refreshAccessToken() {
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const refreshToken = localStorage.getItem(KEYS.refreshToken);
  if (!refreshToken) return null;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) { clearTokens(); return null; }
  const data = await res.json();
  saveTokens(data);
  return data.access_token;
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(KEYS.accessToken, access_token);
  if (refresh_token) localStorage.setItem(KEYS.refreshToken, refresh_token);
  localStorage.setItem(KEYS.expiresAt, String(Date.now() + expires_in * 1000));
}

export function clearTokens() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

export function getStoredToken() {
  const token = localStorage.getItem(KEYS.accessToken);
  const expiresAt = Number(localStorage.getItem(KEYS.expiresAt));
  if (!token || Date.now() > expiresAt - 60000) return null;
  return token;
}

export function hasRefreshToken() {
  return !!localStorage.getItem(KEYS.refreshToken);
}
