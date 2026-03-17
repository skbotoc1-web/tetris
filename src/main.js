// MIT License - Copyright (c) 2026 Stefan Kaiser
// https://github.com/skbotoc1-web/tetris
// main.js
(function() {
    'use strict';

    // Constants
    const CANVAS_WIDTH = 300;
    const CANVAS_HEIGHT = 600;
    const NEXT_CANVAS_SIZE = 200;
    const BLOCK_SIZE = 30;
    const COLS = CANVAS_WIDTH / BLOCK_SIZE;
    const ROWS = CANVAS_HEIGHT / BLOCK_SIZE;
    const FPS = 60;
    const TICK_RATE_BASE = 1000; // ms per drop at level 1

    // Colors
    const COLORS = {
        I: '#00f0f0',
        O: '#f0f000',
        T: '#a000f0',
        S: '#00f000',
        Z: '#f00000',
        J: '#0000f0',
        L: '#f0a000',
        Empty: '#1a1a2e',
        Ghost: 'rgba(255, 255, 255, 0.2)'
    };

    // DOM Elements
    const canvas = document.getElementById('tetris-canvas');
    const ctx = canvas.getContext('2d');
    const nextCanvas = document.getElementById('next-canvas');
    const nextCtx = nextCanvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const linesEl = document.getElementById('lines');
    const gameOverScreen = document.getElementById('gameover-screen');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnRestart = document.getElementById('btn-restart');
    const levelSelect = document.getElementById('level-select');

    // Resize canvases
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    nextCanvas.width = NEXT_CANVAS_SIZE;
    nextCanvas.height = NEXT_CANVAS_SIZE;

    // State
    let gameRunning = false;
    let paused = false;
    let lastTime = 0;
    let dropCounter = 0;
    let dropInterval = TICK_RATE_BASE;
    let animationId = null;

    // Engine Instances (Assumed global or module-loaded)
    // If using modules, this would be: import TetrisEngine from './tetris-engine.js';
    // Assuming global classes based on prompt description.
    let gameEngine;
    let soundEngine;

    // High Score Management
    const HIGH_SCORES_KEY = 'tetris_high_scores';
    
    function getHighScores() {
        const stored = localStorage.getItem(HIGH_SCORES_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    function saveHighScore(score) {
        const scores = getHighScores();
        scores.push({ score: score, date: new Date().toISOString() });
        scores.sort((a, b) => b.score - a.score);
        const top5 = scores.slice(0, 5);
        localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(top5));
        return top5;
    }

    function renderNextPiece(piece) {
        if (!piece) {
            nextCtx.fillStyle = COLORS.Empty;
            nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
            return;
        }

        // Clear next canvas
        nextCtx.fillStyle = COLORS.Empty;
        nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

        const blockSize = 25; // Slightly smaller for preview
        const offsetX = (nextCanvas.width - (piece.matrix[0].length * blockSize)) / 2;
        const offsetY = (nextCanvas.height - (piece.matrix.length * blockSize)) / 2;

        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextCtx.fillStyle = piece.color;
                    nextCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            });
        });
    }

    function drawBlock(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        
        // Add a subtle bevel effect
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, 4);
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 4, BLOCK_SIZE - 1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x * BLOCK_SIZE + BLOCK_SIZE - 5, y * BLOCK_SIZE, 5, BLOCK_SIZE - 1);
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE + BLOCK_SIZE - 5, BLOCK_SIZE - 1, 5);
    }

    function drawBoard(board) {
        // Fill background
        ctx.fillStyle = COLORS.Empty;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw placed blocks
        for (let y = 0; y < board.length; y++) {
            for (let x = 0; x < board[y].length; x++) {
                const value = board[y][x];
                if (value !== 0) {
                    drawBlock(x, y, value);
                }
            }
        }
    }

    function drawActivePiece(piece, ghostY = null) {
        if (!piece) return;

        // Draw Ghost Piece
        if (ghostY !== null) {
            piece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        ctx.fillStyle = COLORS.Ghost;
                        ctx.fillRect(
                            (piece.pos.x + x) * BLOCK_SIZE,
                            (ghostY + y) * BLOCK_SIZE,
                            BLOCK_SIZE - 1,
                            BLOCK_SIZE - 1
                        );
                    }
                });
            });
        }

        // Draw Active Piece
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(piece.pos.x + x, piece.pos.y + y, piece.color);
                }
            });
        });
    }

    function updateUI() {
        if (!gameEngine) return;
        
        scoreEl.textContent = gameEngine.score;
        levelEl.textContent = gameEngine.level;
        linesEl.textContent = gameEngine.lines;
        
        if (gameEngine.nextPiece) {
            renderNextPiece(gameEngine.nextPiece);
        }
    }

    function gameLoop(time = 0) {
        if (!gameRunning || paused) {
            animationId = requestAnimationFrame(gameLoop);
            return;
        }

        const deltaTime = time - lastTime;
        lastTime = time;

        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            if (gameEngine.step()) {
                // Game Over
                gameOver();
                return; 
            }
            dropCounter = 0;
        }

        // Render
        drawBoard(gameEngine.board);
        
        // Calculate ghost position
        let ghostY = null;
        if (gameEngine.activePiece) {
            ghostY = gameEngine.getGhostY();
            drawActivePiece(gameEngine.activePiece, ghostY);
        }

        updateUI();

        animationId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        // Stop existing loop
        if (animationId) cancelAnimationFrame(animationId);
        
        const startingLevel = parseInt(levelSelect.value) || 1;
        
        // Initialize Engine
        if (typeof TetrisEngine === 'undefined') {
            alert('TetrisEngine class not found. Ensure tetris-engine.js is loaded.');
            return;
        }
        gameEngine = new TetrisEngine(startingLevel);

        // Calculate drop interval based on level
        dropInterval = Math.max(100, TICK_RATE_BASE - ((startingLevel - 1) * 100));

        // Initialize Sound
        if (typeof TetrisSoundEngine !== 'undefined') {
            soundEngine = new TetrisSoundEngine();
            // Bind engine events to sounds if the engine has an event emitter
            // Assuming simple method calls or callbacks, otherwise we poll or use specific hooks.
            // For this implementation, we assume the engine exposes events or we wrap methods.
            // If the engine is simple, we might need to hook into the step function.
        }

        gameRunning = true;
        paused = false;
        gameOverScreen.style.display = 'none';
        btnStart.disabled = true;
        levelSelect.disabled = true;
        btnPause.disabled = false;
        
        lastTime = performance.now();
        dropCounter = 0;
        
        if (soundEngine) soundEngine.play('start');
        
        animationId = requestAnimationFrame(gameLoop);
    }

    function pauseGame() {
        if (!gameRunning) return;
        paused = !paused;
        btnPause.textContent = paused ? 'Resume' : 'Pause';
        if (paused) {
            if (soundEngine) soundEngine.play('pause');
        } else {
            lastTime = performance.now();
            if (soundEngine) soundEngine.play('resume');
        }
    }

    function gameOver() {
        gameRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        
        const finalScore = gameEngine.score;
        const top5 = saveHighScore(finalScore);
        
        if (soundEngine) soundEngine.play('game_over');
        
        gameOverScreen.innerHTML = `
            <h2>Game Over</h2>
            <p>Score: ${finalScore}</p>
            <p>Level: ${gameEngine.level}</p>
            <p>Lines: ${gameEngine.lines}</p>
        `;
        gameOverScreen.style.display = 'flex';
        
        btnStart.disabled = false;
        levelSelect.disabled = false;
        btnPause.disabled = true;
        btnPause.textContent = 'Pause';
    }

    function restartGame() {
        gameOverScreen.style.display = 'none';
        startGame();
    }

    // Input Handling
    function handleInput(action) {
        if (!gameRunning || paused) return;

        if (soundEngine) {
            switch(action) {
                case 'move': soundEngine.play('move'); break;
                case 'rotate': soundEngine.play('rotate'); break;
                case 'drop': soundEngine.play('drop'); break;
            }
        }

        switch(action) {
            case 'left':
                gameEngine.move(-1);
                break;
            case 'right':
                gameEngine.move(1);
                break;
            case 'down':
                gameEngine.move(0); // Soft drop
                break;
            case 'rotate':
                gameEngine.rotate();
                break;
            case 'hard_drop':
                gameEngine.hardDrop();
                break;
        }
    }

    // Keyboard Events
    document.addEventListener('keydown', (e) => {
        if (!gameRunning && e.key.toLowerCase() === 'enter') {
            startGame();
            return;
        }

        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                handleInput('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                handleInput('right');
                break;
            case 'ArrowDown':
                e.preventDefault();
                handleInput('down');
                break;
            case 'ArrowUp':
                e.preventDefault();
                handleInput('rotate');
                break;
            case ' ':
                e.preventDefault();
                handleInput('hard_drop');
                break;
            case 'p':
            case 'P':
                pauseGame();
                break;
        }
    });

    // Touch Events
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastMoveTime = 0;
    const SWIPE_THRESHOLD = 30;
    const TAP_DELAY = 200;

    canvas.addEventListener('touchstart', (e) => {
        if (!gameRunning || paused) return;
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        lastMoveTime = 0;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!gameRunning || paused) return;
        e.preventDefault();
        
        const touch = e.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        const duration = Date.now() - touchStartTime;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (duration < TAP_DELAY && absX < 10 && absY < 10) {
            // Tap
            handleInput('rotate');
        } else if (absX > absY && absX > SWIPE_THRESHOLD) {
            // Horizontal Swipe
            if (deltaX > 0) handleInput('right');
            else handleInput('left');
        } else if (absY > absX && absY > SWIPE_THRESHOLD) {
            // Vertical Swipe
            if (deltaY > 0) {
                // Down swipe -> Hard drop or soft drop? 
                // Prompt says "down swipe". Usually down is soft drop, but hard drop is space.
                // Let's make down swipe soft drop repeated or hard drop.
                // Standard Tetris on mobile often maps swipe down to hard drop if fast, or soft drop.
                // Let's do hard drop for distinct swipe down.
                handleInput('hard_drop');
            }
        }
    }, { passive: false });

    // Continuous movement for hold down touch?
    // For simplicity in this script, we stick to tap/swipe. 
    // If we wanted hold, we'd need touchmove.

    // Button Listeners
    btnStart.addEventListener('click', startGame);
    btnPause.addEventListener('click', pauseGame);
    btnRestart.addEventListener('click', restartGame);
    
    // Initial UI Setup
    levelSelect.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Level ${i}`;
        levelSelect.appendChild(opt);
    }
    levelSelect.value = '1';
    levelSelect.disabled = true;
    btnPause.disabled = true;

    // Initial Render (Empty board)
    ctx.fillStyle = COLORS.Empty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press Start to Play', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);

})();