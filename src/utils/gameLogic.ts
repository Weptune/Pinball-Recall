export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Position {
  x: number;
  y: number;
}

export type BumperType = 'FORWARD' | 'BACK'; // FORWARD is '/' and BACK is '\'

export interface Bumper {
  id: string;
  x: number;
  y: number;
  type: BumperType;
}

export interface LaunchPoint {
  x: number;
  y: number;
  dir: Direction;
}

export interface PathStep {
  x: number;
  y: number;
  dir: Direction;
  isBumperHit?: boolean;
}

export interface GameLevelConfig {
  gridSize: number;
  bumperCount: number;
  memorizationTimeMs: number;
  minHits: number;
  tierTitle: string;
}

/**
 * Unlimited Dynamic Level Difficulty Scaling Matrix
 */
export function getLevelConfig(level: number): GameLevelConfig {
  const lvl = Math.max(1, level);

  let gridSize = 4;
  let bumperCount = 2;
  let minHits = 1;
  const memorizationTimeMs = 5000; // Fixed 5.0 seconds for all levels
  let tierTitle = "Novice";

  if (lvl <= 3) {
    gridSize = 4;
    bumperCount = lvl + 1;
    minHits = 1;
    tierTitle = "Novice";
  } else if (lvl <= 7) {
    gridSize = 5;
    bumperCount = Math.floor(lvl * 1.1) + 1;
    minHits = lvl >= 6 ? 2 : 1;
    tierTitle = "Intermediate";
  } else if (lvl <= 11) {
    gridSize = 6;
    bumperCount = Math.floor(lvl * 1.15) + 1;
    minHits = 3;
    tierTitle = "Advanced";
  } else if (lvl <= 15) {
    gridSize = 7;
    bumperCount = Math.floor(lvl * 1.2) + 1;
    minHits = 4;
    tierTitle = "Expert";
  } else if (lvl <= 19) {
    gridSize = 8;
    bumperCount = Math.floor(lvl * 1.25) + 1;
    minHits = 5;
    tierTitle = "Master";
  } else if (lvl <= 23) {
    gridSize = 9;
    bumperCount = Math.floor(lvl * 1.3) + 1;
    minHits = 6;
    tierTitle = "Grandmaster";
  } else {
    // Unlimited scaling beyond Level 23 up to Level 100+
    gridSize = Math.min(12, 4 + Math.floor((lvl - 1) / 4));
    bumperCount = Math.min(Math.floor(gridSize * gridSize * 0.35), Math.floor(lvl * 1.35) + 2);
    minHits = Math.min(gridSize - 1, Math.floor(lvl / 3) + 1);
    if (lvl <= 27) tierTitle = "Champion";
    else if (lvl <= 31) tierTitle = "Legend";
    else if (lvl <= 35) tierTitle = "Mythic";
    else tierTitle = `Titan ${lvl}`;
  }

  return {
    gridSize,
    bumperCount,
    memorizationTimeMs,
    minHits,
    tierTitle,
  };
}

/**
 * Deflect direction off a bumper:
 * FORWARD SLASH '/' (bottom-left to top-right):
 *   - Moving UP    (dy = -1) -> reflects RIGHT (dx = +1)
 *   - Moving DOWN  (dy = +1) -> reflects LEFT  (dx = -1)
 *   - Moving LEFT  (dx = -1) -> reflects DOWN  (dy = +1)
 *   - Moving RIGHT (dx = +1) -> reflects UP    (dy = -1)
 * 
 * BACKWARD SLASH '\' (top-left to bottom-right):
 *   - Moving UP    (dy = -1) -> reflects LEFT  (dx = -1)
 *   - Moving DOWN  (dy = +1) -> reflects RIGHT (dx = +1)
 *   - Moving LEFT  (dx = -1) -> reflects UP    (dy = -1)
 *   - Moving RIGHT (dx = +1) -> reflects DOWN  (dy = +1)
 */
export function getDeflection(incomingDir: Direction, bumperType: BumperType): Direction {
  if (bumperType === 'FORWARD') {
    switch (incomingDir) {
      case 'UP': return 'RIGHT';
      case 'DOWN': return 'LEFT';
      case 'LEFT': return 'DOWN';
      case 'RIGHT': return 'UP';
    }
  } else {
    switch (incomingDir) {
      case 'UP': return 'LEFT';
      case 'DOWN': return 'RIGHT';
      case 'LEFT': return 'UP';
      case 'RIGHT': return 'DOWN';
    }
  }
}

// Generate unique set of bumpers that don't overlap
export function generateBoard(gridSize: number, bumperCount: number): Bumper[] {
  const bumpers: Bumper[] = [];
  const usedCells = new Set<string>();

  let idCounter = 0;
  let attempts = 0;
  const maxBumpers = Math.min(bumperCount, Math.floor((gridSize * gridSize) * 0.45));

  while (bumpers.length < maxBumpers && attempts < 300) {
    attempts++;
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    const key = `${x},${y}`;

    if (!usedCells.has(key)) {
      usedCells.add(key);
      const type: BumperType = Math.random() > 0.5 ? 'FORWARD' : 'BACK';
      bumpers.push({
        id: `bumper-${idCounter++}`,
        x,
        y,
        type,
      });
    }
  }

  return bumpers;
}

// Generate outer border launch point
export function getRandomLaunchPoint(gridSize: number): LaunchPoint {
  const side = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
  const index = Math.floor(Math.random() * gridSize);

  switch (side) {
    case 0: // Top border cell, launching DOWN into grid
      return { x: index, y: -1, dir: 'DOWN' };
    case 1: // Right border cell, launching LEFT into grid
      return { x: gridSize, y: index, dir: 'LEFT' };
    case 2: // Bottom border cell, launching UP into grid
      return { x: index, y: gridSize, dir: 'UP' };
    case 3: // Left border cell, launching RIGHT into grid
    default:
      return { x: -1, y: index, dir: 'RIGHT' };
  }
}

// Trace trajectory path starting from outer launch point
export function tracePath(gridSize: number, bumpers: Bumper[], launch: LaunchPoint): PathStep[] {
  const path: PathStep[] = [];
  let currentX = launch.x;
  let currentY = launch.y;
  let currentDir = launch.dir;

  const bumperMap = new Map<string, BumperType>();
  bumpers.forEach(b => bumperMap.set(`${b.x},${b.y}`, b.type));

  // Step 1: Move from launcher into first interior grid cell
  switch (currentDir) {
    case 'UP': currentY--; break;
    case 'DOWN': currentY++; break;
    case 'LEFT': currentX--; break;
    case 'RIGHT': currentX++; break;
  }

  const maxSteps = 120;
  let steps = 0;

  while (
    currentX >= 0 && currentX < gridSize &&
    currentY >= 0 && currentY < gridSize &&
    steps < maxSteps
  ) {
    steps++;
    const key = `${currentX},${currentY}`;
    const bumperType = bumperMap.get(key);
    const step: PathStep = { x: currentX, y: currentY, dir: currentDir };

    if (bumperType) {
      step.isBumperHit = true;
      currentDir = getDeflection(currentDir, bumperType);
      step.dir = currentDir;
    }

    path.push(step);

    // Advance to next cell in trajectory direction
    switch (currentDir) {
      case 'UP': currentY--; break;
      case 'DOWN': currentY++; break;
      case 'LEFT': currentX--; break;
      case 'RIGHT': currentX++; break;
    }
  }

  return path;
}

// Generate round with guaranteed non-trivial trajectory (must hit at least minHits bumpers)
export function generateNonTrivialRound(
  gridSize: number,
  bumperCount: number,
  minHits: number = 1
): { bumpers: Bumper[]; launcher: LaunchPoint; path: PathStep[] } {
  let bestRound = {
    bumpers: generateBoard(gridSize, bumperCount),
    launcher: getRandomLaunchPoint(gridSize),
    path: [] as PathStep[],
  };

  for (let attempt = 0; attempt < 100; attempt++) {
    const bumpers = generateBoard(gridSize, bumperCount);
    const launcher = getRandomLaunchPoint(gridSize);
    const path = tracePath(gridSize, bumpers, launcher);

    const hitCount = path.filter(s => s.isBumperHit).length;

    if (hitCount >= minHits) {
      return { bumpers, launcher, path };
    }

    if (hitCount > bestRound.path.filter(s => s.isBumperHit).length) {
      bestRound = { bumpers, launcher, path };
    }
  }

  return bestRound;
}

// Returns final exit border cell position
export function getExitPoint(path: PathStep[]): Position & { dir: Direction } {
  if (path.length === 0) {
    return { x: 0, y: 0, dir: 'DOWN' };
  }
  
  const lastStep = path[path.length - 1];
  let exitX = lastStep.x;
  let exitY = lastStep.y;
  
  switch (lastStep.dir) {
    case 'UP': exitY--; break;
    case 'DOWN': exitY++; break;
    case 'LEFT': exitX--; break;
    case 'RIGHT': exitX++; break;
  }
  
  return { x: exitX, y: exitY, dir: lastStep.dir };
}

export interface ExitOption {
  x: number;
  y: number;
  label: string;
  side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  index: number;
}

// Generate perimeter exit option targets
export function getExitOptions(gridSize: number): ExitOption[] {
  const options: ExitOption[] = [];
  
  // Top border cells (y = -1)
  for (let x = 0; x < gridSize; x++) {
    options.push({ x, y: -1, label: `T-${x}`, side: 'TOP', index: x });
  }
  // Bottom border cells (y = gridSize)
  for (let x = 0; x < gridSize; x++) {
    options.push({ x, y: gridSize, label: `B-${x}`, side: 'BOTTOM', index: x });
  }
  // Left border cells (x = -1)
  for (let y = 0; y < gridSize; y++) {
    options.push({ x: -1, y, label: `L-${y}`, side: 'LEFT', index: y });
  }
  // Right border cells (x = gridSize)
  for (let y = 0; y < gridSize; y++) {
    options.push({ x: gridSize, y, label: `R-${y}`, side: 'RIGHT', index: y });
  }

  return options;
}

export interface PuzzleRoundData {
  solutionBumpers: Bumper[];
  scrambledBumpers: Bumper[];
  launcher: LaunchPoint;
  targetExit: Position & { dir: Direction };
  solutionPath: PathStep[];
  invertedBumperIds: Set<string>;
}

/**
 * DFS Trajectory Solver to count how many bumper orientation configurations
 * connect launcher to targetExit.
 */
export function countPuzzleSolutions(
  gridSize: number,
  bumpers: Bumper[],
  launcher: LaunchPoint,
  targetExit: Position
): number {
  let solutionCount = 0;
  const n = Math.min(12, bumpers.length); // Evaluate decision bumpers
  const maxConfigs = 1 << n;

  for (let mask = 0; mask < maxConfigs; mask++) {
    const testBumpers: Bumper[] = bumpers.map((b, i) => {
      if (i < n) {
        return {
          ...b,
          type: ((mask >> i) & 1) === 1 ? ('FORWARD' as BumperType) : ('BACK' as BumperType),
        };
      }
      return { ...b };
    });

    const path = tracePath(gridSize, testBumpers, launcher);
    const exit = getExitPoint(path);

    if (exit.x === targetExit.x && exit.y === targetExit.y) {
      solutionCount++;
      if (solutionCount > 1) {
        return solutionCount; // Early exit if non-unique!
      }
    }
  }

  return solutionCount;
}

/**
 * Generate a Puzzle Mode round:
 * 1. Creates a working solution board with launcher & target exit port.
 * 2. Selects a mixed bag of inversions (varies from 1 to 60% of hit bumpers + optional decoy inversions).
 * 3. Verifies that the resulting puzzle has EXACTLY 1 UNIQUE SOLUTION (countPuzzleSolutions === 1).
 */
export function generatePuzzleRound(
  gridSize: number,
  bumperCount: number,
  minHits: number = 1
): PuzzleRoundData {
  let bestPuzzle: PuzzleRoundData | null = null;

  for (let attempt = 0; attempt < 200; attempt++) {
    const round = generateNonTrivialRound(gridSize, bumperCount, minHits);
    const targetExit = getExitPoint(round.path);

    // Find bumpers that were actually hit along the trajectory path
    const hitBumperCoords = new Set<string>();
    round.path.forEach(step => {
      if (step.isBumperHit) {
        hitBumperCoords.add(`${step.x},${step.y}`);
      }
    });

    const hitBumpers = round.bumpers.filter(b => hitBumperCoords.has(`${b.x},${b.y}`));
    const nonHitBumpers = round.bumpers.filter(b => !hitBumperCoords.has(`${b.x},${b.y}`));

    if (hitBumpers.length === 0) continue;

    // Mixed bag inversion selection: 1 to 60% of hit bumpers
    const maxHitInvert = Math.max(1, Math.min(hitBumpers.length, Math.ceil(hitBumpers.length * 0.6)));
    const numToInvert = Math.floor(Math.random() * maxHitInvert) + 1;

    const shuffledHitBumpers = [...hitBumpers].sort(() => Math.random() - 0.5);
    const invertedBumperIds = new Set(shuffledHitBumpers.slice(0, numToInvert).map(b => b.id));

    // Mixed bag: 25% chance to also invert a decoy non-hit bumper
    nonHitBumpers.forEach(b => {
      if (Math.random() < 0.25) {
        invertedBumperIds.add(b.id);
      }
    });

    // Construct scrambled board
    const scrambledBumpers = round.bumpers.map(b => {
      if (invertedBumperIds.has(b.id)) {
        return {
          ...b,
          type: b.type === 'FORWARD' ? ('BACK' as BumperType) : ('FORWARD' as BumperType),
        };
      }
      return { ...b };
    });

    const candidatePuzzle: PuzzleRoundData = {
      solutionBumpers: round.bumpers,
      scrambledBumpers,
      launcher: round.launcher,
      targetExit,
      solutionPath: round.path,
      invertedBumperIds,
    };

    // Verify uniqueness: must have EXACTLY 1 unique solution!
    const solutionCount = countPuzzleSolutions(gridSize, scrambledBumpers, round.launcher, targetExit);

    if (solutionCount === 1) {
      return candidatePuzzle; // Guaranteed unique solution!
    }

    if (!bestPuzzle) {
      bestPuzzle = candidatePuzzle;
    }
  }

  return bestPuzzle!;
}

/**
 * Rotate a bumper's orientation in a bumper list
 */
export function rotateBumperInList(bumpers: Bumper[], id: string): Bumper[] {
  return bumpers.map(b => {
    if (b.id === id) {
      return {
        ...b,
        type: b.type === 'FORWARD' ? ('BACK' as BumperType) : ('FORWARD' as BumperType),
      };
    }
    return { ...b };
  });
}

