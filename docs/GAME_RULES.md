# Game Rules

The authoritative rules for Pokémon Chess. Where this file and `PRD.md` differ, this file wins; every
difference is recorded in `DECISIONS.md`.

## 1. Board and pieces

- Standard 8×8 board and starting position. White moves first.
- Pieces move with standard chess geometry. Pieces cannot jump except knights.
- There is **no check or checkmate**. Kings may move into attacked squares and stand next to each other.

## 2. Pokémon assignment

- At match start, every piece gets an independently random Pokémon from the pinned roster
  (`roster.v1.json`). Duplicates are allowed.
- Roster: every species in its default form plus regional forms as separate entries. Excluded:
  Mega, Gigantamax, cosmetic-only forms, and anything without a usable sprite. All entries are
  equally likely. (R14)
- A single-type Pokémon uses that type. A dual-type Pokémon gets one of its two types, 50/50.
- Species and active type never change, including after promotion.
- Both players see every piece's species and active type.
- Type chart: Generation 6+ (18 types). (R15)

## 3. Captures (battles)

Any move onto an enemy piece, or an en passant capture, is a battle. Resolve in this order:

1. **Immunity (0×):** nothing happens; no roll is made; the turn ends. (R3)
2. **Dodge roll (10%):** on a dodge nothing happens; the turn ends.
3. **Effectiveness:**

| Multiplier            | Defender | Attacker            | Turn                                             |
| --------------------- | -------- | ------------------- | ------------------------------------------------ |
| 2× super effective    | Removed  | Moves to the square | **Bonus turn**                                   |
| 1× normal             | Removed  | Moves to the square | Bonus turn only on a **critical hit** (10% roll) |
| ½× not very effective | Removed  | **Also removed**    | Ends                                             |

- Critical hits are rolled only on 1× captures. A 2× capture never gets a second bonus turn.
- Bonus turns can chain. They never allow illegal moves.
- An attack on an immune piece is a legal move. It wastes the turn and counts toward the 100
  half-move rule. (R5)
- The UI shows the multiplier for every capture target before the player commits. (R4)
- Dodge and crit chances are configurable server-side for balancing.

## 4. Winning and drawing

- **Capturing the king wins immediately**, including through a super-effective capture (no bonus
  turn is needed).
- A non-king piece attacking a king at ½× removes both, and the **attacker's side wins**. (R2)
- A king attacking the enemy king at ½× removes both kings: **draw** ("double knockout"). (R1)
- A player may resign at any time, including during a bonus turn.
- Running out of time loses. (R11)
- **Draws:** stalemate (the side to move has no legal move or capture, immune captures included);
  mutual agreement (offers allowed during bonus turns); 100 half-moves without a pawn move or a
  completed capture. Every action, bonus actions included, is one half-move (R9). A ½× trade
  counts as a completed capture; dodged and immune attacks do not.
- Threefold repetition is not used in the MVP.

## 5. Special moves

- **Castling:** the king and rook must both be unmoved, with empty squares between them. Allowed
  while attacked and through or into attacked squares. Consumes the turn. A rook removed by any
  means loses that side's right permanently. (R10)
- **En passant:** standard timing and geometry, resolved as a battle against the passed pawn. A
  successful capture moves the attacker diagonally and removes the passed pawn. Dodge or immunity:
  nothing moves. ½×: both pawns removed. The window is only the opponent's very next action; if
  that action earns a bonus turn, en passant is no longer available. (R6)
- **Promotion:** the promotion choice (queen, rook, bishop or knight) is sent with the move (R8).
  It applies only if the pawn actually lands on the last rank. Dodged, immune and ½× attacks do
  not promote (R7). Species and type are kept.

## 6. Clocks and connections

- Matchmaking: 10 minutes + 5 seconds per action. Private rooms: 5+3, 10+5, 30+0 or untimed.
  Bonus actions also earn the increment. (R11)
- White's clock starts as soon as both players are in the match. Only the side to move has a
  running clock; it stops when the game ends. (R17)
- A disconnected player has a 60-second grace period; their clock keeps running. After it, the
  opponent may claim victory or keep waiting. (R12) A claimed win is recorded as abandonment.
- Leaving a match on purpose (not a dropped connection) starts no grace period: the opponent may
  claim victory at once. To give up properly, resign. (R18)
- Random outcomes are generated once on the server, logged, and never re-rolled.

## 7. King threat cue

The king-threat music plays when any enemy piece has a legal capture on your king that is not 0×.
It is audiovisual only and never restricts moves. (R16)

## 8. Rematches

- After a game ends, either player may ask for a rematch; it starts only when both have asked.
  (PRD 5.5)
- The rematch is a new game in the same room with the same time control: colours swap, every
  piece gets a new random Pokémon and active type, and clocks start fresh. (R19)
