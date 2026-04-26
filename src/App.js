import React, { useState } from 'react';
import './App.css';
import { useTeam } from './context/TeamContext';
import { SpotifyProvider } from './contexts/SpotifyContext';
import { TeamProvider } from './context/TeamContext';
import SpotifyCallback from './components/SpotifyCallback';
import RosterManagement from './components/RosterManagement';
import PlayerProfile from './components/PlayerProfile';
import GameDay from './components/GameDay';
import Settings from './components/Settings';
import TeamSwitcher from './components/TeamSwitcher';

const TABS = [
  { id: 'gameday', label: 'Game Day', icon: '⚾' },
  { id: 'roster', label: 'Roster', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function AppInner() {
  const [activeTab, setActiveTab] = useState('gameday');
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [isCallback, setIsCallback] = useState(window.location.pathname === '/callback');
  const { roster: players, addPlayer, updatePlayer, removePlayer: deletePlayer, activeTeam } = useTeam();

  if (isCallback) {
    return (
      <SpotifyCallback onDone={() => {
        window.history.replaceState({}, '', '/');
        setIsCallback(false);
      }} />
    );
  }

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  const handleSelectPlayer = (id) => {
    setSelectedPlayerId(id);
    setActiveTab('profile');
  };

  const handleBackFromProfile = () => {
    setSelectedPlayerId(null);
    setActiveTab('roster');
  };

  const renderContent = () => {
    if (activeTab === 'profile' && selectedPlayer) {
      return (
        <PlayerProfile
          player={selectedPlayer}
          updatePlayer={updatePlayer}
          deletePlayer={deletePlayer}
          onBack={handleBackFromProfile}
        />
      );
    }
    switch (activeTab) {
      case 'gameday': return <GameDay players={players} />;
      case 'roster':
        return (
          <RosterManagement
            players={players}
            addPlayer={addPlayer}
            deletePlayer={deletePlayer}
            onSelectPlayer={handleSelectPlayer}
          />
        );
      case 'settings': return <Settings players={players} />;
      default: return null;
    }
  };

  const currentTab = activeTab === 'profile' ? 'roster' : activeTab;

  const teamName = activeTeam?.name || 'MY TEAM';

  return (
    <div className="app">
      {/* Ticker bar */}
      <div className="ticker-bar">
        NOW BATTING ⚾ {teamName.toUpperCase()} ⚾ GAME DAY
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="logo">
          Now<span style={{ color: '#c8102e' }}>Batting</span>
        </div>
        <TeamSwitcher />
      </header>

      {/* Tab bar */}
      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'roster') setSelectedPlayerId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-content" style={{ width: '100%', boxSizing: 'border-box' }}>
        {renderContent()}
      </main>

      {/* Bottom nav (keep for mobile navigation) */}
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-btn ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'roster') setSelectedPlayerId(null);
            }}
          >
            <span className="nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <TeamProvider>
      <SpotifyProvider>
        <AppInner />
      </SpotifyProvider>
    </TeamProvider>
  );
}
