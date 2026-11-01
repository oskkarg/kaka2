/**
 * DIV-8 Fantasy Console - Main Application
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { ScreenCanvas } from './components/ScreenCanvas';
import { VirtualGamepad } from './components/VirtualGamepad';
import { SpriteEditor } from './components/SpriteEditor';
import { SfxStudio } from './components/SfxStudio';
import { ReferenceDocs } from './components/ReferenceDocs';
import { NaalaaTranslator } from './components/NaalaaTranslator';
import { ProcessInspector } from './components/ProcessInspector';
import { TilemapEditor } from './components/TilemapEditor';
import { CARTRIDGES } from './demos';
import { Cartridge, CompilerError, GamepadState, Sprite } from './engine/types';
import { DivCompiler } from './engine/compiler';
import { DivRuntime } from './engine/runtime';
import { audio } from './engine/audio';
import { DEFAULT_SPRITES } from './engine/sprites';
import { Code2, Paintbrush, Music, BookOpen, Sparkles, Layers } from 'lucide-react';

export default function App() {
  const [currentCartridge, setCurrentCartridge] = useState<Cartridge>(CARTRIDGES[0]);
  const [code, setCode] = useState<string>(CARTRIDGES[0].code);
  const [sprites, setSprites] = useState<Sprite[]>([...DEFAULT_SPRITES]);
  const [errors, setErrors] = useState<CompilerError[]>([]);
  const [activeTab, setActiveTab] = useState<'code' | 'sprites' | 'tilemap' | 'sfx' | 'docs' | 'translator'>('code');

  // Runtime State
  const runtimeRef = useRef<DivRuntime>(new DivRuntime());
  const runtime = runtimeRef.current;

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [processCount, setProcessCount] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'warn' | 'error'; timestamp: string }[]>([]);

  // Gamepad visible por defecto: false (ocupa más altura la pantalla)
  const [showGamepad, setShowGamepad] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup runtime log hook
  useEffect(() => {
    runtime.onLog = (msg, type) => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [...prev.slice(-49), { msg, type, timestamp: timeStr }]);
    };

    runtime.onStatsUpdate = (stats) => {
      setFps(stats.fps);
      setProcessCount(stats.processCount);
      setFrameCount(stats.frame);
    };
  }, [runtime]);

  // Sync sprites to runtime whenever updated
  useEffect(() => {
    runtime.sprites = sprites;
  }, [sprites, runtime]);

  // Execute / Run game code
  const runCode = (sourceCode: string = code) => {
    const compileResult = DivCompiler.compile(sourceCode);
    if (compileResult.errors.length > 0) {
      setErrors(compileResult.errors);
      setActiveTab('code');
      return;
    }

    setErrors([]);
    runtime.reset();

    try {
      const runnerBuilder = compileResult.compiled!.createRunner(runtime);
      runtime.globals = runnerBuilder.initGlobals();
      runnerBuilder.initProcesses(runtime);

      setIsRunning(true);
      setIsPaused(false);

      if (runtime.pixiRenderer?.canvas) {
        runtime.start(runtime.pixiRenderer.canvas);
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [
        ...prev.slice(-49),
        { msg: `Juego iniciado con éxito`, type: 'info', timestamp: timeStr },
      ]);
    } catch (err: any) {
      console.error('Execution error:', err);
      setErrors([
        {
          line: 1,
          column: 1,
          message: err.message || 'Error al ejecutar el programa',
        },
      ]);
    }
  };

  const handleRun = () => {
    runCode(code);
  };

  // Stop running game
  const handleStop = () => {
    runtime.stop();
    setIsRunning(false);
    setIsPaused(false);
  };

  // Toggle Pause
  const handleTogglePause = () => {
    if (!isRunning) {
      handleRun();
      return;
    }
    runtime.pause();
    setIsPaused(runtime.isPaused);
  };

  // Step 1 frame
  const handleStep = () => {
    if (isRunning && isPaused) {
      runtime.step();
      setFrameCount(runtime.frameCount);
      setProcessCount(runtime.processes.length);
    }
  };

  // Reset current game
  const handleReset = () => {
    runCode(code);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMuted(nextMuted);
  };

  // Toggle CRT effect
  const handleToggleCrt = () => {
    setCrtEnabled(!crtEnabled);
  };

  // Select Cartridge
  const handleSelectCartridge = (cart: Cartridge) => {
    setCurrentCartridge(cart);
    setCode(cart.code);
    setErrors([]);
    runCode(cart.code);
  };

  // New Empty Project
  const handleNewProject = () => {
    const newCart: Cartridge = {
      id: `custom_${Date.now()}`,
      title: '🎮 Mi Nuevo Juego DIV',
      author: 'Usuario',
      description: 'Proyecto creado en DIV-8',
      code: `// ==========================================
// MI NUEVO JUEGO - DIV Games Studio
// ==========================================

PROGRAM MiJuego;

GLOBAL
    score = 0;

PROCESS main()
BEGIN
    screen_color(1); // Fondo azul
    jugador(160, 120);
    
    LOOP
        write(10, 10, "SCORE: " + score, 10);
        FRAME;
    END
END

PROCESS jugador(x, y)
LOCAL
    speed = 3;
BEGIN
    graph = 1; // Nave o personaje
    
    LOOP
        if (key(_left)) x = x - speed; end
        if (key(_right)) x = x + speed; end
        if (key(_up)) y = y - speed; end
        if (key(_down)) y = y + speed; end
        
        FRAME;
    END
END
`,
    };
    setCurrentCartridge(newCart);
    setCode(newCart.code);
    setErrors([]);
    handleStop();
    setActiveTab('code');
  };

  // Export Cartridge as JSON or text
  const handleExportCartridge = () => {
    const data = {
      title: currentCartridge.title,
      author: currentCartridge.author,
      description: currentCartridge.description,
      code,
      sprites,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCartridge.id || 'juego'}.div8`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Cartridge File
  const handleImportCartridge = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // Check if JSON format
        if (text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          if (parsed.code) {
            setCode(parsed.code);
            if (parsed.sprites) setSprites(parsed.sprites);
            setCurrentCartridge({
              id: `imported_${Date.now()}`,
              title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
              author: parsed.author || 'Importado',
              description: parsed.description || 'Cartucho cargado externamente',
              code: parsed.code,
            });
          }
        } else {
          // Plain DIV code file
          setCode(text);
          setCurrentCartridge({
            id: `imported_${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            author: 'Importado',
            description: 'Código cargado externamente',
            code: text,
          });
        }
        handleStop();
        setActiveTab('code');
      } catch (err) {
        console.error('Error importing cartridge:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Virtual Gamepad Handlers
  const handleButtonDown = (btn: keyof GamepadState) => {
    runtime.input[btn] = true;
  };

  const handleButtonUp = (btn: keyof GamepadState) => {
    runtime.input[btn] = false;
  };

  // Global Keyboard Shortcuts (F5 to run, etc.)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [code, currentCartridge]);

  // Auto-run default cartridge on initial load for instant excitement
  useEffect(() => {
    handleRun();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Hidden File Input for .div8 cartridges */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".div8,.txt,.div,.prg,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header */}
      <Header
        currentCartridge={currentCartridge}
        onSelectCartridge={handleSelectCartridge}
        isRunning={isRunning}
        isPaused={isPaused}
        isMuted={isMuted}
        crtEnabled={crtEnabled}
        onRun={handleRun}
        onStop={handleStop}
        onPause={handleTogglePause}
        onStep={handleStep}
        onReset={handleReset}
        onToggleMute={handleToggleMute}
        onToggleCrt={handleToggleCrt}
        onExport={handleExportCartridge}
        onImport={handleImportCartridge}
        onNew={handleNewProject}
      />

      {/* Main Split Layout: Left Editor / Right Fantasy Console */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANE: Editor & Studio Tools */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 overflow-hidden h-[50vh] lg:h-full">
          {/* Navigation Tabs */}
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-3 py-1 flex items-center gap-1 overflow-x-auto text-xs select-none">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'code'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Código DIV</span>
            </button>

            <button
              onClick={() => setActiveTab('sprites')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'sprites'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Paintbrush className="w-4 h-4" />
              <span>Sprites (Graph)</span>
            </button>

            <button
              onClick={() => setActiveTab('tilemap')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'tilemap'
                  ? 'bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Mapa Tiles (.tmap)</span>
            </button>

            <button
              onClick={() => setActiveTab('sfx')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'sfx'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Sonido SFX</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'docs'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Manual DIV</span>
            </button>

            <button
              onClick={() => setActiveTab('translator')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'translator'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Traductor Naalaa (ES)</span>
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' && (
              <CodeEditor
                code={code}
                onChange={setCode}
                errors={errors}
                onInsertSnippet={(snippet) => setCode((prev) => prev + snippet)}
              />
            )}

            {activeTab === 'sprites' && (
              <SpriteEditor
                sprites={sprites}
                onUpdateSprite={(updated) => {
                  setSprites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                  runtime.invalidateSprite(updated.id);
                }}
              />
            )}

            {activeTab === 'tilemap' && (
              <TilemapEditor
                runtime={runtime}
                sprites={sprites}
                onTilemapUpdated={(name, tm) => {
                  runtime.scrollManager.registerTilemap(name, tm);
                }}
              />
            )}

            {activeTab === 'sfx' && <SfxStudio />}

            {activeTab === 'docs' && (
              <ReferenceDocs
                onInsertCode={(snippet) => {
                  setCode((prev) => prev + '\n' + snippet);
                  setActiveTab('code');
                }}
              />
            )}

            {activeTab === 'translator' && (
              <NaalaaTranslator
                onLoadIntoEditor={(translated) => {
                  setCode(translated);
                  setActiveTab('code');
                }}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANE: Fantasy Console Screen, Virtual Gamepad & Inspector */}
        <div className="w-full lg:w-1/2 flex flex-col bg-zinc-950 p-2 sm:p-3 gap-2 overflow-hidden h-[50vh] lg:h-full items-stretch justify-start">

          {/* Virtual Retro Screen — ocupa todo el espacio vertical disponible */}
          <div className="flex-1 min-h-0 w-full">
            <ScreenCanvas
              runtime={runtime}
              isRunning={isRunning}
              isPaused={isPaused}
              crtEnabled={crtEnabled}
              fps={fps}
              processCount={processCount}
              frameCount={frameCount}
              onTogglePause={handleTogglePause}
              showGamepad={showGamepad}
              onToggleGamepad={() => setShowGamepad((v) => !v)}
            />
          </div>

          {/* Virtual Gamepad Controller — solo si está activado */}
          {showGamepad && (
            <VirtualGamepad
              inputState={runtime.input}
              onButtonDown={handleButtonDown}
              onButtonUp={handleButtonUp}
            />
          )}

          {/* Real-time Process Inspector & Debugger */}
          <div className="w-full">
            <ProcessInspector
              processes={runtime.processes}
              globals={runtime.globals}
              logs={logs}
              onClearLogs={() => setLogs([])}
            />
          </div>
        </div>
      </div>
    </div>
  );
}