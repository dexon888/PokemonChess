import type { Color, Role } from "@pokemon-chess/engine";

/**
 * Chess silhouettes drawn for this project (24×24 grid, no third-party artwork). Shapes follow
 * the classic Staunton outlines so the piece reads at a glance even over a busy sprite.
 */
const BASE =
  "M5 18.5h14a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 1-.6.6H5a.6.6 0 0 1-.6-.6v-1.3a.6.6 0 0 1 .6-.6z";

const PATHS: Record<Role, string> = {
  pawn: "M12 3.5a3 3 0 0 1 2 5.25V10h1.5v1.3h-1C14.5 14 15.5 16.5 17 18.5H7c1.5-2 2.5-4.5 2.5-7.2h-1V10H10V8.75A3 3 0 0 1 12 3.5z",
  rook: "M6.5 4H9v2h1.75V4h2.5v2H15V4h2.5v4.5L16 10v6.5l1.5 2h-11l1.5-2V10L6.5 8.5z",
  knight:
    "M7.6 18.5c0-3 1.4-4.6 3.2-6.2-1.1.3-2.2.9-3.1 1.7-1 .9-2.4.5-2.6-.7-.2-1 .4-1.8 1.4-2.6l2.8-2.6c.4-1.6 1.2-2.8 2-3.6l.4-1.4 1.2 1.2c3.4.6 5.4 3.6 5.4 7.1 0 2.7-.8 5-1.4 7.1zM11.3 6.8a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z",
  bishop:
    "M12 2.6a1.5 1.5 0 0 1 .9 2.7c3 1.7 3.9 4.3 3.3 6.9-.4 1.4-1.4 2.1-1.4 2.1h.3v1.3h-.6c.3 1.2 1.3 2.2 2.3 2.9H7.2c1-.7 2-1.7 2.3-2.9h-.6v-1.3h.3s-1-.7-1.4-2.1c-.6-2.6.3-5.2 3.3-6.9A1.5 1.5 0 0 1 12 2.6zm.9 5.6-2.6 3.6 1 .6 2.6-3.6z",
  queen:
    "M12 3.7a1.3 1.3 0 0 1 .4 2.5l-.4 5.3 3-4.7a1.3 1.3 0 1 1 1.4.7l-1.2 4.7 2.6-3.6a1.3 1.3 0 1 1 1.2.3L16.4 15.5v1.3l.8 1.7H6.8l.8-1.7v-1.3L5 8.6a1.3 1.3 0 1 1 1.2-.3l2.6 3.6-1.2-4.7A1.3 1.3 0 1 1 9 6.5l3 4.7-.4-5a1.3 1.3 0 0 1 .4-2.5z",
  king: "M11.2 2h1.6v1.5h1.6v1.6h-1.6v2.6c2.8.2 4.7 1.6 4.7 3.6 0 1.7-1.4 3.1-1.7 4.2v1.3l.8 1.7H7.4l.8-1.7v-1.3c-.3-1.1-1.7-2.5-1.7-4.2 0-2 1.9-3.4 4.7-3.6V5.1H9.6V3.5h1.6z",
};

const INK = { white: "#F4F6FF", black: "#0B1020" } as const;

interface Props {
  role: Role;
  color: Color;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}

/** A filled chess silhouette in the side's colour, outlined in the opposite colour. */
export function PieceIcon({ role, color, size, className, style }: Props) {
  const fill = INK[color];
  const outline = color === "white" ? INK.black : INK.white;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <g
        fill={fill}
        fillRule="evenodd"
        stroke={outline}
        strokeWidth={1.4}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        <path d={PATHS[role]} />
        <path d={BASE} />
      </g>
    </svg>
  );
}
