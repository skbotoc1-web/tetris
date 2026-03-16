'use strict';

// ─── Constants ─────────────────────────────────────────────────
const COLS  = 10;
const ROWS  = 20;
const SZ    = 30;   // block size px

// DAS (Delayed Auto Shift) timing - in milliseconds
const DAS_INITIAL_DELAY  = 167;  // initial delay before auto-repeat
const DAS_REPEAT_DELAY   = 33;   // auto-repeat interval

const PIECES = {
  I:{ color:'#00f0f0', shadow:'#007878', matrix:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], startY: -1 },
  O:{ color:'#f0f000', shadow:'#787800', matrix:[[1,1],[1,1]], startY: 0 },
  T:{ color:'#a000f0', shadow:'#500078', matrix:[[0,1,0],[1,1,1],[0,0,0]], startY: 0 },
  S:{ color:'#00f000', shadow:'#007800', matrix:[[0,1,1],[1,1,0],[0,0,0]], startY: 0 },
  Z:{ color:'#f00000', shadow:'#780000', matrix:[[1,1,0],[0,1,1],[0,0,0]], startY: 0 },
  J:{ color:'#0000f0', shadow:'#000078', matrix:[[1,0,0],[1,1,1],[0,0,0]], startY: 0 },
  L:{ color:'#f0a000', shadow:'#785000', matrix:[[0,0,1],[1,1,1],[0,0,0]], startY: 0 },
};
const BAG = Object.keys(PIECES);

const SPEEDS = [800,717,633,550,467,383,300,217,133,100]; // ms/drop per level (1-10)
const SCORES = [0,100,300,500,800]; // 0-4 lines

// ─── Named Game Constants ─────────────────────────────────────────
const LOCK_DELAY_MS       = 500;    // piece lock delay after soft-drop
const LOCK_MAX_RESETS     = 15;     // max DAS resets during lock
const FLASH_ANIM_MS       = 150;    // line-clear flash duration
const COMBO_FLASH_MS      = 800;    // combo popup duration

// ─── Helpers ──────────────────────────────────────────────────
function cloneMatrix(m) { return m.map(r=>[...r]); }
function rotateCW(m) {
  const R=m.length, C=m[0].length;
  return Array.from({length:C},(_,c)=>Array.from({length:R},(_,r)=>m[R-1-r][c]));
}

// ─── 7-bag random ─────────────────────────────────────────────
class Bag {
  constructor() { this._bag=[]; }
  next() {
    if(!this._bag.length) {
      this._bag=[...BAG];
      for(let i=this._bag.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [this._bag[i],this._bag[j]]=[this._bag[j],this._bag[i]];
      }
    }
    const key=this._bag.pop();
    return {key, color:PIECES[key].color, shadow:PIECES[key].shadow, matrix:cloneMatrix(PIECES[key].matrix)};
  }
}

// ─── Game Logic (pure) ────────────────────────────────────────────
class TetrisGame {
  constructor(startLevel=1) {
    this.board   = Array.from({length:ROWS},()=>new Array(COLS).fill(0));
    this.score   = 0;
    this.level   = Math.max(1,Math.min(10,startLevel));
    this.lines   = 0;
    this.combo   = 0;
    this.gameOver= false;
    this._bag    = new Bag();
    this.next    = this._bag.next();
    this.piece   = null;
    this._stats  = {I:0,O:0,T:0,S:0,Z:0,J:0,L:0};
    this._clearAnim = [];
    this._lockDelay = LOCK_DELAY_MS;
    this._lockResets = 0;
    this._lockMaxResets = LOCK_MAX_RESETS;
    this._lockPending = false;
    this._lockTimer = null;
    this._spawn();
  }

  _clearAllTimers() {
    if(this._lockTimer) clearTimeout(this._lockTimer);
    this._lockTimer = null;
  }

  _spawn() {
    this.piece = this.next;
    this.next  = this._bag.next();
    this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
    this.piece.y = this.piece.key === 'I' ? -1 : 0;  // Fixed I-piece spawn above visible board
    this._stats[this.piece.key]++;
    if (this._hit(this.piece, 0, 0)) {
      this.gameOver = true;
    }
    this._lockPending = false;
    this._clearAllTimers();
    this._lockResets = 0;
  }

  _hit(p, dx, dy, mat) {
    const m = mat || p.matrix;
    for (let r=0; r<m.length; r++)
      for (let c=0; c<m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = p.x+c+dx, ny = p.y+r+dy;
        if (nx<0 || nx>=COLS || ny>=ROWS) return true;
        if (ny>=0 && this.board[ny][nx]) return true;
      }
    return false;
  }

  commitLock() {
    if (!this._lockPending) return;
    this._lockPending = false;
    this._clearAllTimers();
    return this._lock();
  }

  _lock() {
    const p = this.piece;
    let aboveTop = false;
    p.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (v) {
        const ny = p.y+r;
        if (ny < 0) aboveTop = true;
        if (ny >= 0) this.board[ny][p.x+c] = p.color;
      }
    }));
    if (aboveTop) { this.gameOver = true; return {cleared:0, topOut:true}; }

    const full = [];
    for (let r=ROWS-1; r>=0; r--)
      if (this.board[r].every(v=>v!==0)) full.push(r);

    if (full.length) {
      this._clearAnim = full;
      full.forEach(r => {
        this.board.splice(r,1);
        this.board.unshift(new Array(COLS).fill(0));
      });
      this.lines += full.length;
      this.combo++;
      const base  = SCORES[full.length] * this.level;
      const bonus = this.combo > 1 ? Math.floor(base * (this.combo-1) * 0.5) : 0;
      this.score += base + bonus;
      const newLevel = Math.min(10, 1 + Math.floor(this.lines/10));
      if (newLevel > this.level) this.level = newLevel;
      return {cleared:full.length, combo:this.combo};
    } else {
      this.combo = 0;
      return {cleared:0};
    }
  }

  resetLockTimer() {
    if (this._lockPending) {
      this._clearAllTimers();
      if (this._lockResets < this._lockMaxResets) {
        this._lockResets++;
        this._lockTimer = setTimeout(() => {
          const res = this.commitLock();
          if (res) return {locked:true, ...res};
        }, this._lockDelay);
      } else {
        const res = this.commitLock();
        if (res) return {locked:true, ...res};
      }
    }
    return null;
  }

  moveLeft()  { 
    if(!this._hit(this.piece,-1,0)){this.piece.x--;return true;} 
    this.resetLockTimer();
    return false; 
  }
  moveRight() { 
    if(!this._hit(this.piece, 1,0)){this.piece.x++;return true;} 
    this.resetLockTimer();
    return false; 
  }

  rotate(dir=1) {
    const m = dir>0 ? rotateCW(this.piece.matrix) : rotateCW(rotateCW(rotateCW(this.piece.matrix)));
    const kicks = [0,-1,1,-2,2];
    for (const dx of kicks)
      for (const dy of [0,-1])
        if (!this._hit(this.piece,dx,dy,m)) {
          this.piece.matrix = m;
          this.piece.x += dx;
          this.piece.y += dy;
          this.resetLockTimer();
          return true;
        }
    return false;
  }

  softDrop() {
    if (!this._hit(this.piece,0,1)) { this.piece.y++; this.score++; return {moved:true}; }
    if (!this._lockPending) {
      this._lockPending = true;
      this._lockTimer = setTimeout(() => {
        const res = this.commitLock();
        if (res) return {locked:true, ...res};
      }, this._lockDelay);
      return {moved:false};
    }
    return {moved:false};
  }

  hardDrop() {
    let dropped = 0;
    while (!this._hit(this.piece,0,1)) { this.piece.y++; dropped++; }
    this.score += dropped * 2;
    if (dropped === 0 && this.piece.y <= 1) {
      this.gameOver = true;
      return {cleared:0, locked:true, dropped:0};
    }
    if(this._lockTimer) clearTimeout(this._lockTimer);
    this._lockPending = false;
    const result = this._lock();
    if (!this.gameOver) this._spawn();
    return {...result, locked:true, dropped};
  }

  ghostY() {
    let dy=0;
    while (!this._hit(this.piece,0,dy+1)) dy++;
    return this.piece.y + dy;
  }

  getStats() { return {...this._stats}; }
}

// ─── Sound ────────────────────────────────────────────────────
class Sound {
  constructor() {
    this._ac = null;
    this.muted = false;
    this._musicTimer = null;
    this._noteIdx = 0;
    this._melody = [
      [659,400],[494,200],[523,200],[587,400],[523,200],[494,200],
      [440,400],[440,200],[523,200],[659,400],[587,200],[523,200],
      [494,600],[523,200],[587,400],[659,400],[523,400],[440,400],[440,400],null,
      [587,400],[698,200],[880,400],[784,200],[698,200],
      [659,600],[523,200],[659,400],[587,200],[523,200],
      [494,400],[494,200],[523,200],[587,400],[659,400],[523,400],[440,400],[440,400],null,
    ];
  }
  _ac_ctx() {
    if (!this._ac) try { this._ac = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
    if (this._ac?.state==='suspended') this._ac.resume();
    return this._ac;
  }
  _tone(freq, dur, type='square', vol=0.25, delay=0) {
    if (this.muted) return;
    const ac = this._ac_ctx(); if (!ac) return;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime+delay);
    g.gain.setValueAtTime(0, ac.currentTime+delay);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime+delay+0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+delay+dur/1000);
    osc.start(ac.currentTime+delay); osc.stop(ac.currentTime+delay+dur/1000+0.05);
  }
  move()    { this._tone(200,40,'square',0.08); }
  rotate()  { this._tone(300,50,'square',0.10); }
  land()    { this._tone(120,80,'square',0.18); }
  clear(n)  { [392,523,659,880].slice(0,n).forEach((f,i)=>this._tone(f,100,'sine',0.25,i*0.06)); }
  levelUp() { [523,659,784,1047].forEach((f,i)=>this._tone(f,120,'sine',0.25,i*0.08)); }
  over()    { [440,330,220,110].forEach((f,i)=>this._tone(f,200,'sawtooth',0.2,i*0.15)); }
  hardDropSfx(n) { this._tone(150+n*5, 60, 'square', 0.15); }

  startMusic() {
    if (this.muted) return;
    this._noteIdx = 0; this._playNote();
  }
  _playNote() {
    if (this.muted) return;
    const note = this._melody[this._noteIdx % this._melody.length];
    this._noteIdx++;
    const dur = note ? note[1] : 200;
    if (note) this._tone(note[0], dur*0.88, 'square', 0.08);
    this._musicTimer = setTimeout(()=>this._playNote(), dur);
  }
  stopMusic() { clearTimeout(this._musicTimer); this._musicTimer=null; }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic();
    return this.muted;
  }
}

// ─── Renderer ─────────────────────────────────────────────────
class Renderer {
  constructor(canvas, nextCanvas) {
    this.c   = canvas;
    this.ctx = canvas.getContext('2d');
    this.nc  = nextCanvas;
    this.nctx= nextCanvas.getContext('2d');
    this.c.width  = COLS*SZ;
    this.c.height = ROWS*SZ;
    this._flash = 0;
  }

  _block(ctx, x, y, color, shadow, alpha=1) {
    const bx=x*SZ, by=y*SZ;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(bx+1, by+1, SZ-2, SZ-2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx+2, by+2, SZ-4, 4);
    ctx.fillRect(bx+2, by+2, 4, SZ-4);
    ctx.fillStyle = shadow || 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx+SZ-6, by+2, 4, SZ-4);
    ctx.fillRect(bx+2, by+SZ-6, SZ-4, 4);
    ctx.globalAlpha = 1;
  }

  draw(game, flashRows=[]) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0,0,this.c.width,this.c.height);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
      ctx.fillRect(c*SZ+SZ/2-1, r*SZ+SZ/2-1, 2, 2);

    game.board.forEach((row,r) => {
      const isFlash = flashRows.includes(r);
      row.forEach((color,c) => {
        if (color) {
          if (isFlash) {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#fff';
            ctx.fillRect(c*SZ+1, r*SZ+1, SZ-2, SZ-2);
            ctx.globalAlpha = 1;
          } else {
            const key = BAG.find(k=>PIECES[k].color===color);
            this._block(ctx, c, r, color, key?PIECES[key].shadow:'#333');
          }
        }
      });
    });

    if (!game.piece || game.gameOver) return;

    // Ghost Piece
    const gy = game.ghostY();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    game.piece.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (v && gy+r !== game.piece.y+r) {
        const bx = (game.piece.x+c)*SZ+1, by = (gy+r)*SZ+1;
        ctx.strokeRect(bx, by, SZ-2, SZ-2);
        ctx.fillStyle = game.piece.color;
        ctx.fillRect(bx, by, SZ-2, SZ-2);
      }
    }));
    ctx.globalAlpha = 1;

    game.piece.matrix.forEach((row,r) => row.forEach((v,c) => {
      if (v) this._block(ctx, game.piece.x+c, game.piece.y+r, game.piece.color, game.piece.shadow);
    }));

    const levelColors=['#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722','#f44336','#e91e63','#9c27b0'];
    ctx.strokeStyle = levelColors[Math.min(game.level-1,9)];
    ctx.lineWidth = 2;
    ctx.strokeRect(1,1,this.c.width-2,this.c.height-2);

    this._drawNext(game.next);
  }

  _drawNext(piece) {
    const ctx = this.nctx, nw=this.nc.width, nh=this.nc.height;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0,0,nw,nh);
    if (!piece) return;
    const bs = 22;
    const ox = Math.floor((nw - piece.matrix[0].length*bs)/2);
    const oy = Math.floor((nh - piece.matrix.length*bs)/2);
    piece.matrix.forEach((row,r)=>row.forEach((v,c)=>{
      if(v) {
        ctx.fillStyle = piece.color;
        ctx.fillRect(ox+c*bs+1, oy+r*bs+1, bs-2, bs-2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(ox+c*bs+2, oy+r*bs+2, bs-3, 3);
      }
    }));
  }

  overlay(text, sub, color='#fff') {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,10,20,0.82)';
    ctx.fillRect(0,0,this.c.width,this.c.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 32px "Segoe UI",Arial';
    ctx.fillText(text, this.c.width/2, this.c.height/2-18);
    if (sub) {
      ctx.fillStyle = '#aaa';
      ctx.font = '15px "Segoe UI",Arial';
      ctx.fillText(sub, this.c.width/2, this.c.height/2+14);
    }
  }

  idle() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0,0,this.c.width,this.c.height);
    const colors = Object.values(PIECES).map(p=>p.color);
    for(let r=2;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      if(Math.random()<0.3) {
        ctx.globalAlpha=0.15+Math.random()*0.12;
        ctx.fillStyle=colors[Math.floor(Math.random()*colors.length)];
        ctx.fillRect(c*SZ+1,r*SZ+1,SZ-2,SZ-2);
      }
    }
    ctx.globalAlpha=1;
    this.overlay('TETRIS','Press  Start  to  play','#4caf50');
  }
}

// ─── Controller ───────────────────────────────────────────────
class TetrisController {
  constructor() {
    this.$  = id => document.getElementById(id);
    this.canvas   = this.$('tetris-canvas');
    this.renderer = new Renderer(this.canvas, this.$('next-canvas'));
    this.sound    = new Sound();
    this.game     = null;
    this.state    = 'idle';
    this.rafId    = null;
    this.dropAcc  = 0;
    this.lastTime = 0;
    this.flashRows= [];
    this.flashTimer=null;
    this._dasState = {};

    this._buildUI();
    this.renderer.idle();
  }

  _buildUI() {
    const sel = this.$('level-select');
    for(let i=1;i<=10;i++){
      const o=document.createElement('option');
      o.value=i; o.textContent='Level '+i; sel.appendChild(o);
    }

    this.$('btn-start').addEventListener('click',   ()=>this.start());
    this.$('btn-pause').addEventListener('click',   ()=>this.togglePause());
    this.$('btn-restart').addEventListener('click', ()=>this.start());
    const mb = this.$('btn-mute');
    if (mb) mb.addEventListener('click', ()=>{
      const m=this.sound.toggleMute();
      mb.textContent = m?'🔇':'🔊';
    });

    const handleKey = (code, action, isDown) => {
      if (isDown) {
        if (!this._dasState[code]) {
          this._dasState[code] = true;
          this._action(action);
          if (['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','KeyS'].includes(code)) {
            let first = true;
            this._dasState[code] = {
              timer: setTimeout(() => {
                this._dasState[code].interval = setInterval(() => {
                  this._action(action);
                }, 33);
              }, first ? 167 : 33)
            };
          }
        }
      } else {
        if (this._dasState[code]) {
          if (this._dasState[code].interval) clearInterval(this._dasState[code].interval);
          if (this._dasState[code].timer) clearTimeout(this._dasState[code].timer);
          delete this._dasState[code];
        }
      }
    };

    document.addEventListener('keydown', e=>{
      if (['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','KeyS','ArrowUp','KeyW','KeyZ','Space','KeyP','Escape','KeyM'].includes(e.code)) e.preventDefault();
      
      if (e.code === 'KeyP' || e.code === 'Escape') this._action('pause');
      else if (e.code === 'KeyM') this._action('mute');
      else handleKey(e.code, {
        'ArrowLeft':'left', 'KeyA':'left', 'ArrowRight':'right', 'KeyD':'right',
        'ArrowDown':'soft', 'KeyS':'soft', 'ArrowUp':'rotate', 'KeyW':'rotate',
        'KeyZ':'rotate_ccw', 'Space':'hard'
      }[e.code], true);
    });

    document.addEventListener('keyup', e=>{
      if (['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','KeyS'].includes(e.code)) {
        handleKey(e.code, null, false);
      }
    });

    let tx=0,ty=0,tTime=0;
    this.canvas.addEventListener('touchstart',e=>{
      tx=e.touches[0].clientX; ty=e.touches[0].clientY; tTime=Date.now();
      e.preventDefault();
    },{passive:false});
    this.canvas.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-tx;
      const dy=e.changedTouches[0].clientY-ty;
      const dt=Date.now()-tTime;
      if(Math.abs(dx)<15&&Math.abs(dy)<15&&dt<300){this._action('rotate');return;}
      if(Math.abs(dx)>Math.abs(dy)) this._action(dx>0?'right':'left');
      else if(dy>40)                this._action('hard');
      else if(dy<-40)               this._action('rotate');
      e.preventDefault();
    },{passive:false});

    this._refreshBest();
    this.$('btn-pause').disabled=true;
  }

  _key(e) {
    const K={
      ArrowLeft:'left',KeyA:'left',
      ArrowRight:'right',KeyD:'right',
      ArrowDown:'soft',KeyS:'soft',
      ArrowUp:'rotate',KeyW:'rotate',
      KeyZ:'rotate_ccw',
      Space:'hard',
      KeyP:'pause', Escape:'pause',
      KeyM:'mute',
    };
    const a=K[e.code];
    if (!a) return;
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code)) e.preventDefault();
    this._action(a);
  }

  _action(a) {
    if (a==='pause') { this.togglePause(); return; }
    if (a==='mute')  { this.sound.toggleMute(); return; }
    if (this.state!=='running'||!this.game) return;
    const g=this.game;
    switch(a){
      case 'left':       if(g.moveLeft())   this.sound.move(); break;
      case 'right':      if(g.moveRight())  this.sound.move(); break;
      case 'rotate':     if(g.rotate(1))    { this.sound.rotate(); navigator.vibrate && navigator.vibrate(8); } break;
      case 'rotate_ccw': if(g.rotate(-1))   { this.sound.rotate(); navigator.vibrate && navigator.vibrate(8); } break;
      case 'soft': {
        const r=g.softDrop();
        if(r.locked) this._onLock(r);
        break;
      }
      case 'hard': {
        const r=g.hardDrop();
        this.sound.hardDropSfx(r.dropped||0);
        navigator.vibrate && navigator.vibrate([10,10,40]);
        this._onLock(r);
        break;
      }
    }
  }

  _onLock(r) {
    if (this.game.gameOver) { this._onGameOver(); return; }
    if (r.cleared > 0) {
      this.flashRows = this.game._clearAnim || [];
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(()=>{ this.flashRows=[]; }, 150);
      this.sound.clear(r.cleared);
      if (r.combo > 1) this._showCombo(r.combo);
    }
    navigator.vibrate && navigator.vibrate(5);
    const prevLevel = this.game.level;
    this._updateHUD();
  }

  _showCombo(n) {
    const el = this.$('combo');
    if (!el) return;
    el.textContent = n+'x COMBO!';
    el.style.opacity='1';
    clearTimeout(this._comboTimer);
    this._comboTimer=setTimeout(()=>{el.style.opacity='0';},800);
  }

  start() {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.flashTimer);
    this.sound.stopMusic();
    const lvl = parseInt(this.$('level-select').value)||1;
    this.game   = new TetrisGame(lvl);
    this.dropAcc= 0; this.lastTime=0;
    this.state  = 'running';
    this.flashRows=[];
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
    const dt = this.lastTime ? Math.min(time-this.lastTime,100) : 0;
    this.lastTime=time;
    this.dropAcc+=dt;
    const spd=SPEEDS[Math.min(this.game.level-1,SPEEDS.length-1)];

    if (this.dropAcc>=spd) {
      this.dropAcc=0;
      const r=this.game.softDrop();
      if (r.locked) this._onLock(r);
      if (this.game.gameOver) { this._onGameOver(); return; }
    }

    this.renderer.draw(this.game, this.flashRows);
    this._updateHUD();
    this.rafId=requestAnimationFrame(t=>this._loop(t));
  }

  _onGameOver() {
    this.state='gameover';
    this.sound.stopMusic();
    this.sound.over();
    const score=this.game.score;
    this._saveBest(score);
    setTimeout(()=>{
      this.renderer.overlay('GAME OVER','Score: '+score+'  —  Press Start','#f44336');
    },300);
    this.$('btn-pause').disabled=true;
    this.$('btn-start').textContent='Start';
    this.$('level-select').disabled=false;
    this._refreshBest();
    this._updateHUD();
  }

  _updateHUD() {
    if(!this.game) return;
    this.$('score').textContent = this.game.score.toLocaleString();
    this.$('level').textContent = this.game.level;
    this.$('lines').textContent = this.game.lines;
  }

  _saveBest(score) {
    try{const b=parseInt(localStorage.getItem('tb')||'0'); if(score>b) localStorage.setItem('tb',score);}catch(e){}
  }
  _refreshBest() {
    const el=this.$('best'); if(!el) return;
    try{el.textContent=parseInt(localStorage.getItem('tb')||'0').toLocaleString();}catch(e){}
  }
}

// ─── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{ window._t=new TetrisController(); });