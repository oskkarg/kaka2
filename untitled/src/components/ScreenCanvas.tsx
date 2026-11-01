/**
 * Screen Canvas Component for DIV-8 Fantasy Console
 * PixiJS GPU Hardware-Accelerated Output
 */

import React, { useRef, useEffect, useState } from 'react';
import { Camera, Maximize, Play, Pause, Zap, Gamepad2 } from 'lucide-react';
import { DivRuntime } from '../engine/runtime';

export type ScaleMode = '1x' | '2x' | '3x' | '4x' | 'fit';

interface ScreenCanvasProps {
  runtime: DivRuntime;
  isRunning: boolean;
  isPaused: boolean;
  crtEnabled: boolean;
  fps: number;
  processCount: number;
  frameCount: number;
  onTogglePause: () => void;
  showGamepad?: boolean;
  onToggleGamepad?: () => void;
}

export const ScreenCanvas: React.FC<ScreenCanvasProps> = ({
  runtime,
  isRunning,
  isPaused,
  crtEnabled,
  fps,
  processCount,
  frameCount,
  onTogglePause,
  showGamepad = false,
  onToggleGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: runtime.width || 320,
    height: runtime.height || 240,
  });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Track dynamic resolution changes triggered by set_mode(w, h)
  useEffect(() => {
    const handleResize = (w: number, h: number) => {
      setResolution({ width: w, height: h });
    };
    runtime.onResize = handleResize;
    setResolution({ width: runtime.width, height: runtime.height });
  }, [runtime]);

  // Start / Stop runtime loop
  useEffect(() => {
    if (canvasRef.current && isRunning) {
      runtime.start(canvasRef.current);
    } else {
      runtime.stop();
    }
    return () => {
      runtime.stop();
    };
  }, [isRunning, runtime]);

  // Measure viewport size so we can compute exact CSS scale in "fit" mode
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewport({ w: rect.width, h: rect.height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Capture screenshot to PNG
  const handleScreenshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `div8_screenshot_${resolution.width}x${resolution.height}_${Date.now()}.png`;
    a.click();
  };

  // Toggle Fullscreen on screen container
  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  // Compute canvas style based on scale mode
  const getCanvasStyle = (): React.CSSProperties => {
    if (scaleMode === '1x') {
      return { width: `${resolution.width}px`, height: `${resolution.height}px` };
    }
    if (scaleMode === '2x') {
      return { width: `${resolution.width * 2}px`, height: `${resolution.height * 2}px` };
    }
    if (scaleMode === '3x') {
      return { width: `${resolution.width * 3}px`, height: `${resolution.height * 3}px` };
    }
    if (scaleMode === '4x') {
      return { width: `${resolution.width * 4}px`, height: `${resolution.height * 4}px` };
    }

    // 'fit' mode: scale to fill viewport while preserving aspect ratio
    if (viewport.w > 0 && viewport.h > 0) {
      const scale = Math.min(
        viewport.w / resolution.width,
        viewport.h / resolution.height
      );
      const finalScale = Math.max(0.1, Math.floor(scale * 100) / 100);
      return {
        width: `${resolution.width * finalScale}px`,
        height: `${resolution.height * finalScale}px`,
        imageRendering: 'pixelated',
      };
    }

    // Fallback while measuring
    return {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      imageRendering: 'pixelated',
    };
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onClick={() => containerRef.current?.focus()}
      className="relative w-full h-full flex flex-col items-stretch justify-start p-2 bg-zinc-950 rounded-xl border border-zinc-800 shadow-2xl select-none outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer"
    >
      {/* Top Info Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[10px] font-mono text-zinc-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-amber-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            DIV-8
          </span>
          <span className="text-zinc-700">|</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 font-pixel text-[8px]">
            {fps} FPS
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-cyan-400 font-mono text-[10px]">{processCount} PROCS</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-[9px] font-mono">
            <span className="text-zinc-500 px-1 text-[8px] uppercase hidden sm:inline">Escala:</span>
            {(['1x', '2x', '3x', '4x', 'fit'] as ScaleMode[]).map((mode) => (
              <button
                key={mode}
                onClick={(e) => {
                  e.stopPropagation();
                  setScaleMode(mode);
                }}
                title={mode === 'fit' ? 'Ajustar al panel' : `Escalar a ${mode}`}
                className={`px-1.5 py-0.5 rounded transition-all font-pixel text-[7.5px] ${
                  scaleMode === mode
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {mode === 'fit' ? 'Ajustar' : mode}
              </button>
            ))}
          </div>

          {/* Toggle Gamepad Visibility */}
          {onToggleGamepad && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleGamepad();
              }}
              title={showGamepad ? 'Ocultar mando virtual' : 'Mostrar mando virtual'}
              className={`p-1 rounded transition-colors ${
                showGamepad
                  ? 'text-amber-400 bg-zinc-800'
                  : 'hover:text-amber-400 hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleScreenshot}
            title="Capturar Pantalla (PNG)"
            className="p-1 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFullscreen}
            title="Pantalla Completa"
            className="p-1 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Monitor Box: fills remaining vertical space */}
      <div className="w-full flex-1 min-h-0 relative rounded-lg p-2 bg-zinc-900 border-2 border-zinc-800 shadow-inner overflow-hidden flex items-stretch justify-center">
        {/* Viewport: measures itself, centers canvas */}
        <div
          ref={viewportRef}
          className="w-full h-full flex items-center justify-center overflow-hidden rounded bg-black crt-screen-shadow relative"
        >
          <canvas
            ref={canvasRef}
            width={resolution.width}
            height={resolution.height}
            style={getCanvasStyle()}
            className="block [image-rendering:pixelated] select-none"
          />

          {/* CRT scanline overlay — positioned relative to viewport, not canvas */}
          {crtEnabled && (
            <div className="absolute inset-0 crt-overlay pointer-events-none" />
          )}

          {/* Pause / Stopped overlay */}
          {(!isRunning || isPaused) && (
            <div
              onClick={onTogglePause}
              className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer transition-all"
            >
              <div className="bg-zinc-900/90 border border-zinc-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-xl">
                {!isRunning ? (
                  <>
                    <Play className="w-4 h-4 text-emerald-400 fill-current animate-pulse" />
                    <span className="font-pixel text-[10px] text-zinc-200">PULSA EJECUTAR (F5)</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 text-amber-400" />
                    <span className="font-pixel text-[10px] text-amber-400">EN PAUSA</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="w-full flex items-center justify-between px-1 pt-2 text-[10px] font-mono text-zinc-500 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] text-amber-400/90">
            {resolution.width}x{resolution.height}
          </span>
          <span className="text-zinc-700">•</span>
          <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            PIXI.JS (GPU)
          </span>
          <span className="text-zinc-700">•</span>
          <span className="text-[9px] text-zinc-400">
            Modo: <strong className="text-zinc-200">{scaleMode}</strong>
          </span>
        </div>
        <div className="font-mono text-[9px] text-zinc-500">
          FRAME: <span className="text-zinc-300">{frameCount}</span>
        </div>
      </div>
    </div>
  );
};