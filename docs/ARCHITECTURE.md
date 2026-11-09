# Architecture

```
apps/web     Vite + React + Tailwind client. Renders server state; previews legal moves.
apps/server  Node + Colyseus. QueueRoom (matchmaking) and MatchRoom (authoritative game).
packages/engine     Pure TypeScript rules. No UI, network or Node APIs. Randomness is injected.
packages/protocol   Zod schemas for every client → server message, plus shared types.
packages/creature-packs  Versioned roster + sprite manifests (Pokémon pack; original pack later).
```

## Data flow

1. The client sends an intent (`move`, `promote`, `resign`, `offerDraw`, ...).
2. `MatchRoom` validates it with Zod, then with the engine's legal-move generator.
3. The engine resolves any battle with the room's seeded `Rng`.
4. The room appends the result, including every roll, to the match event log.
5. The room broadcasts the resolved events and a full state snapshot to both players.

Reconnecting clients receive the snapshot. They never cause a re-roll.

## Rules for code

- `packages/engine` must stay dependency-free at runtime and testable without a browser or network.
- Every random decision goes through `Rng`. Tests use `createScriptedRng`.
- The client never decides an outcome; it only animates what the server reports.
