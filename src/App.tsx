import { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { ScoreBoard } from './components/ScoreBoard';
import { GameBoard } from './components/GameBoard';
import { AuthModal } from './components/AuthModal';
import type { 
  Bumper, 
  LaunchPoint, 
  PathStep, 
  Position, 
} from './utils/gameLogic';
import { 
  getLevelConfig, 
  generateNonTrivialRound,
  generatePuzzleRound,
  rotateBumperInList,
  tracePath,
  getExitPoint 
} from './utils/gameLogic';
import { 
  getCurrentUserSession, 
  fetchUserProfile, 
  saveUserProgress, 
  signOutUser 
} from './utils/supabaseClient';
import { soundEngine } from './utils/soundEngine';
import { RotateCcw, CheckCircle2 } from 'lucide-react';

type ScreenState = 'DASHBOARD' | 'PLAYING' | 'GAME_OVER';
type GameRoundState = 'MEMORIZE' | 'PREDICT' | 'SIMULATE' | 'RESULT';

function App() {
  // Mode-specific high scores & max levels
  const [screen, setScreen] = useState<ScreenState>('DASHBOARD');
  const [recallHighScore, setRecallHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('pinball_highscore_recall') || localStorage.getItem('pinball_highscore') || '0', 10);
  });
  const [recallMaxLevel, setRecallMaxLevel] = useState<number>(() => {
    const val = parseInt(localStorage.getItem('pinball_maxlevel_recall') || localStorage.getItem('pinball_maxlevel') || '22', 10);
    return Math.max(22, val);
  });
  const [puzzleHighScore, setPuzzleHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('pinball_highscore_puzzle') || '0', 10);
  });
  const [puzzleMaxLevel, setPuzzleMaxLevel] = useState<number>(() => {
    const val = parseInt(localStorage.getItem('pinball_maxlevel_puzzle') || '17', 10);
    return Math.max(17, val);
  });

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Gameplay Mode & Session stats
  const [gameMode, setGameMode] = useState<'RECALL' | 'PUZZLE'>('RECALL');
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [consecutiveMistakes, setConsecutiveMistakes] = useState<number>(0);
  const [trialCount, setTrialCount] = useState<number>(1);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);

  // Active round state
  const [gameState, setGameState] = useState<GameRoundState>('MEMORIZE');
  const [gridSize, setGridSize] = useState<number>(4);
  const [bumpers, setBumpers] = useState<Bumper[]>([]);
  const [launchPoint, setLaunchPoint] = useState<LaunchPoint>({ x: 0, y: -1, dir: 'DOWN' });
  const [path, setPath] = useState<PathStep[]>([]);
  const [selectedExit, setSelectedExit] = useState<Position | null>(null);
  const [actualExit, setActualExit] = useState<Position | null>(null);

  // Puzzle Mode specific state
  const [clickedBumperIds, setClickedBumperIds] = useState<Set<string>>(new Set());
  const [targetExit, setTargetExit] = useState<Position | null>(null);

  // Difficulty tier metadata
  const [tierTitle, setTierTitle] = useState<string>("Novice");
  const [bumperCount, setBumperCount] = useState<number>(2);
  const [minHits, setMinHits] = useState<number>(1);

  // Timers and simulation
  const [memorizeTimeRemainingMs, setMemorizeTimeRemainingMs] = useState<number>(0);
  const [totalMemorizeTimeMs, setTotalMemorizeTimeMs] = useState<number>(0);
  const [rotationTimeRemainingMs, setRotationTimeRemainingMs] = useState<number>(5000);
  const timerRef = useRef<number | null>(null);
  const rotationTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  // Latest state refs to prevent stale closure in timer callbacks
  const bumpersRef = useRef(bumpers);
  useEffect(() => { bumpersRef.current = bumpers; }, [bumpers]);

  const gridSizeRef = useRef(gridSize);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);

  const launchPointRef = useRef(launchPoint);
  useEffect(() => { launchPointRef.current = launchPoint; }, [launchPoint]);

  const targetExitRef = useRef(targetExit);
  useEffect(() => { targetExitRef.current = targetExit; }, [targetExit]);

  // Helper to sync fetched profile stats to state & localStorage
  const syncProfileToState = (profile: any) => {
    if (!profile) return;
    setRecallHighScore((prev) => {
      const best = Math.max(prev, profile.high_score || 0);
      localStorage.setItem('pinball_highscore_recall', best.toString());
      return best;
    });
    setRecallMaxLevel((prev) => {
      const maxLvl = Math.max(22, Math.max(prev, profile.max_level || 22));
      localStorage.setItem('pinball_maxlevel_recall', maxLvl.toString());
      return maxLvl;
    });
    setPuzzleHighScore((prev) => {
      const best = Math.max(prev, profile.puzzle_high_score || 0);
      localStorage.setItem('pinball_highscore_puzzle', best.toString());
      return best;
    });
    setPuzzleMaxLevel((prev) => {
      const maxLvl = Math.max(17, Math.max(prev, profile.puzzle_max_level || 17));
      localStorage.setItem('pinball_maxlevel_puzzle', maxLvl.toString());
      return maxLvl;
    });
  };

  // Load user session on mount
  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUserSession();
      if (user && user.username) {
        setCurrentUser({ id: user.id, username: user.username });
        const profile = await fetchUserProfile(user.id);
        if (profile) {
          syncProfileToState(profile);
        }
      }
    }
    checkAuth();
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // Puzzle Mode 5-second rotation phase auto-run countdown timer
  useEffect(() => {
    if (gameMode === 'PUZZLE' && gameState === 'PREDICT') {
      setRotationTimeRemainingMs(5000);

      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);

      const intervalMs = 100;
      rotationTimerRef.current = window.setInterval(() => {
        setRotationTimeRemainingMs((prev) => {
          if (prev <= intervalMs) {
            if (rotationTimerRef.current) {
              clearInterval(rotationTimerRef.current);
              rotationTimerRef.current = null;
            }
            triggerPuzzleTrajectoryTest();
            return 0;
          }
          return prev - intervalMs;
        });
      }, intervalMs);

      return () => {
        if (rotationTimerRef.current) {
          clearInterval(rotationTimerRef.current);
          rotationTimerRef.current = null;
        }
      };
    }
  }, [gameMode, gameState]);

  // Set up a new round
  const startNewRound = (nextLevel: number, mode: 'RECALL' | 'PUZZLE' = gameMode) => {
    const config = getLevelConfig(nextLevel);
    setGridSize(config.gridSize);
    setTierTitle(config.tierTitle);
    setBumperCount(config.bumperCount);
    setMinHits(config.minHits);
    setSelectedExit(null);
    setClickedBumperIds(new Set());

    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);

    if (mode === 'PUZZLE') {
      const puzzleData = generatePuzzleRound(config.gridSize, config.bumperCount, config.minHits);
      setBumpers(puzzleData.scrambledBumpers);
      setLaunchPoint(puzzleData.launcher);
      setTargetExit(puzzleData.targetExit);
      
      const currentPath = tracePath(config.gridSize, puzzleData.scrambledBumpers, puzzleData.launcher);
      setPath(currentPath);
      setActualExit(getExitPoint(currentPath));
    } else {
      const roundData = generateNonTrivialRound(config.gridSize, config.bumperCount, config.minHits);
      const exit = getExitPoint(roundData.path);
      setBumpers(roundData.bumpers);
      setLaunchPoint(roundData.launcher);
      setTargetExit(null);
      setPath(roundData.path);
      setActualExit(exit);
    }

    setTotalMemorizeTimeMs(config.memorizationTimeMs);
    setMemorizeTimeRemainingMs(config.memorizationTimeMs);
    setGameState('MEMORIZE');

    // Start countdown timer (Viewing Phase)
    if (timerRef.current) clearInterval(timerRef.current);
    
    const intervalMs = 100;
    timerRef.current = window.setInterval(() => {
      setMemorizeTimeRemainingMs((prev) => {
        if (prev <= intervalMs) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameState('PREDICT'); // Unlocks rotation in puzzle mode!
          return 0;
        }
        return prev - intervalMs;
      });
    }, intervalMs);
  };

  const handleStartGame = (mode: 'RECALL' | 'PUZZLE' = 'RECALL') => {
    setGameMode(mode);
    setScore(0);
    setLevel(1);
    setStreak(0);
    setConsecutiveMistakes(0);
    setTrialCount(1);
    setCorrectAnswersCount(0);
    setScreen('PLAYING');
    startNewRound(1, mode);
  };

  const handleRotateBumper = (bumperId: string) => {
    if (gameMode !== 'PUZZLE' || gameState !== 'PREDICT') return;

    setClickedBumperIds((prev) => {
      const next = new Set(prev);
      next.add(bumperId);
      return next;
    });

    const newBumpers = rotateBumperInList(bumpers, bumperId);
    setBumpers(newBumpers);

    const newPath = tracePath(gridSize, newBumpers, launchPoint);
    setPath(newPath);
    setActualExit(getExitPoint(newPath));
  };

  const triggerPuzzleTrajectoryTest = () => {
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }

    const currentPath = tracePath(gridSizeRef.current, bumpersRef.current, launchPointRef.current);
    const currentExit = getExitPoint(currentPath);

    setPath(currentPath);
    setActualExit(currentExit);
    setSelectedExit({ x: currentExit.x, y: currentExit.y });
    setGameState('SIMULATE');

    const simulationDuration = Math.max(900, Math.min(2400, currentPath.length * 220)) + 400;
    setTimeout(() => {
      setGameState('RESULT');
      const isMatch = targetExitRef.current && currentExit.x === targetExitRef.current.x && currentExit.y === targetExitRef.current.y;
      evaluateRoundResult({ x: currentExit.x, y: currentExit.y }, Boolean(isMatch));
    }, simulationDuration);
  };

  const handleTestTrajectory = () => {
    if (gameMode !== 'PUZZLE' || gameState !== 'PREDICT') return;
    triggerPuzzleTrajectoryTest();
  };

  const handleSelectExit = (exit: Position) => {
    setSelectedExit(exit);
    setGameState('SIMULATE');

    const simulationDuration = Math.max(900, Math.min(2400, path.length * 220)) + 400;
    setTimeout(() => {
      setGameState('RESULT');
      evaluateRoundResult(exit);
    }, simulationDuration);
  };

  const evaluateRoundResult = (selection: Position, customIsCorrect?: boolean) => {
    const isCorrect = customIsCorrect !== undefined
      ? customIsCorrect
      : (actualExit && selection.x === actualExit.x && selection.y === actualExit.y);
    const bounceHits = path.filter(s => s.isBumperHit).length;
    
    let nextLevel = level;
    let nextConsecutiveMistakes = consecutiveMistakes;
    let nextStreak = streak;

    if (isCorrect) {
      soundEngine.playSuccess();

      // Multiplier score calculation: Level^2 * 10 + Bounce Hits * 25
      const pointsEarned = level * level * 10 + bounceHits * 25;

      setScore(prev => {
        const newScore = prev + pointsEarned;
        if (gameMode === 'PUZZLE') {
          if (newScore > puzzleHighScore) {
            setPuzzleHighScore(newScore);
            localStorage.setItem('pinball_highscore_puzzle', newScore.toString());
          }
        } else {
          if (newScore > recallHighScore) {
            setRecallHighScore(newScore);
            localStorage.setItem('pinball_highscore_recall', newScore.toString());
            localStorage.setItem('pinball_highscore', newScore.toString());
          }
        }
        return newScore;
      });
      setCorrectAnswersCount(prev => prev + 1);
      nextStreak += 1;
      nextConsecutiveMistakes = 0;
      nextLevel = level + 1;
    } else {
      soundEngine.playError();

      nextStreak = 0;
      nextConsecutiveMistakes = 1;
      nextLevel = Math.max(1, level - 1);
    }

    setLevel(nextLevel);
    setStreak(nextStreak);
    setConsecutiveMistakes(nextConsecutiveMistakes);

    if (gameMode === 'PUZZLE') {
      if (nextLevel > puzzleMaxLevel) {
        setPuzzleMaxLevel(nextLevel);
        localStorage.setItem('pinball_maxlevel_puzzle', nextLevel.toString());
      }
    } else {
      if (nextLevel > recallMaxLevel) {
        setRecallMaxLevel(nextLevel);
        localStorage.setItem('pinball_maxlevel_recall', nextLevel.toString());
        localStorage.setItem('pinball_maxlevel', nextLevel.toString());
      }
    }

    // Auto-advance round after 1 second
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    const delay = isCorrect ? 1000 : 1500;
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (!isCorrect) {
        finishGameSession();
      } else {
        handleContinue();
      }
    }, delay);
  };

  const handleContinue = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    soundEngine.playClick();
    
    // Check if last attempt was incorrect
    if (consecutiveMistakes > 0) {
      finishGameSession();
    } else {
      setTrialCount(prev => prev + 1);
      startNewRound(level);
    }
  };

  const finishGameSession = () => {
    setScreen('GAME_OVER');

    // Auto sync to Supabase if logged in
    if (currentUser) {
      const totalAttempted = Math.max(1, trialCount);
      const accuracyPercent = Math.round((correctAnswersCount / totalAttempted) * 100);
      saveUserProgress(
        currentUser.id,
        currentUser.username,
        score,
        level,
        accuracyPercent,
        correctAnswersCount,
        totalAttempted,
        gameMode
      );
    }
  };

  const handleQuit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setScreen('DASHBOARD');
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  return (
    <div className="app-main-viewport">
      {screen === 'DASHBOARD' && (
        <Dashboard 
          onStartGame={handleStartGame} 
          recallHighScore={recallHighScore} 
          recallMaxLevel={recallMaxLevel} 
          puzzleHighScore={puzzleHighScore}
          puzzleMaxLevel={puzzleMaxLevel}
          currentUserUsername={currentUser?.username || null}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
        />
      )}

      {screen === 'PLAYING' && (
        <div className="gameplay-session-container">
          <ScoreBoard 
            score={score}
            level={level}
            streak={streak}
            consecutiveMistakes={consecutiveMistakes}
            trialCount={trialCount}
            tierTitle={tierTitle}
            gridSize={gridSize}
            bumperCount={bumperCount}
            minHits={minHits}
            gameMode={gameMode}
            onTestLaunch={handleTestTrajectory}
            canTestLaunch={gameState === 'PREDICT'}
            onQuit={handleQuit}
          />

          <GameBoard 
            gridSize={gridSize}
            bumpers={bumpers}
            launchPoint={launchPoint}
            gameState={gameState}
            onSelectExit={handleSelectExit}
            selectedExit={selectedExit}
            actualExit={actualExit}
            path={path}
            memorizeTimeRemainingMs={memorizeTimeRemainingMs}
            totalMemorizeTimeMs={totalMemorizeTimeMs}
            gameMode={gameMode}
            clickedBumperIds={clickedBumperIds}
            targetExit={targetExit}
            onRotateBumper={handleRotateBumper}
            canRotate={gameState === 'PREDICT'}
            rotationTimeRemainingMs={rotationTimeRemainingMs}
          />
        </div>
      )}

      {screen === 'GAME_OVER' && (
        <div className="solid-card summary-card">
          <h2 className="summary-title">{consecutiveMistakes > 0 ? "Session Ended" : "Session Summary"}</h2>
          <p className="summary-subtitle">
            {consecutiveMistakes > 0 
              ? `Reached Round ${trialCount} before miscalculation.` 
              : `Completed ${trialCount} rounds of Pinball Recall!`
            }
          </p>

          <div className="summary-stats-grid">
            <div className="summary-stat-box">
              <span className="summary-label">Level Reached</span>
              <span className="summary-val text-cyan">Lvl {level}</span>
            </div>
            <div className="summary-stat-box">
              <span className="summary-label">Accuracy</span>
              <span className="summary-val text-pink">
                {Math.round((correctAnswersCount / Math.max(1, trialCount)) * 100)}%
              </span>
            </div>
          </div>

          {currentUser && (
            <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
              <span>Progress synced to @{currentUser.username}</span>
            </div>
          )}

          <div className="summary-btn-row">
            <button 
              type="button" 
              onClick={() => handleStartGame(gameMode)} 
              className="btn-primary"
              style={{ flex: 1 }}
            >
              <RotateCcw style={{ width: '16px', height: '16px' }} />
              Play Again
            </button>
            <button 
              type="button" 
              onClick={handleQuit} 
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Supabase Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(username) => {
          getCurrentUserSession().then(async (user) => {
            if (user) {
              setCurrentUser({ id: user.id, username: user.username || username });
              const profile = await fetchUserProfile(user.id);
              if (profile) {
                syncProfileToState(profile);
              }
            }
          });
        }}
      />
    </div>
  );
}

export default App;
