import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAME_COUNT,
  SPRITESHEET_SRC,
} from "./constants";
import type { BlockColor } from "./levels";

interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Fila (sy) de cada color dentro del spritesheet
const BLOCK_SY: Record<BlockColor, number> = {
  red: 176,
  cyan: 192,
  green: 208,
  magenta: 224,
  yellow: 240,
  hotpink: 256,
  gray: 288,
};
// El bloque gris no tiene fila de explosión propia: usa la del rojo
const EXPLOSION_SY: Record<BlockColor, number> = {
  ...BLOCK_SY,
  gray: 176,
};

const BLOCK_SX = 32;
const EXPLOSION_SX = 256;
const SPRITE_W = 32;
const SPRITE_H = 16;

export const PADDLE_SPRITE: Frame = { sx: 32, sy: 112, sw: 162, sh: 14 };
export const BALL_SPRITE: Frame = { sx: 32, sy: 32, sw: 16, sh: 16 };

export function blockSprite(color: BlockColor): Frame {
  return { sx: BLOCK_SX, sy: BLOCK_SY[color], sw: SPRITE_W, sh: SPRITE_H };
}

/** Fotograma de la explosión según los ms transcurridos. */
export function explosionFrame(color: BlockColor, elapsed: number): Frame {
  const i = Math.min(
    Math.floor((elapsed / EXPLOSION_DURATION) * EXPLOSION_FRAME_COUNT),
    EXPLOSION_FRAME_COUNT - 1,
  );
  return {
    sx: EXPLOSION_SX + i * SPRITE_W,
    sy: EXPLOSION_SY[color],
    sw: SPRITE_W,
    sh: SPRITE_H,
  };
}

/** Carga la imagen (solo en el cliente; llamar desde el motor, no desde el render). */
export function loadSpritesheet(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load spritesheet"));
    img.src = SPRITESHEET_SRC;
  });
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  f: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(sheet, f.sx, f.sy, f.sw, f.sh, x, y, w, h);
}
