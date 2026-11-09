# PokemonChess

A real-time multiplayer chess variant where every piece is a random Pokémon. Captures use type
effectiveness, critical hits and dodges. Built with TypeScript, React, and Colyseus.

> Personal, non-commercial fan project. Not affiliated with Nintendo, Game Freak or The Pokémon
> Company.

## How it plays

- Standard chess movement, but no check: you win by **capturing the king**.
- Every piece is a random Pokémon with one active type, visible to both players.
- A capture is a battle: **2×** captures and gives you another turn; **1×** captures (10% crit
  chance for another turn); **½×** knocks out both pieces; **0×** does nothing. Every attack has a
  10% chance to be dodged.

Full rules: [docs/GAME_RULES.md](docs/GAME_RULES.md).

## Development

Requires Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev         # play locally at http://localhost:5173 (two players, one screen)
pnpm test        # engine and roster tests
pnpm typecheck
pnpm lint
pnpm build
```

Add `?seed=12345` to the URL to replay the same Pokémon assignment and dice rolls.

## Status

Milestone 3 (local playable prototype) in progress. See
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
