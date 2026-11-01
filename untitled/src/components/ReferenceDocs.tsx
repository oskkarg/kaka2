/**
 * DIV Games Studio & Naalaa Reference Manual
 */

import React from 'react';
import { BookOpen, Copy, Check } from 'lucide-react';

interface ReferenceDocsProps {
  onInsertCode?: (snippet: string) => void;
}

export const ReferenceDocs: React.FC<ReferenceDocsProps> = ({ onInsertCode }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const copyOrInsert = (code: string, idx: number) => {
    if (onInsertCode) {
      onInsertCode(code);
    }
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const sections = [
    {
      title: 'Estructura de Procesos Multitarea',
      desc: 'En DIV Games Studio todo es un proceso independiente que se ejecuta en paralelo de forma cooperativa.',
      items: [
        {
          name: 'PROCESS / PROCESO',
          syntax: `PROCESS nave(x, y)\nLOCAL\n    speed = 4;\nBEGIN\n    graph = 1; // ID de sprite\n    LOOP\n        // lógica por cuadro\n        FRAME;\n    END\nEND`,
          desc: 'Define un actor del juego. Sus variables locales son exclusivas de cada instancia.',
        },
        {
          name: 'FRAME; / CUADRO;',
          syntax: `FRAME; // o CUADRO;`,
          desc: 'Cede el turno al motor para redibujar la pantalla y avanzar al siguiente fotograma. ¡Obligatorio en todo LOOP!',
        },
        {
          name: 'LOOP ... END / BUCLE ... FIN',
          syntax: `LOOP\n    x = x + 1;\n    FRAME;\nEND`,
          desc: 'Bucle continuo infinito que mantiene vivo el proceso.',
        },
      ],
    },
    {
      title: 'Propiedades del Proceso (Locales Automáticas)',
      desc: 'Cada proceso tiene sus propias propiedades predefinidas que determinan cómo se dibuja en pantalla:',
      items: [
        {
          name: 'x, y, z',
          syntax: `x = 160; y = 120; z = 0;`,
          desc: 'Coordenadas en pantalla (320x240). z determina la profundidad (menor = más al fondo).',
        },
        {
          name: 'graph',
          syntax: `graph = 1; // 0 = invisible/sin sprite`,
          desc: 'ID del sprite asignado en el Editor de Sprites (1 a 16).',
        },
        {
          name: 'size & angle',
          syntax: `size = 150; // 150% de tamaño\nangle = 45; // grados 0-360`,
          desc: 'Escala y rotación del sprite en grados.',
        },
        {
          name: 'flags',
          syntax: `flags = 1; // 1 = espejo horizontal, 2 = vertical`,
          desc: 'Volteo de imagen.',
        },
      ],
    },
    {
      title: 'Entradas y Controles',
      desc: 'Lectura de teclado y mando virtual en tiempo real:',
      items: [
        {
          name: 'key(k) / tecla(k)',
          syntax: `if (key(_left)) x = x - 3; end\nif (key(_space)) disparo(x, y); end`,
          desc: 'Devuelve verdadero si la tecla está presionada: _up, _down, _left, _right, _space, _z, _x, _enter, _shift.',
        },
      ],
    },
    {
      title: 'Colisiones y Señales',
      desc: 'Interacción y combate entre procesos:',
      items: [
        {
          name: 'collision(tipo) / colision(tipo)',
          syntax: `col = collision(enemigo);\nif (col != 0)\n    sound(2); // Explosión\n    signal(col, s_kill);\n    return;\nend`,
          desc: 'Comprueba si el proceso actual colisiona con cualquier instancia del tipo indicado. Devuelve el ID del proceso impactado o 0.',
        },
        {
          name: 'signal(id, tipo) / senal(id, tipo)',
          syntax: `signal(col, s_kill); // Destruir proceso objetivo\nsignal(all_process, s_kill); // Destruir todos`,
          desc: 'Envía una señal para eliminar (s_kill) o congelar procesos.',
        },
        {
          name: 'let_me_alone() / dejame_solo()',
          syntax: `let_me_alone(); // Elimina a todos excepto a mí`,
          desc: 'Característica icónica de DIV Games Studio para reiniciar pantallas o transiciones.',
        },
      ],
    },
    {
      title: 'Texto, Gráficos y Sonido',
      desc: 'Funciones para dibujar texto en pantalla, formas geométricas y audio:',
      items: [
        {
          name: 'write(x, y, texto, color, alineacion)',
          syntax: `write(10, 10, "SCORE: " + score, 10, align_left);\nwrite(160, 120, "GAME OVER", 8, align_center);`,
          desc: 'Muestra texto retro en pantalla en las coordenadas indicadas.',
        },
        {
          name: 'draw_box / box / rectangulo',
          syntax: `draw_box(x, y, ancho, alto, color, relleno);`,
          desc: 'Dibuja un rectángulo con la paleta de color.',
        },
        {
          name: 'sound(id) / sonido(id)',
          syntax: `sound(1); // 1: Láser, 2: Explosión, 3: Salto, 4: Golpe, 5: Moneda, 6: Powerup, 7: GameOver`,
          desc: 'Reproduce un efecto de sonido retro instantáneamente.',
        },
        {
          name: 'set_mode(ancho, alto) / modo_pantalla',
          syntax: `set_mode(320, 240); // O también set_mode(640, 480);\n// O constantes DIV: set_mode(m320x240);`,
          desc: 'Cambia dinámicamente la resolución interna de la consola Pixi.js acelerada por GPU.',
        },
        {
          name: 'width() / ancho() & height() / alto()',
          syntax: `w = width();  // o ancho()\nh = height(); // o alto()`,
          desc: 'Devuelve las dimensiones actuales de la pantalla según la resolución fijada.',
        },
        {
          name: 'rand(min, max) / aleatorio(min, max)',
          syntax: `x = rand(20, 300);`,
          desc: 'Genera un número entero aleatorio comprendido entre min y max.',
        },
      ],
    },
    {
      title: 'Sistema de Scroll y Tilemaps (DivGO)',
      desc: 'Soporte completo para fondos en mosaico, cámaras con seguimiento, multiscroll en franjas y mapas de tiles v2.',
      items: [
        {
          name: 'start_scroll(id, file, front, back, region, bloqueo)',
          syntax: `tilemap = new_tilemap("0030");\nstart_scroll(0, 0, tilemap, 101, 0, 4);`,
          desc: 'Inicia el sistema de scroll. Si el gráfico es menor al tamaño de pantalla se tilea automáticamente. Front puede ser un tilemap o sprite; back es el fondo.',
        },
        {
          name: 'break_back_scroll(id, orientacion, fragmentos[], velocidades[])',
          syntax: `fragmento[] = 137, 15, 15, 2, 3, 5, 5, 5, 5, 8, 8, 8, 16, 16, 16, 16, 8;\nvelocidad[] = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17;\nbreak_back_scroll(0, 0, fragmento, velocidad);`,
          desc: 'Trocea el fondo en tiras horizontales (0) o verticales (1) con diferentes alturas y velocidades independientes para lograr parallax retro tipo Genesis/SMS.',
        },
        {
          name: 'scroll.camera = id / ctype = c_scroll',
          syntax: `ctype = c_scroll; // 1 = Coordenadas de mundo\nscroll.camera = id; // La cámara sigue a este proceso`,
          desc: 'Centra la cámara del scroll en este proceso y desplaza los elementos del mundo automáticamente.',
        },
        {
          name: 'get_tile(tilemap, x, y) / set_tile(tilemap, x, y, id)',
          syntax: `if (get_tile(tilemap, x, y + 16) <> 0)\n    en_suelo = true;\nend`,
          desc: 'Consulta o modifica el tile en coordenadas del mundo en píxeles. Compatible con colisiones de juego.',
        },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 text-zinc-200 overflow-y-auto">
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          MANUAL DE REFERENCIA DIV GAMES STUDIO
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Sintaxis directa y cooperativa de DIV Games Studio adaptada a la consola de fantasía DIV-8.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-3">
            <div>
              <h4 className="font-bold text-amber-300 text-sm">{sec.title}</h4>
              <p className="text-xs text-zinc-400">{sec.desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {sec.items.map((item, itemIdx) => {
                const uniqueIdx = secIdx * 100 + itemIdx;
                const isCopied = copiedIndex === uniqueIdx;

                return (
                  <div
                    key={itemIdx}
                    className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-pixel text-[11px] text-zinc-200">{item.name}</span>
                      <button
                        onClick={() => copyOrInsert(item.syntax, uniqueIdx)}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs flex items-center gap-1 border border-zinc-700 transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Insertado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Insertar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 mb-2">{item.desc}</p>

                    <pre className="p-2 bg-zinc-950 rounded text-emerald-400 font-mono text-xs overflow-x-auto border border-zinc-800/80">
                      <code>{item.syntax}</code>
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
