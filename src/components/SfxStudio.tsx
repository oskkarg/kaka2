/**
 * SFX Studio Component for DIV-8 Fantasy Console
 */

import React, { useState } from 'react';
import { Volume2, Play, Music, Sparkles } from 'lucide-react';
import { audio } from '../engine/audio';

export const SfxStudio: React.FC = () => {
  const [customFreq, setCustomFreq] = useState<number>(440);
  const [customDuration, setCustomDuration] = useState<number>(150);
  const [waveType, setWaveType] = useState<OscillatorType>('square');

  const presets = [
    { id: 1, name: 'Láser Pew-Pew', desc: 'Disparo agudo descendente rápido', soundId: 1 },
    { id: 2, name: 'Explosión Retro', desc: 'Ráfaga de ruido blanco con filtro lowpass', soundId: 2 },
    { id: 3, name: 'Salto Plataformas', desc: 'Curva ascendente en onda cuadrada', soundId: 3 },
    { id: 4, name: 'Golpe / Bump', desc: 'Impacto sordo triangular de baja frecuencia', soundId: 4 },
    { id: 5, name: 'Moneda / Chime', desc: 'Doble campanilla aguda (B5 -> E6)', soundId: 5 },
    { id: 6, name: 'Fanfarria Mejora', desc: 'Arpegio ascendente de 4 notas de victoria', soundId: 6 },
    { id: 7, name: 'Game Over', desc: 'Melodía descendente menor', soundId: 7 },
  ];

  const handleTestPreset = (soundId: number) => {
    audio.playSound(soundId);
  };

  const handlePlayCustomTone = () => {
    audio.tone(customFreq, customDuration, waveType);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 text-zinc-200 overflow-y-auto">
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
          <Music className="w-4 h-4" />
          ESTUDIO DE SONIDO SFX (8-BIT)
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Efectos de sonido predefinidos del sistema. Úsalos en tu código con <code className="text-amber-400">sound(id);</code> o <code className="text-amber-400">sonido(id);</code>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Presets List */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
            Efectos Predefinidos (Presets):
          </label>
          {presets.map((p) => (
            <div
              key={p.id}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[10px] text-amber-400">ID #{p.soundId}</span>
                  <span className="font-bold text-xs text-zinc-200">{p.name}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">{p.desc}</p>
                <code className="text-[10px] text-emerald-400 font-mono mt-1 block">
                  sound({p.soundId});
                </code>
              </div>

              <button
                onClick={() => handleTestPreset(p.soundId)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded border border-zinc-700 flex items-center gap-1.5 transition-colors active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs">Probar</span>
              </button>
            </div>
          ))}
        </div>

        {/* Custom Tone Synthesizer */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
          <h4 className="font-pixel text-xs text-zinc-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            GENERADOR DE TONOS PERSONALIZADOS
          </h4>

          {/* Waveform Selector */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">Tipo de Onda:</label>
            <div className="grid grid-cols-4 gap-2">
              {(['square', 'sawtooth', 'triangle', 'sine'] as OscillatorType[]).map((wave) => (
                <button
                  key={wave}
                  onClick={() => setWaveType(wave)}
                  className={`py-1.5 px-2 rounded text-xs capitalize border transition-all ${
                    waveType === wave
                      ? 'bg-amber-500 text-black border-amber-400 font-bold'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {wave}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency Slider */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Frecuencia (Pitch):</span>
              <span className="font-mono text-amber-400">{customFreq} Hz</span>
            </div>
            <input
              type="range"
              min="80"
              max="2000"
              step="10"
              value={customFreq}
              onChange={(e) => setCustomFreq(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Duración (ms):</span>
              <span className="font-mono text-amber-400">{customDuration} ms</span>
            </div>
            <input
              type="range"
              min="30"
              max="1000"
              step="10"
              value={customDuration}
              onChange={(e) => setCustomDuration(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <button
            onClick={handlePlayCustomTone}
            className="mt-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Volume2 className="w-4 h-4" />
            <span>Emitir Tono</span>
          </button>
        </div>
      </div>
    </div>
  );
};
