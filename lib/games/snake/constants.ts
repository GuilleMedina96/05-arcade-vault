export const COLS = 20;
export const ROWS = 15;
export const CELL = 40;
export const WIDTH = COLS * CELL; // 800
export const HEIGHT = ROWS * CELL; // 600

export const INITIAL_LENGTH = 3;
export const POINTS_PER_FRUIT = 10;

// Velocidad: ms por paso. Cada FRUITS_PER_SPEEDUP frutas se acorta STEP_DECREASE_MS
export const START_STEP_MS = 140;
export const MIN_STEP_MS = 60;
export const STEP_DECREASE_MS = 10;
export const FRUITS_PER_SPEEDUP = 5;

// Giros que se pueden encolar entre dos pasos
export const MAX_QUEUED_TURNS = 2;

// dt máximo por fotograma (s), para no dar saltos al volver a la pestaña
export const MAX_DT = 0.05;

export const FRUITS_SRC = "/games/snake/fruits.png";
