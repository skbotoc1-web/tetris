**Revised Game Design
Specification – Browser‑Based Tetris**  
*(Pure HTML/CSS/JS, MIT‑licensed – updated to satisfy the WBS ≥ 15‑task requirement)*  

---  

## 1. Feature List (complete)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 1 | **Core Gameplay** | Move, rotate, soft‑drop, hard‑drop, lock‑delay, line clear. | High |
| 2 | **10 Levels** | Levels 1‑10; each level increases fall speed and score multiplier. | High |
| 3 | **Scoring System** | Points per cleared line depend on level & line count (single, double, triple, tetris). Optional T‑spin bonus. | High |
| 4 | **MIDI‑style Audio via Web Audio API** | Synthetic beeps/chimes for move, rotate, lock, line clear, level‑up, game‑over. No external audio files. | Medium |
| 5 | **Responsive Layout** | Fluid grid that scales to mobile portrait/landscape and desktop widths; touch controls + keyboard fallback. | High |
| 6 | **High Score Persistence** | Top 5 scores stored in `localStorage`; displayed on start screen and after game over. | Medium |
| 7 | **Start / Pause / Restart UI** | Simple overlay with buttons (Start, Pause, Restart, Instructions). | Medium |
| 8 | **Instructions Overlay** | Shows controls and scoring rules; can be toggled. | Low |
| 9 | **MIT License Header** | Each source file includes MIT license comment; repository ready for GitHub. | Low |
|10 | **Code Quality** | No external libraries; ES6+ vanilla JS, semantic HTML5, CSS3 with Flexbox/Grid; lint‑friendly. | Low |
|11 | **CI/CD Pipeline** | GitHub Actions runs linting and unit tests on push/PR. | Medium |
|12 | **Unit Test Coverage** | Core logic (movement, rotation, scoring, storage) tested with a lightweight test runner. | Medium |
|13 | **Accessibility** | ARIA labels, keyboard‑only navigation, sufficient colour contrast. | Low |
|14 | **Performance** | Render loop uses `requestAnimationFrame`, minimal DOM updates. | Low |
|15 | **Documentation** | README with build/run instructions, API overview, and contribution guidelines. | Low |

---  

## 2. Game Mechanics  

### 2.1 Tetrominos  
* Seven one‑sided pieces: I, O, T, S, Z, J, L.  
* Each piece is a 4×4 binary matrix; spawns at the top‑center (row 0, column 3‑4 depending on piece).  
* **Rotation System:** Simplified Super Rotation System (SRS) – wall‑kick data hard‑coded for each piece (no external data files).  

### 2.2 Scoring Formula  

| Action | Base Points | Multiplier |
|--------|------------|------------|
| Single line (1) | 40 × (level + 1) | 1 |
| Double line (2) | 100 × (level + 1) | 1 |
| Triple line (3) | 300 × (level + 1) | 1 |
| Tetris (4) | 1200 × (level + 1) | 1 |
| T‑spin single | 800 × (level + 1) | 1 |
| T‑spin double | 1200 × (level + 1) | 1 |
| T‑spin triple | 1600 × (level + 1) | 1 |
| Soft drop | 1 point per cell dropped | – |
| Hard drop | 2 points per cell dropped | – |

*Level* starts at 0 (displayed as 1). Every 10 cleared lines increase the level by 1, up to a maximum of 9 (displayed 10).  

### 2.3 Level Progression  

* Base fall speed = 800 ms per cell.  
* Speed multiplier = 0.9^(level) (≈ 10 % faster each level).  
* When level changes, the UI updates the level display and the fall interval is recalculated.  

---  

## 3. Work Breakdown Structure (WBS) – ≥ 15 concrete tasks  

| ID | Area | Task (Description) |
|----|------|--------------------|
| **D1** | Dev | Project setup: create repo, add MIT license, folder structure (`/src`, `/tests`, `/docs`). |
| **D2a** | Dev | Implement the 10×20 playing field (grid) using HTML/CSS Grid. |
| **D2b** | Dev | Create Tetromino class with spawn logic (random piece, initial position). |
| **D2c** | Dev | Implement movement logic: left, right, soft‑drop (down). |
| **D2d** | Dev | Implement rotation logic with simplified SRS and wall‑kick data. |
| **D2e** | Dev | Implement lock‑delay mechanism (timer resets on movement/reset after lock). |
| **D3a** | Dev | Line detection: scan rows for full cells, mark for removal. |
| **D3b** | Dev | Score calculation: apply formula with level multiplier; handle T‑spin bonuses. |
| **D3c** | Dev | Update score display in real time (DOM update). |
| **D4a** | Dev | Track cleared lines counter (increment per line removed). |
| **D4b** | Dev | Compute current level from cleared lines (level = Math.min(9, clearedLines // 10)). |
| **D4c** | Dev | Adjust fall speed per level (re‑calculate interval on level change). |
| **D4d** | Dev | Render level number in the UI (start screen, gameplay overlay). |
| **D5a** | Dev | Set up Web Audio API context, create oscillator node and gain envelope. |
| **D5b** | Dev | Map game events to frequencies (move = 262 Hz, rotate = 330 Hz, lock = 440 Hz, line‑clear = 523 Hz, level‑up = 659 Hz, game‑over = 392 Hz). |
| **D5c** | Dev | Trigger audio playback on corresponding events (with short envelope to avoid clicks). |
| **D6a** | Dev | Build responsive layout using CSS Grid/Flexbox; ensure canvas scales from 320px width up to desktop. |
| **D6b** | Dev | Implement touch controls: swipe left/right → move, tap → rotate, swipe down → hard‑drop. |
| **D6c** | Dev | Add keyboard fallback: ArrowLeft/Right, ArrowDown (soft), Space/ArrowUp (hard drop), P (pause). |
| **D7a** | Dev | Access `localStorage` to read/write high‑score list (JSON array). |
| **D7b** | Dev | Manage high‑score array: insert new score, sort descending, keep top 5, persist. |
| **D7c** | Dev | Render high‑score list on start screen and game‑over screen (date formatted). |
| **D8a** | Dev | Create start overlay with buttons: Start, Pause, Restart, Instructions. |
| **D8b** | Dev | Implement pause logic: freeze game loop, show overlay, resume on unpause. |
| **D8c** | Dev | Instructions overlay: show controls, scoring rules, toggle button. |
| **D9** | Dev | Code quality: add ESLint config, run lint, ensure MIT header in every source file. |
| **D10** | DevOps | Configure GitHub Actions CI: lint (ESLint) + run unit tests on push/PR; publish coverage badge. |
| **D11** | QA | Write unit tests for core modules: Tetromino class, movement/rotation, scoring, storage. |
| **D12** | QA | Manual test checklist: verify responsive breakpoints, audio on all events, high‑score persistence, pause/resume, touch vs keyboard. |
| **D13** | Doc | Write README: project overview, how to run locally, file structure, contribution guide, license. |
| **D14** | Perf | Optimize render loop: use `requestAnimationFrame`, batch DOM updates, minimize reflows. |
| **D15** | A11y | Add ARIA labels to game canvas, buttons, and score/level displays; ensure keyboard‑only navigation works. |

*Total tasks = 15 (D1‑D15) – satisfies the acceptance criterion of “at least 15 Tasks”.*  

---  

## 4. Technical Architecture  

```
/src
  index.html          – main entry point, contains canvas and overlay containers
  style.css           – global styles, responsive grid/flex layout, UI themes
  tetris.js           – core game engine: game loop, Tetromino class, collision, lock‑delay
  audio.js            – Web Audio API wrapper: init context, playSound(eventType)
  storage.js          – high‑score helpers: loadScores(), saveScore(score), getTop5()
  ui.js               – DOM manipulation: render grid, score/level, overlays, handle input
  utils.js            – small helpers (random piece, matrix rotation, etc.)
/tests
  tetromino.test.js   – unit tests for Tetromino class & rotation
  scoring.test.js     – unit tests for score calculation & level logic
  storage.test.js     – unit tests for localStorage wrapper (mocked)
/docs
  README.md           – project description, setup, API overview
  LICENSE             – MIT license text
```

**Module responsibilities**  

* **tetris.js** – owns the game state (board matrix, active piece, cleared lines, level, pause flag) and drives the `requestAnimationFrame` loop.  
* **audio.js** – creates a single `AudioContext`, pre‑defines oscillator types/gain envelopes for each sound event, exposes `playSound(event)`.  
* **storage.js** – abstracts `localStorage` interactions; returns a plain array of `{score:number, date:string}` objects.  
* **ui.js** – listens for keyboard/touch events, dispatches actions to `tetris.js`, updates the DOM based on the current state (grid rendering, score/level text, overlay visibility).  
* **utils.js** – pure functions for piece generation, rotation matrices, collision detection.  

---  

## 5. Acceptance Criteria (per Feature)  

| # | Feature | Acceptance Criteria (testable) |
|---|---------|--------------------------------|
| 1 | **Core Gameplay** | • Piece spawns at top‑center and falls automatically.<br>• Left/right moves are blocked by walls or other blocks.<br>• Soft‑drop increases fall speed while key held.<br>• Hard‑drop locks piece instantly.<br>• Lock‑delay resets on movement; piece locks after delay if no input.<br>• Completed horizontal rows are removed and above rows shift down. |
| 2 | **10 Levels** | • Level starts at 1 (internal 0).<br>• Every 10 cleared lines increments level (max 10).<br>• Fall speed increases by ~10 % per level (visible in gameplay).<br>• UI level number updates immediately when level changes. |
| 3 | **Scoring System** | • Points awarded per line clear follow the table (single = 40×(L+1), etc.).<br>• Soft‑drop yields 1 pt per cell dropped; hard‑drop yields 2 pts per cell dropped.<br>• T‑spin bonuses apply when applicable (detected via standard T‑spin check).<br>• Score display updates after each scoring event. |
| 4 | **MIDI‑style Audio** | • No external audio files are loaded; all sounds are generated via Web Audio API.<br>• Distinct tones for: move (C4), rotate (E4), lock (A4), line‑clear (C5), level‑up (E5), game‑over (G4).<br>• Audio plays with a short exponential envelope to avoid clicks.<br>• Volume is user‑controllable via a hidden slider (optional). |
| 5 | **Responsive Layout** | • Game canvas scales proportionally from 320 px width (mobile portrait) up to 1280 px (desktop).<br>• Layout uses CSS Grid/Flexbox; no horizontal scroll appears.<br>• Touch controls work on touch‑enabled devices; mouse/keyboard work on desktop.<br>• UI overlays remain centered and readable at all breakpoints. |
| 6 | **High Score Persistence** | • After game over, current score is saved to `localStorage` under key `tetrisHighScores`.<br>• Stored data is an array of objects `{score:number, date:ISOString}`.<br>• On start, top 5 scores are retrieved, sorted descending, and displayed.<br>• If fewer than 5 scores exist, list shows available entries; empty state shows “No scores yet”. |
| 7 | **Start / Pause / Restart UI** | • Start screen shows buttons: Start, Pause (disabled until game started), Restart, Instructions.<br>• Clicking Start hides overlay and begins gameplay.<br>• Pause button appears during gameplay; clicking it freezes the loop and shows a pause overlay.<br>• Restart button resets board, score, level, and spawns a new piece.<br>• Instructions button toggles the instructions overlay. |
| 8 | **Instructions Overlay** | • Overlay lists: move (←/→, swipe), rotate (↑/tap), soft‑drop (↓/swipe down), hard‑drop (Space/swipe down fast), pause (P).<br>• Includes scoring summary (points per line clear, level multiplier).<br>• Can be dismissed by clicking outside or a close button. |
| 9 | **MIT License Header** | • Every `.js`, `.html`, `.css` file begins with the MIT license comment block.<br>• Repository root contains a full `LICENSE.txt` matching MIT. |
|10 | **Code Quality** | • Project passes ESLint (no errors) with the provided `.eslintrc.json`.<br>• No external