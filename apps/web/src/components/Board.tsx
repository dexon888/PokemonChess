import {
  effectiveness,
  fileOf,
  rankOf,
  squareName,
  type GameState,
  type Move,
  type Square,
  type BattleOutcome,
} from "@pokemon-chess/engine";
import {
  EFFECT_STYLE,
  ROLE_GLYPH,
  ROLE_NAME,
  TYPE_COLOR,
  typeCode,
  typeTextColor,
} from "../game/theme";
import { Sprite } from "./Sprite";

interface Props {
  game: GameState;
  selected: Square | null;
  moves: Move[];
  lastMove: { from: Square; to: Square } | null;
  hitSquare: { sq: Square; kind: BattleOutcome; id: number } | null;
  flipped: boolean;
  size: number;
  onSquare: (sq: Square) => void;
}

const FILES = "abcdefgh";

export function Board({
  game,
  selected,
  moves,
  lastMove,
  hitSquare,
  flipped,
  size,
  onSquare,
}: Props) {
  const q = size / 8;
  const compact = q < 60;
  const attacker = selected !== null ? game.board[selected] : null;
  const order: Square[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = flipped ? row : 7 - row;
      const file = flipped ? 7 - col : col;
      order.push(rank * 8 + file);
    }
  }

  return (
    <div
      role="grid"
      aria-label="Chessboard"
      className="board relative grid overflow-hidden rounded-xl"
      style={{ width: size, height: size, gridTemplateColumns: `repeat(8, ${q}px)` }}
    >
      {order.map((sq, i) => {
        const piece = game.board[sq];
        const dark = (fileOf(sq) + rankOf(sq)) % 2 === 0;
        const move = moves.find((m) => m.to === sq);
        const defenderSq = move?.defender;
        const defender = defenderSq !== undefined ? game.board[defenderSq] : null;
        const eff = attacker && defender ? effectiveness(attacker.type, defender.type) : null;
        const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
        const showRank = i % 8 === 0;
        const showFile = i >= 56;
        const hit = hitSquare?.sq === sq ? hitSquare : null;

        const label = [
          squareName(sq),
          piece
            ? `${piece.color} ${ROLE_NAME[piece.role]}, ${piece.species}, ${piece.type}`
            : "empty",
          eff !== null ? `attack ${EFFECT_STYLE[eff].label}` : move ? "legal move" : "",
        ]
          .filter(Boolean)
          .join(", ");

        return (
          <button
            key={sq}
            type="button"
            aria-label={label}
            onClick={() => onSquare(sq)}
            className={`square relative ${dark ? "sq-dark" : "sq-light"} ${isLast ? "sq-last" : ""} ${
              selected === sq ? "sq-selected" : ""
            }`}
            style={{ width: q, height: q }}
          >
            {showRank && (
              <span
                className="coord"
                style={{ left: q * 0.05, top: q * 0.02, fontSize: Math.max(9, q * 0.13) }}
              >
                {rankOf(sq) + 1}
              </span>
            )}
            {showFile && (
              <span
                className="coord"
                style={{ right: q * 0.06, bottom: q * 0.02, fontSize: Math.max(9, q * 0.13) }}
              >
                {FILES[fileOf(sq)]}
              </span>
            )}

            {move && !defender && (
              <span className="move-dot" style={{ width: q * 0.22, height: q * 0.22 }} />
            )}

            {piece && (
              <div
                key={hit ? `hit-${hit.id}` : "piece"}
                className={`absolute inset-0 ${hit ? `anim-${hit.kind}` : ""}`}
              >
                <span
                  className={`platform ${piece.color === "white" ? "platform-white" : "platform-black"}`}
                  style={{
                    left: q * 0.12,
                    top: q * 0.66,
                    width: q * 0.76,
                    height: q * 0.22,
                    ["--type" as string]: TYPE_COLOR[piece.type],
                  }}
                />
                <span
                  className="absolute flex justify-center"
                  style={{ left: 0, right: 0, top: q * 0.02 }}
                >
                  <Sprite
                    species={piece.species}
                    type={piece.type}
                    size={q * 0.84}
                    flip={piece.color === "black"}
                  />
                </span>
                <span
                  className={`role-badge ${piece.color === "white" ? "role-white" : "role-black"}`}
                  style={{
                    left: q * 0.04,
                    bottom: q * 0.04,
                    width: q * 0.3,
                    height: q * 0.3,
                    fontSize: q * 0.22,
                  }}
                >
                  {ROLE_GLYPH[piece.role]}
                </span>
                <span
                  className="type-tag"
                  style={{
                    right: compact ? 1 : q * 0.04,
                    top: compact ? 1 : q * 0.04,
                    background: TYPE_COLOR[piece.type],
                    color: typeTextColor(piece.type),
                    fontSize: compact ? 9 : Math.max(9, q * 0.12),
                  }}
                >
                  {typeCode(piece.type)}
                </span>
              </div>
            )}

            {eff !== null && (
              <>
                <span
                  className="capture-ring"
                  style={{
                    inset: q * 0.06,
                    borderColor: EFFECT_STYLE[eff].bg,
                    borderStyle: eff === 0 ? "dashed" : "solid",
                  }}
                />
                <span
                  className="capture-badge"
                  style={{
                    right: q * 0.03,
                    bottom: q * 0.03,
                    minWidth: q * 0.34,
                    background: EFFECT_STYLE[eff].bg,
                    color: EFFECT_STYLE[eff].fg,
                    fontSize: Math.max(10, q * 0.17),
                  }}
                >
                  {EFFECT_STYLE[eff].label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
