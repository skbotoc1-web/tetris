# Tetris Web Game — Projekt Kickoff

**Datum:** 2026-03-15  
**Auftraggeber:** Stefan Kaiser  
**Orchestrator:** SKBOT  
**Lizenz:** MIT

---

## Mission Statement
> "Building an autonomous 24/7 business that creates value for the real world that every person and organization achieves more."

---

## Projektziel
Vollständiges, browser-spielbares Tetris-Spiel mit:
- 10 Levels (steigende Geschwindigkeit + Punktemultiplikator)
- MIDI-Sound (Web Audio API, kostenlos, kein Backend)
- Sauberes UI/UX, responsive
- MIT-lizenziert, GitHub-Release

## Team
| Bot | Rolle | Modell |
|---|---|---|
| skbot-01 | Dev — Frontend/Game Engine | NVIDIA Nemotron (kostenlos) |
| skbot-02 | DevOps — Build, GitHub CI/CD | NVIDIA Nemotron (kostenlos) |
| skbot-03 | Research/PM — Spec, Docs | NVIDIA Nemotron (kostenlos) |
| skbot-04 | QA/Security — Review, Tests | NVIDIA Nemotron (kostenlos) |
| SKBOT (master) | Orchestrator, QA-Gate | Anthropic (max 1 USD) |

## Budget
- Anthropic API: max 1 USD gesamt
- Alle Worker-Calls: 0 USD (NVIDIA Nemotron free)

## Meilensteine
| MS | Name | Owner | QA |
|---|---|---|---|
| M1 | Game Design Spec + WBS | skbot-03 | skbot-04 |
| M2 | Core Game Engine (Tetris Logik) | skbot-01 | skbot-04 |
| M3 | UI + 10 Levels | skbot-01 | skbot-04 |
| M4 | MIDI Sound System | skbot-01 | skbot-04 |
| M5 | Integration + Polishing | skbot-01 | skbot-04 |
| M6 | CI/CD + GitHub Release | skbot-02 | skbot-04 |
| M7 | Dokumentation | skbot-03 | SKBOT |
| M8 | Final QA + MIT Publish | SKBOT | Stefan |
