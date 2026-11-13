import type { Metadata } from "next";
import { Suspense } from "react";

import { AsteroidsGame } from "@/components/asteroids-game";
import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/components/leaderboard-panel";

export const metadata: Metadata = {
  title: "Asteroids · Arcade Vault",
};

const CONTROLS = [
  { keys: ["←", "→"], label: "Rotar" },
  { keys: ["↑"], label: "Propulsar" },
  { keys: ["Espacio"], label: "Disparar" },
];

export default function AsteroidsPage() {
  return (
    <div className="av-player game-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Asteroids</h1>
        <p>
          Destruye las rocas, esquiva los fragmentos y aguanta con tres vidas.
        </p>
      </header>

      <div className="game-layout">
        <div className="game-stage">
          <AsteroidsGame />
        </div>
        <aside className="game-side">
          <Suspense fallback={<LeaderboardSkeleton title="Top 10" />}>
            <LeaderboardPanel gameSlug="asteroids" limit={10} title="Top 10" />
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
