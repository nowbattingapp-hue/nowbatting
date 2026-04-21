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
        <span style={{ ...styles.dot, background: activeTeam?.color ?? '#C8102E' }} />
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
    fontFamily: "'Anton', impact, sans-serif",
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    color: '#fff',
    fontSize: 16,
    letterSpacing: '0.04em',
    transition: 'background 0.15s',
    minWidth: 160,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  teamName: {
    flex: 1,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  caret: {
    fontSize: 10,
    opacity: 0.7,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    minWidth: 240,
    background: '#1a1a2e',
    border: '1.5px solid rgba(200,16,46,0.5)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '8px 14px 6px',
    fontSize: 11,
    letterSpacing: '0.12em',
    color: '#C8102E',
    fontFamily: "'Anton', impact, sans-serif",
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
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 15,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '9px 8px',
    cursor: 'pointer',
    borderRadius: 6,
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
    borderRadius: 5,
    color: '#fff',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 14,
    padding: '5px 8px',
    outline: 'none',
    letterSpacing: '0.04em',
  },
  saveBtn: {
    background: '#C8102E',
    border: 'none',
    borderRadius: 5,
    color: '#fff',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 12,
    padding: '5px 10px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 5,
    color: '#aaa',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 12,
    padding: '5px 8px',
    cursor: 'pointer',
  },
  addTeamBtn: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    color: '#C8102E',
    fontFamily: "'Anton', impact, sans-serif",
    fontSize: 14,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '11px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
};
