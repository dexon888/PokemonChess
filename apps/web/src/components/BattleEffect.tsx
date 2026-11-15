import type { CSSProperties } from "react";
import type { HitSquare } from "../game/narrate";
import { TYPE_COLOR } from "../game/theme";

/**
 * The visual beat of a battle, drawn over the defender's square (PRD 6.2): a burst in the
 * attacker's type colour for hits (bigger for 2×, with a flash and starburst on a crit), a puff
 * for a ½× trade where both faint, motion streaks for a dodge, and a shield ripple for an
 * immunity. Purely decorative (aria-hidden): the banner and battle log carry the meaning, and
 * the board does not render this at all under reduced motion.
 *
 * Every part waits for `delay` (the moment the attacker arrives) and ends fully transparent, so
 * a finished effect can stay mounted until the next battle replaces it.
 */
export function BattleEffect({
  hit,
  left,
  top,
  size,
  delay,
}: {
  hit: HitSquare;
  left: number;
  top: number;
  size: number;
  delay: number;
}) {
  const color = hit.attackerType ? TYPE_COLOR[hit.attackerType] : "#F4F6FF";
  const style = {
    left,
    top,
    width: size,
    height: size,
    "--fx": color,
    "--delay": `${delay}ms`,
    "--q": `${size}px`,
  } as CSSProperties;

  return (
    <div aria-hidden="true" className={`fx fx-${hit.kind}`} style={style}>
      {(hit.kind === "superEffective" || hit.kind === "captured") && (
        <>
          <span className="fx-flash" />
          <span className="fx-ring" />
          {hit.kind === "superEffective" && <span className="fx-ring fx-ring-2" />}
          {sparks(hit.kind === "superEffective" ? 10 : 6)}
          {hit.crit && <span className="fx-star" />}
        </>
      )}
      {hit.kind === "resisted" && (
        <>
          <span className="fx-puff" style={{ "--px": "-18%", "--py": "-10%" } as CSSProperties} />
          <span className="fx-puff" style={{ "--px": "16%", "--py": "-16%" } as CSSProperties} />
          <span className="fx-puff" style={{ "--px": "0%", "--py": "12%" } as CSSProperties} />
        </>
      )}
      {hit.kind === "dodged" && (
        <>
          <span className="fx-streak" style={{ "--sy": "30%" } as CSSProperties} />
          <span className="fx-streak" style={{ "--sy": "50%" } as CSSProperties} />
          <span className="fx-streak" style={{ "--sy": "70%" } as CSSProperties} />
        </>
      )}
      {hit.kind === "immune" && (
        <>
          <span className="fx-shield" />
          <span className="fx-shield fx-shield-2" />
        </>
      )}
    </div>
  );
}

function sparks(n: number) {
  return Array.from({ length: n }, (_, i) => (
    <span
      key={i}
      className="fx-spark"
      style={{ "--a": `${(360 / n) * i + 12}deg` } as CSSProperties}
    />
  ));
}

/** A brief whole-board flash for critical hits. */
export function CritFlash({ delay }: { delay: number }) {
  return (
    <div
      aria-hidden="true"
      className="fx-crit-flash"
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    />
  );
}
