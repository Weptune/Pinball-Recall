import React, { useState } from 'react';
import { Play, BookOpen, Award, Users, HelpCircle, User, LogOut, RefreshCw } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import { 
  fetchGlobalLeaderboard, 
  isSupabaseConfigured, 
  type LeaderboardEntry 
} from '../utils/supabaseClient';

interface DashboardProps {
  onStartGame: (mode: 'RECALL' | 'PUZZLE') => void;
  recallHighScore: number;
  recallMaxLevel: number;
  puzzleHighScore: number;
  puzzleMaxLevel: number;
  currentUserUsername: string | null;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onStartGame, 
  recallMaxLevel,
  puzzleMaxLevel,
  currentUserUsername,
  onOpenAuthModal,
  onSignOut,
}) => {
  const [showRules, setShowRules] = useState(false);
  const [activeTab, setActiveTab] = useState<'solo' | 'multiplayer' | 'leaderboards'>('solo');
  const [selectedMode, setSelectedMode] = useState<'RECALL' | 'PUZZLE'>('RECALL');
  const [leaderboardMode, setLeaderboardMode] = useState<'RECALL' | 'PUZZLE'>('RECALL');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const isConfigured = isSupabaseConfigured();

  React.useEffect(() => {
    if (activeTab === 'leaderboards') {
      loadLeaderboards(leaderboardMode);
    }
  }, [activeTab, leaderboardMode]);

  const handleTabClick = (tab: 'solo' | 'multiplayer' | 'leaderboards') => {
    soundEngine.playClick();
    setActiveTab(tab);
  };

  const loadLeaderboards = async (modeToFetch: 'RECALL' | 'PUZZLE' = leaderboardMode) => {
    setLoadingLeaderboard(true);
    try {
      const data = await fetchGlobalLeaderboard(modeToFetch);
      setLeaderboardData(data || []);
    } catch (err) {
      console.error("Leaderboard loading error:", err);
      setLeaderboardData([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleLaunch = () => {
    soundEngine.playClick();
    onStartGame(selectedMode);
  };

  const handleOpenRules = () => {
    soundEngine.playClick();
    setShowRules(true);
  };

  const activeMaxLevel = selectedMode === 'PUZZLE' ? puzzleMaxLevel : recallMaxLevel;

  return (
    <div className="solid-card main-dashboard-card">
      {/* Account Badge Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
        {currentUserUsername ? (
          <div className="account-badge-logged">
            <User style={{ width: '14px', height: '14px', color: '#22c55e' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
              {currentUserUsername}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="icon-btn"
              style={{ width: '26px', height: '26px' }}
              title="Sign Out"
            >
              <LogOut style={{ width: '13px', height: '13px', color: '#ef4444' }} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="account-badge-guest"
          >
            <User style={{ width: '14px', height: '14px', color: '#38bdf8' }} />
            <span>{isConfigured ? 'Sign In / Account' : 'Guest Mode'}</span>
          </button>
        )}
      </div>

      {/* Title Header */}
      <div>
        <h1 className="hero-title">
          PINBALL RECALL
        </h1>
        <p className="hero-subtitle">
          hai
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-bar-container">
        <button
          type="button"
          onClick={() => handleTabClick('solo')}
          className={`tab-btn-item ${activeTab === 'solo' ? 'active' : ''}`}
        >
          <Play style={{ width: '16px', height: '16px' }} />
          Solo Training
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('multiplayer')}
          className={`tab-btn-item ${activeTab === 'multiplayer' ? 'active' : ''}`}
        >
          <Users style={{ width: '16px', height: '16px' }} />
          Multiplayer
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('leaderboards')}
          className={`tab-btn-item ${activeTab === 'leaderboards' ? 'active' : ''}`}
        >
          <Award style={{ width: '16px', height: '16px' }} />
          Leaderboard
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-viewport">
        {activeTab === 'solo' && (
          <div className="solo-tab-content">
            {/* Mode Selector */}
            <div className="mode-selector-container">
              <span className="mode-selector-label">GAME MODE</span>
              <div className="mode-selector-grid">
                <button
                  type="button"
                  onClick={() => { soundEngine.playClick(); setSelectedMode('RECALL'); }}
                  className={`mode-card-btn ${selectedMode === 'RECALL' ? 'active' : ''}`}
                >
                  <span className="mode-card-title">Memory Recall</span>
                  <span className="mode-card-desc">click the final landing square</span>
                </button>

                <button
                  type="button"
                  onClick={() => { soundEngine.playClick(); setSelectedMode('PUZZLE'); }}
                  className={`mode-card-btn ${selectedMode === 'PUZZLE' ? 'active' : ''}`}
                >
                  <span className="mode-card-title">Puzzle Rotation</span>
                  <span className="mode-card-desc">flip the rods to make the ball reach the target</span>
                </button>
              </div>
            </div>

            {/* Mode-Specific Stats Row */}
            <div className="personal-stats-row single-stat-center">
              <div className="personal-stat-box">
                <span className="personal-stat-label">{selectedMode === 'PUZZLE' ? 'PUZZLE MAX LEVEL' : 'RECALL MAX LEVEL'}</span>
                <span className="personal-stat-value text-pink" style={{ fontSize: '1.75rem' }}>Lvl {activeMaxLevel}</span>
              </div>
            </div>

            <div className="action-buttons-row">
              <button type="button" onClick={handleLaunch} className="btn-primary">
                <Play style={{ width: '18px', height: '18px', fill: 'white' }} />
                Start {selectedMode === 'PUZZLE' ? 'Puzzle' : 'Session'}
              </button>
              <button 
                type="button"
                onClick={handleOpenRules}
                className="btn-secondary"
              >
                <BookOpen style={{ width: '18px', height: '18px' }} />
                How to Play
              </button>
            </div>
          </div>
        )}

        {activeTab === 'multiplayer' && (
          <div className="locked-feature-card">
            <Users style={{ width: '40px', height: '40px', color: '#38bdf8', margin: '0 auto 0.75rem' }} />
            <h3 className="locked-title">Multiplayer Matchmaking Queues</h3>
            <p className="locked-desc">
              Real-time 1v1 pinball recall duels and matchmaking queues are arriving in Version 2.0.
            </p>
            <div className="locked-badge">
              VERSION 2.0 FEATURE
            </div>
          </div>
        )}

        {activeTab === 'leaderboards' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Leaderboard Mode Sub-Tabs */}
            <div className="mode-selector-grid">
              <button
                type="button"
                onClick={() => { soundEngine.playClick(); setLeaderboardMode('RECALL'); }}
                className={`mode-card-btn ${leaderboardMode === 'RECALL' ? 'active' : ''}`}
                style={{ padding: '0.45rem 0.65rem', alignItems: 'center' }}
              >
                <span className="mode-card-title" style={{ fontSize: '0.75rem' }}>Memory Recall</span>
              </button>
              <button
                type="button"
                onClick={() => { soundEngine.playClick(); setLeaderboardMode('PUZZLE'); }}
                className={`mode-card-btn ${leaderboardMode === 'PUZZLE' ? 'active' : ''}`}
                style={{ padding: '0.45rem 0.65rem', alignItems: 'center' }}
              >
                <span className="mode-card-title" style={{ fontSize: '0.75rem' }}>Puzzle Rotation</span>
              </button>
            </div>

            {!isConfigured ? (
              <div className="locked-feature-card" style={{ maxWidth: '100%' }}>
                <Award style={{ width: '36px', height: '36px', color: '#f59e0b', margin: '0 auto 0.5rem' }} />
                <h3 className="locked-title">Supabase Database Offline</h3>
                <p className="locked-desc">
                  Connect Supabase credentials to unlock global cloud rankings and sync your highscores!
                </p>
                <button type="button" onClick={onOpenAuthModal} className="btn-secondary" style={{ marginTop: '0.75rem' }}>
                  Setup Supabase Connection
                </button>
              </div>
            ) : (
              <div className="leaderboard-table-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>
                    {leaderboardMode === 'PUZZLE' ? 'PUZZLE ROTATION RANKINGS' : 'MEMORY RECALL RANKINGS'}
                  </span>
                  <button type="button" onClick={() => loadLeaderboards(leaderboardMode)} className="icon-btn" style={{ width: '28px', height: '28px' }}>
                    <RefreshCw style={{ width: '13px', height: '13px' }} className={loadingLeaderboard ? 'spin' : ''} />
                  </button>
                </div>

                {loadingLeaderboard ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Fetching top scores...
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No scores recorded yet. Complete a 25-trial session to claim rank #1!
                  </div>
                ) : (
                  <div className="leaderboard-scroll-list">
                    {leaderboardData.map((entry, index) => (
                      <div key={entry.id || index} className="leaderboard-row-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                            #{index + 1}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                            {entry.username || entry.user_email || 'Player'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22c55e', fontFamily: 'var(--font-display)' }}>
                            Lvl {entry.level_reached}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="modal-backdrop">
          <div className="solid-card modal-card-content">
            <h2 className="modal-title-header">
              <HelpCircle style={{ color: '#38bdf8', width: '22px', height: '22px' }} />
              {selectedMode === 'PUZZLE' ? 'Puzzle Rotation Rules' : 'Memory Recall Rules'}
            </h2>

            <div className="modal-rules-scroll">
              {selectedMode === 'PUZZLE' ? (
                <>
                  <div className="rule-item">
                    <span className="rule-item-title">1. Study Start & Exit Ports</span>
                    <p className="rule-item-text">The start launcher arrow and gold target exit port are shown along with the scrambled mirror layout during the 5s viewing phase.</p>
                  </div>
                  
                  <div className="rule-item">
                    <span className="rule-item-title">2. Mirrors Disappear into Memory</span>
                    <p className="rule-item-text">When the viewing countdown ends, all mirror rods hide. You must rely on memory of where the rods were placed.</p>
                  </div>

                  <div className="rule-item">
                    <span className="rule-item-title">3. Click Cells to Rotate Hidden Rods</span>
                    <p className="rule-item-text">Click grid cells containing hidden rods to rotate their orientation at 90° angles (/ ↔ \). A green indicator badge shows which cells you have rotated.</p>
                    
                    <div className="bumper-legend-box">
                      <div className="bumper-legend-item">
                        <div className="bumper-icon-badge forward">/</div>
                        <div>
                          <div className="bumper-legend-name">Forward Bumper (Gold)</div>
                          <div className="bumper-legend-formula">UP ➔ RIGHT | DOWN ➔ LEFT</div>
                        </div>
                      </div>
                      <div className="bumper-legend-item">
                        <div className="bumper-icon-badge backward">\</div>
                        <div>
                          <div className="bumper-legend-name">Backward Bumper (Silver)</div>
                          <div className="bumper-legend-formula">UP ➔ LEFT | DOWN ➔ RIGHT</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rule-item">
                    <span className="rule-item-title">4. 5-Second Auto-Run & Connect Exit</span>
                    <p className="rule-item-text">You have 5 seconds to rotate the memorized rods to build a path to the target exit port before the trajectory automatically rolls!</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rule-item">
                    <span className="rule-item-title">1. Memorize the Grid</span>
                    <p className="rule-item-text">Study the locations and orientations of diagonal mirror bumpers during the 5-second viewing phase.</p>
                  </div>
                  
                  <div className="rule-item">
                    <span className="rule-item-title">2. Bumpers Disappear</span>
                    <p className="rule-item-text">The mirrors fade away. A launcher arrow appears on the outer border showing where the ball will enter.</p>
                  </div>

                  <div className="rule-item">
                    <span className="rule-item-title">3. Trace the 90° Deflections</span>
                    <p className="rule-item-text">Mentally simulate the ball bouncing off the hidden bumpers at 90° angles:</p>
                    
                    <div className="bumper-legend-box">
                      <div className="bumper-legend-item">
                        <div className="bumper-icon-badge forward">/</div>
                        <div>
                          <div className="bumper-legend-name">Forward Bumper (Gold)</div>
                          <div className="bumper-legend-formula">UP ➔ RIGHT | DOWN ➔ LEFT</div>
                        </div>
                      </div>
                      <div className="bumper-legend-item">
                        <div className="bumper-icon-badge backward">\</div>
                        <div>
                          <div className="bumper-legend-name">Backward Bumper (Silver)</div>
                          <div className="bumper-legend-formula">UP ➔ LEFT | DOWN ➔ RIGHT</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rule-item">
                    <span className="rule-item-title">4. Select the Exit Target</span>
                    <p className="rule-item-text">Click the border arrow where you predict the ball will exit. Correct answers raise your level; 1 mistake drops your level immediately.</p>
                  </div>
                </>
              )}
            </div>

            <button 
              type="button"
              onClick={() => setShowRules(false)}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
