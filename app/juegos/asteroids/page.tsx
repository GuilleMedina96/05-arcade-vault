import type { Metadata } from "next";
import { AsteroidsGame } from "@/components/asteroids-game";

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
    <div className="av-player fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Asteroids</h1>
        <p>
          Destruye las rocas, esquiva los fragmentos y aguanta con tres vidas.
        </p>
      </header>

      <div className="crt">
        <div className="crt-screen">
          <AsteroidsGame />
        </div>
        <div className="crt-bottom">
          <span className="led">ROCAS</span>
          <span>1 JUGADOR</span>
        </div>
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
