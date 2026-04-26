// announcementScript.js — Script template engine for NowBatting
// Resolves a team's script template + delivery style into an ElevenLabs prompt.

// ─── Default templates ────────────────────────────────────────────────────────

export const DELIVERY_STYLES = {
  classic: 'classic',
  hype: 'hype',
};

export const DEFAULT_SCRIPT_TEMPLATE = 'Now batting... number {number}... {firstName} {lastName}!';

export const ANNOUNCER_VOICES = [
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    description: 'Current default · mid energy',
    emoji: '🎙️',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'Deep · warm · authoritative',
    emoji: '🏟️',
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    description: 'Big · powerful · classic',
    emoji: '📣',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Smooth · polished · ESPN',
    emoji: '⚡',
  },
];

export const AVAILABLE_VARIABLES = [
  { token: '{firstName}',  label: 'First Name' },
  { token: '{lastName}',   label: 'Last Name' },
  { token: '{number}',     label: 'Jersey Number' },
  { token: '{position}',   label: 'Position' },
  { token: '{nickname}',   label: 'Nickname' },
  { token: '{teamName}',   label: 'Team Name' },
];

// ─── Resolve template → announcement text ────────────────────────────────────

export function resolveScript(template, player, team) {
  const map = {
    '{firstName}': player.firstName || player.name?.split(' ')[0] || '',
    '{lastName}':  player.lastName  || player.name?.split(' ').slice(1).join(' ') || '',
    '{number}':    player.number    || player.jerseyNumber || '',
    '{position}':  player.position  || '',
    '{nickname}':  player.nickname  || player.firstName || player.name?.split(' ')[0] || '',
    '{teamName}':  team?.name       || '',
  };

  let script = template || DEFAULT_SCRIPT_TEMPLATE;
  Object.entries(map).forEach(([token, value]) => {
    script = script.replaceAll(token, value);
  });

  // Clean up any double spaces from empty tokens
  return script.replace(/\s{2,}/g, ' ').trim();
}

// ─── Build ElevenLabs prompt with delivery style ──────────────────────────────

export function buildAnnouncementPrompt(resolvedText, deliveryStyle) {
  if (deliveryStyle === DELIVERY_STYLES.classic) {
    return buildClassicPrompt(resolvedText);
  }
  return buildHypePrompt(resolvedText);
}

function buildClassicPrompt(text) {
  const styled = text.replace(/\.\.\./g, ', ');
  return {
    text: styled,
    voiceSettings: { stability: 0.85, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false },
  };
}

function buildHypePrompt(text) {
  // Strip trailing punctuation, then re-append the last word followed by !!
  const stripped = text.replace(/[!.,\s]+$/, '');
  const lastWord = stripped.match(/\S+$/)?.[0] ?? '';
  const base = stripped.slice(0, stripped.length - lastWord.length).trimEnd();
  const styled = (base ? base + ' ' : '') + lastWord + '!!';

  return {
    text: styled.replace(/Now batting/gi, 'NOW BATTING'),
    voiceSettings: { stability: 0.35, similarity_boost: 0.75, style: 0.8, use_speaker_boost: true },
  };
}

// ─── Team settings storage helpers ───────────────────────────────────────────

export function getTeamAnnouncementSettings(teamId) {
  try {
    const raw = localStorage.getItem(`nowbatting_announce_${teamId}`);
    return raw ? JSON.parse(raw) : getDefaultAnnouncementSettings();
  } catch {
    return getDefaultAnnouncementSettings();
  }
}

export function saveTeamAnnouncementSettings(teamId, settings) {
  localStorage.setItem(`nowbatting_announce_${teamId}`, JSON.stringify(settings));
}

export function getDefaultAnnouncementSettings() {
  return {
    scriptTemplate: DEFAULT_SCRIPT_TEMPLATE,
    deliveryStyle: DELIVERY_STYLES.hype,
    voiceId: 'nPczCjzI2devNBz1zQrb',
  };
}
