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
- [x] M3 polish: chess-piece silhouettes on every piece so the role reads at a glance
- [x] M3 polish: keyboard play on the board (ARIA grid, one Tab stop, arrows/Home/End move focus,
      Enter selects or moves, Esc cancels)
- [x] M3 polish: battle log collapses to its newest entry below 768px, with a "Show all" toggle;
      announcements use an always-present live region

Design files: the Game Screen v1 canvas on claude.ai.

## M4 breakdown

One small PR each, in order:

- [x] `packages/protocol`: Zod schemas for every client message, shared server message types,
      time controls (R11) and the reconnect grace (R12)
- [x] `apps/server` with `MatchRoom`: Colyseus room running the engine authoritatively with a
      seeded `Rng`, an event log, events + snapshot broadcast; untimed; integration tests
- [ ] Clocks (R11): increments on every action including bonus actions, timeout loses
- [ ] Reconnection (R12, R13): nickname, reconnect token, 60 s grace with the clock running,
      claim victory after it
- [ ] Private rooms: room code and invite link, time-control choice, no third player
- [ ] Matchmaking: `QueueRoom` at 10+5 with cancel
- [ ] Web client: home, matchmaking and lobby screens; online game driven by server events
- [ ] Rematch (PRD 5.5) and results screen (PRD 6.7)
