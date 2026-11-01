/**
 * Built-in Sprite Library and Efficient Render Engine for DIV-8 Fantasy Console
 *
 * Renderizado por buffer de píxeles INDEXADO (1 byte por píxel).
 * Los sprites se cachean como índices de paleta (Uint8Array) y se blitean
 * al framebuffer indexado. Solo al final del frame se convierte a RGBA
 * con una LUT de 256 entradas y se vuelca con putImageData.
 *
 * Caché de sprites por WeakMap: sin construir claves de string ni consultar
 * Map por id. El sprite convertido se asocia directamente al objeto Sprite.
 */

import { Sprite } from './types';
import { PALETTE_RGBA32, getColorRgb } from './palette';

// ---------------------------------------------------------------
// ASCII -> Sprite
// ---------------------------------------------------------------
function parseAsciiSprite(id: number, name: string, width: number, height: number, rows: string[]): Sprite {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] || '';
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.';
      if (char === '.') data.push(0);
      else if (char >= '0' && char <= '9') data.push(parseInt(char, 10));
      else if (char === 'a') data.push(10);
      else if (char === 'b') data.push(11);
      else if (char === 'c') data.push(12);
      else if (char === 'd') data.push(13);
      else if (char === 'e') data.push(14);
      else if (char === 'f') data.push(15);
      else if (char === 'W') data.push(7);
      else if (char === 'R') data.push(8);
      else if (char === 'Y') data.push(10);
      else if (char === 'G') data.push(11);
      else if (char === 'B') data.push(12);
      else if (char === 'P') data.push(14);
      else if (char === 'X') data.push(5);
      else data.push(7);
    }
  }
  return { id, name, width, height, data };
}

// ---------------------------------------------------------------
// Biblioteca de sprites por defecto
// ---------------------------------------------------------------
export const DEFAULT_SPRITES: Sprite[] = [
  // 1: Nave Jugador (16x16)
  parseAsciiSprite(1, 'Nave Jugador', 16, 16, [
    '.......77.......',
    '......7cc7......',
    '......7cc7......',
    '.....7cccc7.....',
    '.....7cccc7.....',
    '....7cccccc7....',
    '....7c1111c7....',
    '...7c177771c7...',
    '...7c17..71c7...',
    '..7717....7177..',
    '.7cc17777771cc7.',
    '7ccc11111111ccc7',
    '77777a9aa9a77777',
    '....9a9..9a9....',
    '....98....89....',
    '.....8....8.....',
  ]),

  // 2: Láser / Bala (8x8)
  parseAsciiSprite(2, 'Laser / Bala', 8, 8, [
    '...aa...',
    '..aaaa..',
    '..a77a..',
    '..a77a..',
    '..a77a..',
    '..aaaa..',
    '...99...',
    '...88...',
  ]),

  // 3: Alien / Enemigo (16x16)
  parseAsciiSprite(3, 'Alien Enemigo', 16, 16, [
    '....888....888..',
    '.....888..888...',
    '....8888888888..',
    '...889888888988.',
    '..88998888889988',
    '..88998888889988',
    '..88888888888888',
    '..88888888888888',
    '...888888888888.',
    '....88.88.88....',
    '...88..88..88...',
    '..88...88...88..',
    '.88....88....88.',
    '88............88',
    '................',
    '................',
  ]),

  // 4: Asteroide (16x16)
  parseAsciiSprite(4, 'Asteroide', 16, 16, [
    '....4444444.....',
    '...445555444....',
    '..45566655444...',
    '.4566666655444..',
    '456655566654444.',
    '456554556655444.',
    '456544456655444.',
    '456655566654444.',
    '.4566666655444..',
    '..45666655444...',
    '...455555444....',
    '....4444444.....',
    '.....4444.......',
    '................',
    '................',
    '................',
  ]),

  // 5: Explosión (16x16)
  parseAsciiSprite(5, 'Explosión', 16, 16, [
    '....9...aa...9..',
    '..9.aa.7777.aa.9',
    '...a7777aa777a..',
    '.9a7a999999a7a9.',
    '..a9988888899a..',
    '.a988888888889a.',
    'a79888888888897a',
    'a79888888888897a',
    '.a988888888889a.',
    '..a9988888899a..',
    '.9a7a999999a7a9.',
    '...a7777aa777a..',
    '..9.aa.7777.aa.9',
    '....9...aa...9..',
    '................',
    '................',
  ]),

  // 6: Héroe Diver (16x16)
  parseAsciiSprite(6, 'Héroe Diver', 16, 16, [
    '.....cccc.......',
    '....cccccc......',
    '....cccccc......',
    '....ffff77......',
    '...ffffff77.....',
    '...ff0ff0ff.....',
    '...ffffff.......',
    '....ffff........',
    '...88888888.....',
    '..8888888888....',
    '..8888888888....',
    '..88.8888.88....',
    '.....8888.......',
    '....11..11......',
    '....11..11......',
    '...555..555.....',
  ]),

  // 7: Moneda / Gema (8x8)
  parseAsciiSprite(7, 'Moneda Oro', 8, 8, [
    '..aaaa..',
    '.aa77aa.',
    'aa7aaa9a',
    'aa7aaa9a',
    'aa7aaa9a',
    'aa7aaa9a',
    '.aa999a.',
    '..aaaa..',
  ]),

  // 8: Esqueleto / Fantasma (16x16)
  parseAsciiSprite(8, 'Esqueleto / Fantasma', 16, 16, [
    '.....777777.....',
    '...7777777777...',
    '..777777777777..',
    '..770077770077..',
    '..778877778877..',
    '..770077770077..',
    '..777770077777..',
    '...7777777777...',
    '....70707070....',
    '....77777777....',
    '...5577557755...',
    '..55.77..77.55..',
    '.....77..77.....',
    '.....77..77.....',
    '....555..555....',
    '................',
  ]),

  // 9: Corazón / Vida (8x8)
  parseAsciiSprite(9, 'Corazón / Vida', 8, 8, [
    '.88..88.',
    '87788888',
    '87888888',
    '88888888',
    '.888888.',
    '..8888..',
    '...88...',
    '....8...',
  ]),

  // 10: Ladrillo / Muro (16x16)
  parseAsciiSprite(10, 'Ladrillo / Muro', 16, 16, [
    '9999999999999999',
    '9444444494444444',
    '9444444494444444',
    '9444444494444444',
    '9999999999999999',
    '4444444944444449',
    '4444444944444449',
    '4444444944444449',
    '9999999999999999',
    '9444444494444444',
    '9444444494444444',
    '9444444494444444',
    '9999999999999999',
    '4444444944444449',
    '4444444944444449',
    '9999999999999999',
  ]),

  // 11: Pelota (8x8)
  parseAsciiSprite(11, 'Pelota', 8, 8, [
    '..7777..',
    '.777777.',
    '77c77777',
    '7c1c7777',
    '77c77777',
    '77777777',
    '.777777.',
    '..7777..',
  ]),

  // 12: Pala / Raqueta (16x8)
  parseAsciiSprite(12, 'Pala / Raqueta', 16, 8, [
    '..cccccccccccc..',
    '.c777777777777c.',
    'c7cccccccccccc7c',
    'c11111111111111c',
    'c11111111111111c',
    'c7cccccccccccc7c',
    '.c777777777777c.',
    '..cccccccccccc..',
  ]),

  // 13: Estrella (8x8)
  parseAsciiSprite(13, 'Estrella', 8, 8, [
    '...aa...',
    '...aa...',
    '..aaaa..',
    'aaaaaaaa',
    '..aaaa..',
    '.aa..aa.',
    'aa....aa',
    '........',
  ]),

  // 14: Llave (8x8)
  parseAsciiSprite(14, 'Llave Cofre', 8, 8, [
    '..aaaa..',
    '.aa..aa.',
    '.aa..aa.',
    '..aaaa..',
    '...aa...',
    '...aaaa.',
    '...aa...',
    '...aaaa.',
  ]),

  // 15: Antorcha / Llama (8x8)
  parseAsciiSprite(15, 'Antorcha', 8, 8, [
    '...77...',
    '..7aa7..',
    '..a99a..',
    '..9889..',
    '...88...',
    '..4444..',
    '...44...',
    '...44...',
  ]),

  // 16: Cofre del Tesoro (16x16)
  parseAsciiSprite(16, 'Cofre Tesoro', 16, 16, [
    '................',
    '..444444444444..',
    '.4aaaaaaaaaaaa4.',
    '.4a4444444444a4.',
    '44a4aaaaaaaa4a44',
    '44a4a999999a4a44',
    '44a4a9aaaa9a4a44',
    '4444444444444444',
    '44a4444aa4444a44',
    '44a444aaaa444a44',
    '44a444a00a444a44',
    '44a444aaaa444a44',
    '44a4444aa4444a44',
    '4444444444444444',
    '.4aaaaaaaaaaaa4.',
    '................',
  ]),
];

// ---------------------------------------------------------------
// Búsqueda de sprite (con acceso directo y fallback)
// ---------------------------------------------------------------
export function getSpriteById(sprites: Sprite[], id: number): Sprite | undefined {
  // Acceso directo si el array está indexado por id-1
  const direct = sprites[id - 1];
  if (direct && direct.id === id) return direct;

  for (let i = 0; i < sprites.length; i++) {
    if (sprites[i].id === id) return sprites[i];
  }

  if (sprites !== DEFAULT_SPRITES) {
    return getSpriteById(DEFAULT_SPRITES, id);
  }

  return undefined;
}

// ---------------------------------------------------------------
// Caché de sprites indexados (1 byte por píxel)
// WeakMap asociado directamente al objeto Sprite: sin claves de
// string, sin colisiones, sin construir la clave en cada blit.
// ---------------------------------------------------------------
interface CachedSprite {
  width: number;
  height: number;
  pixels: Uint8Array;
}

const SPRITE_CACHE = new WeakMap<Sprite, CachedSprite>();

function getCachedSprite(sprite: Sprite): CachedSprite {
  let cached = SPRITE_CACHE.get(sprite);

  if (cached) return cached;

  const pixels = new Uint8Array(sprite.width * sprite.height);
  const count = Math.min(pixels.length, sprite.data.length);

  for (let i = 0; i < count; i++) {
    pixels[i] = sprite.data[i] & 255;
  }

  cached = {
    width: sprite.width,
    height: sprite.height,
    pixels,
  };

  SPRITE_CACHE.set(sprite, cached);

  return cached;
}

// ---------------------------------------------------------------
// FRAMEBUFFER INDEXADO
// ---------------------------------------------------------------
export interface PixelFrameBuffer {
  width: number;
  height: number;
  // Un byte por píxel: índice de paleta 0-255.
  pixels: Uint8Array;
  // Buffer final que recibe el Canvas.
  imageData: ImageData;
  // Vista Uint32 sobre imageData.data para la conversión indexado -> RGBA.
  rgba32: Uint32Array;
}

export function createFrameBuffer(width: number, height: number): PixelFrameBuffer {
  const imageData = new ImageData(width, height);
  return {
    width,
    height,
    pixels: new Uint8Array(width * height),
    imageData,
    rgba32: new Uint32Array(imageData.data.buffer),
  };
}

// Limpieza indexada: un byte por píxel.
export function clearFrameBuffer(fb: PixelFrameBuffer, bgColorIndex: number): void {
  fb.pixels.fill(bgColorIndex & 255);
}

// Convierte el framebuffer indexado a RGBA usando la LUT.
// Se ejecuta una vez por fotograma.
export function presentFrameBuffer(fb: PixelFrameBuffer): ImageData {
  const src = fb.pixels;
  const dst = fb.rgba32;
  const lut = PALETTE_RGBA32;

  for (let i = 0; i < src.length; i++) {
    dst[i] = lut[src[i]];
  }

  return fb.imageData;
}

// ---------------------------------------------------------------
// Blit rápido de sprite al framebuffer indexado
// ---------------------------------------------------------------
export function blitSprite(
  fb: PixelFrameBuffer,
  sprite: Sprite,
  cx: number,
  cy: number,
  sizePercent: number,
  angleDeg: number,
  flags: number
): void {
  const cached = getCachedSprite(sprite);

  const baseW = cached.width;
  const baseH = cached.height;

  if (baseW <= 0 || baseH <= 0 || sizePercent <= 0) return;

  const scale = sizePercent / 100;

  const angle = ((Math.round(angleDeg / 90) * 90) % 360 + 360) % 360;

  const dispW = Math.max(1, Math.round(baseW * scale));
  const dispH = Math.max(1, Math.round(baseH * scale));

  const rotated = angle === 90 || angle === 270;

  const outW = rotated ? dispH : dispW;
  const outH = rotated ? dispW : dispH;

  const startX = Math.round(cx - outW / 2);
  const startY = Math.round(cy - outH / 2);

  const flipH = (flags & 1) !== 0;
  const flipV = (flags & 2) !== 0;

  const fbW = fb.width;
  const fbH = fb.height;

  const dst = fb.pixels;
  const src = cached.pixels;

  // -------------------------------------------------------------
  // RUTA ULTRARRÁPIDA
  // Sin rotación, sin escalado y con recorte de pantalla.
  // -------------------------------------------------------------
  if (scale === 1 && angle === 0) {
    const x0 = Math.max(0, startX);
    const x1 = Math.min(fbW, startX + baseW);
    const y0 = Math.max(0, startY);
    const y1 = Math.min(fbH, startY + baseH);

    if (x0 >= x1 || y0 >= y1) return;

    for (let y = y0; y < y1; y++) {
      const sy = y - startY;
      const srcY = flipV ? baseH - 1 - sy : sy;
      const srcRow = srcY * baseW;
      const dstRow = y * fbW;

      if (!flipH) {
        for (let x = x0; x < x1; x++) {
          const color = src[srcRow + x - startX];
          if (color !== 0) dst[dstRow + x] = color;
        }
      } else {
        for (let x = x0; x < x1; x++) {
          const sx = baseW - 1 - (x - startX);
          const color = src[srcRow + sx];
          if (color !== 0) dst[dstRow + x] = color;
        }
      }
    }

    return;
  }

  // -------------------------------------------------------------
  // RUTA GENERAL
  // Escalado, rotación y reflejos.
  // -------------------------------------------------------------
  const stepX = baseW / dispW;
  const stepY = baseH / dispH;

  for (let dy = 0; dy < outH; dy++) {
    const py = startY + dy;
    if (py < 0 || py >= fbH) continue;

    const dstRow = py * fbW;

    for (let dx = 0; dx < outW; dx++) {
      const px = startX + dx;
      if (px < 0 || px >= fbW) continue;

      let u: number;
      let v: number;

      if (angle === 0) {
        u = dx * stepX;
        v = dy * stepY;
      } else if (angle === 90) {
        u = dy * stepX;
        v = (outW - 1 - dx) * stepY;
      } else if (angle === 180) {
        u = (outW - 1 - dx) * stepX;
        v = (outH - 1 - dy) * stepY;
      } else {
        u = (outH - 1 - dy) * stepX;
        v = dx * stepY;
      }

      let sx = Math.floor(u);
      let sy = Math.floor(v);

      if (flipH) sx = baseW - 1 - sx;
      if (flipV) sy = baseH - 1 - sy;

      if (sx < 0) sx = 0;
      else if (sx >= baseW) sx = baseW - 1;

      if (sy < 0) sy = 0;
      else if (sy >= baseH) sy = baseH - 1;

      const color = src[sy * baseW + sx];
      if (color !== 0) {
        dst[dstRow + px] = color;
      }
    }
  }
}

// ---------------------------------------------------------------
// API legacy (no usar en el render loop)
// ---------------------------------------------------------------
export function drawSpriteToCanvas(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  sizePercent: number = 100,
  angleDeg: number = 0,
  flags: number = 0,
  _alpha: number = 1.0
) {
  const cached = getCachedSprite(sprite);
  const scale = sizePercent / 100;
  const w = cached.width * scale;
  const h = cached.height * scale;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (angleDeg !== 0) ctx.rotate((angleDeg * Math.PI) / 180);

  const flipH = (flags & 1) !== 0;
  const flipV = (flags & 2) !== 0;
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  const startX = -Math.round(w / 2);
  const startY = -Math.round(h / 2);

  for (let sy = 0; sy < cached.height; sy++) {
    for (let sx = 0; sx < cached.width; sx++) {
      const c = cached.pixels[sy * cached.width + sx];
      if (c === 0) continue;

      const [r, g, b] = getColorRgb(c);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        startX + Math.round(sx * scale),
        startY + Math.round(sy * scale),
        Math.max(1, Math.ceil(scale)),
        Math.max(1, Math.ceil(scale))
      );
    }
  }

  ctx.restore();
}