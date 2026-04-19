import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nowbatting_roster';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function useRoster() {
  const [players, setPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players]);

  const addPlayer = (playerData) => {
    const newPlayer = {
      id: generateId(),
      name: '',
      phoneticName: '',
      jerseyNumber: '',
      position: '',
      walkUpSong: null,
      customAnnouncement: null,
      ...playerData,
    };
    setPlayers(prev => [...prev, newPlayer]);
    return newPlayer.id;
  };

  const updatePlayer = (id, updates) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePlayer = (id) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const reorderPlayers = (fromIndex, toIndex) => {
    setPlayers(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  return { players, addPlayer, updatePlayer, deletePlayer, reorderPlayers };
}
