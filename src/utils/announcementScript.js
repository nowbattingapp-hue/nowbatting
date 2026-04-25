// announcementScript.js — Script template engine for NowBatting
// Resolves a team's script template + delivery style into an ElevenLabs prompt.

// ─── Default templates ────────────────────────────────────────────────────────

export const DELIVERY_STYLES = {
  classic: 'classic',
  hype: 'hype',
};

export const DEFAULT_SCRIPT_TEMPLATE = 'Now batting... number {number}... {firstName} {lastName}!';

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
  const styled = text
    .replace(/Now batting/gi, 'Noooow batting')
    .replace(/\.\.\./g, '...  ');
  return {
    text: styled,
    voiceSettings: { stability: 0.85, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false },
  };
}

function buildHypePrompt(text) {
  let styled = text.replace(/Now batting/gi, 'NOW BATTING');

  // Stretch the last vowel of the final word before any trailing punctuation
  styled = styled.replace(/([A-Za-z]+)([^A-Za-z]*)$/, (_, word, tail) => {
    const stretched = word.replace(/([aeiouAEIOU])(?=[^aeiouAEIOU]*$)/, '$1$1$1');
    return stretched + tail;
  });

  // Ensure ends with !!
  styled = styled.replace(/!*$/, '!!');

  return {
    text: styled,
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
  };
}
