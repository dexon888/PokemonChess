import { normalizeRoomCode } from "@pokemon-chess/protocol";
import { AppHeader } from "./components/AppHeader";
import { useOnlineMatch } from "./net/useOnlineMatch";
import { Home } from "./screens/Home";
import { LocalGameScreen } from "./screens/LocalGameScreen";
import { Lobby } from "./screens/Lobby";
import { Searching } from "./screens/Searching";
import { OnlineGameScreen } from "./screens/OnlineGameScreen";

/**
 * Routes: `/local` is the hot-seat game; everything else is the online flow. `/join/CODE`
 * (the invite link) opens home with the code filled in.
 */
export function App() {
  const path = window.location.pathname;
  if (path === "/local") return <LocalGameScreen />;
  const code = path.startsWith("/join/") ? normalizeRoomCode(path) : "";
  return <OnlineApp initialCode={code} />;
}

function OnlineApp({ initialCode }: { initialCode: string }) {
  const m = useOnlineMatch();
  const toRoot = () => {
    if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
  };

  switch (m.phase.kind) {
    case "connecting":
      return (
        <div className="min-h-screen bg-bg text-ink">
          <AppHeader />
          <p role="status" className="p-8 text-center text-muted">
            {m.phase.label}
          </p>
        </div>
      );
    case "searching":
      return <Searching queue={m.phase.queue} note={m.phase.note} onCancel={m.cancelSearch} />;
    case "lobby":
      return <Lobby lobby={m.phase.lobby} onLeave={m.leave} />;
    case "playing":
      return <OnlineGameScreen m={m} />;
    default:
      return (
        <Home
          initialCode={initialCode}
          error={m.phase.kind === "error" || m.phase.kind === "ended" ? m.phase.message : null}
          onFindMatch={(nickname) => {
            toRoot();
            void m.findMatch(nickname);
          }}
          onCreatePrivate={(nickname, tc) => {
            toRoot();
            void m.createPrivate(nickname, tc);
          }}
          onJoinPrivate={(code, nickname) => {
            toRoot();
            void m.joinPrivate(code, nickname);
          }}
        />
      );
  }
}
