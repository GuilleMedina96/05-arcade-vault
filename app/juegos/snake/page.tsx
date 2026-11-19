import type { Metadata } from "next";
import { Suspense } from "react";

import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/components/leaderboard-panel";
import { SnakeGame } from "@/components/snake-game";

export const metadata: Metadata = {
  title: "Snake · Arcade Vault",
};

const CONTROLS = [
  { keys: ["←", "↑", "↓", "→"], label: "Mover" },
  { keys: ["W", "A", "S", "D"], label: "Mover" },
  { keys: ["P", "Esc"], label: "Pausa" },
  { keys: ["Espacio"], label: "Empezar y reiniciar" },
];

export default function SnakePage() {
  return (
    <div className="av-player game-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Snake</h1>
        <p>
          Come frutas, crece y no choques contigo mismo ni con las paredes. Cada
          5 frutas la serpiente va más rápido.
        </p>
      </header>

      <div className="game-layout">
        <div className="game-stage">
          <SnakeGame />
        </div>
        <aside className="game-side">
          <Suspense fallback={<LeaderboardSkeleton title="Top 10" />}>
            <LeaderboardPanel gameSlug="snake" limit={10} title="Top 10" />
          </Suspense>
        </aside>
      </div>

      <ul className="game-controls" aria-label="Controles">
        {CONTROLS.map((c) => (
          <li key={c.keys.join("")}>
            <span className="keys">
              {c.keys.map((k) => (
                <kbd key={k} className="keycap">
                  {k}
                </kbd>
              ))}
            </span>
            <span className="control-label">{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
