export interface Input {
  /** Teclas mantenidas, por `KeyboardEvent.code`. */
  keys: Record<string, boolean>;
  /** Devuelve true una sola vez por pulsación (consume el evento). */
  pressed: (code: string) => boolean;
  /** Retira los listeners registrados. */
  destroy: () => void;
}

export function createInput(): Input {
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

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
    },
  };
}
