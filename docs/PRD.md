# Pokémon Chess — Product Requirements Document (PRD)

**Version:** 1.0 — Initial Project Specification  
**Project Name:** Pokémon Chess  
**Platform:** Web Application (Desktop and Mobile Browsers)  
**Development Approach:** AI-assisted development using Claude Code  
**Status:** Planning and Design

---

# 1. Project Overview

## 1.1 Product Vision

Pokémon Chess is a modern, interactive, real-time multiplayer chess variant that combines traditional chess movement with Pokémon-inspired type effectiveness, critical hits, dodging, and randomized Pokémon assignments.

The objective is to create an engaging strategy game where chess positioning remains important, but Pokémon type matchups and probability-based battle mechanics introduce additional strategic depth and unpredictability.

The application should feature a polished, modern interface with animated Pokémon sprites, dynamic battle effects, sound effects, and seamless online multiplayer functionality.

The game should feel like a combination of a competitive online chess platform and a Pokémon battle experience.

## 1.2 Primary Goals

1. Build a fully functional custom chess engine supporting Pokémon Chess rules.
2. Allow two players to compete against each other online in real time.
3. Support both automatic matchmaking and private match invitations.
4. Randomly assign Pokémon and their associated types to every chess piece.
5. Implement Pokémon type effectiveness, critical hits, and dodge mechanics.
6. Create a visually appealing interface using animated Pokémon sprites where possible.
7. Provide engaging battle animations, visual feedback, and sound effects.
8. Support desktop and mobile browsers.
9. Maintain a scalable, modular, and well-documented codebase.
10. Ensure the rules engine is independently testable and multiplayer outcomes are synchronized.

## 1.3 Target Audience

- Pokémon enthusiasts.
- Casual and competitive chess players.
- Players interested in strategy games with randomized mechanics.
- Friends looking for a fun online multiplayer game.

## 1.4 Initial Scope

The first release should focus on a complete, functional multiplayer experience.

The MVP does not require:

- User accounts.
- Ranked matchmaking or Elo ratings.
- Computer-controlled opponents.
- In-game purchases.
- Tournament systems.
- Player inventories.
- Mobile-native applications.
- Persistent player profiles.

These features may be considered in future releases.

---

# 2. Core Gameplay

## 2.1 Board and Starting Positions

The game uses a standard 8×8 chessboard.

Each player begins with the standard 16 chess pieces:

- 1 King
- 1 Queen
- 2 Rooks
- 2 Bishops
- 2 Knights
- 8 Pawns

White moves first.

Chess pieces follow their standard movement patterns, subject to the custom rules defined below.

The game must not enforce traditional check or checkmate restrictions.

## 2.2 Victory Conditions

The primary victory condition is capturing the opponent's king.

Unlike traditional chess:

- Kings can be captured.
- Kings can move into attacked squares.
- Kings can stand adjacent to each other.
- Players are not required to escape check.
- Checkmate does not exist.
- The game ends immediately when a king is captured.

King captures are subject to Pokémon type effectiveness, dodging, and critical-hit rules, just like other captures.

A king can survive an attempted capture if the attack is dodged or the defender's type is immune.

A player can also win if the opponent resigns.

## 2.3 Random Pokémon Assignment

At the beginning of every match, each chess piece receives a randomly selected Pokémon.

Requirements:

1. Pokémon are assigned independently to each piece.
2. Duplicate Pokémon are permitted.
3. Both players receive randomized assignments.
4. All supported Pokémon generations should be included.
5. Pokémon assignments remain unchanged throughout the match.
6. Each Pokémon retains its assigned type for the entire match.
7. Both players can see every Pokémon and its assigned type.

Use a versioned Pokémon dataset so assignments remain reproducible and are not affected by external API changes during an active match.

Each piece should have a unique internal identifier separate from its Pokémon species and chess role.

## 2.4 Pokémon Typing

Each assigned Pokémon has one active type.

For single-type Pokémon:

- The Pokémon's existing type is automatically assigned.

For dual-type Pokémon:

- Randomly select one of its two types.
- Each type has an equal probability of being selected.
- The selected type remains fixed throughout the match.

For example:

Charizard normally has Fire/Flying typing.

If assigned to a chess piece, it randomly receives either Fire or Flying as its active type.

Only the selected active type is used for battle effectiveness.

The game should use the standard Pokémon type-effectiveness chart.

## 2.5 Type Effectiveness

When a piece attempts to capture another piece, the attacking Pokémon's active type is compared against the defending Pokémon's active type.

### Super Effective — 2×

- The defending piece is captured.
- The attacking piece moves to the defender's square.
- The attacking player receives an additional turn.
- Display a "Super Effective!" animation.
- Play an appropriate sound effect.

### Normally Effective — 1×

- The defending piece is captured.
- The attacking piece moves to the defender's square.
- The turn changes normally unless a critical hit occurs.

### Not Very Effective — 0.5×

- The attacking piece is removed.
- The defending piece is also removed.
- The turn changes to the opponent.
- Display a "Not Very Effective!" message.
- Play an appropriate sound effect.

### No Effect — 0×

- The attack fails.
- Neither piece is removed.
- Neither piece changes position.
- The attacker's turn ends.
- Display a "No Effect!" or "Immune!" message.

The server must calculate effectiveness rather than trusting values supplied by the client.

---

# 3. Random Battle Mechanics

## 3.1 Critical Hits

Critical hits have an initial probability of 10%.

A critical hit:

- Can occur on a successful normal-effectiveness capture.
- Grants the attacking player another turn.
- Does not override type immunity.
- Does not override resistance.
- Does not grant multiple additional turns when the capture is already super effective.

Critical-hit probability should be configurable internally for future balancing.

Display a distinct critical-hit animation and sound effect.

## 3.2 Dodging

Every attempted capture has an initial 10% chance of being dodged.

When a dodge occurs:

- The attack fails.
- Both pieces remain in their original positions.
- The attacker's turn ends.
- A dodge animation and message appear.

Dodging applies to all pieces, including kings.

## 3.3 Attack Resolution Order

The recommended resolution sequence is:

1. Validate the attempted chess move.
2. Determine whether the move is a capture.
3. If it is not a capture, execute normal movement and end the turn.
4. If it is a capture, roll for dodge.
5. If dodged, cancel the capture and end the turn.
6. Otherwise, calculate type effectiveness.
7. Resolve immunity, resistance, or successful capture.
8. For eligible normal-effectiveness captures, roll for critical hit.
9. Determine whether the attacker receives a bonus turn.
10. Check whether a king was removed.
11. Update the authoritative match state.
12. Broadcast the result to both clients.

The game must never reroll an outcome during reconnection, replay, or client synchronization.

## 3.4 Bonus Turns

A player receives another turn when:

- Their attack is super effective and successfully captures a piece.
- Their normal-effectiveness attack successfully captures a piece and lands a critical hit.

Bonus turns can occur consecutively.

For example, a player could capture three opposing pieces in succession if each capture grants another turn.

A bonus turn does not bypass movement rules or permit a piece to move illegally.

---

# 4. Special Chess Rules

## 4.1 Castling

Castling is enabled.

Requirements:

- The king must not have previously moved.
- The corresponding rook must not have previously moved.
- All squares between the king and rook must be empty.
- The king and rook move according to standard castling geometry.
- Castling consumes a turn.

Because check restrictions are disabled:

- Castling is permitted while the king is threatened.
- Castling is permitted through attacked squares.
- Castling is permitted into attacked squares.

Castling eligibility must be tracked explicitly in the game state.

## 4.2 En Passant

En passant is enabled.

Standard en passant timing and movement geometry apply.

However, en passant captures use Pokémon attack resolution.

The pawn being captured is the defender, even though it occupies a different square from the attacking pawn's destination.

The outcome depends on the assigned Pokémon types and dodge probability.

Proposed handling:

- Successful capture: attacking pawn moves diagonally and the defending pawn is removed.
- Dodged attack: both pawns remain in their original positions.
- Immune defender: both pawns remain in their original positions.
- Resistant defender: both pawns are removed.
- Super-effective capture: attacking player receives another turn.

An en passant opportunity expires after the immediately following turn, even if the attack fails.

This behavior should be verified and finalized during the rules-engine design.

## 4.3 Pawn Promotion

When a pawn reaches its final rank, the player chooses to promote it to:

- Queen
- Rook
- Bishop
- Knight

The Pokémon species and assigned active type remain unchanged.

The promoted piece gains the movement rules of its new chess role.

Promotion should use an interactive selection dialog.

## 4.4 Draw Conditions

The game supports the following draw conditions:

1. Stalemate: the current player has no legal move.
2. Mutual agreement: both players agree to a draw.
3. A limit of 100 half-moves without a pawn move or completed capture.

For the half-move rule, a completed capture includes a resistant attack in which both pieces are removed. Failed captures do not reset the counter.

Traditional check-based stalemate definitions must not be used.

Threefold repetition is not required for the initial MVP.

The game must also handle situations where repeated failed attacks prevent progress.

---

# 5. Multiplayer Requirements

## 5.1 Online Matchmaking

Players should be able to select "Find Match" from the home screen.

The system should:

1. Add the player to a matchmaking queue.
2. Search for another available player.
3. Pair two players together.
4. Randomly assign White and Black.
5. Generate Pokémon assignments and active types.
6. Initialize the match.
7. Connect both players to the game session.

Players should be able to cancel matchmaking before a match begins.

## 5.2 Private Matches

Players should be able to create private matches.

The system generates a unique invitation link or room code.

The host can share the invitation with another player.

When the invited player joins, the match can begin.

Private rooms should support:

- Waiting for an opponent.
- Copying an invitation link.
- Joining from another browser or device.
- Handling invalid or expired invitations.
- Preventing unauthorized third players from joining an active match.

## 5.3 Real-Time Synchronization

The game should use a server-authoritative multiplayer architecture.

The server is responsible for:

- Validating moves.
- Maintaining board state.
- Tracking turns.
- Calculating type effectiveness.
- Generating random battle outcomes.
- Handling bonus turns.
- Detecting victory and draw conditions.
- Broadcasting authoritative state updates.

Clients should never independently determine critical hits, dodges, or Pokémon assignments.

## 5.4 Disconnects and Reconnection

If a player disconnects:

- The game should preserve the current state.
- The disconnected player should be allowed to reconnect.
- The connected player should receive a clear connection-status message.
- Reconnecting players should receive the latest authoritative state.
- Random outcomes must not be regenerated.

The exact reconnection timeout and abandonment behavior can be finalized during technical design.

## 5.5 Rematches

After a match ends, players should be able to request a rematch.

A rematch should:

- Require both players to agree.
- Reset the chessboard.
- Generate new Pokémon assignments.
- Generate new active types.
- Begin a new match.

---

# 6. UI/UX Requirements

## 6.1 Visual Direction

The application should use a hybrid design style:

**Modern competitive chess interface + colorful animated Pokémon sprites.**

Visual characteristics:

- Dark navy or charcoal backgrounds.
- Clean, modern typography.
- Subtle gradients.
- Polished cards and panels.
- Soft shadows and restrained glow effects.
- Bright Pokémon type colors.
- Smooth transitions.
- Responsive layouts.
- Clear tactical feedback.

The design should feel modern, premium, playful, and readable.

Avoid excessive visual clutter.

## 6.2 Animated Pokémon Sprites

Chess pieces should be represented by Pokémon sprites rather than traditional chess icons.

Requirements:

- Use animated Pokémon pixel sprites when available and appropriately licensed.
- Provide static sprite fallbacks.
- Maintain consistent sprite sizing.
- Clearly identify each Pokémon's chess role.
- Distinguish White and Black pieces.
- Animate movement between squares.
- Animate successful captures.
- Animate dodges.
- Animate critical hits.
- Animate failed attacks.
- Animate piece removal.

The chess role must remain recognizable regardless of which Pokémon is assigned.

A small king, queen, rook, bishop, knight, or pawn badge should accompany each sprite.

Sprites must not obscure the board or legal-move indicators.

## 6.3 Game Screen

The game screen is the highest-priority UI.

It should include:

### Chessboard

- Interactive 8×8 board.
- Pokémon sprites on occupied squares.
- Chess-role badges.
- Type indicators.
- Selected-square highlighting.
- Legal-move highlighting.
- Capture-target highlighting.
- Last-move highlighting.
- Smooth movement animations.
- Board coordinates.
- Responsive sizing.

### Player Information

Show:

- Player names.
- Assigned colors.
- Connection status.
- Current turn.
- Remaining pieces.
- Bonus-turn notification.

### Selected Pokémon Panel

When a piece is selected, display:

- Pokémon name.
- Pokémon sprite.
- Assigned active type.
- Chess role.
- Current square.
- Available legal moves.

### Battle Log

Display a chronological record of important events:

- Piece movement.
- Successful captures.
- Super-effective attacks.
- Not-very-effective attacks.
- Immunities.
- Critical hits.
- Dodges.
- Pawn promotions.
- Bonus turns.
- King captures.
- Match results.

Example messages:

"Charizard used a super-effective attack!"

"Pikachu avoided the attack!"

"Critical Hit! You move again!"

### Game Controls

Include:

- Resign.
- Offer Draw.
- Sound Settings.
- Animation Settings.
- Leave Match.
- Rematch after completion.

## 6.4 Home Screen

The home screen should include:

- Pokémon Chess branding.
- Play Online button.
- Create Private Match button.
- Join Private Match button.
- How to Play.
- Settings.

The home screen should be visually appealing without becoming difficult to navigate.

## 6.5 Matchmaking Screen

Display:

- Searching-for-opponent status.
- Animated loading indicator.
- Cancel Search button.
- Match-found notification.

## 6.6 Private Lobby Screen

Display:

- Room code.
- Copy invitation link.
- Host information.
- Waiting-for-opponent state.
- Connected players.
- Start-match state.

## 6.7 Results Screen

Display:

- Winner or draw result.
- Victory reason.
- Number of captures.
- Number of super-effective attacks.
- Critical hits.
- Successful dodges.
- Rematch button.
- Return-to-home button.

## 6.8 Responsive Design

The application must work on desktop and mobile browsers.

Desktop layout:

- Large central chessboard.
- Side panel for Pokémon information.
- Battle log beside or below the board.
- Player information above and below the board.

Mobile layout:

- Chessboard occupies most available width.
- Pokémon information appears below the board.
- Battle log uses a collapsible panel.
- Buttons and touch targets are appropriately sized.

## 6.9 Accessibility

Include:

- Keyboard-accessible controls.
- Visible focus indicators.
- Reduced-motion settings.
- Adjustable audio.
- Color-independent type labels.
- Sufficient text contrast.
- Clear status messages.
- Accessible promotion controls.

---

# 7. Audio Requirements

The game should include Pokémon-inspired battle audio.

## 7.1 Battle Sound Effects

Provide distinct audio cues for:

- Super-effective attacks.
- Not-very-effective attacks.
- Critical hits.
- Dodges.
- Immunities.
- Successful captures.
- Victory.
- Defeat.

## 7.2 King Threat Music

When a player's king is threatened by an opposing piece, the game should play an urgent low-health-style battle-music cue.

This is purely an audiovisual warning.

It must not enforce traditional check restrictions or prevent legal movement.

The threat-detection logic should be defined separately from capture resolution.

## 7.3 Audio Controls

Players must be able to:

- Enable or disable music.
- Enable or disable sound effects.
- Adjust audio volume.

Use appropriately licensed music and sound assets for public distribution. Original Pokémon music and sound effects should not be assumed to be freely reusable.

---

# 8. Technical Architecture

## 8.1 Recommended Technology Stack

The following stack is proposed and should be evaluated before implementation.

**Frontend**
- React
- TypeScript
- Next.js
- Tailwind CSS

**Animations**
- Motion or CSS animations

**Backend**
- Node.js
- TypeScript
- WebSocket-based real-time communication
- Socket.IO or equivalent

**Game Engine**
- Custom TypeScript chess-variant engine

**Database**
- PostgreSQL if persistent storage is required
- Redis if needed for matchmaking or distributed game sessions

**Testing**
- Vitest for unit tests
- Playwright for end-to-end tests
- Multiplayer integration tests

**Deployment**
- A hosting platform supporting persistent WebSocket connections
- Managed database if necessary

Claude should evaluate architectural tradeoffs and recommend the simplest maintainable implementation.

## 8.2 Game Engine Architecture

The game engine should be independent from the user interface.

Suggested modules:

1. Board State Manager
2. Piece Movement Validator
3. Pokémon Assignment Manager
4. Type Effectiveness Calculator
5. Capture Resolution Engine
6. Critical Hit and Dodge Resolver
7. Turn Manager
8. Special Move Handler
9. Victory and Draw Detector
10. Match State Serializer

The game engine should expose deterministic functions wherever possible.

Randomness should be injected through a testable random-number provider.

## 8.3 Match State

A match should maintain:

- Match ID.
- Player IDs or session tokens.
- Player colors.
- Board state.
- Unique piece IDs.
- Chess roles.
- Assigned Pokémon species.
- Assigned active types.
- Current player.
- Castling rights.
- En passant availability.
- Promotion state.
- Half-move counter.
- Move history.
- Battle event history.
- Match status.
- Winner or draw reason.
- Connection status.

## 8.4 Pokémon Data

Use PokéAPI or another appropriate data source to generate a local, versioned Pokémon roster.

The roster should include:

- Pokémon identifier.
- Name.
- Species or form information.
- Primary type.
- Secondary type, if present.
- Sprite references.
- Available animation assets.

Do not depend on live external API requests during individual move resolution.

Document how alternate forms, regional forms, and Pokémon without suitable sprites are handled.

## 8.5 Security

Requirements:

- Validate all moves server-side.
- Prevent clients from modifying opponent pieces.
- Prevent clients from manipulating random outcomes.
- Protect private match sessions.
- Validate WebSocket messages.
- Apply appropriate rate limiting.
- Prevent unauthorized match participation.
- Do not expose sensitive session credentials.

---

# 9. Testing Requirements

The rules engine requires comprehensive automated tests.

At minimum, test:

### Chess Movement
- All standard piece movements.
- Blocked movement.
- Illegal movement.
- King adjacency.
- King moving into attacked squares.
- King captures.
- Castling.
- En passant.
- Pawn promotion.

### Pokémon Mechanics
- Single-type assignment.
- Dual-type random selection.
- Duplicate Pokémon assignments.
- All type matchups.
- Super-effective captures.
- Normal captures.
- Resistant mutual removal.
- Immune attacks.
- Critical hits.
- Dodges.
- Consecutive bonus turns.

### Edge Cases
- King dodges.
- King is immune.
- King is removed by a resistant attack.
- En passant attack fails.
- En passant causes mutual removal.
- Promotion after a successful capture.
- No legal moves.
- Draw conditions.
- Simultaneous client actions.
- Reconnection after a capture.
- Duplicate network messages.
- Match completion during a bonus-turn sequence.

### Multiplayer
- Two-player connection.
- Private invitation links.
- Matchmaking.
- Turn synchronization.
- Invalid moves.
- Reconnection.
- Resignation.
- Rematch.
- Consistent state after network interruptions.

---

# 10. Development Roadmap

## Milestone 0 — Planning and Specifications

Deliverables:

- Approved PRD.
- Formal game rules specification.
- Technical architecture.
- Screen inventory.
- Development roadmap.
- Open-decisions register.

Do not begin implementation until the core rules and architecture have been reviewed.

## Milestone 1 — UI/UX Design

Deliverables:

- Home screen design.
- Matchmaking screen design.
- Private lobby design.
- Main game screen design.
- Results screen design.
- Design system.
- Desktop and mobile layouts.
- Interaction and animation specifications.

Create high-fidelity visual mockups before full frontend implementation.

## Milestone 2 — Game Engine

Deliverables:

- Board representation.
- Legal movement generation.
- Pokémon assignment.
- Type effectiveness.
- Capture resolution.
- Critical hits.
- Dodging.
- Bonus turns.
- Special moves.
- Victory and draw detection.
- Unit tests.

The engine must be testable without a browser or network connection.

## Milestone 3 — Local Playable Prototype

Deliverables:

- Interactive chessboard.
- Pokémon piece rendering.
- Local two-player gameplay.
- Battle feedback.
- Promotion UI.
- Game-over states.

This milestone should allow two players to play on the same device.

## Milestone 4 — Online Multiplayer

Deliverables:

- Real-time game server.
- Matchmaking queue.
- Private matches.
- Server-authoritative moves.
- State synchronization.
- Reconnection handling.
- Multiplayer integration tests.

## Milestone 5 — Visual and Audio Polish

Deliverables:

- Animated Pokémon sprites.
- Movement transitions.
- Attack animations.
- Battle effects.
- Sound effects.
- King-threat audio.
- Responsive UI improvements.
- Accessibility improvements.

## Milestone 6 — Testing and Deployment

Deliverables:

- End-to-end tests.
- Multiplayer stress and reconnection tests.
- Bug fixes.
- Production configuration.
- Deployment documentation.
- Initial public or private release.

---

# 11. Project Documentation Structure

Create and maintain the following documentation:

```text
pokemon-chess/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── PRD.md
│   ├── GAME_RULES.md
│   ├── REQUIREMENTS.md
│   ├── USER_FLOWS.md
│   ├── DESIGN_SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── DECISIONS.md
├── designs/
├── assets/
├── src/
└── tests/
```

`CLAUDE.md` should contain concise instructions about the project architecture, development conventions, testing expectations, and references to authoritative documentation.

Do not duplicate the entire PRD inside `CLAUDE.md`.

---

# 12. Instructions for Claude

You are acting as a senior software architect, game developer, product designer, and technical project manager.

Your responsibility is to help design and implement Pokémon Chess as a maintainable, polished multiplayer web application.

Follow these principles:

1. **Do not immediately begin coding.** First review the requirements, identify ambiguities, and propose an implementation strategy.

2. **Prioritize planning and design.** Create a clear architecture, screen inventory, and implementation plan before building the application.

3. **Treat the PRD as the product baseline.** Do not silently change approved gameplay mechanics.

4. **Identify unresolved edge cases.** Present recommendations and request approval for decisions that materially affect gameplay.

5. **Use modular architecture.** Keep the game engine, networking, persistence, and user interface separate.

6. **Write testable code.** Game logic must be independently testable with deterministic test scenarios.

7. **Implement incrementally.** Complete small milestones rather than attempting the entire application at once.

8. **Maintain project documentation.** Update relevant specifications when approved changes occur.

9. **Design a polished interface.** Prioritize usability, responsiveness, clear gameplay feedback, and consistent visual design.

10. **Avoid unnecessary complexity.** Recommend practical technologies appropriate for the MVP.

11. **Consider asset licensing.** Identify copyright and licensing concerns for Pokémon sprites, names, artwork, music, and sound effects.

12. **Provide progress summaries.** After each milestone, explain what was implemented, what was tested, and what remains.

## Your First Task

Before writing application code:

1. Review this PRD.
2. Identify missing requirements and gameplay ambiguities.
3. Recommend the technical architecture and technology stack.
4. Propose the initial repository structure.
5. Create a detailed implementation roadmap.
6. Define the UI/UX design process.
7. Propose the first high-fidelity game screen design.
8. Ask for approval before proceeding to implementation.

The immediate objective is to produce an approved design and technical plan, not to generate the entire application in one step.