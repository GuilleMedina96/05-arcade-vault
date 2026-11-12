export interface Input {
  /** Teclas mantenidas, por `KeyboardEvent.code`. */
  keys: Record<string, boolean>;
  /** Devuelve true una sola vez por pulsación (consume el evento). */
  pressed: (code: string) => boolean;
  /** Retira los listeners registrados. */
  destroy: () => void;
}

const GAME_KEYS = new Set(["Space", "ArrowUp", "ArrowLeft", "ArrowRight"]);

export function createInput(): Input {
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    // Evita que Espacio y las flechas desplacen la página
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  // Al perder el foco no llegará el keyup: se vacían las teclas pulsadas
  const onBlur = () => {
    for (const code of Object.keys(keys)) keys[code] = false;
    for (const code of Object.keys(justPressed)) justPressed[code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    keys,
    pressed(code) {
      const val = !!justPressed[code];
      justPressed[code] = false;
      return val;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
