# Implementation Plan

Milestone 0 (planning) was approved on 2026-11-08. M1 and M2 run in parallel.

| Milestone             | Scope                                                                                                                 | Exit gate                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| M0 Planning           | PRD review, rules decisions, stack, roadmap                                                                           | Approved ✅                                        |
| M1 UI/UX design       | Design system; game, home, matchmaking, lobby, results screens; desktop + mobile; animation specs                     | Screens approved                                   |
| M2 Rules engine       | Board, legal moves, castling, en passant, promotion, battle resolver, turns, draws, serialization; scripted-RNG tests | Engine tests green                                 |
| M3 Local prototype    | Hot-seat play on one device, promotion dialog, battle log, game over                                                  | A full local game plays start to finish            |
| M4 Online multiplayer | Colyseus rooms, matchmaking, private codes, reconnection, clocks, integration tests                                   | Two devices finish a game and survive a disconnect |
| M5 Polish             | Animated sprites, attack effects, audio, king-threat music, accessibility pass                                        | Review                                             |
| M6 Release            | Playwright end-to-end tests, stress tests, deploy pipeline                                                            | Live                                               |

## Progress

- [x] Repo scaffold, CI, engine type chart, seeded RNG, battle resolver (PR 1)
- [ ] Board representation and legal-move generation
- [ ] Special moves, turn manager, victory and draw detection
- [ ] Roster build script (`@pkmn/dex` → `roster.v1.json`)

Design files: the Game Screen v1 canvas on claude.ai.
