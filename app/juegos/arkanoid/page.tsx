import type { Metadata } from "next";
import { Suspense } from "react";

import { ArkanoidGame } from "@/components/arkanoid-game";
import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/components/leaderboard-panel";

export const metadata: Metadata = {
  title: "Arkanoid · Arcade Vault",
};

const CONTROLS = [
  { keys: ["←", "→"], label: "Mover la pala" },
  { keys: ["P", "Esc"], label: "Pausa" },
  { keys: ["Espacio"], label: "Reiniciar" },
];

export default function ArkanoidPage() {
  return (
    <div className="av-player game-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Arkanoid</h1>
        <p>
          Rompe todos los bloques con la pelota sin dejarla caer. Tienes tres
          vidas y cinco niveles.
        </p>
      </header>

      <div className="game-layout">
        <div className="game-stage">
          <ArkanoidGame />
        </div>
        <aside className="game-side">
          <Suspense fallback={<LeaderboardSkeleton title="Top 10" />}>
            <LeaderboardPanel gameSlug="arkanoid" limit={10} title="Top 10" />
          </Suspense>
        </aside>
      </div>

      <ul className="game-controls" aria-label="Controles">
        {CONTROLS.map((c) => (
          <li key={c.label + c.keys.join("")}>
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
