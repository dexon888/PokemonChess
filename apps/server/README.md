# @pokemon-chess/server

Authoritative Colyseus 0.18 game server. `MatchRoom` (room name `match`) wraps one `Match`,
which runs the engine with a seeded RNG, records every action (rolls included) in `match.log`,
and sends each player an `events` message (events + their own snapshot) after every action.
Messages follow `@pokemon-chess/protocol`; state sync is plain JSON, not Colyseus schema (D6).

Clocks (R11, R17): create the room with `{ "timeControl": "5+3" }` (also `10+5`, `30+0`,
`untimed`; default `10+5`). Snapshots carry `clocks`; the room arms a timer for the next possible
flag, and any message arriving after the deadline loses on time first.

Not yet: reconnect grace, private room codes, matchmaking, rematch (later M4 steps).

## Run it

```bash
pnpm dev:server
```

- Server: `ws://localhost:2567`, health check at `http://localhost:2567/health`.
- Playground (dev only): `http://localhost:2567/playground`.

## Try two players by hand

1. Open the playground in two browser tabs.
2. Tab 1: method **Create**, room type `match`, options `{ "nickname": "Ash" }`, then join.
   Copy the room ID it shows.
3. Tab 2: method **Join by ID**, paste the room ID, options `{ "nickname": "Gary" }`.
4. Both tabs receive a `snapshot`; `you` says which colour that tab plays.
5. From the White tab send type `move` with `{ "from": 12, "to": 20 }` (e2→e3; squares are
   0–63, a1 = 0, h8 = 63). Both tabs receive `events` with `seq: 1`.
6. Try a move from the wrong tab (`notYourTurn`), a bad payload (`invalidMessage`), `resign`,
   or `offerDraw` then `answerDraw` with `{ "accept": true }`. Closing a tab marks that player
   disconnected for the other.

In dev the playground also sends a `__playground_message_types` message; clients should ignore
message types they don't know.

## Tests

`pnpm --filter @pokemon-chess/server test`:

- `test/match.test.ts`: the `Match` class with scripted rolls (exact battle outcomes).
- `test/MatchRoom.test.ts`: a real server in-process and two SDK clients over WebSocket.

Vitest runs in the `threads` pool here: Colyseus calls `process.send()` whenever an IPC
channel exists, and the default `forks` pool provides one.
