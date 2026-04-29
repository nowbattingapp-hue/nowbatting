// TeamSwitcher.jsx — Header team selector for NowBatting
// Fits into the existing American hype theme with Anton font.
// Shows current team name, tap to open panel for switching/adding/renaming teams.

import React, { useState, useRef, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';

export default function TeamSwitcher() {
  const { teams, activeTeam, switchTeam, addTeam, editTeamName, removeTeam } = useTeam();
  const [open, setOpen]         = useState(false);
  const [adding, setAdding]     = useState(false);
  const [newName, setNewName]   = useState('');
  const [editing, setEditing]   = useState(null); // teamId being renamed
  const [editName, setEditName] = useState('');
  const panelRef                = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setAdding(false);
        setEditing(null);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleAdd() {
    if (!newName.trim()) return;
    addTeam(newName.trim());
    setNewName('');
    setAdding(false);
    setOpen(false);
  }

  function handleRename(teamId) {
    if (!editName.trim()) return;
    editTeamName(teamId, editName.trim());
    setEditing(null);
  }

  function handleDelete(teamId) {
    if (teams.length === 1) {
      alert("You need at least one team.");
      return;
    }
    if (window.confirm(`Delete "${teams.find(t => t.id === teamId)?.name}"? This also deletes the roster.`)) {
      removeTeam(teamId);
    }
  }

  return (
    <div style={styles.wrapper} ref={panelRef}>
      {/* Trigger button */}
      <button
        style={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-label="Switch team"
      >
        <span style={styles.teamName}>{activeTeam?.name ?? 'Select Team'}</span>
        <span style={styles.caret}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>MY TEAMS</div>

          {teams.map(team => (
            <div key={team.id} style={styles.teamRow}>
              {editing === team.id ? (
                // Inline rename input
                <div style={styles.editRow}>
                  <input
                    style={styles.input}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(team.id);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    autoFocus
                    maxLength={30}
                  />
                  <button style={styles.saveBtn} onClick={() => handleRename(team.id)}>✓</button>
                  <button style={styles.cancelBtn} onClick={() => setEditing(null)}>✕</button>
                </div>
              ) : (
                <>
                  <button
                    style={{
                      ...styles.teamSelectBtn,
                      ...(activeTeam?.id === team.id ? styles.activeTeamBtn : {}),
                    }}
                    onClick={() => { switchTeam(team.id); setOpen(false); }}
                  >
                    <span style={{ ...styles.dot, background: team.color }} />
                    <span style={styles.teamBtnName}>{team.name}</span>
                    {activeTeam?.id === team.id && <span style={styles.checkmark}>✓</span>}
                  </button>
                  <button
                    style={styles.iconBtn}
                    title="Rename"
                    onClick={() => { setEditing(team.id); setEditName(team.name); }}
                  >✏️</button>
                  <button
                    style={styles.iconBtn}
                    title="Delete"
                    onClick={() => handleDelete(team.id)}
                  >🗑️</button>
                </>
              )}
            </div>
          ))}

          {/* Add new team */}
          {adding ? (
            <div style={styles.addRow}>
              <input
                style={styles.input}
                placeholder="Team name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                }}
                autoFocus
                maxLength={30}
              />
              <button style={styles.saveBtn} onClick={handleAdd}>Add</button>
              <button style={styles.cancelBtn} onClick={() => { setAdding(false); setNewName(''); }}>✕</button>
            </div>
          ) : (
            <button style={styles.addTeamBtn} onClick={() => setAdding(true)}>
              + New Team
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Tuned for the existing dark/red NowBatting hype theme

const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
    flex: '0 0 auto',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#c8102e',
    border: 'none',
    borderRadius: 4,
    padding: '6px 14px',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    minWidth: 80,
    maxWidth: 160,
    transition: 'background 0.15s',
  },
  teamName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  caret: {
    fontSize: 8,
    opacity: 0.7,
    flexShrink: 0,
  },
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    zIndex: 1000,
    minWidth: 220,
    background: '#13172b',
    border: '1px solid rgba(200,16,46,0.5)',
    borderRadius: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '8px 14px 6px',
    fontSize: 10,
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  teamRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 6px',
  },
  teamSelectBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '9px 8px',
    cursor: 'pointer',
    borderRadius: 4,
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  activeTeamBtn: {
    background: 'rgba(200,16,46,0.15)',
    color: '#fff',
  },
  teamBtnName: {
    flex: 1,
  },
  checkmark: {
    color: '#C8102E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 5px',
    opacity: 0.5,
    borderRadius: 4,
    transition: 'opacity 0.15s',
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    padding: '4px 0',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 10px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: '#fff',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    padding: '5px 8px',
    outline: 'none',
  },
  saveBtn: {
    background: '#c8102e',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 12,
    padding: '5px 10px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: '#aaa',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 12,
    padding: '5px 8px',
    cursor: 'pointer',
  },
  addTeamBtn: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    color: '#c8102e',
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    padding: '11px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
};
