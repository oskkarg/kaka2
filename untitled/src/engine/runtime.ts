/**
 * DIV-8 Fantasy Console Runtime Engine
 * Cooperative multitasking scheduler, collision engine, input manager,
 * multiscroll parallax engine, and hybrid renderer.
 */
import { ProcessInstance, Sprite, GamepadState, TextDrawCall, ShapeDrawCall } from './types';
import { DEFAULT_SPRITES, drawSpriteToCanvas, getSpriteById, getSpriteCanvas } from './sprites';
import { audio } from './audio';
import { getColorHex, PALETTE } from './palette';
import { PixiRenderer } from './pixiRenderer';
import { ScrollManager, ScrollInstance } from './scroll';
import { DivTilemap } from './tilemap';
import { createDefaultSonicTilemap } from './sonicAssets';

function createLocals(initial?: Record<string, any>): Record<string, any> {
  const store: Record<string, any> = initial ? { ...initial } : {};
  return new Proxy(store, {
    get(target, prop) {
      if (typeof prop === 'string') {
        const val = target[prop];
        return val !== undefined ? val : 0;
      }
      return target[prop as any];
    },
    set(target, prop, val) {
      target[prop as any] = val;
      return true;
    },
  });
}

export class ProcessInstanceImpl implements ProcessInstance {
  public id: number;
  public type: string;
  public x: number;
  public y: number;
  public z: number = 0;
  public graph: number = 0;
  public size: number = 100;
  public angle: number = 0;
  public flags: number = 0;
  public alpha: number = 1.0;
  public ctype: number = 0; // 0 = c_screen, 1 = c_scroll
  public locals: Record<string, any>;
  public iterator: Generator<any, any, any> | null = null;
  public alive: boolean = true;
  public parent?: number;

  constructor(id: number, type: string, x: number, y: number, parent?: number) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.parent = parent;
    this.locals = createLocals();
  }
}

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
  public pixiRenderer: PixiRenderer | null = null;
  public onResize?: (width: number, height: number) => void;

  // Scroll Engine & Tilemap Manager
  public scrollManager: ScrollManager = new ScrollManager();
  public scroll: any;

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

  constructor() {
    this.setupKeyboardListeners();

    // Setup flexible scroll proxy: scroll.camera = id, scroll[0].camera = id
    this.scroll = new Proxy(this.scrollManager.scrolls, {
      get: (target, prop) => {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = parseInt(prop, 10);
          return this.scrollManager.scrolls[idx] || this.scrollManager.startScroll(idx);
        }
        const primary = this.scrollManager.scrolls[0] || this.scrollManager.startScroll(0);
        return (primary as any)[prop];
      },
      set: (target, prop, value) => {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = parseInt(prop, 10);
          this.scrollManager.scrolls[idx] = value;
          return true;
        }
        const primary = this.scrollManager.scrolls[0] || this.scrollManager.startScroll(0);
        (primary as any)[prop] = value;
        return true;
      },
    });

    this.registerDefaultTilemaps();
  }

  private registerDefaultTilemaps() {
    try {
      const defaultSonicMap = createDefaultSonicTilemap();
      this.scrollManager.registerTilemap('0030', defaultSonicMap);
      this.scrollManager.registerTilemap('greenhill', defaultSonicMap);
    } catch {
      // fallback
    }
  }

  public registerProcess(name: string, generatorFn: (self: ProcessInstance, ...args: any[]) => Generator<any, any, any>) {
    this.processDefs.set(name.toLowerCase(), generatorFn);
  }

  public reset() {
    this.processes = [];
    this.nextProcessId = 1;
    this.globals = {};
    this.textCalls.length = 0;
    this.shapeCalls.length = 0;
    this.bgColor = 0;
    this.frameCount = 0;
    this.scrollManager.reset();
    this.registerDefaultTilemaps();
  }

  /**
   * Set display resolution (DIV SET_MODE / modo_pantalla)
   */
  public setMode(w: any, h?: any) {
    let targetW = 320;
    let targetH = 240;

    if (typeof w === 'number' && (h === undefined || h === null)) {
      if (w === 0 || w === 320200) { targetW = 320; targetH = 200; }
      else if (w === 1 || w === 320240) { targetW = 320; targetH = 240; }
      else if (w === 2 || w === 640400) { targetW = 640; targetH = 400; }
      else if (w === 3 || w === 640480) { targetW = 640; targetH = 480; }
      else if (w === 800600) { targetW = 800; targetH = 600; }
      else { targetW = 320; targetH = 240; }
    } else {
      targetW = typeof w === 'number' ? Math.round(w) : parseInt(w, 10) || 320;
      targetH = typeof h === 'number' ? Math.round(h) : parseInt(h, 10) || 240;
    }

    this.width = Math.max(16, Math.min(1920, targetW));
    this.height = Math.max(16, Math.min(1080, targetH));

    if (this.pixiRenderer) {
      this.pixiRenderer.resize(this.width, this.height);
    }
    if (this.onResize) {
      this.onResize(this.width, this.height);
    }
  }

  public invalidateSprite(spriteId: number) {
    if (this.pixiRenderer) {
      this.pixiRenderer.invalidateTexture(spriteId);
    }
  }

  public spawn(type: string, ...args: any[]): number {
    const typeLower = type.toLowerCase();
    const generatorFn = this.processDefs.get(typeLower);
    if (!generatorFn) {
      console.warn(`[Runtime] Process definition not found for '${type}'`);
      return 0;
    }

    const id = this.nextProcessId++;
    let x = 0;
    let y = 0;
    let parent: number | undefined;

    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      x = args[0];
      y = args[1];
    }
    if (args.length > 0 && typeof args[args.length - 1] === 'number') {
      parent = args[args.length - 1];
    }

    const instance = new ProcessInstanceImpl(id, typeLower, x, y, parent);
    instance.iterator = generatorFn(instance, ...args);
    this.processes.push(instance);
    return id;
  }

  /**
   * Scroll and Tilemap Engine API
   */
  public startScroll(
    id: number = 0,
    file: any = 0,
    frontGraphOrTilemap?: any,
    backGraph?: any,
    region: number = 0,
    bloqueo: number = 0
  ): ScrollInstance {
    return this.scrollManager.startScroll(id, file, frontGraphOrTilemap, backGraph, region, bloqueo);
  }

  public stopScroll(id: number = 0) {
    this.scrollManager.stopScroll(id);
  }

  public breakBackScroll(
    id: number = 0,
    orientacion: number = 0,
    distancias: number[] = [],
    velocidades: number[] = []
  ): number[] {
    return this.scrollManager.breakBackScroll(id, orientacion, distancias, velocidades);
  }

  public newTilemap(nameOrDef: any): DivTilemap {
    if (typeof nameOrDef === 'string') {
      const existing = this.scrollManager.getTilemap(nameOrDef);
      if (existing) return existing;
      const newTm = DivTilemap.create(60, 20, 16, nameOrDef);
      this.scrollManager.registerTilemap(nameOrDef, newTm);
      return newTm;
    }
    return new DivTilemap(nameOrDef);
  }

  public getTile(tilemap: any, x: number, y: number): number {
    if (DivTilemap.isTilemap(tilemap)) {
      return (tilemap as DivTilemap).getTile(x, y);
    }
    if (typeof tilemap === 'string') {
      const tm = this.scrollManager.getTilemap(tilemap);
      if (tm) return tm.getTile(x, y);
    }
    const primary = this.scrollManager.getPrimaryScroll();
    if (primary?.front.graphObj && DivTilemap.isTilemap(primary.front.graphObj)) {
      return (primary.front.graphObj as DivTilemap).getTile(x, y);
    }
    return 0;
  }

  public setTile(tilemap: any, x: number, y: number, idTile: number): number {
    if (DivTilemap.isTilemap(tilemap)) {
      return (tilemap as DivTilemap).setTile(x, y, idTile);
    }
    return 0;
  }

  public getTileFlags(tilemap: any, x: number, y: number): number {
    if (DivTilemap.isTilemap(tilemap)) {
      return (tilemap as DivTilemap).getFlags(x, y);
    }
    return 0;
  }

  public setTileFlags(tilemap: any, x: number, y: number, val: number): number {
    if (DivTilemap.isTilemap(tilemap)) {
      return (tilemap as DivTilemap).setFlags(x, y, val);
    }
    return 0;
  }

  public changeTilemap(scrollId: number, name: string) {
    const scroll = this.scrollManager.scrolls[scrollId];
    if (scroll) {
      const tm = this.scrollManager.getTilemap(name);
      if (tm) {
        scroll.setFront(tm);
        return tm;
      }
    }
    return 0;
  }

  public changeTileValue(tilemap: any, oldId: number, newId: number): number {
    if (DivTilemap.isTilemap(tilemap)) {
      return (tilemap as DivTilemap).changeTileValue(oldId, newId);
    }
    return 0;
  }

  public loadFpg(path: string): number {
    return 0;
  }

  public setTitle(title: string) {
    if (typeof document !== 'undefined') {
      // document.title = title;
    }
  }

  public setFps(fps: number) {
    this.fps = fps;
  }

  /**
   * High performance tick: in-place compaction without GC allocations
   */
  public tick() {
    this.textCalls.length = 0;
    this.shapeCalls.length = 0;

    // Snapshot active count so processes spawned during this tick wait until next frame
    const activeCount = this.processes.length;

    for (let i = 0; i < activeCount; i++) {
      const proc = this.processes[i];
      if (proc.alive && proc.iterator) {
        try {
          const step = proc.iterator.next();
          if (step.done) {
            proc.alive = false;
          }
        } catch (err: any) {
          console.error(`Error in process ${proc.type} (id: ${proc.id}):`, err);
          if (this.onLog) this.onLog(`Error en proceso ${proc.type}: ${err.message}`, 'error');
          proc.alive = false;
        }
      }
    }

    // Compact in-place across ALL processes (including newly spawned ones)
    let aliveCount = 0;
    const totalCount = this.processes.length;
    for (let i = 0; i < totalCount; i++) {
      const proc = this.processes[i];
      if (proc.alive) {
        if (aliveCount !== i) {
          this.processes[aliveCount] = proc;
        }
        aliveCount++;
      }
    }

    this.processes.length = aliveCount;
    this.frameCount++;

    // Update scroll cameras and parallax offsets
    this.scrollManager.updateAll(this.processes, this.width, this.height);
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = getColorHex(this.bgColor);
    ctx.fillRect(0, 0, this.width, this.height);

    const primaryScroll = this.scrollManager.getPrimaryScroll();
    let scrollOffX = 0;
    let scrollOffY = 0;

    if (primaryScroll) {
      scrollOffX = primaryScroll.front.x;
      scrollOffY = primaryScroll.front.y;

      // Draw Backdrop
      if (primaryScroll.back.graph > 0) {
        const bgSprite = getSpriteById(this.sprites, primaryScroll.back.graph);
        if (bgSprite) {
          const bgCanvas = getSpriteCanvas(bgSprite);
          const bgW = bgCanvas.width || 320;
          const bgH = bgCanvas.height || 240;

          if (primaryScroll.multiscroll.total > 0 && primaryScroll.multiscroll.orientacion === 0) {
            let acum = 0;
            for (let i = 0; i < primaryScroll.multiscroll.total; i++) {
              const dist = primaryScroll.multiscroll.distancia[i] || 0;
              const vel = primaryScroll.multiscroll.velocidad[i] || 1;
              const tras = primaryScroll.multiscroll.trasladar[i] || 0;
              if (dist <= 0) continue;

              const movX = (-primaryScroll.back.x + tras) * (vel * 0.1);
              const startX = -ScrollInstance.modulo(-movX, bgW);

              ctx.save();
              ctx.beginPath();
              ctx.rect(0, acum, this.width, dist);
              ctx.clip();

              for (let curX = startX; curX < this.width; curX += bgW) {
                ctx.drawImage(bgCanvas, curX, acum);
              }
              ctx.restore();
              acum += dist;
            }
          } else {
            const startX = -ScrollInstance.modulo(primaryScroll.back.x, bgW);
            const startY = -ScrollInstance.modulo(primaryScroll.back.y, bgH);
            for (let y = startY; y < this.height; y += bgH) {
              for (let x = startX; x < this.width; x += bgW) {
                ctx.drawImage(bgCanvas, x, y);
              }
            }
          }
        }
      }

      // Draw Front Tilemap
      if (primaryScroll.front.graphObj && DivTilemap.isTilemap(primaryScroll.front.graphObj)) {
        const tm = primaryScroll.front.graphObj as DivTilemap;
        const tam = tm.size;
        const colStart = Math.max(0, Math.floor(primaryScroll.front.x / tam));
        const colEnd = Math.min(tm.cols, Math.ceil((primaryScroll.front.x + this.width) / tam));
        const rowStart = Math.max(0, Math.floor(primaryScroll.front.y / tam));
        const rowEnd = Math.min(tm.rows, Math.ceil((primaryScroll.front.y + this.height) / tam));

        for (let r = rowStart; r < rowEnd; r++) {
          const row = tm.map[r];
          if (!row) continue;
          for (let c = colStart; c < colEnd; c++) {
            const tileId = row[c];
            if (!tileId) continue;
            const tileSprite = getSpriteById(this.sprites, tileId);
            if (tileSprite) {
              drawSpriteToCanvas(
                ctx,
                tileSprite,
                c * tam - primaryScroll.front.x + tam / 2,
                r * tam - primaryScroll.front.y + tam / 2,
                100, 0, 0, 1.0
              );
            }
          }
        }
      }
    }

    for (const shape of this.shapeCalls) {
      ctx.fillStyle = getColorHex(shape.color);
      ctx.strokeStyle = getColorHex(shape.color);
      if (shape.type === 'box_fill') ctx.fillRect(Math.round(shape.x1), Math.round(shape.y1), Math.round(shape.x2), Math.round(shape.y2));
      else if (shape.type === 'box') ctx.strokeRect(Math.round(shape.x1), Math.round(shape.y1), Math.round(shape.x2), Math.round(shape.y2));
      else if (shape.type === 'circle_fill') { ctx.beginPath(); ctx.arc(shape.x1, shape.y1, shape.x2, 0, Math.PI * 2); ctx.fill(); }
      else if (shape.type === 'circle') { ctx.beginPath(); ctx.arc(shape.x1, shape.y1, shape.x2, 0, Math.PI * 2); ctx.stroke(); }
      else if (shape.type === 'line') { ctx.beginPath(); ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); ctx.stroke(); }
      else if (shape.type === 'pixel') ctx.fillRect(Math.round(shape.x1), Math.round(shape.y1), 1, 1);
    }

    const sortedProcs = [...this.processes].sort((a, b) => a.z - b.z);
    for (const proc of sortedProcs) {
      if (!proc.alive) continue;
      if (proc.graph > 0) {
        let px = proc.x;
        let py = proc.y;
        if (proc.ctype === 1) {
          px -= scrollOffX;
          py -= scrollOffY;
        }
        const sprite = getSpriteById(this.sprites, proc.graph);
        if (sprite) drawSpriteToCanvas(ctx, sprite, px, py, proc.size, proc.angle, proc.flags, proc.alpha);
        else { ctx.fillStyle = getColorHex(11); ctx.fillRect(px - 4, py - 4, 8, 8); }
      }
    }

    for (const call of this.textCalls) {
      ctx.save();
      ctx.font = '8px monospace';
      ctx.fillStyle = getColorHex(call.color);
      ctx.textAlign = call.align;
      ctx.textBaseline = 'top';
      ctx.fillText(call.text, Math.round(call.x), Math.round(call.y));
      ctx.restore();
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
    if (targetId === -1) {
      this.processes.forEach((p) => { if (signalType === 0) p.alive = false; });
      return;
    }
    const p = this.processes.find((proc) => proc.id === targetId);
    if (p && signalType === 0) p.alive = false;
  }

  public letMeAlone(caller: ProcessInstance) {
    this.processes.forEach((p) => { if (p.id !== caller.id) p.alive = false; });
    this.input.start = false;
    this.activeKeys.delete('enter');
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

  public async start(canvas: HTMLCanvasElement) {
    this.stop();
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.fpsTimer = performance.now();
    this.fpsCounter = 0;

    // Initialize or reuse PixiJS renderer
    if (!this.pixiRenderer || this.pixiRenderer.canvas !== canvas) {
      if (this.pixiRenderer) {
        this.pixiRenderer.destroy();
      }
      this.pixiRenderer = new PixiRenderer(canvas, this.width, this.height);
      await this.pixiRenderer.init();
    } else {
      this.pixiRenderer.resize(this.width, this.height);
    }

    const fallbackCtx = !this.pixiRenderer?.isReady ? canvas.getContext('2d', { alpha: false }) : null;
    if (fallbackCtx) {
      fallbackCtx.imageSmoothingEnabled = false;
    }

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;
      if (!this.isPaused) this.tick();

      if (this.pixiRenderer && this.pixiRenderer.isReady) {
        this.pixiRenderer.renderFrame(
          this.bgColor,
          this.shapeCalls,
          this.processes,
          this.sprites,
          this.textCalls,
          this.scrollManager
        );
      } else if (fallbackCtx) {
        this.render(fallbackCtx);
      }

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
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    if (this.pixiRenderer) {
      this.pixiRenderer.destroy();
      this.pixiRenderer = null;
    }
  }

  public pause() { this.isPaused = !this.isPaused; }
  public step() { if (this.isPaused) this.tick(); }
}