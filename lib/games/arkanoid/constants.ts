export const WIDTH = 800;
export const HEIGHT = 600;

export const PADDLE_SPEED = 400; // px/s con el teclado
// game.js fija 81 aunque el sprite mide 162 (ver SPEC 08)
export const PADDLE_W = 81;
export const PADDLE_H = 14;
export const PADDLE_Y = 560;

export const BALL_SIZE = 16;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;

export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (WIDTH - BLOCK_COLS * BLOCK_W) / 2;
export const BLOCKS_ORIGIN_Y = 80;

export const BLOCK_SCORE = 10;
export const INITIAL_LIVES = 3;

export const EXPLOSION_DURATION = 150; // ms
export const EXPLOSION_FRAME_COUNT = 4;

/** Límite de dt (s) para no atravesar bloques ni la pala al volver a la pestaña. */
export const MAX_DT = 0.05;

export const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";
export const BOUNCE_SOUND_SRC = "/games/arkanoid/ball-bounce.mp3";
export const BREAK_SOUND_SRC = "/games/arkanoid/break-sound.mp3";
