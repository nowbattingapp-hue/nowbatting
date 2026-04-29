// announcementScript.js — Script template engine for NowBatting
// Resolves a team's script template + delivery style into an ElevenLabs prompt.

// ─── Default templates ────────────────────────────────────────────────────────

export const DELIVERY_STYLES = {
  classic: 'classic',
  hype: 'hype',
};

export const DEFAULT_SCRIPT_TEMPLATE_CLASSIC = 'Now batting... Number {number}... {firstName} {lastName}.';
export const DEFAULT_SCRIPT_TEMPLATE_HYPE    = 'NOW batting... Number {number}... {firstName} {lastName}!!';
export const DEFAULT_SCRIPT_TEMPLATE = DEFAULT_SCRIPT_TEMPLATE_HYPE;

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
  const firstName = player.firstName || player.name?.split(' ')[0] || '';
  const lastName  = player.lastName  || player.name?.split(' ').slice(1).join(' ') || '';
  const map = {
    '{firstName}': player.phoneticFirst || firstName,
    '{lastName}':  player.phoneticLast  || lastName,
    '{number}':    player.number    || player.jerseyNumber || '',
    '{position}':  player.position  || '',
    '{nickname}':  player.nickname  || firstName,
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
  return {
    text,
    voiceSettings: { stability: 0.90, similarity_boost: 0.70, style: 0.0, use_speaker_boost: false },
    isSSML: false,
  };
}

function buildHypePrompt(text) {
  return {
    text,
    voiceSettings: { stability: 0.30, similarity_boost: 0.85, style: 0.80, use_speaker_boost: true },
    isSSML: false,
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

export const WALKUP_DURATIONS = [10, 15, 20, 30];
export const DEFAULT_WALKUP_DURATION = 15;

export function getDefaultAnnouncementSettings() {
  return {
    scriptTemplate: DEFAULT_SCRIPT_TEMPLATE,
    deliveryStyle: DELIVERY_STYLES.hype,
    voiceId: 'nPczCjzI2devNBz1zQrb',
    walkUpDuration: DEFAULT_WALKUP_DURATION,
  };
}
