/**
 * DIV-8 Fantasy Console Types
 */

export interface Sprite {
  id: number;
  name: string;
  width: number;
  height: number;
  // Matrix of palette color indices (0-15 or 0-31), 0 is transparent
  data: number[];
  _canvas?: HTMLCanvasElement;
  _texture?: any;
}

export interface SoundPreset {
  id: number;
  name: string;
  type: 'laser' | 'explosion' | 'jump' | 'hit' | 'coin' | 'powerup' | 'beep';
  freq: number;
  speed: number;
  decay: number;
}

export interface ProcessInstance {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  graph: number; // sprite id (or 0 for custom shape)
  size: number;  // 100 = normal 100%, 50 = half, 200 = double
  angle: number; // degrees 0-360
  flags: number; // 0 = normal, 1 = flip_h, 2 = flip_v
  alpha: number; // 1.0 = solid, 0.0 = invisible
  ctype?: number; // 0 = c_screen (default), 1 = c_scroll
  // process-specific local variables
  locals: Record<string, any>;
  // generator iterator
  iterator: Generator<any, any, any> | null;
  alive: boolean;
  parent?: number;
}

export interface TextDrawCall {
  text: string;
  x: number;
  y: number;
  color: number;
  align: 'left' | 'center' | 'right';
  size?: number;
}

export interface ShapeDrawCall {
  type: 'box' | 'box_fill' | 'circle' | 'circle_fill' | 'line' | 'pixel';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
}

export interface GamepadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean; // Z or Space
  b: boolean; // X
  start: boolean; // Enter
  select: boolean; // Shift
}

export interface Cartridge {
  id: string;
  title: string;
  author: string;
  description: string;
  code: string;
  sprites?: Sprite[];
}

export interface CompilerError {
  line: number;
  column: number;
  message: string;
  codeContext?: string;
}
