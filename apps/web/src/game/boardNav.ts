import { fileOf, rankOf, type Square } from "@pokemon-chess/engine";

/** Screen position of a square: row 0 is the top row as displayed, col 0 the left column. */
export function screenCell(sq: Square, flipped: boolean) {
  return {
    col: flipped ? 7 - fileOf(sq) : fileOf(sq),
    row: flipped ? rankOf(sq) : 7 - rankOf(sq),
  };
}

export function squareAt(row: number, col: number, flipped: boolean): Square {
  const rank = flipped ? row : 7 - row;
  const file = flipped ? 7 - col : col;
  return rank * 8 + file;
}

/**
 * Where focus goes for a key press on the board (ARIA grid pattern). Directions follow the
 * board as displayed, so "up" is always away from the player at the bottom, flipped or not.
 * Returns null for keys the board does not handle. Edges clamp; focus never wraps.
 */
export function nextFocus(sq: Square, key: string, flipped: boolean, ctrl = false): Square | null {
  let { row, col } = screenCell(sq, flipped);
  switch (key) {
    case "ArrowUp":
      row = Math.max(0, row - 1);
      break;
    case "ArrowDown":
      row = Math.min(7, row + 1);
      break;
    case "ArrowLeft":
      col = Math.max(0, col - 1);
      break;
    case "ArrowRight":
      col = Math.min(7, col + 1);
      break;
    case "Home":
      col = 0;
      if (ctrl) row = 0;
      break;
    case "End":
      col = 7;
      if (ctrl) row = 7;
      break;
    default:
      return null;
  }
  return squareAt(row, col, flipped);
}
