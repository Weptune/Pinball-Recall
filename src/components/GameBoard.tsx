import React, { useEffect, useState, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, Target, RotateCw } from 'lucide-react';
import type { Bumper, LaunchPoint, PathStep, ExitOption, Position } from '../utils/gameLogic';
import { getExitOptions } from '../utils/gameLogic';
import { soundEngine } from '../utils/soundEngine';

interface GameBoardProps {
  gridSize: number;
  bumpers: Bumper[];
  launchPoint: LaunchPoint;
  gameState: 'MEMORIZE' | 'PREDICT' | 'SIMULATE' | 'RESULT';
  onSelectExit: (exit: Position | null) => void;
  selectedExit: Position | null;
  actualExit: Position | null;
  path: PathStep[];
  memorizeTimeRemainingMs: number;
  totalMemorizeTimeMs: number;
  // Puzzle Mode Props
  gameMode?: 'RECALL' | 'PUZZLE';
  clickedBumperIds?: Set<string>;
  targetExit?: Position | null;
  onRotateBumper?: (id: string) => void;
  canRotate?: boolean;
  rotationTimeRemainingMs?: number;
}

interface Waypoint {
  x: number;
  y: number;
  isBumperHit?: boolean;
  bumperType?: 'FORWARD' | 'BACK';
  cellX?: number;
  cellY?: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gridSize,
  bumpers,
  launchPoint,
  gameState,
  onSelectExit,
  selectedExit,
  actualExit,
  path,
  memorizeTimeRemainingMs,
  totalMemorizeTimeMs,
  gameMode = 'RECALL',
  clickedBumperIds = new Set(),
  targetExit = null,
  onRotateBumper,
  canRotate = false,
  rotationTimeRemainingMs = 5000,
}) => {
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [trailPolyline, setTrailPolyline] = useState<string>('');
  const [revealedBumpers, setRevealedBumpers] = useState<Set<string>>(new Set());
  const [sparkPos, setSparkPos] = useState<{ x: number; y: number } | null>(null);
  
  const animRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const exitOptions = getExitOptions(gridSize);

  // Helper to map logic coordinates to exact percentage positions inside grid matrix
  const getCellPercentage = (x: number, y: number) => {
    if (containerRef.current) {
      const gridEl = containerRef.current.querySelector('.chess-grid-container') as HTMLElement;
      const targetEl = containerRef.current.querySelector(`[data-cell="${x},${y}"]`) as HTMLElement;
      if (targetEl && gridEl) {
        const rect = targetEl.getBoundingClientRect();
        const gridRect = gridEl.getBoundingClientRect();
        
        const centerX = rect.left + rect.width / 2 - gridRect.left;
        const centerY = rect.top + rect.height / 2 - gridRect.top;

        return {
          x: (centerX / gridRect.width) * 100,
          y: (centerY / gridRect.height) * 100,
        };
      }
    }

    const totalCellsCount = gridSize + 2;
    const colPercent = ((x + 1.5) / totalCellsCount) * 100;
    const rowPercent = ((y + 1.5) / totalCellsCount) * 100;
    return { x: colPercent, y: rowPercent };
  };

  // 60 FPS requestAnimationFrame Smooth Trajectory Engine
  useEffect(() => {
    if (gameState === 'SIMULATE') {
      soundEngine.playPlungerRelease();
      setRevealedBumpers(new Set());

      // 1. Build waypoints list
      const waypoints: Waypoint[] = [];

      // Start: Outer Launcher
      const startPt = getCellPercentage(launchPoint.x, launchPoint.y);
      waypoints.push({ x: startPt.x, y: startPt.y });

      // Interior path steps
      path.forEach((step) => {
        const pt = getCellPercentage(step.x, step.y);
        const hitBumper = bumpers.find((b) => b.x === step.x && b.y === step.y);
        waypoints.push({
          x: pt.x,
          y: pt.y,
          isBumperHit: step.isBumperHit,
          bumperType: hitBumper?.type,
          cellX: step.x,
          cellY: step.y,
        });
      });

      // End: Outer Exit Target
      if (actualExit) {
        const exitPt = getCellPercentage(actualExit.x, actualExit.y);
        waypoints.push({ x: exitPt.x, y: exitPt.y });
      }

      if (waypoints.length < 2) return;

      // 2. Pre-calculate segment lengths & cumulative distances
      const distances: number[] = [0];
      let totalDist = 0;

      for (let i = 0; i < waypoints.length - 1; i++) {
        const dx = waypoints[i + 1].x - waypoints[i].x;
        const dy = waypoints[i + 1].y - waypoints[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        totalDist += dist;
        distances.push(totalDist);
      }

      // 3. Animation Timing Setup
      const durationMs = Math.max(900, Math.min(2400, path.length * 220));
      const startTime = performance.now();
      const triggeredHitIndices = new Set<number>();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const currentDist = progress * totalDist;

        // Find current segment k
        let k = 0;
        while (k < distances.length - 1 && distances[k + 1] < currentDist) {
          k++;
        }

        if (k >= waypoints.length - 1) {
          // Finished
          const lastWp = waypoints[waypoints.length - 1];
          setBallPos({ x: lastWp.x, y: lastWp.y });
          const pointsStr = waypoints.map((w) => `${w.x}%,${w.y}%`).join(' ');
          setTrailPolyline(pointsStr);
          return;
        }

        // Interpolate along segment k -> k+1
        const segStartDist = distances[k];
        const segEndDist = distances[k + 1];
        const segLength = segEndDist - segStartDist;
        const segProgress = segLength > 0 ? (currentDist - segStartDist) / segLength : 1;

        const wpA = waypoints[k];
        const wpB = waypoints[k + 1];

        const curX = wpA.x + (wpB.x - wpA.x) * segProgress;
        const curY = wpA.y + (wpB.y - wpA.y) * segProgress;

        setBallPos({ x: curX, y: curY });

        // Build continuous trail polyline
        const trailPoints: string[] = [];
        for (let i = 0; i <= k; i++) {
          trailPoints.push(`${waypoints[i].x}%,${waypoints[i].y}%`);
        }
        trailPoints.push(`${curX}%,${curY}%`);
        setTrailPolyline(trailPoints.join(' '));

        // Bumper Collision Trigger
        if (wpA.isBumperHit && !triggeredHitIndices.has(k)) {
          triggeredHitIndices.add(k);
          soundEngine.playBumperHit(wpA.bumperType || 'FORWARD');
          
          if (wpA.cellX !== undefined && wpA.cellY !== undefined) {
            setSparkPos({ x: wpA.cellX, y: wpA.cellY });
            setRevealedBumpers((prev) => new Set(prev).add(`${wpA.cellX},${wpA.cellY}`));
            setTimeout(() => setSparkPos(null), 250);
          }
        }

        if (progress < 1.0) {
          animRef.current = requestAnimationFrame(animate);
        }
      };

      animRef.current = requestAnimationFrame(animate);

      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    } else if (gameState === 'RESULT') {
      const waypoints: Waypoint[] = [];
      const startPt = getCellPercentage(launchPoint.x, launchPoint.y);
      waypoints.push({ x: startPt.x, y: startPt.y });

      path.forEach((step) => {
        const pt = getCellPercentage(step.x, step.y);
        waypoints.push({ x: pt.x, y: pt.y });
      });

      if (actualExit) {
        const exitPt = getCellPercentage(actualExit.x, actualExit.y);
        waypoints.push({ x: exitPt.x, y: exitPt.y });
      }

      setTrailPolyline(waypoints.map((w) => `${w.x}%,${w.y}%`).join(' '));
      const lastWp = waypoints[waypoints.length - 1];
      if (lastWp) setBallPos({ x: lastWp.x, y: lastWp.y });
    } else {
      setBallPos(null);
      setTrailPolyline('');
      setSparkPos(null);
      setRevealedBumpers(new Set());
    }
  }, [gameState, path, bumpers, launchPoint, actualExit]);

  const getBumperAt = (x: number, y: number): Bumper | undefined => {
    return bumpers.find((b) => b.x === x && b.y === y);
  };

  const isBumperRevealed = (x: number, y: number) => {
    if (gameState === 'MEMORIZE' || gameState === 'RESULT') {
      return true;
    }
    if (gameState === 'SIMULATE') {
      return revealedBumpers.has(`${x},${y}`);
    }
    return false;
  };

  const isLauncherCell = (x: number, y: number) => {
    return launchPoint.x === x && launchPoint.y === y;
  };

  const handleSelectExitClick = (option: ExitOption) => {
    soundEngine.playClick();
    onSelectExit({ x: option.x, y: option.y });
  };

  const renderExitArrow = (option: ExitOption) => {
    const isSelected = selectedExit?.x === option.x && selectedExit?.y === option.y;
    const isCorrectExit = actualExit?.x === option.x && actualExit?.y === option.y;
    const isTargetExitPort = gameMode === 'PUZZLE' && targetExit && targetExit.x === option.x && targetExit.y === option.y;

    let btnClass = "board-exit-btn";
    if (isTargetExitPort) {
      btnClass += " target-exit-highlight";
    } else if (gameState === 'PREDICT') {
      btnClass += isSelected ? " selected-target" : " active-target";
    } else if (gameState === 'RESULT') {
      if (isCorrectExit) {
        btnClass += " result-correct-target";
      } else if (isSelected) {
        btnClass += " result-incorrect-target";
      } else {
        btnClass += " muted-target";
      }
    } else {
      btnClass += " muted-target";
    }

    const getArrowIcon = () => {
      if (isTargetExitPort) {
        return <Target style={{ width: '18px', height: '18px', color: '#f59e0b' }} className="pulse" />;
      }
      switch (option.side) {
        case 'TOP': return <ArrowUp style={{ width: '16px', height: '16px' }} />;
        case 'BOTTOM': return <ArrowDown style={{ width: '16px', height: '16px' }} />;
        case 'LEFT': return <ArrowLeft style={{ width: '16px', height: '16px' }} />;
        case 'RIGHT': return <ArrowRight style={{ width: '16px', height: '16px' }} />;
      }
    };

    return (
      <button 
        key={option.label}
        data-cell={`${option.x},${option.y}`}
        type="button"
        disabled={gameState !== 'PREDICT' || gameMode === 'PUZZLE'}
        onClick={() => handleSelectExitClick(option)}
        className={btnClass}
        style={{ gridColumn: option.x + 2, gridRow: option.y + 2, position: 'relative' }}
        title={isTargetExitPort ? "Target Exit Port" : undefined}
      >
        {option.side === 'TOP' && (
          <span className="chess-label-top-border">{String.fromCharCode(65 + option.x)}</span>
        )}
        {option.side === 'LEFT' && (
          <span className="chess-label-left-border">{option.y + 1}</span>
        )}
        {getArrowIcon()}
      </button>
    );
  };

  const renderBoardGrid = () => {
    const gridElements: React.ReactNode[] = [];
    const totalSize = gridSize + 2;

    for (let r = 0; r < totalSize; r++) {
      for (let c = 0; c < totalSize; c++) {
        const x = c - 1;
        const y = r - 1;

        // Corners
        const isCorner = (r === 0 || r === totalSize - 1) && (c === 0 || c === totalSize - 1);
        if (isCorner) {
          gridElements.push(<div key={`corner-${r}-${c}`} style={{ gridColumn: c + 1, gridRow: r + 1 }} />);
          continue;
        }

        // Borders
        const isBorder = r === 0 || r === totalSize - 1 || c === 0 || c === totalSize - 1;
        if (isBorder) {
          if (isLauncherCell(x, y)) {
            const getLauncherIcon = () => {
              switch (launchPoint.dir) {
                case 'DOWN': return <ArrowDown className="launcher-arrow-icon" style={{ width: '20px', height: '20px' }} />;
                case 'UP': return <ArrowUp className="launcher-arrow-icon" style={{ width: '20px', height: '20px' }} />;
                case 'RIGHT': return <ArrowRight className="launcher-arrow-icon" style={{ width: '20px', height: '20px' }} />;
                case 'LEFT': return <ArrowLeft className="launcher-arrow-icon" style={{ width: '20px', height: '20px' }} />;
              }
            };

            gridElements.push(
              <div 
                key={`launcher-${r}-${c}`}
                data-cell={`${x},${y}`}
                className="board-launcher-tile"
                style={{ gridColumn: c + 1, gridRow: r + 1, position: 'relative' }}
              >
                {r === 0 && (
                  <span className="chess-label-top-border">{String.fromCharCode(65 + x)}</span>
                )}
                {c === 0 && (
                  <span className="chess-label-left-border">{y + 1}</span>
                )}
                {getLauncherIcon()}
              </div>
            );
          } else {
            const option = exitOptions.find(o => o.x === x && o.y === y);
            if (option) {
              gridElements.push(renderExitArrow(option));
            }
          }
          continue;
        }

        // Interior Chessboard Squares
        const bumper = getBumperAt(x, y);
        const revealed = isBumperRevealed(x, y);
        const isLightSquare = (x + y) % 2 === 0;
        const isClicked = bumper && clickedBumperIds.has(bumper.id);
        const isInteractive = gameMode === 'PUZZLE' && canRotate && Boolean(bumper);

        gridElements.push(
          <div
            key={`cell-${x}-${y}`}
            data-cell={`${x},${y}`}
            className={`board-square ${isLightSquare ? 'sq-light' : 'sq-dark'} ${revealed && gameState === 'SIMULATE' ? 'sq-hit' : ''} ${isInteractive ? 'sq-interactive-rotate' : ''} ${isClicked ? 'sq-clicked-active' : ''}`}
            style={{ gridColumn: c + 1, gridRow: r + 1 }}
            onClick={() => {
              if (isInteractive && bumper && onRotateBumper) {
                soundEngine.playClick();
                onRotateBumper(bumper.id);
              }
            }}
          >
            {/* Rotation Badge Overlay for clicked cells during hidden rotation phase */}
            {isClicked && !revealed && (
              <div className="clicked-rod-badge" title="Rod Rotated">
                <RotateCw style={{ width: '15px', height: '15px', color: '#22c55e' }} />
              </div>
            )}

            {bumper && (
              <svg className="bumper-svg-layer" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="gold-mirror-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="silver-mirror-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  <filter id="mirror-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.6" />
                  </filter>
                  <filter id="silver-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
                  </filter>
                </defs>

                {bumper.type === 'FORWARD' ? (
                  // Forward Slash '/': Bottom-Left (18, 82) to Top-Right (82, 18)
                  <g style={{
                    opacity: revealed ? 1 : 0,
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transformOrigin: 'center',
                    transform: revealed ? 'scale(1)' : 'scale(0.3)',
                  }}>
                    <line
                      x1="18"
                      y1="82"
                      x2="82"
                      y2="18"
                      stroke="url(#gold-mirror-grad)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      filter="url(#mirror-glow)"
                    />
                    <circle cx="18" cy="82" r="5" fill="#fef08a" />
                    <circle cx="82" cy="18" r="5" fill="#fef08a" />
                  </g>
                ) : (
                  // Backward Slash '\': Top-Left (18, 18) to Bottom-Right (82, 82)
                  <g style={{
                    opacity: revealed ? 1 : 0,
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transformOrigin: 'center',
                    transform: revealed ? 'scale(1)' : 'scale(0.3)',
                  }}>
                    <line
                      x1="18"
                      y1="18"
                      x2="82"
                      y2="82"
                      stroke="url(#silver-mirror-grad)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      filter="url(#silver-glow)"
                    />
                    <circle cx="18" cy="18" r="5" fill="#ffffff" />
                    <circle cx="82" cy="82" r="5" fill="#ffffff" />
                  </g>
                )}
              </svg>
            )}
          </div>
        );
      }
    }

    return gridElements;
  };

  const progressPercent = Math.max(0, Math.min(100, (memorizeTimeRemainingMs / totalMemorizeTimeMs) * 100));
  const progressHue = (progressPercent / 100) * 120;

  const rotationPercent = Math.max(0, Math.min(100, (rotationTimeRemainingMs / 5000) * 100));
  const rotationHue = (rotationPercent / 100) * 120;

  return (
    <div className="chess-board-wrapper">
      {/* Top Banner Status */}
      <div className="chess-status-bar">
        <span className="chess-status-text">
          {gameMode === 'PUZZLE' ? (
            gameState === 'MEMORIZE' ? (
              <>
                <Eye style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                STUDY BOARD
              </>
            ) : gameState === 'PREDICT' ? (
              <>
                <Target style={{ width: '16px', height: '16px', color: '#22c55e' }} />
                ROTATE RODS TO CONNECT PATH
              </>
            ) : gameState === 'SIMULATE' ? (
              "TESTING PATH..."
            ) : (
              selectedExit?.x === actualExit?.x && selectedExit?.y === actualExit?.y ? (
                <span style={{ color: '#22c55e', fontWeight: 800 }}>PATH CONNECTED!</span>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: 800 }}>MISCALCULATED!</span>
              )
            )
          ) : (
            gameState === 'MEMORIZE' ? (
              <>
                <Eye style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                MEMORIZE BOARD
              </>
            ) : gameState === 'PREDICT' ? (
              <>
                <Target style={{ width: '16px', height: '16px', color: '#22c55e' }} />
                CLICK EXIT TARGET
              </>
            ) : gameState === 'SIMULATE' ? (
              "TRACING PATH..."
            ) : (
              selectedExit?.x === actualExit?.x && selectedExit?.y === actualExit?.y ? (
                <span style={{ color: '#22c55e', fontWeight: 800 }}>PERFECT!</span>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: 800 }}>MISCALCULATED!</span>
              )
            )
          )}
        </span>
        {gameState === 'MEMORIZE' && (
          <span className="chess-countdown-text">
            {(memorizeTimeRemainingMs / 1000).toFixed(1)}s
          </span>
        )}
        {gameMode === 'PUZZLE' && gameState === 'PREDICT' && (
          <span className="chess-countdown-text" style={{ color: '#f59e0b' }}>
            {(rotationTimeRemainingMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Countdown Progress Bar */}
      {gameState === 'MEMORIZE' && (
        <div className="chess-progress-track">
          <div 
            className="chess-progress-fill"
            style={{ 
              width: `${progressPercent}%`,
              background: `hsl(${progressHue}, 85%, 48%)`,
              boxShadow: `0 0 8px hsl(${progressHue}, 85%, 48%)`
            }}
          />
        </div>
      )}
      {gameMode === 'PUZZLE' && gameState === 'PREDICT' && (
        <div className="chess-progress-track">
          <div 
            className="chess-progress-fill"
            style={{ 
              width: `${rotationPercent}%`,
              background: `hsl(${rotationHue}, 85%, 48%)`,
              boxShadow: `0 0 8px hsl(${rotationHue}, 85%, 48%)`
            }}
          />
        </div>
      )}

      {/* Main Board Frame */}
      <div className="chess-playfield-frame" ref={containerRef}>
        <div 
          className="chess-grid-container"
          style={{
            position: 'relative',
            gridTemplateColumns: `repeat(${gridSize + 2}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize + 2}, 1fr)`,
          }}
        >
          {renderBoardGrid()}

          {/* Spark Burst on Collision */}
          {sparkPos && (
            <div 
              className="collision-spark"
              style={{
                position: 'absolute',
                left: `${getCellPercentage(sparkPos.x, sparkPos.y).x}%`,
                top: `${getCellPercentage(sparkPos.x, sparkPos.y).y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 25,
                pointerEvents: 'none'
              }}
            />
          )}

          {/* 60 FPS Trajectory Trail SVG & Pinball */}
          {(gameState === 'SIMULATE' || gameState === 'RESULT') && trailPolyline && (
            <svg 
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 20
              }}
            >
              <polyline
                points={trailPolyline}
                fill="none"
                stroke="#22c55e"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.7))'
                }}
              />
              
              {/* Smooth 60 FPS Ball */}
              {ballPos && (
                <circle
                  cx={`${ballPos.x}%`}
                  cy={`${ballPos.y}%`}
                  r="8"
                  fill="url(#smooth-ball-grad)"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))'
                  }}
                />
              )}

              <defs>
                <radialGradient id="smooth-ball-grad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#15803d" />
                </radialGradient>
              </defs>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
