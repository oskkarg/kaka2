/**
 * Process Inspector and Debug Console for DIV-8
 */

import React, { useState } from 'react';
import { ProcessInstance } from '../engine/types';
import { Terminal, Cpu, Activity, Trash2 } from 'lucide-react';

interface ProcessInspectorProps {
  processes: ProcessInstance[];
  globals: Record<string, any>;
  logs: { msg: string; type: 'info' | 'warn' | 'error'; timestamp: string }[];
  onClearLogs: () => void;
}

export const ProcessInspector: React.FC<ProcessInspectorProps> = React.memo(({
  processes,
  globals,
  logs,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'processes' | 'globals' | 'logs'>('processes');

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-44 text-xs font-mono select-none">
      {/* Header Tabs */}
      <div className="bg-zinc-950 px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('processes')}
            className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'processes'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Procesos ({processes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('globals')}
            className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'globals'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Variables Globales</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'logs'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Consola ({logs.length})</span>
          </button>
        </div>

        {activeTab === 'logs' && logs.length > 0 && (
          <button
            onClick={onClearLogs}
            title="Limpiar Consola"
            className="text-zinc-500 hover:text-rose-400 p-1 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-2 overflow-y-auto bg-zinc-950 text-zinc-300 select-text">
        {/* Processes Table */}
        {activeTab === 'processes' && (
          <div className="space-y-1">
            {processes.length === 0 ? (
              <div className="text-zinc-600 text-center py-4">No hay procesos activos en ejecución</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {processes.slice(0, 48).map((p) => (
                    <div
                      key={p.id}
                      className="p-1.5 bg-zinc-900 border border-zinc-800 rounded flex flex-col gap-0.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400 truncate">{p.type}</span>
                        <span className="text-[10px] text-zinc-500">#{p.id}</span>
                      </div>
                      <div className="text-zinc-400 text-[10px] flex justify-between">
                        <span>x: {Math.round(p.x)}, y: {Math.round(p.y)}</span>
                        <span>g: {p.graph}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {processes.length > 48 && (
                  <div className="text-[10px] text-zinc-500 text-center py-1 bg-zinc-900/60 rounded border border-zinc-800/50">
                    Mostrando primeros 48 de {processes.length} procesos activos (optimizador GPU)
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Globals Table */}
        {activeTab === 'globals' && (
          <div className="space-y-1">
            {Object.keys(globals).length === 0 ? (
              <div className="text-zinc-600 text-center py-4">No hay variables globales declaradas</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {Object.entries(globals).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-1.5 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-between text-[11px]"
                  >
                    <span className="text-cyan-400 font-semibold">{key}:</span>
                    <span className="text-amber-300 font-mono">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="text-zinc-600 text-center py-4">Consola vacía. Usa print() o write() en tu código.</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`text-[11px] leading-relaxed flex items-start gap-2 ${
                    log.type === 'error'
                      ? 'text-rose-400'
                      : log.type === 'warn'
                      ? 'text-amber-400'
                      : 'text-zinc-300'
                  }`}
                >
                  <span className="text-zinc-600 text-[10px] shrink-0">{log.timestamp}</span>
                  <span className="break-all">{log.msg}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
});
