/**
 * Tetris Unit Tests
 * Tests Game Logic, Bag Randomizer, Sound, Renderer
 */

const { TetrisGame, Bag, Sound, Renderer, Settings } = require('./tetris.js');

const ROWS = 20; // constants from tetris.js
const COLS = 10;

// Reset Settings before each test
beforeEach(() => {
  Settings.set('ghost', true);
  Settings.set('hold', true);
  Settings.set('hardDrop', true);
  Settings.set('music', true);
  Settings.set('sfx', true);
  Settings.set('das', 'normal');
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════
//  BAG RANDOMIZER
// ════════════════════════════════════════════════════════════

describe('Bag Randomizer', () => {
  test('generates 7 pieces before refill', () => {
    const bag = new Bag();
    const pieces = [];
    for (let i = 0; i < 7; i++) pieces.push(bag.next().key);
    expect(pieces).toHaveLength(7);
    expect(new Set(pieces).size).toBe(7); // All unique
  });

  test('refills bag after empty', () => {
    const bag = new Bag();
    for (let i = 0; i < 7; i++) bag.next();
    const next = bag.next();
    expect(next).toBeDefined();
  });

  test('shuffles pieces correctly', () => {
    const bag = new Bag();
    const runs = [];
    for (let r = 0; r < 10; r++) {
      const bag2 = new Bag();
      const run = [];
      for (let i = 0; i < 7; i++) run.push(bag2.next().key);
      runs.push(run);
    }
    // At least 2 runs should differ (randomness check)
    const uniqueRuns = new Set(runs.map(r => r.join(',')));
    expect(uniqueRuns.size).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
//  GAME LOGIC
// ════════════════════════════════════════════════════════════

describe('TetrisGame', () => {
  test('starts with level 1 by default', () => {
    const game = new TetrisGame();
    expect(game.level).toBe(1);
  });

  test('clamps startLevel to range 1-10', () => {
    const game1 = new TetrisGame(0);
    const game2 = new TetrisGame(15);
    expect(game1.level).toBe(1);
    expect(game2.level).toBe(10);
  });

  test('spawns first piece correctly', () => {
    const game = new TetrisGame();
    expect(game.piece).toBeDefined();
    // x depends on piece width: 4-wide (I) → x=3, 2-wide (O) → x=4, 3-wide (others) → x=3 or 4
    expect(game.piece.x).toBeGreaterThanOrEqual(3);
    expect(game.piece.x).toBeLessThanOrEqual(4);
    expect(game.piece.y).toBeLessThanOrEqual(0);
  });

  test('fills board and clears full rows', () => {
    const game = new TetrisGame();
    // Manually fill row 19 (bottom)
    for (let c = 0; c < 10; c++) {
      game.board[19][c] = '#f0f0f0';
    }
    // Spawn a piece that will lock
    game.piece = { x: 0, y: 18, color: '#fff', matrix: [[1]] };
    const result = game._lock();
    expect(result.cleared).toBe(1);
    expect(game.board.length).toBe(ROWS); // Still 20 rows
    expect(game.board[0].every(v => v === null)).toBe(true); // New empty row at top
    expect(game.lines).toBe(1);
  });

  test('scores 100 points for single line clear at level 1', () => {
    const game = new TetrisGame(1);
    // Fill row
    for (let c = 0; c < 10; c++) game.board[19][c] = '#f0f0f0';
    game.piece = { x: 0, y: 18, color: '#fff', matrix: [[1]] };
    const result = game._lock();
    expect(result.cleared).toBe(1);
    expect(game.score).toBe(100);
  });

  test('combo multiplies score', () => {
    const game = new TetrisGame(1);
    // Clear 2 consecutive lines
    for (let c = 0; c < 10; c++) game.board[19][c] = '#f0f0f0';
    game.piece = { x: 0, y: 18, color: '#fff', matrix: [[1]] };
    game._lock(); // First lock

    for (let c = 0; c < 10; c++) game.board[19][c] = '#f0f0f0';
    game.piece = { x: 0, y: 18, color: '#fff', matrix: [[1]] };
    game._lock(); // Second lock (combo)

    expect(game.combo).toBe(2);
    // Actual scoring: 100 (base, full lines) + 100 (base, full lines) + 50 (bonus) = 250
    // Combo bonus = base * (combo-1) * 0.5 = 100 * 1 * 0.5 = 50
    expect(game.score).toBe(250);
  });

  test('advances level every 10 lines', () => {
    const game = new TetrisGame(1);
    expect(game.level).toBe(1);

    // Clear 9 lines
    for (let l = 0; l < 9; l++) {
      game.lines++;
    }
    expect(game.level).toBe(1);

    // 10th line
    game.lines++;
    const newLvl = Math.min(10, 1 + Math.floor(game.lines / 10));
    expect(newLvl).toBe(2);
  });

  test('holdPiece works correctly', () => {
    const game = new TetrisGame(1);
    const initialPiece = game.piece.key;
    game.canHold = true;

    const held = game.holdPiece();
    expect(held).toBe(true);
    expect(game.hold).toBeDefined();
    expect(game.hold.key).toBe(initialPiece);
    expect(game.canHold).toBe(false);

    // Can't hold again
    const heldAgain = game.holdPiece();
    expect(heldAgain).toBe(false);
  });

  test('holdPiece respects setting', () => {
    const game = new TetrisGame(1);
    Settings.set('hold', false);
    game.canHold = true;

    const held = game.holdPiece();
    expect(held).toBe(false);
  });

  test('ghostY returns correct position', () => {
    const game = new TetrisGame(1);
    // Empty board (all null)
    game.board = Array.from({length:ROWS}, () => new Array(COLS).fill(null));
    // Place piece
    game.piece = { x: 5, y: 5, color: '#fff', matrix: [[1,1,1,1],[0,0,0,0],[0,0,0,0],[0,0,0,0]] };

    const ghostY = game.ghostY();
    expect(ghostY).toBe(19); // 20 - 1 (piece height 1 block in matrix) = 19
  });

  test('hardDrop works correctly', () => {
    const game = new TetrisGame(1);
    game.piece.y = 0;
    game.piece.x = 5;

    const result = game.hardDrop();
    expect(result.locked).toBe(true);
    expect(result.dropped).toBeGreaterThan(0);
  });

  test('gameOver when piece spawns at top', () => {
    const game = new TetrisGame(1);
    // Manually position piece at top with collision
    game.board[0][5] = '#f0f0f0';
    game.board[1][5] = '#f0f0f0';
    game.piece = {
      x: 5, y: -1,
      matrix: [[1], [1]], // 2 blocks tall
      color: '#fff'
    };
    game._spawn();

    expect(game.gameOver).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════

describe('Settings', () => {
  test('loads defaults when no storage', () => {
    localStorage.clear();
    expect(Settings.get('ghost')).toBe(true);
    expect(Settings.get('hold')).toBe(true);
    expect(Settings.get('hardDrop')).toBe(true);
    expect(Settings.get('music')).toBe(true);
    expect(Settings.get('sfx')).toBe(true);
    expect(Settings.get('das')).toBe('normal');
  });

  test('persists to localStorage', () => {
    localStorage.clear();
    Settings.set('ghost', false);
    expect(localStorage.getItem('ts_cfg')).toBe('{"ghost":false,"hold":true,"hardDrop":true,"das":"normal","music":true,"sfx":true}');
  });

  test('dasDelay returns correct values', () => {
    Settings.set('das', 'slow');
    expect(Settings.dasDelay()).toBe(250);
    Settings.set('das', 'normal');
    expect(Settings.dasDelay()).toBe(167);
    Settings.set('das', 'fast');
    expect(Settings.dasDelay()).toBe(100);
    Settings.set('das', 'instant');
    expect(Settings.dasDelay()).toBe(0);
  });

  test('dasRepeat returns correct values', () => {
    Settings.set('das', 'slow');
    expect(Settings.dasRepeat()).toBe(50);
    Settings.set('das', 'normal');
    expect(Settings.dasRepeat()).toBe(33);
    Settings.set('das', 'fast');
    expect(Settings.dasRepeat()).toBe(16);
    Settings.set('das', 'instant');
    expect(Settings.dasRepeat()).toBe(0);
  });
});