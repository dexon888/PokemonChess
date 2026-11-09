import type { PokemonType } from "@pokemon-chess/engine";
import { rosterEntry } from "@pokemon-chess/roster";
import { useState } from "react";
import { TYPE_COLOR, typeTextColor } from "../game/theme";

interface Props {
  species: string;
  type: PokemonType;
  /** Rendered box size in px; the sprite scales to fit inside it. */
  size: number;
  flip?: boolean;
}

/** Animated pixel sprite → static sprite → type-coloured placeholder. Never breaks the board. */
export function Sprite({ species, type, size, flip = false }: Props) {
  const entry = rosterEntry(species);
  const sources = [entry?.sprite.animated, entry?.sprite.static].filter((s): s is string => !!s);
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex items-center justify-center rounded-[30%] font-display font-bold"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: TYPE_COLOR[type],
          color: typeTextColor(type),
          fontSize: size * 0.25,
        }}
      >
        {species.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setIndex((i) => i + 1)}
      className="pixelated pointer-events-none select-none object-contain object-bottom"
      style={{ width: size, height: size, transform: flip ? "scaleX(-1)" : undefined }}
    />
  );
}
