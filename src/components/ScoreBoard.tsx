import React, { useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, AlertCircle, Shield } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface ScoreBoardProps {
  score: number;
  level: number;
  streak: number;
  consecutiveMistakes: number;
  trialCount: number;
  tierTitle?: string;
  gridSize?: number;
  bumperCount?: number;
  minHits?: number;
  gameMode?: 'RECALL' | 'PUZZLE';
  onTestLaunch?: () => void;
  canTestLaunch?: boolean;
  onQuit: () => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  level,
  streak,
  consecutiveMistakes,
  trialCount,
  tierTitle = "Novice",
  gridSize = 4,
  bumperCount = 2,
  minHits = 1,
  gameMode = 'RECALL',
  onTestLaunch,
  canTestLaunch = false,
  onQuit,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(soundEngine.isMuted());

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleQuitClick = () => {
    soundEngine.playClick();
    onQuit();
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Top Header Stat Bar */}
      <div className="solid-card stat-bar-container">
        {/* Back button */}
        <button
          type="button"
          onClick={handleQuitClick}
          className="icon-btn"
          title="Return to Menu"
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
        </button>

        {/* Stats Cluster */}
        <div className="stats-cluster">
          {/* Level */}
          <div className="stat-pill">
            <div className="stat-pill-data">
              <span className="stat-pill-label">Level</span>
              <span className="stat-pill-val text-cyan">{level}</span>
            </div>
          </div>

          {/* Streak */}
          <div className="stat-pill">
            <div className="stat-pill-data">
              <span className="stat-pill-label">Streak</span>
              <span className="stat-pill-val" style={{ color: streak > 0 ? '#ec4899' : '#94a3b8' }}>{streak}</span>
            </div>
          </div>

          {/* Round Progress */}
          <div className="stat-pill">
            <span className="stat-pill-label" style={{ marginBottom: 0, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
              ROUND {trialCount}
            </span>
          </div>

          {/* Level Danger Warning */}
          {consecutiveMistakes > 0 && (
            <div className="danger-warning-tag">
              <AlertCircle style={{ width: '14px', height: '14px' }} />
              <span>Drop Risk</span>
            </div>
          )}
        </div>

        {/* Test Launch Button for Puzzle Mode */}
        {gameMode === 'PUZZLE' && canTestLaunch && (
          <button
            type="button"
            onClick={() => { soundEngine.playClick(); onTestLaunch?.(); }}
            className="btn-primary test-launch-btn"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            Test Trajectory
          </button>
        )}

        {/* Audio Mute Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          className="icon-btn"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? <VolumeX style={{ width: '18px', height: '18px', color: '#ef4444' }} /> : <Volume2 style={{ width: '18px', height: '18px', color: '#38bdf8' }} />}
        </button>
      </div>

      {/* Difficulty HUD Badge Bar */}
      <div className="difficulty-hud-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Shield style={{ width: '14px', height: '14px', color: '#22c55e' }} />
            <span className="difficulty-tier-tag">{tierTitle.toUpperCase()} TIER</span>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: gameMode === 'PUZZLE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)', color: gameMode === 'PUZZLE' ? '#f59e0b' : '#38bdf8', border: `1px solid ${gameMode === 'PUZZLE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)'}` }}>
            {gameMode === 'PUZZLE' ? 'PUZZLE MODE' : 'RECALL MODE'}
          </span>
        </div>
        <div className="difficulty-params-readout">
          <span>{gridSize}×{gridSize} Grid</span>
          <span>•</span>
          <span>{bumperCount} Mirrors</span>
          <span>•</span>
          <span>Min {minHits} Deflections</span>
        </div>
      </div>
    </div>
  );
};
