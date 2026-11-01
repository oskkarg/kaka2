/**
 * Screen Canvas Component for DIV-8 Fantasy Console
 */

import React, { useRef, useEffect } from 'react';
import { Camera, Maximize, Play, Pause } from 'lucide-react';
import { DivRuntime } from '../engine/runtime';

interface ScreenCanvasProps {
  runtime: DivRuntime;
  isRunning: boolean;
  isPaused: boolean;
  crtEnabled: boolean;
  fps: number;
  processCount: number;
  frameCount: number;
  onTogglePause: () => void;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Capture screenshot to PNG
  const handleScreenshot = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `div8_screenshot_${Date.now()}.png`;
    a.click();
  };

  // Toggle Fullscreen on screen container
  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onClick={() => containerRef.current?.focus()}
      className="relative flex flex-col items-center justify-center p-3 bg-zinc-950 rounded-xl border border-zinc-800 shadow-2xl select-none outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer"
    >
      {/* Console Bezel Top Info Bar */}
      <div className="w-full max-w-[560px] flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-amber-500">DIV-8 DISPLAY</span>
          <span className="text-zinc-600">|</span>
          <span className="text-emerald-400">{fps} FPS</span>
          <span className="text-zinc-600">|</span>
          <span className="text-cyan-400">{processCount} PROCESOS</span>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Screen Monitor Box */}
      <div className="relative rounded-lg p-2 bg-zinc-900 border-2 border-zinc-800 shadow-inner overflow-hidden">
        {/* Canvas Display with Crisp Pixel Scaling */}
        <div className="relative overflow-hidden rounded bg-black flex items-center justify-center crt-screen-shadow">
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="w-[320px] h-[240px] sm:w-[480px] sm:h-[360px] md:w-[540px] md:h-[405px] max-w-full aspect-[4/3] block [image-rendering:pixelated]"
          />

          {/* CRT Scanline & Phosphor Overlay */}
          {crtEnabled && (
            <div className="absolute inset-0 crt-overlay pointer-events-none" />
          )}

          {/* Pause / Stopped Overlay */}
          {(!isRunning || isPaused) && (
            <div
              onClick={onTogglePause}
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer transition-all"
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

      {/* Bottom Screen Status */}
      <div className="w-full max-w-[560px] flex items-center justify-between px-2 pt-2 text-[10px] font-mono text-zinc-500">
        <span>320x240 VGA</span>
        <span>FRAME: {frameCount}</span>
      </div>
    </div>
  );
};
