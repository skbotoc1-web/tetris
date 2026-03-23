# Tetris 2026 — Iterative Rebuild Plan

## Ziel
Marktfähige, stabile, spaßige WebApp mit klarer UX, robustem Gameplay und reproduzierbarem QA-Loop.

## Iteration 1 (done)
- Ist-Analyse + Regression-Check (test/build/lint)
- UI-Neudesign (2026-Style, responsive panel layout)
- Mobile Touch Control Buttons ergänzt
- HUD/State Klarheit (`Ready/Running/Paused/Game Over`)
- QA-Härtung in jest setup + lint warnings entfernt

## Iteration 2 (next)
- Gameplay-Polish: Input-Feel, Lock-Delay-Feinschliff, Balance Tuning
- UX: Start/Onboarding, besseres Feedback bei Level-Up/Combo
- Audio-Mix verbessern (Lautheit, Frequenzbalance)
- Erweiterte Tests für Scoring, lock state, pause/resume edge cases

## Iteration 3
- Product Layer: Sprint Mode / Challenge Mode
- Accessibility pass (Kontrast, reduced motion, key remap prep)
- Performance Profiling (mobile mid-tier)

## Go/No-Go Gates pro Iteration
1. `npm test` grün
2. `npm run lint` ohne warnings/errors
3. `npm run build` erfolgreich
4. Manueller Smoke-Check: Start, Pause, Hold, Hard Drop, Game Over, Restart
