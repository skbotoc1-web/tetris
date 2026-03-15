// MIT License - Copyright (c) 2026 Stefan Kaiser
// https://github.com/skbotoc1-web/tetris

(function() {
    'use strict';

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const canvas      = document.getElementById('tetris-canvas');
    const ctx         = canvas.getContext('2d');
    const nextCanvas  = document.getElementById('next-canvas');
    const nextCtx     = nextCanvas.getContext('2d');
    const scoreEl     = document.getElementById('score');
    const levelEl     = document.getElementById('level');
    const linesEl     = document.getElementById('lines');
    const gameOverEl  = document.getElementById('gameover-screen');
    const btnStart    = document.getElementById('btn-start');
    const btnPause    = document.getElementById('btn-pause');
    const btnRestart  = document.getElementById('btn-restart');
    const levelSelect = document.getElementById('level-select');

    // ── Constants ─────────────────────────────────────────────────────────────
    const COLS       = 10;
    const ROWS       = 20;
    const BLOCK      = 30;
    const COLORS     = {
        Empty: '#1a1a2e',
        Ghost: 'rgba(255,255,255,0.15)',
        '#00f0f0': '#00f0f0', // I
        '#f0f000': '#f0f000', // O
        '#a000f0': '#a000f0', // T
        '#00f000': '#00f000', // S
        '#f00000': '#f00000', // Z
        '#0000f0': '#0000f0', // J
        '#f0a000': '#f0a000', // L
    };

    // Level drop speeds in ms
    const SPEEDS = [800,700,600,500,400,300,250,200,150,100];

    // ── State ─────────────────────────────────────────────────────────────────
    let engine       = null;
    let sound        = null;
    let running      = false;
    let paused       = false;
    let rafId        = null;
    let dropCounter  = 0;
    let lastTime     = 0;
    let dropInterval = 800;

    // ── Rendering ─────────────────────────────────────────────────────────────
    function drawBlock(ctx, x, y, color, alpha) {
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
        // Bevel
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, 3);
        ctx.fillRect(x * BLOCK, y * BLOCK, 3, BLOCK - 1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x * BLOCK + BLOCK - 4, y * BLOCK, 4, BLOCK - 1);
        ctx.fillRect(x * BLOCK, y * BLOCK + BLOCK - 4, BLOCK - 1, 4);
        if (alpha !== undefined) ctx.globalAlpha = 1;
    }

    function getGhostY(board, player) {
        let ghostY = player.pos.y;
        while (true) {
            ghostY++;
            // Check collision at ghostY
            let hit = false;
            for (let r = 0; r < player.matrix.length; r++) {
                for (let c = 0; c < player.matrix[r].length; c++) {
                    if (!player.matrix[r][c]) continue;
                    const ny = ghostY + r;
                    const nx = player.pos.x + c;
                    if (ny >= ROWS || nx < 0 || nx >= COLS || (board[ny] && board[ny][nx] !== 0)) {
                        hit = true; break;
                    }
                }
                if (hit) break;
            }
            if (hit) { ghostY--; break; }
        }
        return ghostY;
    }

    function render() {
        if (!engine) return;

        const state = engine.getGameState();
        const board = state.board;
        const player = engine.player;

        // Clear
        ctx.fillStyle = COLORS.Empty;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid lines (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
            }
        }

        // Draw placed blocks
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[r].length; c++) {
                const val = board[r][c];
                if (val && val !== 0) {
                    drawBlock(ctx, c, r, val);
                }
            }
        }

        // Draw ghost piece
        if (player && player.matrix && running && !paused) {
            const ghostY = getGhostY(board, player);
            player.matrix.forEach((row, r) => {
                row.forEach((val, c) => {
                    if (val !== 0) {
                        ctx.fillStyle = COLORS.Ghost;
                        ctx.fillRect(
                            (player.pos.x + c) * BLOCK,
                            (ghostY + r) * BLOCK,
                            BLOCK - 1, BLOCK - 1
                        );
                    }
                });
            });
        }

        // Draw active piece
        if (player && player.matrix) {
            player.matrix.forEach((row, r) => {
                row.forEach((val, c) => {
                    if (val !== 0) {
                        drawBlock(ctx, player.pos.x + c, player.pos.y + r, player.color || '#ffffff');
                    }
                });
            });
        }

        // Draw next piece
        if (engine.nextPiece && engine.nextPiece.matrix) {
            nextCtx.fillStyle = COLORS.Empty;
            nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
            const np = engine.nextPiece;
            const bSize = 20;
            const offX = Math.floor((nextCanvas.width  - np.matrix[0].length * bSize) / 2);
            const offY = Math.floor((nextCanvas.height - np.matrix.length    * bSize) / 2);
            np.matrix.forEach((row, r) => {
                row.forEach((val, c) => {
                    if (val !== 0) {
                        nextCtx.fillStyle = np.color || '#ffffff';
                        nextCtx.fillRect(offX + c*bSize, offY + r*bSize, bSize-1, bSize-1);
                    }
                });
            });
        }

        // Update HUD
        scoreEl.textContent = state.score;
        levelEl.textContent = state.level;
        linesEl.textContent = state.lines;
    }

    // ── Game Loop ─────────────────────────────────────────────────────────────
    function loop(time = 0) {
        if (!running || !engine) { rafId = requestAnimationFrame(loop); return; }

        if (!paused) {
            const dt = time - lastTime;
            lastTime = time;
            dropCounter += dt;

            if (dropCounter >= dropInterval) {
                dropCounter = 0;
                // Manual drop
                engine.playerDrop();
                const state = engine.getGameState();
                if (state.gameOver) { showGameOver(); return; }
                // Update speed based on level
                dropInterval = SPEEDS[Math.min(state.level - 1, SPEEDS.length - 1)];
            }
        }

        render();
        rafId = requestAnimationFrame(loop);
    }

    // ── Game Control ──────────────────────────────────────────────────────────
    function startGame() {
        if (typeof TetrisEngine === 'undefined') {
            alert('TetrisEngine not loaded.');
            return;
        }

        cancelAnimationFrame(rafId);
        const startLevel = parseInt(levelSelect.value) || 1;
        dropInterval = SPEEDS[Math.min(startLevel - 1, SPEEDS.length - 1)];

        // Create engine — pass canvas id + state-change callback
        engine = new TetrisEngine('tetris-canvas', function(state) {});
        engine.setLevel(startLevel);

        // Init sound
        if (typeof TetrisSound !== 'undefined') {
            sound = TetrisSound;
        }

        gameOverEl.classList.add('hidden');
        running = true;
        paused  = false;
        dropCounter = 0;
        lastTime = 0;

        btnPause.disabled = false;
        btnStart.textContent = 'Restart';
        levelSelect.disabled = true;

        rafId = requestAnimationFrame(loop);
    }

    function pauseGame() {
        if (!running) return;
        paused = !paused;
        if (!paused) {
            lastTime = performance.now();
        }
        btnPause.textContent = paused ? 'Resume' : 'Pause';
    }

    function restartGame() {
        startGame();
    }

    function showGameOver() {
        running = false;
        cancelAnimationFrame(rafId);

        const state = engine ? engine.getGameState() : { score: 0 };
        gameOverEl.classList.remove('hidden');
        gameOverEl.innerHTML = `
            <div class="gameover-text">GAME OVER</div>
            <div class="final-score">Score: <strong>${state.score}</strong></div>
            <button class="btn-start" onclick="document.getElementById('btn-start').click()">Play Again</button>
        `;
        if (sound) sound.playSfx('gameover');

        // Save high score
        saveHighScore(state.score);

        btnPause.disabled = true;
        btnStart.textContent = 'Start';
        levelSelect.disabled = false;
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    document.addEventListener('keydown', function(e) {
        if (!running || paused || !engine) return;
        switch (e.code) {
            case 'ArrowLeft':  case 'KeyA': engine.playerMove(-1); e.preventDefault(); break;
            case 'ArrowRight': case 'KeyD': engine.playerMove(1);  e.preventDefault(); break;
            case 'ArrowDown':  case 'KeyS': engine.playerDrop();   dropCounter = 0; e.preventDefault(); break;
            case 'ArrowUp':    case 'KeyW': engine.playerRotate(1); e.preventDefault(); break;
            case 'Space':  engine.playerHardDrop(); dropCounter = 0; e.preventDefault(); break;
            case 'KeyP':   pauseGame(); break;
        }
    });

    // Touch support
    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
        if (!running || paused || !engine) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (absDx < 10 && absDy < 10) { engine.playerRotate(1); return; }
        if (absDx > absDy) {
            engine.playerMove(dx > 0 ? 1 : -1);
        } else if (dy > 0) {
            engine.playerHardDrop();
        }
        e.preventDefault();
    }, { passive: false });

    // ── High Score ────────────────────────────────────────────────────────────
    function saveHighScore(score) {
        try {
            const scores = JSON.parse(localStorage.getItem('tetris-scores') || '[]');
            scores.push({ score, date: new Date().toLocaleDateString() });
            scores.sort((a,b) => b.score - a.score);
            localStorage.setItem('tetris-scores', JSON.stringify(scores.slice(0,5)));
        } catch(e) {}
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    btnStart.addEventListener('click', startGame);
    btnPause.addEventListener('click', pauseGame);
    btnRestart.addEventListener('click', restartGame);

    // Populate level select
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'Level ' + i;
        levelSelect.appendChild(opt);
    }
    levelSelect.value = '1';
    btnPause.disabled = true;

    // Initial canvas message
    ctx.fillStyle = COLORS.Empty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press Start', canvas.width/2, canvas.height/2 - 10);
    ctx.fillStyle = '#888';
    ctx.font = '14px Arial';
    ctx.fillText('to play', canvas.width/2, canvas.height/2 + 15);

})();
