import {
  effectiveness,
  fileOf,
  rankOf,
  squareName,
  type GameState,
  type Move,
  type Piece,
  type Square,
  type BattleOutcome,
} from "@pokemon-chess/engine";
import { useLayoutEffect, useRef } from "react";
import { FADE_MS, LUNGE_MS, SLIDE_MS, type Motion } from "../game/motion";
import { EFFECT_STYLE, ROLE_NAME, TYPE_COLOR, typeCode, typeTextColor } from "../game/theme";
import { PieceIcon } from "./PieceIcon";
import { Sprite } from "./Sprite";

interface Props {
  game: GameState;
  selected: Square | null;
  moves: Move[];
  lastMove: { from: Square; to: Square } | null;
  hitSquare: { sq: Square; kind: BattleOutcome; id: number } | null;
  motion: Motion | null;
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
  motion,
  flipped,
  size,
  onSquare,
}: Props) {
  const q = size / 8;
  const boardRef = useRef<HTMLDivElement>(null);
  useBoardMotion(boardRef, motion, q, flipped);
  const animate = motion !== null && !prefersReducedMotion();
  const ghosts = animate ? motion.ghosts : [];
  const hitDelay = animate ? motion.impactDelay : 0;
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
      ref={boardRef}
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
              <PieceView
                key={piece.id}
                piece={piece}
                q={q}
                hit={hit && !removesDefender(hit.kind) ? hit : null}
                hitDelay={hitDelay}
              />
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

      {ghosts.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
          {ghosts.map((g, i) => {
            const { col, row } = cell(g.square, flipped);
            const hit = !g.slideFrom && hitSquare?.sq === g.square ? hitSquare : null;
            return (
              <div
                key={`${motion?.id}-${i}`}
                data-ghost={i}
                className="absolute"
                style={{ left: col * q, top: row * q, width: q, height: q }}
              >
                <PieceView piece={g.piece} q={q} hit={hit} hitDelay={hitDelay} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Screen column and row of a square (0,0 is the top-left cell as displayed). */
function cell(sq: Square, flipped: boolean) {
  return {
    col: flipped ? 7 - fileOf(sq) : fileOf(sq),
    row: flipped ? rankOf(sq) : 7 - rankOf(sq),
  };
}

const removesDefender = (kind: BattleOutcome) =>
  kind === "superEffective" || kind === "captured" || kind === "resisted";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Plays one Motion: moved pieces slide in from their old square, attackers that stay put lunge
 * at their target, and removed pieces fade out as ghosts once the hit lands. Pieces are found by
 * `data-piece-id`, so the board markup itself never changes shape during an animation.
 */
function useBoardMotion(
  boardRef: React.RefObject<HTMLDivElement | null>,
  motion: Motion | null,
  q: number,
  flipped: boolean,
) {
  useLayoutEffect(() => {
    const root = boardRef.current;
    if (!motion || !root || prefersReducedMotion()) return;
    const animations: Animation[] = [];
    const offset = (from: Square, to: Square) => {
      const a = cell(from, flipped);
      const b = cell(to, flipped);
      return { dx: (a.col - b.col) * q, dy: (a.row - b.row) * q };
    };
    const run = (node: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      if (!(node instanceof HTMLElement)) return;
      node.style.zIndex = "20"; // Travel above neighbouring squares.
      const anim = node.animate(frames, opts);
      const drop = () => {
        node.style.zIndex = "";
      };
      anim.addEventListener("finish", drop);
      anim.addEventListener("cancel", drop);
      animations.push(anim);
    };
    const pieceNode = (id: string) => root.querySelector(`[data-piece-id="${CSS.escape(id)}"]`);

    for (const [id, { from, to }] of motion.slides) {
      const { dx, dy } = offset(from, to);
      run(pieceNode(id), [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: SLIDE_MS,
        easing: EASE_OUT,
      });
    }

    for (const [id, { from, toward }] of motion.lunges) {
      const { dx, dy } = offset(toward, from);
      const reach = `translate(${dx * LUNGE_REACH}px, ${dy * LUNGE_REACH}px)`;
      run(
        pieceNode(id),
        [{ transform: "none" }, { transform: reach, offset: 0.5 }, { transform: "none" }],
        { duration: LUNGE_MS, easing: "ease-in-out" },
      );
    }

    motion.ghosts.forEach((g, i) => {
      const node = root.querySelector(`[data-ghost="${i}"]`);
      if (g.slideFrom !== undefined) {
        // A ½× attacker: travels to the target, then faints alongside the defender.
        const { dx, dy } = offset(g.slideFrom, g.square);
        run(
          node,
          [
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
            {
              transform: "none",
              opacity: 1,
              offset: SLIDE_MS / (SLIDE_MS + FADE_MS + FAINT_HOLD_MS),
            },
            {
              transform: "none",
              opacity: 1,
              offset: (SLIDE_MS + FAINT_HOLD_MS) / (SLIDE_MS + FADE_MS + FAINT_HOLD_MS),
            },
            { transform: "scale(0.6)", opacity: 0 },
          ],
          { duration: SLIDE_MS + FAINT_HOLD_MS + FADE_MS, easing: EASE_OUT, fill: "forwards" },
        );
      } else {
        run(node, [{ opacity: 1 }, { transform: "scale(0.6)", opacity: 0 }], {
          duration: FADE_MS,
          delay: motion.impactDelay + FAINT_HOLD_MS,
          easing: "ease-in",
          fill: "both",
        });
      }
    });

    return () => animations.forEach((a) => a.cancel());
    // Only a new Motion starts animations; a resize or flip mid-move lets the current one finish
    // with the geometry it started with.
  }, [boardRef, motion]);
}

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** How far toward its target an attacker lunges, as a fraction of the distance. */
const LUNGE_REACH = 0.35;
/** How long a knocked-out piece stays visible after the hit before it fades. */
const FAINT_HOLD_MS = 200;

function PieceView({
  piece,
  q,
  hit,
  hitDelay,
}: {
  piece: Piece;
  q: number;
  hit: { kind: BattleOutcome; id: number } | null;
  hitDelay: number;
}) {
  const compact = q < 60;
  return (
    <div data-piece-id={piece.id} className="absolute inset-0">
      <div
        key={hit ? `hit-${hit.id}` : "piece"}
        className={`absolute inset-0 ${hit ? `anim-${hit.kind}` : ""}`}
        style={hit && hitDelay ? { animationDelay: `${hitDelay}ms` } : undefined}
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
        <span className="absolute flex justify-center" style={{ left: 0, right: 0, top: q * 0.02 }}>
          <Sprite
            species={piece.species}
            type={piece.type}
            size={q * 0.84}
            flip={piece.color === "black"}
          />
        </span>
        <PieceIcon
          role={piece.role}
          color={piece.color}
          size={Math.max(16, q * 0.42)}
          className="piece-icon"
          style={{ left: q * 0.01, bottom: q * 0.01 }}
        />
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
    </div>
  );
}
