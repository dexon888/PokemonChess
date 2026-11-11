# Pokémon Chess

A real-time multiplayer chess variant where every piece is a random Pokémon and captures are
battles resolved by type effectiveness, dodges and critical hits. Personal, non-commercial fan
project for playing with friends.

## Where things stand

- Milestones 0 (planning), 2 (rules engine) and 3 (local prototype) are done. **Milestone 4
  (online multiplayer, Colyseus) is in progress**; its step-by-step breakdown is at the end of
  `docs/IMPLEMENTATION_PLAN.md`.
- `apps/server` runs one authoritative `MatchRoom` per game with chess clocks (R11, R17), reconnection (R12, R13, R18) and private rooms joined by invite code (D7). Next:
  matchmaking and the online web client.
- The engine plays a full game: legal moves, battles, bonus turns, castling, en passant,
  promotion, wins and draws. Perft matches standard chess to depth 3.
- `apps/web` is a playable hot-seat game (two players, one screen) built from the Game Screen v1
  design. For now the engine runs in the browser; M4 moves battle resolution to the server.
- Piece moves are animated from engine events (`apps/web/src/game/motion.ts`); the board only
  plays what the events report. The board is an ARIA grid with keyboard play
  (`apps/web/src/game/boardNav.ts`). The battle log collapses on phones. All listed M3 polish
  items are done; sound comes in M5.
- Live progress: `docs/IMPLEMENTATION_PLAN.md`. Update it in every PR that finishes an item.

## Source of truth

- Rules: `docs/GAME_RULES.md` (wins over `docs/PRD.md`). Decision log: `docs/DECISIONS.md`.
  All 18 rule decisions (R1–R18) and the stack decisions (D1–D7) are approved.
- Architecture: `docs/ARCHITECTURE.md`. Roadmap and progress: `docs/IMPLEMENTATION_PLAN.md`.
- Never change gameplay silently. Propose the change, get approval, then update
  `GAME_RULES.md` and `DECISIONS.md` in the same PR.
- Planning doc and design canvas live on claude.ai (owner can share them):
  "Pokémon Chess — Technical & Design Plan" and "Pokémon Chess — Game Screen v1" (desktop,
  mobile, battle-outcome overlays, board component).

## Design direction

- Modern and polished, sprite-forward, neither minimal nor flashy. Dark navy base (#0B1020),
  cards #121933, accent #6EA8FE, Space Grotesk headings, Inter body. Colour comes from the
  Pokémon type colours, the sprite platforms and battle effects; everything else stays quiet.
- Each piece: Gen 5 pixel sprite standing on a type-tinted platform, role badge bottom-left,
  three-letter type code top-right, effectiveness badge bottom-right when it is a capture target.
- Accessibility rules from the design review: board squares are buttons with names like
  "d4, white Queen, Machamp, Fighting"; arrow keys move focus, Enter selects/moves, Esc cancels;
  battle results go to an `aria-live` region; resign needs confirmation; honour reduced motion;
  text contrast ≥ 4.5:1 and never colour alone.

## Layout

- `packages/engine`: pure TypeScript rules. No runtime dependencies, no DOM, no Node APIs.
- `packages/roster`: generated roster v1 (1,083 entries) + sprite URLs. Regenerate with
  `pnpm --filter @pokemon-chess/roster generate`; never hand-edit `roster.v1.ts`.
- `packages/protocol`: Zod schemas for every client message, shared server message types,
  time controls. Both apps import it.
- `apps/web`: Vite + React + Tailwind client.
- `apps/server`: Colyseus 0.18 server. Game logic lives in the transport-free `Match` class
  (`src/match.ts`); `MatchRoom` only validates and delivers. See `apps/server/README.md`.

## Commands (pnpm 10, Node 22+)

- `pnpm dev` (http://localhost:5173, add `?seed=123` to replay a game), `pnpm dev:server`
  (ws://localhost:2567, playground at http://localhost:2567/playground), `pnpm test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format`
- The owner develops on Windows; keep scripts cross-platform (no bash-only commands in
  package.json).

## Workflow

- `main` is protected by a ruleset: changes land only through PRs with the
  "Lint, typecheck, test, build" CI check passing. Never push to `main`.
- One small, focused PR per change on a feature branch (`feat/…`, `fix/…`, `docs/…`). Base PRs on
  `main`; if you must stack, retarget the base to `main` before the lower PR merges.
- Before opening a PR run format, lint, build, typecheck and test locally. In the PR body list
  what changed, how it was tested, and any rule decisions it relies on.
- For UI changes, run the app and check it in the browser (desktop and ~390px wide) before
  opening the PR.

## Conventions

- All randomness goes through the injected `Rng`. Tests use `createScriptedRng` with explicit
  rolls; never rely on `Math.random`.
- Every engine rule gets a test, including the edge cases in PRD §9.
- The server is authoritative (from M4). The client never computes battle outcomes online.
- Record every third-party asset in `docs/ASSET_LICENSES.md`. Sprites are hotlinked from the
  Showdown sprite server for local dev only; mirror them before any deploy. No Pokémon audio.
