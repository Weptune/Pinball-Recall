import React, { useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, Shield } from 'lucide-react';
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

        {/* Stats Cluster - ONLY LEVEL */}
        <div className="stats-cluster" style={{ justifyContent: 'center' }}>
          {/* Level */}
          <div className="stat-pill" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0.4rem 1rem', minWidth: '76px' }}>
            <div className="stat-pill-data" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span className="stat-pill-label" style={{ textAlign: 'center' }}>Level</span>
              <span className="stat-pill-val text-cyan" style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 800 }}>{level}</span>
            </div>
          </div>
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
