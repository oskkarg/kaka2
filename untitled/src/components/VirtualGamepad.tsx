/**
 * Virtual Gamepad for DIV-8 Fantasy Console
 */

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GamepadState } from '../engine/types';

interface VirtualGamepadProps {
  inputState: GamepadState;
  onButtonDown: (button: keyof GamepadState) => void;
  onButtonUp: (button: keyof GamepadState) => void;
}

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  inputState,
  onButtonDown,
  onButtonUp,
}) => {
  const createButtonHandlers = (btn: keyof GamepadState) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      onButtonDown(btn);
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.preventDefault();
      onButtonUp(btn);
    },
    onMouseLeave: () => {
      onButtonUp(btn);
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      onButtonDown(btn);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      onButtonUp(btn);
    },
  });

  return (
    <div className="w-full max-w-[560px] bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-4 select-none shadow-lg">
      {/* Directional D-Pad */}
      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
        {/* D-Pad Cross Background */}
        <div className="absolute w-24 h-8 bg-zinc-800 rounded-md shadow-inner" />
        <div className="absolute w-8 h-24 bg-zinc-800 rounded-md shadow-inner" />

        {/* Up Button */}
        <button
          {...createButtonHandlers('up')}
          className={`absolute top-0 w-8 h-8 rounded-t bg-zinc-750 hover:bg-zinc-700 flex items-center justify-center transition-all ${
            inputState.up ? 'bg-amber-500 text-black translate-y-0.5' : 'text-zinc-400'
          }`}
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Down Button */}
        <button
          {...createButtonHandlers('down')}
          className={`absolute bottom-0 w-8 h-8 rounded-b bg-zinc-750 hover:bg-zinc-700 flex items-center justify-center transition-all ${
            inputState.down ? 'bg-amber-500 text-black -translate-y-0.5' : 'text-zinc-400'
          }`}
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Left Button */}
        <button
          {...createButtonHandlers('left')}
          className={`absolute left-0 w-8 h-8 rounded-l bg-zinc-750 hover:bg-zinc-700 flex items-center justify-center transition-all ${
            inputState.left ? 'bg-amber-500 text-black translate-x-0.5' : 'text-zinc-400'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right Button */}
        <button
          {...createButtonHandlers('right')}
          className={`absolute right-0 w-8 h-8 rounded-r bg-zinc-750 hover:bg-zinc-700 flex items-center justify-center transition-all ${
            inputState.right ? 'bg-amber-500 text-black -translate-x-0.5' : 'text-zinc-400'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Center circle */}
        <div className="absolute w-7 h-7 bg-zinc-800 rounded-full border border-zinc-700/50 pointer-events-none" />
      </div>

      {/* Middle Options: Select & Start */}
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {/* SELECT */}
          <div className="flex flex-col items-center gap-1">
            <button
              {...createButtonHandlers('select')}
              className={`w-10 h-3.5 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-all ${
                inputState.select ? 'bg-amber-400 scale-95' : ''
              }`}
            />
            <span className="font-pixel text-[8px] text-zinc-500">SELECT</span>
          </div>

          {/* START */}
          <div className="flex flex-col items-center gap-1">
            <button
              {...createButtonHandlers('start')}
              className={`w-10 h-3.5 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-all ${
                inputState.start ? 'bg-amber-400 scale-95' : ''
              }`}
            />
            <span className="font-pixel text-[8px] text-zinc-500">START</span>
          </div>
        </div>

        {/* Controls Keyboard Hint */}
        <div className="text-[9px] font-mono text-zinc-500 text-center hidden sm:block">
          Teclado: <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">Flechas</kbd> + <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">Z / Espacio</kbd>
        </div>
      </div>

      {/* Action Buttons: A and B */}
      <div className="flex items-center gap-3 shrink-0">
        {/* B Button (X) */}
        <div className="flex flex-col items-center gap-1">
          <button
            {...createButtonHandlers('b')}
            className={`w-12 h-12 rounded-full font-pixel text-xs font-bold transition-all border-2 border-zinc-700 shadow-lg ${
              inputState.b
                ? 'bg-amber-500 text-black scale-95 border-amber-400 shadow-amber-500/50'
                : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 active:scale-95'
            }`}
          >
            B
          </button>
          <span className="text-[9px] font-mono text-zinc-500">[X]</span>
        </div>

        {/* A Button (Z / Space) */}
        <div className="flex flex-col items-center gap-1 -mt-3">
          <button
            {...createButtonHandlers('a')}
            className={`w-12 h-12 rounded-full font-pixel text-xs font-bold transition-all border-2 border-zinc-700 shadow-lg ${
              inputState.a
                ? 'bg-rose-500 text-white scale-95 border-rose-400 shadow-rose-500/50'
                : 'bg-zinc-800 hover:bg-zinc-700 text-rose-400 active:scale-95'
            }`}
          >
            A
          </button>
          <span className="text-[9px] font-mono text-zinc-500">[Z/Space]</span>
        </div>
      </div>
    </div>
  );
};
