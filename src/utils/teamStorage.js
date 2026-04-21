// teamStorage.js — Multi-team data layer for NowBatting
// Wraps all localStorage operations with team scoping.
// Fully backwards-compatible: existing single-team data is migrated on first load.

const TEAMS_KEY = 'nowbatting_teams';
const ACTIVE_TEAM_KEY = 'nowbatting_active_team';
const LEGACY_ROSTER_KEY = 'nowbatting_roster'; // old single-team key

// ─── Team CRUD ────────────────────────────────────────────────────────────────

export function getAllTeams() {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllTeams(teams) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

export function createTeam(name) {
  const teams = getAllTeams();
  const newTeam = {
    id: `team_${Date.now()}`,
    name: name.trim(),
    createdAt: Date.now(),
    color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
  };
  saveAllTeams([...teams, newTeam]);
  return newTeam;
}

export function renameTeam(teamId, newName) {
  const teams = getAllTeams().map(t =>
    t.id === teamId ? { ...t, name: newName.trim() } : t
  );
  saveAllTeams(teams);
}

export function deleteTeam(teamId) {
  // Remove team metadata
  const teams = getAllTeams().filter(t => t.id !== teamId);
  saveAllTeams(teams);
  // Remove team's roster
  localStorage.removeItem(rosterKey(teamId));
  // If deleted team was active, switch to first remaining team
  if (getActiveTeamId() === teamId) {
    setActiveTeamId(teams[0]?.id ?? null);
  }
}

// ─── Active Team ──────────────────────────────────────────────────────────────

export function getActiveTeamId() {
  return localStorage.getItem(ACTIVE_TEAM_KEY);
}

export function setActiveTeamId(teamId) {
  if (teamId) {
    localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
  } else {
    localStorage.removeItem(ACTIVE_TEAM_KEY);
  }
}

export function getActiveTeam() {
  const id = getActiveTeamId();
  return getAllTeams().find(t => t.id === id) ?? null;
}

// ─── Roster (scoped per team) ─────────────────────────────────────────────────

function rosterKey(teamId) {
  return `nowbatting_roster_${teamId}`;
}

export function getRoster(teamId) {
  try {
    const raw = localStorage.getItem(rosterKey(teamId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRoster(teamId, players) {
  localStorage.setItem(rosterKey(teamId), JSON.stringify(players));
}

export function getActiveRoster() {
  const id = getActiveTeamId();
  return id ? getRoster(id) : [];
}

export function saveActiveRoster(players) {
  const id = getActiveTeamId();
  if (id) saveRoster(id, players);
}

// ─── Migration: single-team → multi-team ─────────────────────────────────────
// Call this once on app startup. Safe to call multiple times (idempotent).

export function migrateIfNeeded() {
  const teams = getAllTeams();
  const legacyRoster = localStorage.getItem(LEGACY_ROSTER_KEY);

  if (teams.length === 0) {
    // First launch or legacy user — create a default team
    const defaultTeam = createTeam('My Team');

    if (legacyRoster) {
      // Migrate existing roster into the new team
      try {
        const players = JSON.parse(legacyRoster);
        saveRoster(defaultTeam.id, players);
        localStorage.removeItem(LEGACY_ROSTER_KEY); // clean up legacy key
      } catch {
        // corrupt legacy data — just start fresh
      }
    }

    setActiveTeamId(defaultTeam.id);
    return defaultTeam;
  }

  // Ensure there's always an active team set
  if (!getActiveTeamId() || !getAllTeams().find(t => t.id === getActiveTeamId())) {
    setActiveTeamId(teams[0].id);
  }

  return null; // no migration needed
}

// ─── Palette for team color badges ───────────────────────────────────────────

const TEAM_COLORS = [
  '#C8102E', // red
  '#003087', // navy
  '#006400', // green
  '#FF8C00', // orange
  '#6A0DAD', // purple
  '#00827F', // teal
];
