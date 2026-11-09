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
- [x] Board representation and legal-move generation, incl. castling, en passant and promotion
      flags, stalemate detection, and the king-threat cue (PR 2)
- [x] Applying actions: battles on the board, bonus turns, castling-right and en passant
      bookkeeping, promotion, wins (incl. R1/R2), draws, resign/timeout; random assignment;
      perft to depth 3 (PR 3)
- [x] Roster v1: 1,083 entries (1,025 species + regional forms) from `@pkmn/dex` (PR 4)
- [x] Local hot-seat web app with the Game Screen v1 design, sprites, attack preview, battle
      banners, promotion dialog, game-over stats (PR 4)
- [x] M3 polish: move animations driven by engine events (slides, castling, lunges on dodged and
      immune attacks, knocked-out pieces fade after the hit; off with reduced motion)
- [ ] M3 polish: keyboard arrow navigation on the board
- [ ] M3 polish: collapsible battle log on mobile

Design files: the Game Screen v1 canvas on claude.ai.
