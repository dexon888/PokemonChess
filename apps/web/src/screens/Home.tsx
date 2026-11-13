import {
  nicknameSchema,
  roomCodeSchema,
  TIME_CONTROL_IDS,
  type TimeControlId,
} from "@pokemon-chess/protocol";
import { useState, type FormEvent } from "react";
import { AppHeader } from "../components/AppHeader";
import { savedNickname } from "../net/client";

const card = "rounded-2xl border border-line bg-card p-5 sm:p-6";
const input =
  "h-12 w-full rounded-xl border border-line bg-card-2 px-4 text-base outline-none focus:border-accent";

const TC_LABEL: Record<TimeControlId, string> = {
  "5+3": "5 + 3",
  "10+5": "10 + 5",
  "30+0": "30 + 0",
  untimed: "Untimed",
};

export interface HomeProps {
  /** Code from a `/join/CODE` link, prefilled in the join form. */
  initialCode?: string;
  error?: string | null;
  onCreatePrivate: (nickname: string, tc: TimeControlId) => void;
  onJoinPrivate: (code: string, nickname: string) => void;
}

/** Home (PRD 6.4): pick a nickname, then create a private match or join one by code. */
export function Home({ initialCode = "", error, onCreatePrivate, onJoinPrivate }: HomeProps) {
  const [nickname, setNickname] = useState(savedNickname);
  const [tc, setTc] = useState<TimeControlId>("10+5");
  const [code, setCode] = useState(initialCode);
  const [problem, setProblem] = useState<string | null>(null);

  const nick = () => {
    const r = nicknameSchema.safeParse(nickname);
    if (!r.success) {
      setProblem(r.error.issues[0]?.message ?? "Choose a nickname");
      return null;
    }
    return r.data;
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    const n = nick();
    if (n) onCreatePrivate(n, tc);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const n = nick();
    if (!n) return;
    const r = roomCodeSchema.safeParse(code);
    if (!r.success) {
      setProblem(r.error.issues[0]?.message ?? "Enter a room code");
      return;
    }
    onJoinPrivate(r.data, n);
  };

  const shown = problem ?? error;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader />
      <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Play with a friend</h1>
          <p className="mt-1 text-muted">
            Every piece is a random Pokémon. Captures are battles: type matchups, dodges and
            critical hits.
          </p>
        </div>

        <div className={card}>
          <label htmlFor="nickname" className="mb-2 block text-sm font-semibold">
            Your nickname
          </label>
          <input
            id="nickname"
            className={input}
            value={nickname}
            maxLength={20}
            autoComplete="nickname"
            placeholder="Ash"
            onChange={(e) => {
              setNickname(e.target.value);
              setProblem(null);
            }}
          />
        </div>

        {shown && (
          <div
            role="alert"
            className="rounded-xl border border-[#F87171] bg-card px-4 py-3 text-sm"
          >
            {shown}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <form onSubmit={create} className={`${card} flex flex-col gap-4`}>
            <h2 className="font-display text-xl font-semibold">Create a private match</h2>
            <fieldset>
              <legend className="mb-2 text-sm text-muted">Time control (minutes + seconds)</legend>
              <div className="grid grid-cols-2 gap-2">
                {TIME_CONTROL_IDS.map((id) => (
                  <label
                    key={id}
                    className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${
                      tc === id ? "border-accent bg-card-2" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tc"
                      value={id}
                      checked={tc === id}
                      onChange={() => setTc(id)}
                      className="sr-only"
                    />
                    {TC_LABEL[id]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="mt-auto h-12 rounded-xl bg-accent font-semibold text-ink-dark"
            >
              Create room
            </button>
          </form>

          <form onSubmit={join} className={`${card} flex flex-col gap-4`}>
            <h2 className="font-display text-xl font-semibold">Join a friend</h2>
            <div>
              <label htmlFor="code" className="mb-2 block text-sm text-muted">
                Room code or invite link
              </label>
              <input
                id="code"
                className={`${input} font-display uppercase tracking-[0.2em]`}
                value={code}
                placeholder="K7PQ2M"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setCode(e.target.value);
                  setProblem(null);
                }}
              />
            </div>
            <button
              type="submit"
              className="mt-auto h-12 rounded-xl border border-accent font-semibold text-accent"
            >
              Join
            </button>
          </form>
        </div>

        <p className="text-sm text-muted">
          Same screen?{" "}
          <a href="/local" className="text-accent underline">
            Play a local hot-seat game
          </a>
          .
        </p>
      </main>
    </div>
  );
}
