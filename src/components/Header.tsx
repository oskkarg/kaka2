/**
 * Header Component for DIV-8 Fantasy Console
 */

import React from 'react';
import { Play, Square, Pause, StepForward, RotateCcw, Volume2, VolumeX, Monitor, Download, Upload, Sparkles } from 'lucide-react';
import { CARTRIDGES } from '../demos';
import { Cartridge } from '../engine/types';

interface HeaderProps {
  currentCartridge: Cartridge;
  onSelectCartridge: (cartridge: Cartridge) => void;
  isRunning: boolean;
  isPaused: boolean;
  isMuted: boolean;
  crtEnabled: boolean;
  onRun: () => void;
  onStop: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onToggleMute: () => void;
  onToggleCrt: () => void;
  onExport: () => void;
  onImport: () => void;
  onNew: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCartridge,
  onSelectCartridge,
  isRunning,
  isPaused,
  isMuted,
  crtEnabled,
  onRun,
  onStop,
  onPause,
  onStep,
  onReset,
  onToggleMute,
  onToggleCrt,
  onExport,
  onImport,
  onNew,
}) => {
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* Brand & Console Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1.5 rounded border border-amber-500/30 shadow-inner">
          <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
          <span className="font-pixel text-[11px] font-bold text-amber-400 tracking-wider">
            DIV-8
          </span>
          <span className="text-[10px] text-zinc-400 tracking-tight font-mono hidden sm:inline">
            STUDIO CONSOLE
          </span>
        </div>

        {/* Cartridge selector */}
        <div className="flex items-center gap-2">
          <select
            value={currentCartridge.id}
            onChange={(e) => {
              const selected = CARTRIDGES.find((c) => c.id === e.target.value);
              if (selected) onSelectCartridge(selected);
            }}
            className="bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {!CARTRIDGES.some((c) => c.id === currentCartridge.id) && (
              <option value={currentCartridge.id}>{currentCartridge.title}</option>
            )}
            {CARTRIDGES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={onNew}
            title="Nuevo Proyecto Vacío"
            className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Execution Controls */}
      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
        {!isRunning ? (
          <button
            onClick={onRun}
            title="Ejecutar Código (F5)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>EJECUTAR</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            title="Detener Programa"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow transition-all active:scale-95"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>DETENER</span>
          </button>
        )}

        <button
          onClick={onPause}
          disabled={!isRunning}
          title={isPaused ? 'Reanudar' : 'Pausar'}
          className={`p-1.5 rounded transition-colors ${
            !isRunning
              ? 'opacity-40 cursor-not-allowed text-zinc-600'
              : isPaused
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'hover:bg-zinc-800 text-zinc-300'
          }`}
        >
          <Pause className="w-4 h-4" />
        </button>

        <button
          onClick={onStep}
          disabled={!isRunning || !isPaused}
          title="Avanzar 1 Frame (Step)"
          className={`p-1.5 rounded transition-colors ${
            !isRunning || !isPaused ? 'opacity-40 cursor-not-allowed text-zinc-600' : 'hover:bg-zinc-800 text-zinc-300'
          }`}
        >
          <StepForward className="w-4 h-4" />
        </button>

        <button
          onClick={onReset}
          title="Reiniciar Juego"
          className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Screen & File Actions */}
      <div className="flex items-center gap-2">
        {/* Audio Mute */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Activar Sonido' : 'Silenciar'}
          className={`p-1.5 rounded border transition-colors ${
            isMuted ? 'bg-zinc-800 text-rose-400 border-rose-500/30' : 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* CRT Monitor Effect */}
        <button
          onClick={onToggleCrt}
          title="Efecto Monitor CRT Retro"
          className={`p-1.5 rounded border transition-colors flex items-center gap-1 ${
            crtEnabled
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span className="text-[10px] hidden lg:inline">CRT</span>
        </button>

        {/* Export / Download Cartridge */}
        <button
          onClick={onExport}
          title="Guardar / Descargar Cartucho (.div8)"
          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors flex items-center gap-1"
        >
          <Download className="w-4 h-4" />
          <span className="text-[10px] hidden lg:inline">Guardar</span>
        </button>

        {/* Import Cartridge */}
        <button
          onClick={onImport}
          title="Abrir Cartucho .div8"
          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
