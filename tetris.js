'use strict';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const COLS = 10;
const ROWS = 20;
const SZ   = 30; // logical block size (px)

const PIECES = {
  I:{ color:'#00f0f0', shadow:'#006868', matrix:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], startY:-1 },
  O:{ color:'#f0f000', shadow:'#686800', matrix:[[1,1],[1,1]],                              startY: 0 },
  T:{ color:'#a000f0', shadow:'#500080', matrix:[[0,1,0],[1,1,1],[0,0,0]],                  startY: 0 },
  S:{ color:'#00f000', shadow:'#006800', matrix:[[0,1,1],[1,1,0],[0,0,0]],                  startY: 0 },
  Z:{ color:'#f00000', shadow:'#680000', matrix:[[1,1,0],[0,1,1],[0,0,0]],                  startY: 0 },
  J:{ color:'#0000f0', shadow:'#000068', matrix:[[1,0,0],[1,1,1],[0,0,0]],                  startY: 0 },
  L:{ color:'#f0a000', shadow:'#685000', matrix:[[0,0,1],[1,1,1],[0,0,0]],                  startY: 0 },
};
const BAG_KEYS      = Object.keys(PIECES);
const COLOR_TO_KEY  = Object.fromEntries(BAG_KEYS.map(k => [PIECES[k].color, k]));

// Exponential gravity curve — clear level-to-level progression
// Level  1: ~1.0s/row (beginner-friendly)
// Level 10: ~0.05s/row (blazing fast)
const SPEEDS = [1000, 793, 618, 473, 355, 262, 190, 130, 85, 50];

// Points: 1-line, 2-line, 3-line, Tetris (×level multiplier)
const SCORES = [0, 100, 300, 500, 800];

const LEVEL_COLORS = [
  '#4caf50','#8bc34a','#cddc39','#ffeb3b',
  '#ffc107','#ff9800','#ff5722','#f44336','#e91e63','#9c27b0'
];

const LOCK_DELAY_MS    = 500;
const LOCK_MAX_RESETS  = 15;
const FLASH_MS         = 120;
const COMBO_MS         = 900;
const LEVELUP_MS       = 1400;
const GAMEOVER_WAIT_MS = 350;

// ═══════════════════════════════════════════════════════════════
//  SETTINGS  (persisted to localStorage)
// ═══════════════════════════════════════════════════════════════
const Settings = (() => {
  const DEFAULTS = {
    ghost:       true,
    hold:        true,
    hardDrop:    true,
    das:         'normal',   // slow | normal | fast | instant
    music:       true,
    sfx:         true,
  };
  let _d = null;
  const load  = () => { try { _d = {...DEFAULTS, ...JSON.parse(localStorage.getItem('ts_cfg') || '{}')}; } catch(_){ _d = {...DEFAULTS}; } };
  const save  = () => { try { localStorage.setItem('ts_cfg', JSON.stringify(_d)); } catch(_){ /* ignored */ } };
  return {
    get(k)    { if (!_d) load(); return _d[k] ?? DEFAULTS[k]; },
    set(k,v)  { if (!_d) load(); _d[k]=v; save(); },
    dasDelay(){ return {slow:250, normal:167, fast:100, instant:0}[this.get('das')] ?? 167; },
    dasRepeat(){ return {slow:50,  normal:33,  fast:16,  instant:0}[this.get('das')] ?? 33;  },
  };
})();

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const cloneMatrix = m => m.map(r => [...r]);

function rotateCW(m) {
  const R = m.length, C = m[0].length;
  return Array.from({length:C}, (_,c) => Array.from({length:R}, (_,r) => m[R-1-r][c]));
}

// ═══════════════════════════════════════════════════════════════
//  7-BAG RANDOMIZER
// ═══════════════════════════════════════════════════════════════
class Bag {
  constructor() { this._b = []; }
  next() {
    if (!this._b.length) {
      this._b = [...BAG_KEYS];
      for (let i=this._b.length-1; i>0; i--) {
        const j = Math.random()*(i+1)|0;
        [this._b[i],this._b[j]] = [this._b[j],this._b[i]];
      }
    }
    const k = this._b.pop();
    return { key:k, color:PIECES[k].color, shadow:PIECES[k].shadow, matrix:cloneMatrix(PIECES[k].matrix) };
  }
}

// ═══════════════════════════════════════════════════════════════
//  GAME LOGIC  (pure — no DOM)
// ═══════════════════════════════════════════════════════════════
class TetrisGame {
  constructor(startLevel=1) {
    this.board    = Array.from({length:ROWS}, () => new Array(COLS).fill(null));
    this.score    = 0;
    this.level    = Math.max(1, Math.min(10, startLevel|0));
    this.lines    = 0;
    this.combo    = 0;
    this.gameOver = false;
    this.backToBack = false;

    this._bag   = new Bag();
    this.next   = this._bag.next();
    this.hold   = null;       // held piece (or null)
    this.canHold= true;       // reset each spawn
    this.piece  = null;
    this._stats = Object.fromEntries(BAG_KEYS.map(k=>[k,0]));
    this.clearAnim = [];      // row indices to flash (set by _lock)

    this._lockPending = false;
    this._lockTimer   = null;
    this._lockResets  = 0;
    this._onLockCb    = null;

    this._spawn();
  }

  onLock(fn) { this._onLockCb = fn; }

  // ── internals ───────────────────────────────────────────────

  _clearTimer() {
    if (this._lockTimer) { clearTimeout(this._lockTimer); this._lockTimer = null; }
  }

  _spawn(forcePiece, allowHold=true) {
    this.piece = forcePiece || this.next;
    if (!forcePiece) this.next = this._bag.next();
    this.piece.x = (COLS - this.piece.matrix[0].length) >> 1;
    this.piece.y = PIECES[this.piece.key].startY;
    this._stats[this.piece.key]++;
    if (allowHold) this.canHold = true;  // only reset on natural spawn, not on hold-swap
    this._lockPending = false;
    this._clearTimer();
    this._lockResets = 0;
    if (this._hit(this.piece, 0, 0)) this.gameOver = true;
  }

  _hit(p, dx, dy, mat) {
    const m = mat || p.matrix;
    for (let r=0; r<m.length; r++)
      for (let c=0; c<m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx=p.x+c+dx, ny=p.y+r+dy;
        if (nx<0 || nx>=COLS || ny>=ROWS) return true;
        if (ny>=0 && this.board[ny][nx])  return true;
      }
    return false;
  }

  _lock() {
    const p = this.piece;
    let aboveTop = false;
    p.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (!v) return;
      const ny = p.y+r;
      if (ny<0) { aboveTop=true; return; }
      this.board[ny][p.x+c] = p.color;
    }));
    if (aboveTop) { this.gameOver=true; return {cleared:0,topOut:true}; }

    // ── FIX: filter full rows, then prepend empties ───────────
    const full = [];
    for (let r=0; r<ROWS; r++)
      if (this.board[r].every(v => v !== null)) full.push(r);

    this.clearAnim = [...full];

    if (full.length) {
      this.board = this.board.filter((_, r) => !full.includes(r));
      while (this.board.length < ROWS) this.board.unshift(new Array(COLS).fill(null));

      this.lines += full.length;
      this.combo++;
      const base  = SCORES[full.length] * this.level;
      // Back-to-back Tetris bonus: +50% if last clear was also Tetris
      const b2bBonus = (full.length === 4 && this.backToBack) ? Math.floor(base * 0.5) : 0;
      this.backToBack = (full.length === 4);
      // Combo bonus
      const comboBonus = this.combo > 1 
        ? [0, 0, 50, 100, 150][Math.min(this.combo, 4)] * this.level 
        : 0;
      this.score += base + b2bBonus + comboBonus;
      const newLvl = Math.min(10, 1 + Math.floor(this.lines/10));
      if (newLvl > this.level) this.level = newLvl;
      return { cleared:full.length, combo:this.combo, b2b:this.backToBack };
    }
    this.combo = 0;
    return { cleared:0 };
  }

  _lockAndSpawn() {
    this._lockPending = false;
    this._clearTimer();
    const result = this._lock();
    if (!this.gameOver) this._spawn();
    return result;
  }

  _scheduleLock() {
    this._lockPending = true;
    this._clearTimer();
    this._lockTimer = setTimeout(() => {
      const r = this._lockAndSpawn();
      this._onLockCb?.({ locked:true, ...r });
    }, LOCK_DELAY_MS);
  }

  _tryResetLock() {
    if (!this._lockPending) return;
    if (this._lockResets >= LOCK_MAX_RESETS) {
      const r = this._lockAndSpawn();
      this._onLockCb?.({ locked:true, ...r });
      return;
    }
    this._lockResets++;
    this._clearTimer();
    this._lockTimer = setTimeout(() => {
      const r = this._lockAndSpawn();
      this._onLockCb?.({ locked:true, ...r });
    }, LOCK_DELAY_MS);
  }

  // ── public API ───────────────────────────────────────────────

  moveLeft() {
    if (this._hit(this.piece,-1,0)) { this._tryResetLock(); return false; }
    this.piece.x--;
    this._tryResetLock();
    return true;
  }

  moveRight() {
    if (this._hit(this.piece,1,0)) { this._tryResetLock(); return false; }
    this.piece.x++;
    this._tryResetLock();
    return true;
  }

  rotate(dir=1) {
    const m = dir>0 ? rotateCW(this.piece.matrix)
      : rotateCW(rotateCW(rotateCW(this.piece.matrix)));
    // SRS-style wall kicks: horizontal + vertical offsets
    const kicks = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0]];
    for (const [dx,dy] of kicks) {
      if (!this._hit(this.piece,dx,dy,m)) {
        this.piece.matrix = m;
        this.piece.x += dx;
        this.piece.y += dy;
        this._tryResetLock();
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (!this._hit(this.piece,0,1)) { this.piece.y++; this.score++; return {moved:true}; }
    if (!this._lockPending) this._scheduleLock();
    return {moved:false};
  }

  hardDrop() {
    let dropped=0;
    while (!this._hit(this.piece,0,1)) { this.piece.y++; dropped++; }
    this.score += dropped*2;
    const result = this._lockAndSpawn();
    return {...result, locked:true, dropped};
  }

  holdPiece() {
    if (!this.canHold || !Settings.get('hold')) return false;
    this.canHold = false;
    const stored = { key:this.piece.key, color:this.piece.color,
      shadow:this.piece.shadow, matrix:cloneMatrix(PIECES[this.piece.key].matrix) };
    const swap = this.hold;
    this.hold = stored;
    this._spawn(swap, false); // spawn held piece; canHold stays false until next natural spawn
    return true;
  }

  ghostY() {
    let dy=0;
    while (!this._hit(this.piece,0,dy+1)) dy++;
    return this.piece.y+dy;
  }

  getStats() { return {...this._stats}; }
  destroy()  { this._clearTimer(); }
}

// ═══════════════════════════════════════════════════════════════
//  SOUND
// ═══════════════════════════════════════════════════════════════
class Sound {
  constructor() {
    this._ac    = null;
    this._mTimer= null;
    this._mIdx  = 0;
    this._melody= [
      [659,400],[494,200],[523,200],[587,400],[523,200],[494,200],
      [440,400],[440,200],[523,200],[659,400],[587,200],[523,200],
      [494,600],[523,200],[587,400],[659,400],[523,400],[440,400],[440,400],null,
      [587,400],[698,200],[880,400],[784,200],[698,200],
      [659,600],[523,200],[659,400],[587,200],[523,200],
      [494,400],[494,200],[523,200],[587,400],[659,400],[523,400],[440,400],[440,400],null,
    ];
  }

  get _musicOn() { return Settings.get('music'); }
  get _sfxOn()   { return Settings.get('sfx');   }

  _ctx() {
    if (!this._ac) try { this._ac = new (window.AudioContext||window.webkitAudioContext)(); } catch(_){ /* ignored */ }
    if (this._ac?.state==='suspended') this._ac.resume();
    return this._ac;
  }

  _tone(freq, dur, type='square', vol=0.2, delay=0) {
    if (!this._sfxOn) return;
    const ac = this._ctx(); if (!ac) return;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime+delay);
    g.gain.setValueAtTime(0, ac.currentTime+delay);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime+delay+0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+delay+dur/1000);
    osc.start(ac.currentTime+delay);
    osc.stop(ac.currentTime+delay+dur/1000+0.05);
  }

  move()         { this._tone(220,35,'square',0.07); }
  rotate()       { this._tone(320,45,'square',0.09); }
  land()         { this._tone(110,70,'square',0.16); }
  hold()         { this._tone(440,60,'sine',0.12); }
  clear(n)       { [392,523,659,880].slice(0,n).forEach((f,i)=>this._tone(f,90,'sine',0.22,i*0.055)); }
  levelUp(lvl) {
    const tones = [];
    const vol = 0.25;
    switch(lvl) {
    case 2: // kurze aufsteigende Tonfolge
      tones.push([523,150],[659,150],[784,150],[1047,200]);
      break;
    case 3: // etwas länger, höhere Töne
      tones.push([523,150],[659,150],[784,150],[1047,150],[1319,250]);
      break;
    case 4: // Dreiklang + Oktave
      tones.push([523,100],[659,100],[784,100],[1047,300],[523,150],[1047,200]);
      break;
    case 5: // Fünf-Ton-Fanfare
      tones.push([523,120],[659,120],[784,120],[1047,120],[1319,400]);
      break;
    case 6: // Schnellere Akzente + Bass
      tones.push([261,100],[523,80],[659,80],[784,80],[1047,80],[1319,300]);
      break;
    case 7: // Triumphale Sequenz
      tones.push([523,200],[659,150],[784,150],[1047,200],[1319,150],[1568,400]);
      break;
    default: // Level 8+ episch mit Akkordfolge
      tones.push([523,150],[784,100],[1047,150],[659,100],[880,150],[1319,250],[1568,400],[1047,200],[1568,400]);
      break;
    }
    tones.forEach(([f,d],i) => this._tone(f, d, 'triangle', vol + (lvl>=8?0.1:0), i*0.08));
  }
  over()         { [440,330,220,110].forEach((f,i)=>this._tone(f,180,'sawtooth',0.18,i*0.13)); }
  hardDrop(n)    { this._tone(140+n*4,55,'square',0.14); }

  startMusic() {
    if (!this._musicOn) return;
    this._mIdx = 0; this._playNote();
  }
  _playNote() {
    if (!this._musicOn) return;
    const note = this._melody[this._mIdx % this._melody.length];
    this._mIdx++;
    const dur = note ? note[1] : 200;
    if (note) this._tone(note[0], dur*0.88, 'square', 0.07);
    this._mTimer = setTimeout(()=>this._playNote(), dur);
  }
  stopMusic() { clearTimeout(this._mTimer); this._mTimer=null; }

  applySettings() {
    if (!Settings.get('music')) this.stopMusic();
  }
}

// ═══════════════════════════════════════════════════════════════
//  RENDERER
// ═══════════════════════════════════════════════════════════════
class Renderer {
  constructor(canvas, nextCanvas, holdCanvas) {
    this.c    = canvas;
    this.ctx  = canvas.getContext('2d');
    this.nc   = nextCanvas;
    this.nctx = nextCanvas.getContext('2d');
    this.hc   = holdCanvas;
    this.hctx = holdCanvas ? holdCanvas.getContext('2d') : null;

    // Scale for devicePixelRatio (crisp on retina)
    const dpr = window.devicePixelRatio || 1;
    this._dpr = dpr;
    this.c.width  = COLS*SZ*dpr; this.c.height = ROWS*SZ*dpr;
    this.c.style.width  = COLS*SZ + 'px';
    this.c.style.height = ROWS*SZ + 'px';
    this.ctx.scale(dpr, dpr);

    // Pre-render grid to offscreen canvas (drawn once, reused every frame)
    this._grid = this._makeGrid();
  }

  _makeGrid() {
    const dpr = this._dpr;
    const oc = document.createElement('canvas');
    oc.width  = COLS*SZ*dpr; oc.height = ROWS*SZ*dpr;
    const octx = oc.getContext('2d');
    octx.scale(dpr, dpr);
    octx.fillStyle = '#0a0a14';
    octx.fillRect(0,0,COLS*SZ,ROWS*SZ);
    octx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let r=0; r<ROWS; r++)
      for (let c=0; c<COLS; c++)
        octx.fillRect(c*SZ+SZ/2-1, r*SZ+SZ/2-1, 2, 2);
    return oc;
  }

  _block(ctx, x, y, color, shadow, alpha=1) {
    const bx=x*SZ, by=y*SZ;
    if (alpha!==1) ctx.globalAlpha=alpha;
    ctx.fillStyle=color;
    ctx.fillRect(bx+1,by+1,SZ-2,SZ-2);
    ctx.fillStyle='rgba(255,255,255,0.38)';
    ctx.fillRect(bx+2,by+2,SZ-4,4);
    ctx.fillRect(bx+2,by+2,4,SZ-4);
    ctx.fillStyle=shadow||'rgba(0,0,0,0.5)';
    ctx.fillRect(bx+SZ-6,by+2,4,SZ-4);
    ctx.fillRect(bx+2,by+SZ-6,SZ-4,4);
    if (alpha!==1) ctx.globalAlpha=1;
  }

  draw(game, flashRows=[]) {
    const ctx = this.ctx;

    // Grid (pre-rendered)
    ctx.drawImage(this._grid, 0, 0, COLS*SZ, ROWS*SZ);

    // Board cells
    const board = game.board;
    for (let r=0; r<ROWS; r++) {
      const flash = flashRows.includes(r);
      for (let c=0; c<COLS; c++) {
        const color = board[r][c];
        if (!color) continue;
        if (flash) {
          ctx.fillStyle='#ffffff';
          ctx.globalAlpha=0.9;
          ctx.fillRect(c*SZ+1,r*SZ+1,SZ-2,SZ-2);
          ctx.globalAlpha=1;
        } else {
          this._block(ctx, c, r, color, PIECES[COLOR_TO_KEY[color]]?.shadow||'#333');
        }
      }
    }

    if (!game.piece || game.gameOver) return;

    // Ghost piece
    if (Settings.get('ghost')) {
      const gy = game.ghostY();
      if (gy > game.piece.y) {
        ctx.globalAlpha=0.22;
        game.piece.matrix.forEach((row,r) => row.forEach((v,c) => {
          if (!v) return;
          ctx.fillStyle=game.piece.color;
          ctx.fillRect((game.piece.x+c)*SZ+2,(gy+r)*SZ+2,SZ-4,SZ-4);
        }));
        ctx.globalAlpha=1;
      }
    }

    // Active piece
    game.piece.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (v) this._block(ctx, game.piece.x+c, game.piece.y+r, game.piece.color, game.piece.shadow);
    }));

    // Level-colored border
    ctx.strokeStyle = LEVEL_COLORS[Math.min(game.level-1,9)];
    ctx.lineWidth   = 2;
    ctx.strokeRect(1,1,COLS*SZ-2,ROWS*SZ-2);

    this._drawMini(this.nctx, this.nc, game.next);
    if (this.hctx) this._drawMini(this.hctx, this.hc, game.hold, !game.canHold);
  }

  _drawMini(ctx, canvas, piece, dimmed=false) {
    const nw=canvas.width, nh=canvas.height;
    ctx.fillStyle='#0a0a14';
    ctx.fillRect(0,0,nw,nh);
    if (!piece) return;
    const bs=22;
    const ox=((nw-piece.matrix[0].length*bs)/2)|0;
    const oy=((nh-piece.matrix.length*bs)/2)|0;
    if (dimmed) ctx.globalAlpha=0.35;
    piece.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (!v) return;
      ctx.fillStyle=piece.color;
      ctx.fillRect(ox+c*bs+1,oy+r*bs+1,bs-2,bs-2);
      ctx.fillStyle='rgba(255,255,255,0.28)';
      ctx.fillRect(ox+c*bs+2,oy+r*bs+2,bs-3,3);
    }));
    if (dimmed) ctx.globalAlpha=1;
  }

  overlay(text, sub, color='#fff') {
    const ctx=this.ctx, w=COLS*SZ, h=ROWS*SZ;
    ctx.fillStyle='rgba(8,8,20,0.87)';
    ctx.fillRect(0,0,w,h);
    ctx.textAlign='center';
    ctx.fillStyle=color;
    ctx.font='bold 34px "Segoe UI",Arial';
    ctx.fillText(text, w/2, h/2-20);
    if (sub) {
      ctx.fillStyle='#9090b0';
      ctx.font='14px "Segoe UI",Arial';
      ctx.fillText(sub, w/2, h/2+14);
    }
  }

  idle() {
    const ctx=this.ctx, colors=BAG_KEYS.map(k=>PIECES[k].color);
    ctx.drawImage(this._grid, 0, 0, COLS*SZ, ROWS*SZ);
    for (let r=3; r<ROWS; r++) for (let c=0; c<COLS; c++) {
      if (Math.random()<0.25) {
        ctx.globalAlpha=0.10+Math.random()*0.10;
        ctx.fillStyle=colors[Math.random()*colors.length|0];
        ctx.fillRect(c*SZ+1,r*SZ+1,SZ-2,SZ-2);
      }
    }
    ctx.globalAlpha=1;
    this.overlay('TETRIS','Press  Start  to  play','#4caf50');
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTROLLER
// ═══════════════════════════════════════════════════════════════
class TetrisController {
  constructor() {
    this.$  = id => document.getElementById(id);

    this.canvas   = this.$('tetris-canvas');
    this.renderer = new Renderer(this.canvas, this.$('next-canvas'), this.$('hold-canvas'));
    this.sound    = new Sound();

    this.game      = null;
    this.state     = 'idle';
    this.rafId     = null;
    this.dropAcc   = 0;
    this.lastTime  = 0;
    this.flashRows = [];
    this._flashTimer  = null;
    this._dasState    = {};
    this._prevLevel   = 1;
    this._hudCache    = {score:-1, level:-1, lines:-1};

    this._bindUI();
    this._applySettingsToUI();
    this.renderer.idle();
  }

  // ── UI ────────────────────────────────────────────────────────

  _bindUI() {
    // Level select
    const sel = this.$('level-select');
    for (let i=1; i<=10; i++) {
      const o=document.createElement('option'); o.value=i; o.textContent='Level '+i;
      sel.appendChild(o);
    }
    sel.value = Settings.get('startLevel') || 1;
    sel.addEventListener('change', () => Settings.set('startLevel', +sel.value));

    this.$('btn-start').addEventListener('click', ()=>this.start());
    this.$('btn-pause').addEventListener('click', ()=>this.togglePause());
    this.$('btn-mute').addEventListener('click',  ()=>this._toggleMusic());

    // Settings toggles
    this._bindSetting('set-ghost',    'ghost',    v=>v);
    this._bindSetting('set-hold',     'hold',     v=>v);
    this._bindSetting('set-harddrop', 'hardDrop', v=>v);
    this._bindSetting('set-sfx',      'sfx',      v=>v);
    this._bindSetting('set-music',    'music',    v=>{ if(!v) this.sound.stopMusic(); else if(this.state==='running') this.sound.startMusic(); return v; });

    const dasEl = this.$('set-das');
    if (dasEl) {
      dasEl.value = Settings.get('das');
      dasEl.addEventListener('change', ()=>Settings.set('das', dasEl.value));
    }

    // Keyboard + touch
    document.addEventListener('keydown', e=>this._onKeyDown(e));
    document.addEventListener('keyup',   e=>this._onKeyUp(e));
    this._bindTouch();

    this.$('btn-pause').disabled = true;
    this._refreshBest();
  }

  _bindSetting(id, key, onSet) {
    const el = this.$(id);
    if (!el) return;
    el.checked = Settings.get(key);
    el.addEventListener('change', ()=>{ Settings.set(key, el.checked); });
  }

  _applySettingsToUI() {
    ['set-ghost','set-hold','set-harddrop','set-sfx','set-music'].forEach(id=>{
      const el = this.$(id);
      if (el) el.checked = Settings.get(id.replace('set-','').replace('harddrop','hardDrop').replace('sfx','sfx').replace('music','music').replace('ghost','ghost').replace('hold','hold'));
    });
    // Fix mapping
    const map = {ghost:'ghost',hold:'hold','harddrop':'hardDrop',sfx:'sfx',music:'music'};
    Object.entries(map).forEach(([id,key])=>{ const el=this.$('set-'+id); if(el) el.checked=Settings.get(key); });
  }

  _toggleMusic() {
    const now = Settings.get('music');
    Settings.set('music', !now);
    const el = this.$('set-music');
    if (el) el.checked = !now;
    if (now) { this.sound.stopMusic(); this.$('btn-mute').textContent='🔇'; }
    else      { if (this.state==='running') this.sound.startMusic(); this.$('btn-mute').textContent='🔊'; }
  }

  _bindTouch() {
    let tx=0,ty=0,tt=0;
    this.canvas.addEventListener('touchstart', e=>{
      tx=e.touches[0].clientX; ty=e.touches[0].clientY; tt=Date.now();
      e.preventDefault();
    },{passive:false});
    this.canvas.addEventListener('touchend', e=>{
      const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty, dt=Date.now()-tt;
      if (Math.abs(dx)<18&&Math.abs(dy)<18&&dt<250) { this._action('rotate'); return; }
      if (Math.abs(dx)>Math.abs(dy))  this._action(dx>0?'right':'left');
      else if (dy>50)                 this._action('hard');
      else if (dy<-50)                this._action('rotate');
      e.preventDefault();
    },{passive:false});
  }

  // ── Keyboard ──────────────────────────────────────────────────

  _onKeyDown(e) {
    const PREVENT=['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space',
      'KeyA','KeyD','KeyS','KeyW','KeyZ','KeyX','KeyC',
      'KeyP','Escape','KeyM'];
    if (PREVENT.includes(e.code)) e.preventDefault();
    if (e.repeat) return;

    if (e.code==='KeyP'||e.code==='Escape') { this._action('pause'); return; }
    if (e.code==='KeyM')                    { this._toggleMusic(); return; }

    const MAP = {
      ArrowLeft:'left', KeyA:'left',
      ArrowRight:'right',KeyD:'right',
      ArrowDown:'soft',  KeyS:'soft',
      ArrowUp:'rotate',  KeyW:'rotate',
      KeyZ:'rotate_ccw', KeyX:'rotate',
      Space:'hard',
      KeyC:'hold',       ShiftLeft:'hold', ShiftRight:'hold',
    };
    const action = MAP[e.code];
    if (!action) return;
    this._action(action);

    // DAS
    const dasKeys=['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','KeyS'];
    if (dasKeys.includes(e.code) && Settings.dasDelay()>0) {
      this._dasState[e.code] = {
        timer: setTimeout(()=>{
          if (this._dasState[e.code])
            this._dasState[e.code].interval = setInterval(()=>this._action(action), Settings.dasRepeat());
        }, Settings.dasDelay()),
        interval: null,
      };
    }
  }

  _onKeyUp(e) {
    const s = this._dasState[e.code];
    if (!s) return;
    clearTimeout(s.timer); clearInterval(s.interval);
    delete this._dasState[e.code];
  }

  _clearDas() {
    Object.values(this._dasState).forEach(s=>{ clearTimeout(s.timer); clearInterval(s.interval); });
    this._dasState={};
  }

  // ── Actions ───────────────────────────────────────────────────

  _action(a) {
    if (a==='pause') { this.togglePause(); return; }
    if (this.state!=='running'||!this.game) return;
    const g=this.game;
    switch(a) {
    case 'left':       if (g.moveLeft())   this.sound.move(); break;
    case 'right':      if (g.moveRight())  this.sound.move(); break;
    case 'rotate':     if (g.rotate(1))    { this.sound.rotate(); navigator.vibrate?.(6); } break;
    case 'rotate_ccw': if (g.rotate(-1))   { this.sound.rotate(); navigator.vibrate?.(6); } break;
    case 'soft': {
      const r=g.softDrop();
      if (!r.moved&&g.gameOver) this._onGameOver();
      break;
    }
    case 'hard':
      if (!Settings.get('hardDrop')) break;
      { const r=g.hardDrop(); this.sound.hardDrop(r.dropped||0); navigator.vibrate?.([8,8,30]); this._onLock(r); break; }
    case 'hold':
      if (g.holdPiece()) { this.sound.hold(); this._updateHUD(true); } break;
    }
  }

  _onLock(r) {
    if (this.game.gameOver) { this._onGameOver(); return; }
    if (r.cleared>0) {
      this.flashRows = [...this.game.clearAnim];
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(()=>{ this.flashRows=[]; }, FLASH_MS);
      this.sound.clear(r.cleared);
      if (r.combo>1) this._showToast('combo', r.combo+'× COMBO!', COMBO_MS);
    }
    if (this.game.level>this._prevLevel) {
      this._prevLevel=this.game.level;
      this.sound.levelUp(this.game.level);
      this._showToast('levelup', '▲ LEVEL '+this.game.level, LEVELUP_MS);
    }
    navigator.vibrate?.(4);
    this._updateHUD();
  }

  _showToast(id, text, ms) {
    const el=this.$(id); if (!el) return;
    el.textContent=text; el.classList.add('visible');
    clearTimeout(this['_t_'+id]);
    this['_t_'+id]=setTimeout(()=>el.classList.remove('visible'), ms);
  }

  // ── Game lifecycle ─────────────────────────────────────────────

  start() {
    if (this.game) this.game.destroy();
    cancelAnimationFrame(this.rafId);
    clearTimeout(this._flashTimer);
    this._clearDas();
    this.sound.stopMusic();

    const lvl = Math.max(1,Math.min(10, parseInt(this.$('level-select').value)||1));
    this.game  = new TetrisGame(lvl);
    this._prevLevel = lvl;
    this._hudCache  = {score:-1,level:-1,lines:-1};

    this.game.onLock(r=>{ if(this.state==='running') this._onLock(r); });

    this.dropAcc=0; this.lastTime=0;
    this.state='running'; this.flashRows=[];

    this.$('btn-start').textContent='Restart';
    this.$('btn-pause').disabled=false;
    this.$('btn-pause').textContent='Pause';
    this.$('level-select').disabled=true;

    this.sound.startMusic();
    this.rafId=requestAnimationFrame(t=>this._loop(t));
  }

  togglePause() {
    if (this.state==='running') {
      this.state='paused';
      this._clearDas();
      this.sound.stopMusic();
      this.$('btn-pause').textContent='Resume';
      this.renderer.overlay('PAUSED','Press  P  to  resume','#ff9800');
    } else if (this.state==='paused') {
      this.state='running';
      this.lastTime=0;
      this.$('btn-pause').textContent='Pause';
      this.sound.startMusic();
      this.rafId=requestAnimationFrame(t=>this._loop(t));
    }
  }

  _loop(time) {
    if (this.state!=='running') return;

    const dt = this.lastTime ? Math.min(time-this.lastTime, 100) : 0;
    this.lastTime=time;
    this.dropAcc+=dt;

    const spd = SPEEDS[Math.min(this.game.level-1, SPEEDS.length-1)];
    // Use -= to preserve sub-interval remainder (prevents irregular timing)
    while (this.dropAcc>=spd) {
      this.dropAcc-=spd;
      const r=this.game.softDrop();
      if (!r.moved&&this.game.gameOver) { this._onGameOver(); return; }
    }

    this.renderer.draw(this.game, this.flashRows);
    this._updateHUD();
    this.rafId=requestAnimationFrame(t=>this._loop(t));
  }

  _onGameOver() {
    this.state='gameover';
    this._clearDas();
    this.sound.stopMusic();
    this.sound.over();
    const score=this.game.score;
    this._saveBest(score);
    setTimeout(()=>{
      this.renderer.overlay('GAME OVER','Score: '+score.toLocaleString()+' — Press Start','#f44336');
    }, GAMEOVER_WAIT_MS);
    this.$('btn-pause').disabled=true;
    this.$('btn-start').textContent='Start';
    this.$('level-select').disabled=false;
    this._refreshBest();
    this._updateHUD(true);
  }

  // ── HUD  (only update DOM when values change) ─────────────────

  _updateHUD(force=false) {
    if (!this.game) return;
    const {score,level,lines} = this.game;
    if (force||score!==this._hudCache.score) { this.$('score').textContent=score.toLocaleString(); this._hudCache.score=score; }
    if (force||level!==this._hudCache.level) { this.$('level').textContent=level;                  this._hudCache.level=level; }
    if (force||lines!==this._hudCache.lines) { this.$('lines').textContent=lines;                  this._hudCache.lines=lines; }
    
    // Level progress bar
    const progressEl = this.$('level-progress-bar');
    const progressTextEl = this.$('level-progress-text');
    if (progressEl && progressTextEl) {
      if (level >= 10) {
        progressEl.style.width = '100%';
        progressTextEl.textContent = 'MAX LEVEL';
      } else {
        const linesInLevel = lines % 10;
        progressEl.style.width = (linesInLevel * 10) + '%';
        progressTextEl.textContent = `${linesInLevel} / 10 Lines`;
      }
    }
  }

  _saveBest(score) {
    try { const b=+localStorage.getItem('tetris_best')||0; if(score>b) localStorage.setItem('tetris_best',score); } catch(_){ /* ignored */ }
  }
  _refreshBest() {
    const el=this.$('best'); if(!el) return;
    try { el.textContent=(+localStorage.getItem('tetris_best')||0).toLocaleString(); } catch(_){ /* ignored */ el.textContent='0'; }
  }
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
if (typeof window !== 'undefined' && !(typeof global !== 'undefined' && global.__TETRIS_NO_BOOT__)) {
  const _boot = () => { window._t = new TetrisController(); };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot(); // DOM already ready (e.g. deferred/module script)
  }
}

// Export für Tests (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TetrisGame, Bag, Sound, Renderer, TetrisController, Settings };
}
