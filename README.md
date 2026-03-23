# 🎮 Tetris 2026

Neon-styled, browser-based Tetris mit sauberer Game-Engine, Mobile-Touch-Controls und CI-ready Build.

**Live:** https://skbotoc1-web.github.io/tetris/

## Highlights

- 7-Bag Randomizer + Ghost Piece + Hold + Hard Drop
- Kombos, Back-to-Back Tetris Bonus, progressive Level-Kurve
- Mobile-optimiertes UI inkl. Touch-Buttons
- Persistente Settings (Ghost, Hold, Hard Drop, SFX, Music, DAS)
- Highscore in localStorage
- Frame-rate-unabhängige Gravity (stabil auf langsamen/schnellen Geräten)

## Controls

- **Move:** `←` / `→`
- **Rotate CW:** `↑` oder `X`
- **Rotate CCW:** `Z`
- **Soft Drop:** `↓`
- **Hard Drop:** `Space`
- **Hold:** `C` / `Shift`
- **Pause:** `P` / `Esc`
- **Music Toggle:** `M`

## Development

```bash
git clone https://github.com/skbotoc1-web/tetris.git
cd tetris
npm install
npm run dev
```

## QA Loop

```bash
npm test
npm run lint
npm run build
```

## Tech

- Vanilla JS + Canvas + Web Audio API
- Vite (build/dev)
- Jest (unit tests)
- ESLint + Prettier

## License

MIT

(c) [Stefan Kaiser](https://stefankaiser.net)
