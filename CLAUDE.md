# Pokémon Chess

A real-time multiplayer chess variant where every piece is a random Pokémon and captures are
battles resolved by type effectiveness, dodges and critical hits.

## Source of truth

- Rules: `docs/GAME_RULES.md` (wins over `docs/PRD.md`). Decision log: `docs/DECISIONS.md`.
- Architecture: `docs/ARCHITECTURE.md`. Roadmap and progress: `docs/IMPLEMENTATION_PLAN.md`.
- Never change gameplay silently. Propose the change, get approval, then update
  `GAME_RULES.md` and `DECISIONS.md` in the same PR.

## Layout

- `packages/engine`: pure TypeScript rules. No runtime dependencies, no DOM, no Node APIs.
- `apps/server` (Colyseus) and `apps/web` (Vite + React): added in later milestones.

## Commands (pnpm, Node 22)

- `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format`

## Conventions

- All randomness goes through the injected `Rng`. Tests use `createScriptedRng` with explicit
  rolls; never rely on `Math.random`.
- Every engine rule gets a test, including the edge cases in PRD §9.
- The server is authoritative. The client never computes battle outcomes.
- Small PRs on feature branches; `main` is protected and CI must pass.
- Record every third-party asset in `docs/ASSET_LICENSES.md`.
