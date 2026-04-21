// TeamContext.jsx — Global team state for NowBatting
// Wrap your App in <TeamProvider> and use useTeam() anywhere.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAllTeams,
  getActiveTeam,
  getActiveTeamId,
  setActiveTeamId,
  createTeam,
  renameTeam,
  deleteTeam,
  getActiveRoster,
  saveActiveRoster,
  migrateIfNeeded,
} from '../utils/teamStorage';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const [teams, setTeams]           = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [roster, setRoster]         = useState([]);
  const [ready, setReady]           = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    migrateIfNeeded();
    refresh();
    setReady(true);
  }, []);

  const refresh = useCallback(() => {
    setTeams(getAllTeams());
    setActiveTeam(getActiveTeam());
    setRoster(getActiveRoster());
  }, []);

  // ── Team actions ───────────────────────────────────────────────────────────
  const switchTeam = useCallback((teamId) => {
    setActiveTeamId(teamId);
    refresh();
  }, [refresh]);

  const addTeam = useCallback((name) => {
    const team = createTeam(name);
    setActiveTeamId(team.id);
    refresh();
    return team;
  }, [refresh]);

  const editTeamName = useCallback((teamId, newName) => {
    renameTeam(teamId, newName);
    refresh();
  }, [refresh]);

  const removeTeam = useCallback((teamId) => {
    deleteTeam(teamId);
    refresh();
  }, [refresh]);

  // ── Roster actions (scoped to active team) ─────────────────────────────────
  const updateRoster = useCallback((players) => {
    saveActiveRoster(players);
    setRoster(players);
  }, []);

  const addPlayer = useCallback((player) => {
    const next = [...roster, { ...player, id: `player_${Date.now()}` }];
    updateRoster(next);
  }, [roster, updateRoster]);

  const updatePlayer = useCallback((playerId, changes) => {
    const next = roster.map(p => p.id === playerId ? { ...p, ...changes } : p);
    updateRoster(next);
  }, [roster, updateRoster]);

  const removePlayer = useCallback((playerId) => {
    const next = roster.filter(p => p.id !== playerId);
    updateRoster(next);
  }, [roster, updateRoster]);

  const value = {
    // state
    teams,
    activeTeam,
    activeTeamId: getActiveTeamId(),
    roster,
    ready,
    // team actions
    switchTeam,
    addTeam,
    editTeamName,
    removeTeam,
    // roster actions
    updateRoster,
    addPlayer,
    updatePlayer,
    removePlayer,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside <TeamProvider>');
  return ctx;
}
