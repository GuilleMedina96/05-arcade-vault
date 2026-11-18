import type { Metadata } from "next";
import { Suspense } from "react";

import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/components/leaderboard-panel";
import { TetrisGame } from "@/components/tetris-game";

export const metadata: Metadata = {
  title: "Tetris · Arcade Vault",
};

const CONTROLS = [
  { keys: ["←", "→"], label: "Mover" },
  { keys: ["↑"], label: "Rotar" },
  { keys: ["↓"], label: "Bajar" },
  { keys: ["Espacio"], label: "Caída directa" },
  { keys: ["P"], label: "Pausa" },
];

export default function TetrisPage() {
  return (
    <div className="av-player game-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Tetris</h1>
        <p>
          Encaja las piezas, completa líneas y aguanta el mayor tiempo posible.
        </p>
      </header>

      <div className="game-layout">
        <div className="game-stage">
          <TetrisGame />
        </div>
        <aside className="game-side">
          <Suspense fallback={<LeaderboardSkeleton title="Top 10" />}>
            <LeaderboardPanel gameSlug="tetris" limit={10} title="Top 10" />
          </Suspense>
        </aside>
      </div>

      <ul className="game-controls" aria-label="Controles">
        {CONTROLS.map((c) => (
          <li key={c.label}>
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
