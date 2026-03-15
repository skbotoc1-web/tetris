// MIT License — Copyright (c) 2026 Stefan Kaiser
// https://github.com/skbotoc1-web/tetris

'use strict';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const COLS  = 10;
const ROWS  = 20;
const BLOCK = 30;

const PIECES = {
  I: { color: '#00f0f0', matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { color: '#f0f000', matrix: [[1,1],[1,1]] },
  T: { color: '#a000f0', matrix: [[0,1,0],[1,1,1],[0,0,0]] },
  S: { color: '#00f000', matrix: [[0,1,1],[1,1,0],[0,0,0]] },
  Z: { color: '#f00000', matrix: [[1,1,0],[0,1,1],[0,0,0]] },
  J: { color: '#0000f0', matrix: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { color: '#f0a000', matrix: [[0,0,1],[1,1,1],[0,0,0]] },
};
const PIECE_KEYS = Object.keys(PIECES);

// Drop interval per level (ms)
const DROP_SPEED = [800, 700, 600, 500, 400, 300, 250, 200, 150, 100];

// Score per lines cleared
const LINE_SCORE = [0, 100, 300, 500, 800];

// ═══════════════════════════════════════════════════════════════
//  SOUND ENGINE
// ═══════════════════════════════════════════════════════════════
class SoundEngine {
  constructor() {
    this._ac = null;
    this.muted = false;
    // Tetris theme notes (Korobeiniki)
    this._theme = [
      ['E5',400],['B4',200],['C5',200],['D5',400],['C5',200],['B4',200],
      ['A4',400],['A4',200],['C5',200],['E5',400],['D5',200],['C5',200],
      ['B4',600],['C5',200],['D5',400],['E5',400],
      ['C5',400],['A4',400],['A4',400],['rest',200],
      ['D5',600],['F5',200],['A5',400],['G5',200],['F5',200],
      ['E5',600],['C5',200],['E5',400],['D5',200],['C5',200],
      ['B4',400],['B4',200],['C5',200],['D5',400],['E5',400],
      ['C5',400],['A4',400],['A4',400],['rest',400],
    ];
    this._themeTimer = null;
    this._themeIdx = 0;
    this._noteFreq = {
      'C4':261.6,'D4':293.7,'E4':329.6,'F4':349.2,'G4':392,'A4':440,'B4':493.9,
      'C5':523.3,'D5':587.3,'E5':659.3,'F5':698.5,'G5':784,'A5':880,'B5':987.8,
    };
  }

  _ctx() {
    if (!this._ac) {
      try { this._ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (this._ac && this._ac.state === 'suspended') this._ac.resume();
    return this._ac;
  }

  _beep(freq, dur, type = 'square', vol = 0.3) {
    if (this.muted) return;
    const ac = this._ctx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur / 1000);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + dur / 1000 + 0.05);
  }

  playMove()    { this._beep(220, 50,  'square', 0.1); }
  playRotate()  { this._beep(330, 60,  'square', 0.15); }
  playLand()    { this._beep(110, 80,  'square', 0.2); }
  playClear(n)  {
    const freqs = [392, 494, 587, 740];
    for (let i = 0; i < n; i++) {
      setTimeout(() => this._beep(freqs[Math.min(i, freqs.length-1)], 120, 'sine', 0.3), i * 60);
    }
  }
  playLevelUp() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._beep(f, 100, 'sine', 0.3), i * 80));
  }
  playGameOver() {
    [440, 330, 220, 110].forEach((f, i) => setTimeout(() => this._beep(f, 200, 'sawtooth', 0.3), i * 150));
  }

  startMusic() {
    if (this.muted) return;
    this._themeIdx = 0;
    this._playThemeNote();
  }
  _playThemeNote() {
    if (this.muted || !this._ac) return;
    const [note, dur] = this._theme[this._themeIdx % this._theme.length];
    if (note !== 'rest') this._beep(this._noteFreq[note] || 440, dur * 0.9, 'square', 0.1);
    this._themeIdx++;
    this._themeTimer = setTimeout(() => this._playThemeNote(), dur);
  }
  stopMusic() {
    if (this._themeTimer) { clearTimeout(this._themeTimer); this._themeTimer = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic();
    return this.muted;
  }
}

// ═══════════════════════════════════════════════════════════════
//  GAME LOGIC  (pure, no DOM, no canvas)
// ═══════════════════════════════════════════════════════════════
class TetrisGame {
  constructor() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.score    = 0;
    this.level    = 1;
    this.lines    = 0;
    this.gameOver = false;
    this.piece    = null;   // { matrix, color, x, y }
    this.next     = null;
    this._spawnNext();
    this._spawnNext();      // fill piece + next
  }

  _randomPiece() {
    const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    const p   = PIECES[key];
    // deep-copy matrix
    return { matrix: p.matrix.map(r => [...r]), color: p.color, x: 0, y: 0 };
  }

  _spawnNext() {
    this.piece = this.next || this._randomPiece();
    this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
    this.piece.y = 0;
    this.next    = this._randomPiece();
    if (this._collides(this.piece)) {
      this.gameOver = true;
    }
  }

  _collides(p, dx = 0, dy = 0, matrix = null) {
    const m = matrix || p.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = p.x + c + dx;
        const ny = p.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  _lock() {
    const p = this.piece;
    p.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) this.board[p.y + r][p.x + c] = p.color;
      });
    });
    // Clear full lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(v => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++; // re-check same row index
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += LINE_SCORE[cleared] * this.level;
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) this.level = Math.min(newLevel, 10);
      return cleared;
    }
    return 0;
  }

  // ── Public API ────────────────────────────────────────────────
  moveLeft()  { if (!this._collides(this.piece, -1, 0)) { this.piece.x--; return true; } return false; }
  moveRight() { if (!this._collides(this.piece,  1, 0)) { this.piece.x++; return true; } return false; }

  softDrop() {
    if (!this._collides(this.piece, 0, 1)) { this.piece.y++; return false; }
    const cleared = this._lock();
    this._spawnNext();
    return { locked: true, cleared };
  }

  hardDrop() {
    while (!this._collides(this.piece, 0, 1)) this.piece.y++;
    const cleared = this._lock();
    this._spawnNext();
    return { locked: true, cleared };
  }

  rotate() {
    const m = this.piece.matrix;
    const N = m.length;
    const rotated = Array.from({ length: m[0].length }, (_, c) =>
      Array.from({ length: N }, (_, r) => m[N - 1 - r][c])
    );
    const orig = { ...this.piece, matrix: rotated };
    // Try normal, then wall kicks
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!this._collides({ ...this.piece, matrix: rotated }, dx, 0)) {
        this.piece.matrix = rotated;
        this.piece.x += dx;
        return true;
      }
    }
    return false;
  }

  ghostY() {
    let dy = 0;
    while (!this._collides(this.piece, 0, dy + 1)) dy++;
    return this.piece.y + dy;
  }
}

// ═══════════════════════════════════════════════════════════════
//  RENDERER
// ═══════════════════════════════════════════════════════════════
class Renderer {
  constructor(canvas, nextCanvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx   = nextCanvas.getContext('2d');
    canvas.width   = COLS * BLOCK;
    canvas.height  = ROWS * BLOCK;
  }

  drawBlock(ctx, x, y, color, alpha = 1) {
    const bx = x * BLOCK, by = y * BLOCK;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, BLOCK - 1, BLOCK - 1);
    // Highlight top-left
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx, by, BLOCK - 1, 3);
    ctx.fillRect(bx, by, 3, BLOCK - 1);
    // Shadow bottom-right
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(bx + BLOCK - 4, by, 4, BLOCK - 1);
    ctx.fillRect(bx, by + BLOCK - 4, BLOCK - 1, 4);
    ctx.globalAlpha = 1;
  }

  render(game) {
    const ctx = this.ctx;
    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);

    // Board (placed pieces)
    game.board.forEach((row, r) => {
      row.forEach((color, c) => {
        if (color) this.drawBlock(ctx, c, r, color);
      });
    });

    if (game.gameOver || !game.piece) return;

    // Ghost piece
    const gy = game.ghostY();
    game.piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val && gy + r !== game.piece.y + r) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(
            (game.piece.x + c) * BLOCK,
            (gy + r) * BLOCK,
            BLOCK - 1, BLOCK - 1
          );
        }
      });
    });

    // Active piece
    game.piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) this.drawBlock(ctx, game.piece.x + c, game.piece.y + r, game.piece.color);
      });
    });

    // Next piece preview
    if (game.next) {
      const nc = this.nextCtx;
      const nw = this.nextCanvas.width, nh = this.nextCanvas.height;
      nc.fillStyle = '#0d0d1a';
      nc.fillRect(0, 0, nw, nh);
      const bs = 22;
      const cols = game.next.matrix[0].length;
      const rows = game.next.matrix.length;
      const ox = Math.floor((nw - cols * bs) / 2);
      const oy = Math.floor((nh - rows * bs) / 2);
      game.next.matrix.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) {
            nc.fillStyle = game.next.color;
            nc.fillRect(ox + c * bs, oy + r * bs, bs - 1, bs - 1);
            nc.fillStyle = 'rgba(255,255,255,0.25)';
            nc.fillRect(ox + c * bs, oy + r * bs, bs - 1, 3);
          }
        });
      });
    }
  }

  renderPaused() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
  }

  renderGameOver(score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f44336';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, this.canvas.width / 2, this.canvas.height / 2 + 10);
    ctx.fillStyle = '#4caf50';
    ctx.font = '14px Arial';
    ctx.fillText('Press Start to play again', this.canvas.width / 2, this.canvas.height / 2 + 40);
  }

  renderIdle() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('TETRIS', this.canvas.width / 2, this.canvas.height / 2 - 20);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Press Start', this.canvas.width / 2, this.canvas.height / 2 + 15);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTROLLER  (wires DOM ↔ Game ↔ Renderer)
// ═══════════════════════════════════════════════════════════════
class TetrisController {
  constructor() {
    // DOM
    this.scoreEl   = document.getElementById('score');
    this.levelEl   = document.getElementById('level');
    this.linesEl   = document.getElementById('lines');
    this.btnStart  = document.getElementById('btn-start');
    this.btnPause  = document.getElementById('btn-pause');
    this.btnRestart= document.getElementById('btn-restart');
    this.btnMute   = document.getElementById('btn-mute');
    this.levelSel  = document.getElementById('level-select');
    this.hiscoreEl = document.getElementById('hiscore');

    const canvas     = document.getElementById('tetris-canvas');
    const nextCanvas = document.getElementById('next-canvas');

    // Subsystems
    this.renderer  = new Renderer(canvas, nextCanvas);
    this.sound     = new SoundEngine();
    this.game      = null;

    // Loop state
    this.rafId       = null;
    this.dropCounter = 0;
    this.lastTime    = 0;
    this.paused      = false;
    this.state       = 'idle'; // idle | running | paused | gameover

    this._initUI(canvas);
    this.renderer.renderIdle();
  }

  _initUI(canvas) {
    // Level select
    for (let i = 1; i <= 10; i++) {
      const o = document.createElement('option');
      o.value = i; o.textContent = 'Level ' + i;
      this.levelSel.appendChild(o);
    }

    // Buttons
    this.btnStart.addEventListener('click',   () => this.start());
    this.btnPause.addEventListener('click',   () => this.togglePause());
    this.btnRestart.addEventListener('click', () => this.start());
    if (this.btnMute) this.btnMute.addEventListener('click', () => {
      const m = this.sound.toggleMute();
      this.btnMute.textContent = m ? '🔇' : '🔊';
    });

    // Keyboard
    document.addEventListener('keydown', e => this._onKey(e));

    // Touch
    let tx = 0, ty = 0;
    canvas.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { this._input('rotate'); return; }
      if (Math.abs(dx) > Math.abs(dy)) this._input(dx > 0 ? 'right' : 'left');
      else if (dy > 30) this._input('hard');
      e.preventDefault();
    }, { passive: false });

    this._updateHiScore();
    this.btnPause.disabled = true;
  }

  _onKey(e) {
    const map = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowDown: 'soft', KeyS: 'soft',
      ArrowUp: 'rotate', KeyW: 'rotate',
      Space: 'hard',
      KeyP: 'pause',
      KeyM: 'mute',
    };
    const action = map[e.code];
    if (!action) return;
    if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code)) e.preventDefault();
    this._input(action);
  }

  _input(action) {
    if (action === 'pause') { this.togglePause(); return; }
    if (action === 'mute')  { this.sound.toggleMute(); return; }
    if (this.state !== 'running') return;
    const g = this.game;

    switch (action) {
      case 'left':   if (g.moveLeft())  this.sound.playMove();   break;
      case 'right':  if (g.moveRight()) this.sound.playMove();   break;
      case 'rotate': if (g.rotate())    this.sound.playRotate(); break;
      case 'soft': {
        const r = g.softDrop();
        if (r && r.locked) this._onLock(r.cleared);
        break;
      }
      case 'hard': {
        const r = g.hardDrop();
        this.sound.playLand();
        if (r && r.locked) this._onLock(r.cleared);
        break;
      }
    }
  }

  _onLock(cleared) {
    if (cleared > 0) {
      this.sound.playClear(cleared);
    }
    // Level-up check
    if (this.game.level > (parseInt(this.levelSel.value) || 1)) {
      this.sound.playLevelUp();
    }
  }

  start() {
    cancelAnimationFrame(this.rafId);
    this.sound.stopMusic();

    const startLevel  = parseInt(this.levelSel.value) || 1;
    this.game         = new TetrisGame();
    this.game.level   = startLevel;

    this.dropCounter  = 0;
    this.lastTime     = 0;
    this.paused       = false;
    this.state        = 'running';

    this.btnStart.textContent   = 'Restart';
    this.btnPause.disabled      = false;
    this.btnPause.textContent   = 'Pause';
    this.levelSel.disabled      = true;

    this.sound.startMusic();
    this.rafId = requestAnimationFrame(t => this._loop(t));
  }

  togglePause() {
    if (this.state === 'running') {
      this.state  = 'paused';
      this.paused = true;
      this.sound.stopMusic();
      this.btnPause.textContent = 'Resume';
      this.renderer.renderPaused();
    } else if (this.state === 'paused') {
      this.state      = 'running';
      this.paused     = false;
      this.lastTime   = 0; // reset timing
      this.btnPause.textContent = 'Pause';
      this.sound.startMusic();
      this.rafId = requestAnimationFrame(t => this._loop(t));
    }
  }

  _loop(time) {
    if (this.state !== 'running') return;

    const dt = this.lastTime ? time - this.lastTime : 0;
    this.lastTime = time;
    this.dropCounter += dt;

    const speed = DROP_SPEED[Math.min(this.game.level - 1, DROP_SPEED.length - 1)];
    if (this.dropCounter >= speed) {
      this.dropCounter = 0;
      const r = this.game.softDrop();
      if (r && r.locked) this._onLock(r.cleared);
    }

    if (this.game.gameOver) {
      this._onGameOver();
      return;
    }

    // Render
    this.renderer.render(this.game);
    this._updateHUD();

    this.rafId = requestAnimationFrame(t => this._loop(t));
  }

  _onGameOver() {
    this.state  = 'gameover';
    this.sound.stopMusic();
    this.sound.playGameOver();
    this.renderer.renderGameOver(this.game.score);
    this._saveHiScore(this.game.score);
    this._updateHiScore();
    this.btnStart.textContent = 'Start';
    this.btnPause.disabled    = true;
    this.levelSel.disabled    = false;
  }

  _updateHUD() {
    this.scoreEl.textContent = this.game.score;
    this.levelEl.textContent = this.game.level;
    this.linesEl.textContent = this.game.lines;
  }

  _saveHiScore(score) {
    try {
      let best = parseInt(localStorage.getItem('tetris-best') || '0');
      if (score > best) localStorage.setItem('tetris-best', score);
    } catch(e) {}
  }

  _updateHiScore() {
    if (!this.hiscoreEl) return;
    try {
      this.hiscoreEl.textContent = localStorage.getItem('tetris-best') || '0';
    } catch(e) {}
  }
}

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  window._tetris = new TetrisController();
});
