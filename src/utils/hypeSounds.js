export const HYPE_SOUNDS = [
  { id: 'crowd', label: 'Crowd Cheer',   emoji: '🏟️', url: '/sounds/crowd_cheer.mp3' },
  { id: 'pump',  label: 'Pump Up Music', emoji: '🔥', url: '/sounds/pumpup_music.mp3' },
];

export const DEFAULT_HYPE_SOUND_ID = 'crowd';

export function getTeamHypeSound(teamId) {
  try {
    return localStorage.getItem(`nowbatting_hypesound_${teamId}`) || DEFAULT_HYPE_SOUND_ID;
  } catch {
    return DEFAULT_HYPE_SOUND_ID;
  }
}

export function saveTeamHypeSound(teamId, soundId) {
  localStorage.setItem(`nowbatting_hypesound_${teamId}`, soundId);
}
