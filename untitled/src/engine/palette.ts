/**
 * DIV-8 32-Color Retro Palette
 */

export interface PaletteColor {
  index: number;
  hex: string;
  r: number;
  g: number;
  b: number;
  name: string;
}

export const PALETTE: PaletteColor[] = [
  { index: 0, hex: '#000000', r: 0, g: 0, b: 0, name: 'Negro / Transparente' },
  { index: 1, hex: '#1D2B53', r: 29, g: 43, b: 83, name: 'Azul Oscuro' },
  { index: 2, hex: '#7E2553', r: 126, g: 37, b: 83, name: 'Púrpura' },
  { index: 3, hex: '#008751', r: 0, g: 135, b: 81, name: 'Verde Oscuro' },
  { index: 4, hex: '#AB5236', r: 171, g: 82, b: 54, name: 'Marrón' },
  { index: 5, hex: '#5F574F', r: 95, g: 87, b: 79, name: 'Gris Oscuro' },
  { index: 6, hex: '#C2C3C7', r: 194, g: 195, b: 199, name: 'Gris Claro' },
  { index: 7, hex: '#FFF1E8', r: 255, g: 241, b: 232, name: 'Blanco' },
  { index: 8, hex: '#FF004D', r: 255, g: 0, b: 77, name: 'Rojo' },
  { index: 9, hex: '#FFA300', r: 255, g: 163, b: 0, name: 'Naranja' },
  { index: 10, hex: '#FFEC27', r: 255, g: 236, b: 39, name: 'Amarillo' },
  { index: 11, hex: '#00E436', r: 0, g: 228, b: 54, name: 'Verde' },
  { index: 12, hex: '#29ADFF', r: 41, g: 173, b: 255, name: 'Azul Celeste' },
  { index: 13, hex: '#83769C', r: 131, g: 118, b: 156, name: 'Lavanda' },
  { index: 14, hex: '#FF77A8', r: 255, g: 119, b: 168, name: 'Rosa' },
  { index: 15, hex: '#FFCCAA', r: 255, g: 204, b: 170, name: 'Piel / Melocotón' },

  // Extended DIV VGA Colors
  { index: 16, hex: '#291838', r: 41, g: 24, b: 56, name: 'Berenjena' },
  { index: 17, hex: '#3E5B7A', r: 62, g: 91, b: 122, name: 'Azul Acero' },
  { index: 18, hex: '#249f9c', r: 36, g: 159, b: 156, name: 'Turquesa' },
  { index: 19, hex: '#77dc96', r: 119, g: 220, b: 150, name: 'Menta' },
  { index: 20, hex: '#be3942', r: 190, g: 57, b: 66, name: 'Carmesí' },
  { index: 21, hex: '#f06e3a', r: 240, g: 110, b: 58, name: 'Óxido' },
  { index: 22, hex: '#f5d15a', r: 245, g: 209, b: 90, name: 'Dorado' },
  { index: 23, hex: '#b5ec58', r: 181, g: 236, b: 88, name: 'Lima' },
  { index: 24, hex: '#5b2f8a', r: 91, g: 47, b: 138, name: 'Violeta' },
  { index: 25, hex: '#a84cb8', r: 168, g: 76, b: 184, name: 'Magenta' },
  { index: 26, hex: '#d480bb', r: 212, g: 128, b: 187, name: 'Lila' },
  { index: 27, hex: '#165787', r: 22, g: 87, b: 135, name: 'Azul Marino' },
  { index: 28, hex: '#20857c', r: 32, g: 133, b: 124, name: 'Verde Mar' },
  { index: 29, hex: '#482a17', r: 72, g: 42, b: 23, name: 'Chocolate' },
  { index: 30, hex: '#8a5c38', r: 138, g: 92, b: 56, name: 'Cobre' },
  { index: 31, hex: '#ffffff', r: 255, g: 255, b: 255, name: 'Blanco Puro' },
];

export function getColorHex(index: number): string {
  const c = PALETTE[index % PALETTE.length];
  return c ? c.hex : '#000000';
}

export function getColorRgb(index: number): [number, number, number] {
  const c = PALETTE[index % PALETTE.length];
  return c ? [c.r, c.g, c.b] : [0, 0, 0];
}
