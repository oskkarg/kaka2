/**
DIV-8 Fantasy Console Runtime Engine
Cooperative multitasking scheduler, collision engine, input manager, and renderer.
Renderiza por buffer de píxeles INDEXADO (1 byte por píxel) al estilo PICO-8.
*/
import { ProcessInstance, Sprite, GamepadState, TextDrawCall, ShapeDrawCall } from './types';
import {
  DEFAULT_SPRITES,
  getSpriteById,
  createFrameBuffer,
  clearFrameBuffer,
  presentFrameBuffer,
  blitSprite,
  PixelFrameBuffer,
} from './sprites';
import { audio } from './audio';
import { getColorHex } from './palette';

export class DivRuntime {
  public width: number = 320;
  public height: number = 240;
  public processes: ProcessInstance[] = [];
  public nextProcessId: number = 1;
  public processDefs: Map<string, (self: ProcessInstance, ...args: any[]) => Generator<any, any, any>> = new Map();
  public globals: Record<string, any> = {};
  public sprites: Sprite[] = [...DEFAULT_SPRITES];
  public textCalls: TextDrawCall[] = [];
  public shapeCalls: ShapeDrawCall[] = [];
  public bgColor: number = 0;
  public input: GamepadState = {
    up: false, down: false, left: false, right: false,
    a: false, b: false, start: false, select: false,
  };
  private activeKeys: Set<string> = new Set();
  public isRunning: boolean = false;
  public isPaused: boolean = false;
  public fps: number = 60;
  public frameCount: number = 0;
  private lastTime: number = 0;
  private fpsCounter: number = 0;
  private fpsTimer: number = 0;
  private animFrameId: number | null = null;
  public onLog?: (msg: string, type: 'info' | 'warn' | 'error') => void;
  public onStatsUpdate?: (stats: { fps: number; processCount: number; frame: number }) => void;

  // Buffer de píxeles indexado reutilizable (memoria de pantalla de PICO-8)
  private frameBuffer: PixelFrameBuffer | null = null;

  // Bandera de ordenación por z: se activa cuando cambia z o el número de procesos
  private sortDirty = true;

  // Estado de get_id: un único cursor activo por frame.
  private getIdType: string | null = null;
  private getIdIndex = 0;
  private getIdCache: ProcessInstance[] | null = null;
  private getIdExhausted = false;

  constructor() {
    this.setupKeyboardListeners();
  }

  public registerProcess(name: string, generatorFn: (self: ProcessInstance, ...args: any[]) => Generator<any, any, any>) {
    this.processDefs.set(name.toLowerCase(), generatorFn);
  }

  public reset() {
    this.processes = [];
    this.nextProcessId = 1;
    this.globals = {};
    this.textCalls = [];
    this.shapeCalls = [];
    this.bgColor = 0;
    this.frameCount = 0;
    this.sortDirty = false;

    // Reset de get_id
    this.getIdType = null;
    this.getIdIndex = 0;
    this.getIdCache = null;
    this.getIdExhausted = false;
  }

  public spawn(type: string, parentId: number = 0, args: any[] = []): number {
    const typeLower = type.toLowerCase();
    const generatorFn = this.processDefs.get(typeLower);
    if (!generatorFn) {
      if (this.onLog) this.onLog(`Advertencia: Proceso '${type}' no encontrado`, 'warn');
      return 0;
    }

    const id = this.nextProcessId++;
    const target: ProcessInstance = {
      id, type: typeLower,
      father: parentId || 0,
	  frozen: false,    
      x: 160,
      y: 120,
      z: 0, graph: 0, size: 100, angle: 0, flags: 0, alpha: 1.0,
      locals: {}, iterator: null, alive: true,
    };

    const runtime = this;

    const instance: ProcessInstance = new Proxy(target, {
      get(obj: any, prop: string | symbol) {
        if (typeof prop === 'string') {
          if (prop in obj && obj[prop] !== undefined) return obj[prop];
          if (prop in obj.locals && obj.locals[prop] !== undefined) return obj.locals[prop];
          return 0;
        }
        return obj[prop];
      },
      set(obj: any, prop: string | symbol, value: any) {
        if (typeof prop === 'string') {
          switch (prop) {
            case 'id':
            case 'type':
            case 'father':
			case 'frozen':  
            case 'x':
            case 'y':
            case 'z':
            case 'graph':
            case 'size':
            case 'angle':
            case 'flags':
            case 'alpha':
            case 'iterator':
            case 'alive':
            case 'locals':
              if (prop === 'z' && obj.z !== value) {
                runtime.sortDirty = true;
              }
              obj[prop] = value;
              break;

            default:
              obj.locals[prop] = value;
              obj[prop] = value;
              break;
          }
        } else {
          obj[prop] = value;
        }
        return true;
      },
    });

    instance.iterator = generatorFn(instance, ...args);

    try {
      const step = instance.iterator.next();
      if (step.done) {
        instance.alive = false;
        return id;
      }
    } catch (err: any) {
      console.error(`Error in process ${typeLower} (id: ${id}):`, err);
      if (this.onLog) this.onLog(`Error en proceso ${typeLower}: ${err.message}`, 'error');
      instance.alive = false;
      return id;
    }

    const last = this.processes[this.processes.length - 1];
    this.processes.push(instance);
    if (last && instance.z < last.z) {
      this.sortDirty = true;
    }

    return id;
  }

  public tick() {
    // Reset del cursor de get_id al inicio de cada frame.
    this.getIdType = null;
    this.getIdIndex = 0;
    this.getIdCache = null;
    this.getIdExhausted = false;

    this.textCalls = [];
    this.shapeCalls = [];
    const currentProcs = [...this.processes];
	for (let i = 0; i < currentProcs.length; i++) {
  const proc = currentProcs[i];
  if (!proc.alive || !proc.iterator) continue;
  if (proc.frozen) continue;         // ← nuevo

  try {
    const step = proc.iterator.next();
    if (step.done) proc.alive = false;
  } catch (err: any) {
    console.error(`Error in process ${proc.type} (id: ${proc.id}):`, err);
    if (this.onLog) this.onLog(`Error en proceso ${proc.type}: ${err.message}`, 'error');
    proc.alive = false;
  }
}



  

    const count = this.processes.length;
    this.processes = this.processes.filter(p => p.alive);
    if (this.processes.length !== count) {
      this.sortDirty = true;
    }

    this.frameCount++;
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (!this.frameBuffer || this.frameBuffer.width !== this.width || this.frameBuffer.height !== this.height) {
      this.frameBuffer = createFrameBuffer(this.width, this.height);
    }
    const fb = this.frameBuffer;

    clearFrameBuffer(fb, this.bgColor);

    for (const shape of this.shapeCalls) {
      this.paintShapeToBuffer(fb, shape);
    }

    if (this.sortDirty) {
      this.processes.sort((a, b) => a.z - b.z);
      this.sortDirty = false;
    }

    for (let i = 0; i < this.processes.length; i++) {
      const proc = this.processes[i];
      if (!proc.alive) continue;
      if (proc.graph > 0) {
        const sprite = getSpriteById(this.sprites, proc.graph);
        if (sprite) {
          blitSprite(fb, sprite, proc.x, proc.y, proc.size, proc.angle, proc.flags);
        } else {
          this.fillRectBuffer(fb, Math.round(proc.x - 4), Math.round(proc.y - 4), 8, 8, 11);
        }
      }
    }

    ctx.putImageData(presentFrameBuffer(fb), 0, 0);

    if (this.textCalls.length > 0) {
      for (const call of this.textCalls) {
        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = getColorHex(call.color);
        ctx.textAlign = call.align;
        ctx.textBaseline = 'top';
        ctx.fillText(call.text, Math.round(call.x), Math.round(call.y));
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------
  // Helpers de dibujo directo al buffer INDEXADO
  // ---------------------------------------------------------------
  private packColor(colorIndex: number): number {
    return Math.max(0, Math.min(255, Math.floor(colorIndex)));
  }

  private fillRectBuffer(fb: PixelFrameBuffer, x: number, y: number, w: number, h: number, colorIndex: number) {
    const color = this.packColor(colorIndex);
    const W = fb.width, H = fb.height;
    const u8 = fb.pixels;
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w);
    const y1 = Math.min(H, y + h);
    if (x0 >= x1 || y0 >= y1) return;
    for (let yy = y0; yy < y1; yy++) {
      const off = yy * W;
      for (let xx = x0; xx < x1; xx++) {
        u8[off + xx] = color;
      }
    }
  }

  private paintShapeToBuffer(fb: PixelFrameBuffer, shape: ShapeDrawCall) {
    const W = fb.width, H = fb.height;
    const u8 = fb.pixels;

    if (shape.type === 'box_fill') {
      this.fillRectBuffer(fb, Math.round(shape.x1), Math.round(shape.y1), Math.round(shape.x2), Math.round(shape.y2), shape.color);
      return;
    }

    if (shape.type === 'pixel') {
      const x = Math.round(shape.x1);
      const y = Math.round(shape.y1);
      if (x >= 0 && x < W && y >= 0 && y < H) {
        u8[y * W + x] = this.packColor(shape.color);
      }
      return;
    }

    if (shape.type === 'line') {
      let x0 = Math.round(shape.x1), y0 = Math.round(shape.y1);
      let x1 = Math.round(shape.x2), y1 = Math.round(shape.y2);
      const color = this.packColor(shape.color);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) u8[y0 * W + x0] = color;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return;
    }

    if (shape.type === 'circle_fill' || shape.type === 'circle') {
      const cx = shape.x1;
      const cy = shape.y1;
      const r = shape.x2;
      const filled = shape.type === 'circle_fill';
      const color = this.packColor(shape.color);

      let x = r;
      let y = 0;
      let err = 1 - x;

      const plot = (px: number, py: number) => {
        const xi = Math.round(px);
        const yi = Math.round(py);
        if (xi >= 0 && xi < W && yi >= 0 && yi < H) u8[yi * W + xi] = color;
      };

      const hline = (yLine: number, xa: number, xb: number) => {
        const yi = Math.round(yLine);
        if (yi < 0 || yi >= H) return;
        const x0 = Math.max(0, Math.round(xa));
        const x1 = Math.min(W - 1, Math.round(xb));
        const off = yi * W;
        for (let xx = x0; xx <= x1; xx++) u8[off + xx] = color;
      };

      while (x >= y) {
        if (filled) {
          hline(cy + y, cx - x, cx + x);
          hline(cy - y, cx - x, cx + x);
          hline(cy + x, cx - y, cx + y);
          hline(cy - x, cx - y, cx + y);
        } else {
          plot(cx + x, cy + y); plot(cx - x, cy + y);
          plot(cx + x, cy - y); plot(cx - x, cy - y);
          plot(cx + y, cy + x); plot(cx - y, cy + x);
          plot(cx + y, cy - x); plot(cx - y, cy - x);
        }
        y++;
        if (err < 0) err += 2 * y + 1;
        else { x--; err += 2 * (y - x) + 1; }
      }
      return;
    }

    if (shape.type === 'box') {
      const x0 = Math.round(shape.x1);
      const y0 = Math.round(shape.y1);
      const w = Math.round(shape.x2);
      const h = Math.round(shape.y2);
      const color = this.packColor(shape.color);
      const x1 = x0 + w;
      const y1 = y0 + h;

      for (let xx = Math.max(0, x0); xx < Math.min(W, x1); xx++) {
        if (y0 >= 0 && y0 < H) u8[y0 * W + xx] = color;
        if (y1 - 1 >= 0 && y1 - 1 < H) u8[(y1 - 1) * W + xx] = color;
      }

      for (let yy = Math.max(0, y0); yy < Math.min(H, y1); yy++) {
        if (x0 >= 0 && x0 < W) u8[yy * W + x0] = color;
        if (x1 - 1 >= 0 && x1 - 1 < W) u8[yy * W + (x1 - 1)] = color;
      }
      return;
    }
  }

  public key(code: string | number): boolean {
    const c = String(code).toLowerCase();
    if (c === 'up' || c === '_up') return this.input.up;
    if (c === 'down' || c === '_down') return this.input.down;
    if (c === 'left' || c === '_left') return this.input.left;
    if (c === 'right' || c === '_right') return this.input.right;
    if (c === 'a' || c === '_space' || c === '_z' || c === 'space') return this.input.a;
    if (c === 'b' || c === '_x') return this.input.b;
    if (c === 'start' || c === '_enter' || c === 'enter') return this.input.start;
    if (c === 'select' || c === '_shift' || c === 'shift') return this.input.select;
    return this.activeKeys.has(c);
  }

  public collision(caller: ProcessInstance, targetType: string): number {
    const tLower = targetType.toLowerCase();
    const callerRadius = (caller.size / 100) * 8;
    for (let i = 0; i < this.processes.length; i++) {
      const target = this.processes[i];
      if (!target.alive || target.id === caller.id) continue;
      if (target.type !== tLower) continue;
      const targetRadius = (target.size / 100) * 8;
      const dx = target.x - caller.x;
      const dy = target.y - caller.y;
      const distSq = dx * dx + dy * dy;
      const radii = callerRadius + targetRadius;
      if (distSq <= radii * radii) return target.id;
    }
    return 0;
  }

   public signal(targetId: number, signalType: number = 0) {
  // all_process = -1
  if (targetId === -1) {
    if (signalType === 0) {
      this.processes.forEach((p) => { p.alive = false; });
    } else if (signalType === 1 || signalType === 3) {
      this.processes.forEach((p) => { p.frozen = true; });
    } else if (signalType === 2) {
      this.processes.forEach((p) => { p.frozen = false; });
    }
    return;
  }

  const p = this.processes.find((proc) => proc.id === targetId);
  if (!p) return;

  switch (signalType) {
    case 0:   // s_kill
      p.alive = false;
      break;

    case 1:   // s_freeze
    case 3:   // s_sleep (de momento, igual que freeze)
      p.frozen = true;
      break;

    case 2:   // s_wakeup
      p.frozen = false;
      break;

    case -2:  // s_kill_tree
      this.signalTree(p, (proc) => { proc.alive = false; });
      break;

    case -3:  // s_freeze_tree
      this.signalTree(p, (proc) => { proc.frozen = true; });
      break;

    case -4:  // s_wakeup_tree
      this.signalTree(p, (proc) => { proc.frozen = false; });
      break;
  }
}

/**
 * Recorre el proceso y todos sus descendientes (por father, no solo hijos
 * directos) y aplica la función indicada. Funciona aunque algún proceso
 * intermedio ya haya muerto: los descendientes siguen teniendo father
 * apuntando al ancestro, así que se recogen igualmente.
 */
private signalTree(root: ProcessInstance, apply: (proc: ProcessInstance) => void) {
  // Recogemos todos los procesos que descienden de root, en anchura.
  const pending: number[] = [root.id];
  const visited = new Set<number>();

  while (pending.length > 0) {
    const currentId = pending.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Encontrar el proceso con ese id (puede ser root o un descendiente).
    const current = this.processes.find((p) => p.id === currentId);
    if (current) {
      apply(current);
    }

    // Añadir hijos directos a la cola (aunque el padre esté muerto).
    for (const child of this.processes) {
      if (child.father === currentId && !visited.has(child.id)) {
        pending.push(child.id);
      }
    }
  }
}

  public letMeAlone(caller: ProcessInstance) {
    this.processes.forEach((p) => { if (p.id !== caller.id) p.alive = false; });
    this.input.start = false;
    this.activeKeys.delete('enter');
  }

  public exit() {
    this.processes.forEach((p) => { p.alive = false; });
    this.input.start = false;
    this.activeKeys.clear();
  }

  // ---------------------------------------------------------------
  // get_id() — recorrido stateful de procesos por tipo
  // ---------------------------------------------------------------

  public get_id(typeName: string | number): number {
    if (typeName === 0 || typeName === '0') {
      return 0;
    }

    const type = String(typeName).toLowerCase();

    if (this.getIdType !== type) {
      this.getIdType = type;
      this.getIdIndex = 0;
      this.getIdCache = null;
      this.getIdExhausted = false;
    }

    if (this.getIdExhausted) {
      return 0;
    }

    if (this.getIdCache === null) {
      this.getIdCache = this.processes
        .filter(p => p.alive && p.type === type)
        .sort((a, b) => a.id - b.id);
    }

    while (this.getIdIndex < this.getIdCache.length) {
      const proc = this.getIdCache[this.getIdIndex++];
      if (proc.alive) {
        return proc.id;
      }
    }

    this.getIdExhausted = true;
    return 0;
  }

  public rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
  public playSound(idOrName: number | string) { audio.playSound(idOrName); }

  public write(x: number, y: number, text: any, color: number = 7, align: 'left' | 'center' | 'right' = 'left') {
    this.textCalls.push({ text: String(text), x, y, color: typeof color === 'number' ? color : 7, align });
  }
  public drawBox(x1: number, y1: number, w: number, h: number, color: number = 7, filled: boolean | number = 1) {
    this.shapeCalls.push({ type: filled ? 'box_fill' : 'box', x1, y1, x2: w, y2: h, color });
  }
  public drawCircle(x: number, y: number, r: number, color: number = 7, filled: boolean | number = 1) {
    this.shapeCalls.push({ type: filled ? 'circle_fill' : 'circle', x1: x, y1: y, x2: r, y2: 0, color });
  }
  public drawLine(x1: number, y1: number, x2: number, y2: number, color: number = 7) {
    this.shapeCalls.push({ type: 'line', x1, y1, x2, y2, color });
  }
  public clearScreen(color: number = 0) { this.bgColor = color; }
  public setScreenColor(color: number = 0) { this.bgColor = color; }
  public getDist(x1: number, y1: number, x2: number, y2: number): number { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
  public getAngle(x1: number, y1: number, x2: number, y2: number): number {
    let deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }
  public getProcessById(id: number): ProcessInstance | undefined { return this.processes.find((p) => p.id === id); }
  public getProcessesByType(type: string): ProcessInstance[] {
    const tLower = type.toLowerCase();
    return this.processes.filter((p) => p.alive && p.type === tLower);
  }


  // ---------------------------------------------------------------
  // Movimiento de procesos
  // ---------------------------------------------------------------

  /** Mueve el proceso a una posición absoluta. */
  public move(caller: ProcessInstance, x: number, y: number): number {
    caller.x = x;
    caller.y = y;
    return 0;
  }

  /** Avanza el proceso en la dirección de su ángulo.OJO lo hacemos en radianes !! */
  public advance(caller: ProcessInstance, speed: number): number {
  caller.x += Math.cos(caller.angle) * speed;
  caller.y += Math.sin(caller.angle) * speed;
  return 0;
}

  /** Desplaza la pantalla. Stub por ahora. */
  public scroll(_dx: number, _dy: number): number {
    return 0;
  }










  // ---------------------------------------------------------------
  // Soporte de tablas / arrays (DIV TABLAS)
  // ---------------------------------------------------------------

  public newArray(dims: number[], fill: any = 0): any[] {
    if (!dims || dims.length === 0) return [];
    const size = Math.max(0, Math.trunc(dims[0]) || 0);
    const rest = dims.slice(1);
    const arr: any[] = new Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = rest.length > 0 ? this.newArray(rest, fill) : fill;
    }
    return arr;
  }

  public arrGet(target: any, indices: number[]): any {
    let current = target;
    for (let k = 0; k < indices.length; k++) {
      if (current === null || current === undefined) return 0;
      if (typeof current === 'string') {
        const ch = current[Math.trunc(indices[k])];
        if (ch === undefined) return 0;
        current = ch;
        continue;
      }
      if (typeof current !== 'object') return 0;
      const value = current[Math.trunc(indices[k]) || 0];
      if (value === undefined || value === null) return 0;
      current = value;
    }
    return current;
  }

  public arrSet(target: any, indices: number[], value: any): any {
    if (!Array.isArray(target) || indices.length === 0) return value;
    let current: any = target;
    for (let k = 0; k < indices.length - 1; k++) {
      const idx = Math.trunc(indices[k]) || 0;
      if (!Array.isArray(current[idx])) current[idx] = [];
      current = current[idx];
    }
    current[Math.trunc(indices[indices.length - 1]) || 0] = value;
    return value;
  }

  public arrLen(target: any): number {
    if (target === null || target === undefined) return 0;
    if (Array.isArray(target)) return target.length;
    if (typeof target === 'string') return target.length;
    return 0;
  }

  public asArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split('');
    if (value === null || value === undefined || typeof value !== 'object') return [];
    return Object.values(value);
  }

  public getProcessProp(id: number, prop: string): any {
    const proc = this.getProcessById(id);
    if (!proc) return 0;
    const value = (proc as any)[prop];
    return value === undefined ? 0 : value;
  }

  public setProcessProp(id: number, prop: string, value: any): any {
    const proc = this.getProcessById(id);
    if (proc) (proc as any)[prop] = value;
    return value;
  }

  public invoke(name: string, caller: ProcessInstance, args: any[] = []): any {
    const key = name.toLowerCase();
    const fn = (this as any)[key];
    if (typeof fn === 'function' && key !== 'invoke' && key !== 'spawn') {
      return fn.apply(this, args);
    }
    if (this.onLog) this.onLog(`Función no encontrada: ${name}()`, 'warn');
    return 0;
  }

  private setupKeyboardListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.activeKeys.add(e.key.toLowerCase());
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.input.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.input.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.input.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.right = true;
      if (e.key === 'z' || e.key === 'Z' || e.key === ' ' || e.key === 'Control') this.input.a = true;
      if (e.key === 'x' || e.key === 'X' || e.key === 'Alt') this.input.b = true;
      if (e.key === 'Enter') this.input.start = true;
      if (e.key === 'Shift') this.input.select = true;
    });
    window.addEventListener('keyup', (e) => {
      this.activeKeys.delete(e.key.toLowerCase());
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.input.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.input.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.input.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.right = false;
      if (e.key === 'z' || e.key === 'Z' || e.key === ' ' || e.key === 'Control') this.input.a = false;
      if (e.key === 'x' || e.key === 'X' || e.key === 'Alt') this.input.b = false;
      if (e.key === 'Enter') this.input.start = false;
      if (e.key === 'Shift') this.input.select = false;
    });
  }

  public start(canvas: HTMLCanvasElement) {
    this.stop();
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.fpsTimer = performance.now();
    this.fpsCounter = 0;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;
      if (!this.isPaused) this.tick();
      this.render(ctx);
      this.fpsCounter++;
      if (currentTime - this.fpsTimer >= 1000) {
        this.fps = this.fpsCounter;
        this.fpsCounter = 0;
        this.fpsTimer = currentTime;
        if (this.onStatsUpdate) this.onStatsUpdate({ fps: this.fps, processCount: this.processes.length, frame: this.frameCount });
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
  }
  public pause() { this.isPaused = !this.isPaused; }
  public step() { if (this.isPaused) this.tick(); }
}