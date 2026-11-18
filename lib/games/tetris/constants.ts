export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

/** Ancho del tablero y del panel lateral (HUD + pieza siguiente), en px. */
export const BOARD_W = COLS * BLOCK;
export const PANEL_W = 150;

export const WIDTH = BOARD_W + PANEL_W; // 450
export const HEIGHT = ROWS * BLOCK; // 600

// Índice 0 = vacío. 1..7 = I, O, T, S, Z, J, L
export const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
];

export const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

export const PIECE_TYPES = 7;

export const LINE_SCORES = [0, 100, 300, 500, 800];

/** Intervalo de caída inicial y mínimo, en ms. */
export const BASE_DROP_INTERVAL = 1000;
export const MIN_DROP_INTERVAL = 100;
export const DROP_STEP = 90;

export const WALL_KICKS = [0, -1, 1, -2, 2];

/** Color de la rejilla (en el original venía de una variable CSS). */
export const GRID_LINE = "rgba(255,255,255,0.08)";
