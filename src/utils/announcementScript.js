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
  // Bob Sheppard style: slow, deliberate, dignified
  // Add SSML-style pause markers that ElevenLabs respects
  // Replace "..." with longer pauses, add gravitas instructions
  const withPauses = text
    .replace(/\.\.\./g, '<break time="0.8s"/>')
    .replace(/!/g, '.');

  return `Speak in the style of Bob Sheppard, the legendary Yankee Stadium announcer.
Slow, clear, deliberate, dignified. Each word gets full weight.
Measured pace with meaningful pauses. Never rushed. Classic and timeless.

${withPauses}`;
}

function buildHypePrompt(text) {
  // ESPN/stadium hype style: energetic, punchy, exciting
  const withEnergy = text
    .replace(/\.\.\./g, '... ')
    .replace(/!$/g, '!!');

  return `Speak like an electrifying ESPN stadium announcer.
High energy, punchy, exciting. Build anticipation on the name.
The crowd is going wild. Make it feel like a big moment.

${withEnergy}`;
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
