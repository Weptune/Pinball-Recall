import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface DmdDisplayProps {
  score: number;
  level: number;
  trialCount: number;
  totalTrials: number;
  highScore: number;
  streak: number;
  consecutiveMistakes: number;
  isMuted: boolean;
  onToggleMute: () => void;
  statusText?: string;
}

export const DmdDisplay: React.FC<DmdDisplayProps> = ({
  score,
  level,
  trialCount,
  totalTrials,
  highScore,
  streak,
  consecutiveMistakes,
  isMuted,
  onToggleMute,
  statusText = "BALL IN PLAY",
}) => {
  // Format score with leading zeros like classic pinball DMDs
  const formattedScore = score.toString().padStart(8, '0');
  const formattedHigh = highScore.toString().padStart(8, '0');

  return (
    <div className="dmd-cabinet-header">
      {/* Chrome bezel frame top */}
      <div className="dmd-bezel">
        {/* Sound toggle button integrated into top right bezel */}
        <button
          type="button"
          onClick={onToggleMute}
          className="dmd-sound-btn"
          title={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {isMuted ? <VolumeX style={{ width: '16px', height: '16px', color: '#ef4444' }} /> : <Volume2 style={{ width: '16px', height: '16px', color: '#ffaa00' }} />}
        </button>

        {/* DMD Pixel Grid Display */}
        <div className="dmd-screen">
          <div className="dmd-screen-overlay"></div>
          
          {/* Top row: Status & Level */}
          <div className="dmd-row dmd-row-top">
            <span className="dmd-indicator-pill">
              <span className="dmd-dot-led"></span>
              {statusText}
            </span>
            <span className="dmd-text-yellow">
              LVL-{level.toString().padStart(2, '0')}
            </span>
            <span className="dmd-text-orange">
              BALL {trialCount}/{totalTrials}
            </span>
          </div>

          {/* Main Middle Row: Animated Score Readout */}
          <div className="dmd-row dmd-row-main">
            <span className="dmd-score-digits">
              {formattedScore}
            </span>
          </div>

          {/* Bottom Row: Streak & High Score */}
          <div className="dmd-row dmd-row-bottom">
            <span className="dmd-text-dim">
              HIGH: {formattedHigh}
            </span>
            {streak > 0 && (
              <span className="dmd-streak-flasher">
                STREAK x{streak}
              </span>
            )}
            {consecutiveMistakes > 0 && (
              <span className="dmd-danger-flasher">
                WARNING: LEVEL DROP
              </span>
            )}
          </div>
        </div>

        {/* Retro Pinball Indicator Lights on Machine Bezel */}
        <div className="dmd-lamps-bar">
          <span className="dmd-lamp active-green">FREE PLAY</span>
          <span className={`dmd-lamp ${streak >= 3 ? 'active-amber' : ''}`}>MULTIPLIER</span>
          <span className={`dmd-lamp ${consecutiveMistakes > 0 ? 'active-red' : ''}`}>TILT RISK</span>
        </div>
      </div>
    </div>
  );
};
