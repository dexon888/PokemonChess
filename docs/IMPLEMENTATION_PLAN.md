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
- [x] Clocks (R11): increments on every action including bonus actions, timeout loses (R17)
- [x] Reconnection (R12, R13, R18): nickname, reconnect token, 60 s grace with the clock running,
      claim victory after it
- [x] Private rooms: room code and invite link, time-control choice, no third player (D7)
- [x] Matchmaking: `QueueRoom` at 10+5 with cancel (D8)
- [x] Web client, private rooms: home (nickname, create with a time control, join by code or link),
      lobby (code, copy invite link), online game driven by server events (clocks, offline
      grace and claim victory, draw offers, resign); local hot-seat kept at `/local`
- [x] Web client, matchmaking: Find Match and the searching screen; rejoin after a page reload
      with the saved reconnection token (R13)
- [ ] Rematch (PRD 5.5) and results screen (PRD 6.7)

## Post-MVP ideas

Not scheduled. Anything that changes gameplay starts as a written proposal and needs approval
before it touches `GAME_RULES.md`.

- **Team draft mode** (owner idea, 2026-11-09): as an alternative to random assignment, each
  player picks a team of 6 Pokémon and assigns one to each piece type (king, queen, rook, bishop,
  knight, pawn). The engine already takes assignment as a function (`createStartingPosition`),
  so this is mostly a pre-match draft phase plus UI.

  Owner's answers (2026-11-09), to shape the proposal:
  - One Pokémon per piece type: all eight pawns share one, and each pair of rooks, bishops and
    knights shares one.
  - For a dual-type Pokémon, the player chooses the active type.
  - Drafting is hidden and simultaneous, before the match starts; both players may pick the
    same Pokémon.
  - The draft has its own time limit, before the clocked match begins (so R17's clock start
    would move to the end of the draft for this mode).
  - Private rooms only (no matchmaking queue).

  Still open: the draft time limit's length; what happens if a player runs out of draft time
  (random picks for unfilled slots, or forfeit); whether a player may change picks before
  locking in; and whether both teams are revealed together at the start.
