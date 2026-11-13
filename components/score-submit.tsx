"use client";

import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { submitScore } from "@/app/juegos/asteroids/actions";

const ALIAS_KEY = "arcade-vault:alias:v1";
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,12}$/;

const INVALID_ALIAS =
  "El alias debe tener de 3 a 12 caracteres: letras, números, _ o -.";
const FAILED = "No se pudo enviar la puntuación. Inténtalo de nuevo.";

function readSavedAlias(): string {
  try {
    return window.localStorage.getItem(ALIAS_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveAlias(alias: string) {
  try {
    window.localStorage.setItem(ALIAS_KEY, alias);
  } catch {
    // Sin localStorage (modo privado, datos bloqueados): el envío sigue valiendo.
  }
}

type Props = {
  gameSlug: string;
  score: number;
  onSkip: () => void;
};

export function ScoreSubmit({ gameSlug, score, onSkip }: Props) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  // Solo se monta tras GAME OVER, ya en el cliente: leer localStorage aquí
  // no provoca diferencias de hidratación.
  const [alias, setAlias] = useState(readSavedAlias);
  const [error, setError] = useState<string | null>(null);
  const [sentAs, setSentAs] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = pending || sentAs !== null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked) return;

    if (!ALIAS_PATTERN.test(alias)) {
      setError(INVALID_ALIAS);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitScore({ gameSlug, alias, score });
      if (result.ok) {
        saveAlias(alias);
        setSentAs(alias);
      } else {
        setError(result.error === "invalid" ? INVALID_ALIAS : FAILED);
      }
    });
  }

  return (
    <form
      className="score-submit fade-in"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${inputId}-title`}
    >
      <div className="score-submit-head">
        <h2 id={`${inputId}-title`} className="pixel">
          Guarda tu puntuación
        </h2>
        <p className="score-submit-score" aria-label={`${score} puntos`}>
          <span className="pixel neon-yellow">{score}</span>
          <span>puntos</span>
        </p>
      </div>

      {sentAs ? (
        <p className="score-submit-done" role="status">
          Puntuación enviada como <strong>{sentAs}</strong>. Pulsa Espacio para
          jugar otra vez.
        </p>
      ) : (
        <>
          <div className="field score-submit-field">
            <label htmlFor={inputId}>Alias</label>
            <input
              id={inputId}
              name="alias"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              autoComplete="nickname"
              autoCapitalize="off"
              spellCheck={false}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            />
            <span id={hintId} className="score-submit-hint">
              3 a 12 caracteres: letras, números, _ y -
            </span>
          </div>

          {error ? (
            <p id={errorId} className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="score-submit-actions">
            <button type="submit" className="btn" disabled={locked}>
              {pending ? "Enviando…" : "Enviar"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={onSkip}
              disabled={pending}
            >
              Omitir
            </button>
          </div>
        </>
      )}
    </form>
  );
}
