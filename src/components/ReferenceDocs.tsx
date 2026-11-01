/**
 * DIV Games Studio Reference Manual
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
      desc: 'El lenguaje canónico es DIV Games Studio en inglés. Todo proceso se ejecuta en paralelo de forma cooperativa.',
      items: [
        {
          name: 'PROCESS',
          syntax: `PROCESS ship(x, y)\nPRIVATE\n    speed = 4;\nBEGIN\n    graph = 1; // Sprite ID\n    LOOP\n        x = x + speed;\n        FRAME;\n    END\nEND`,
          desc: 'Define un actor del juego. PRIVATE declara variables exclusivas de cada instancia.',
        },
        {
          name: 'FRAME',
          syntax: `FRAME;`,
          desc: 'Cede el turno al motor para redibujar y avanzar al siguiente fotograma. Obligatorio dentro de todo LOOP.',
        },
        {
          name: 'LOOP ... END',
          syntax: `LOOP\n    x = x + 1;\n    FRAME;\nEND`,
          desc: 'Bucle continuo infinito que mantiene vivo el proceso.',
        },
        {
          name: 'Programa principal',
          syntax: `PROGRAM MyGame;\n\nGLOBAL\n    score = 0;\n\nPROCESS main()\nBEGIN\n    screen_color(1);\n    LOOP\n        FRAME;\n    END\nEND`,
          desc: 'PROGRAM es el encabezado obligatorio. El proceso main() arranca automáticamente.',
        },
      ],
    },
    {
      title: 'Funciones de Usuario',
      desc: 'Reutiliza lógica con funciones que devuelven un valor. Aceptan parámetros y pueden llamarse a sí mismas (recursión).',
      items: [
        {
          name: 'FUNCTION',
          syntax: `FUNCTION sum(a, b)\nBEGIN\n    RETURN a + b;\nEND\n\nresult = sum(2, 3); // 5`,
          desc: 'Define una función. Puede declararse antes o después del proceso que la usa.',
        },
        {
          name: 'RETURN',
          syntax: `FUNCTION fact(n)\nBEGIN\n    IF (n <= 1)\n        RETURN 1;\n    END\n    RETURN n * fact(n - 1);\nEND`,
          desc: 'Devuelve un valor y termina la función.',
        },
      ],
    },
    {
      title: 'Tablas y Arrays',
      desc: 'Las tablas guardan varios valores y se indexan desde 0, como en DIV clásico. Se pueden crear de una o varias dimensiones.',
      items: [
        {
          name: 'Declaración con tamaño',
          syntax: `GLOBAL\n    lives[3];          // 3 elements at 0\n    map[2, 3];         // 2D table\n    t[5] = {10, 20, 30, 40, 50};`,
          desc: 'Indica las dimensiones entre corchetes. Con { } se inicializan los valores de la primera dimensión.',
        },
        {
          name: 'Acceso y asignación',
          syntax: `t[1] = t[0] + t[4];\nmap[0, 1] = 7;\nvalue = map[1, 2];`,
          desc: 'Usa un índice por dimensión, separados por comas. Un índice fuera de rango devuelve 0 sin romper el juego.',
        },
        {
          name: 'len(tabla)',
          syntax: `total = len(t);\nrows = len(map);`,
          desc: 'Devuelve el número de elementos de una tabla o el largo de una cadena.',
        },
      ],
    },
    {
      title: 'FOREACH (extensión DIV-8)',
      desc: 'Recorre todos los procesos de un tipo o todos los elementos de una tabla. En español se escribe RECORRE.',
      items: [
        {
          name: 'FOREACH proceso',
          syntax: `FOREACH enemy\n    sum_x = sum_x + x;\n    IF (x > 20)\n        life = life - 1;\n    END\nEND`,
          desc: 'Dentro del bloque, x, y, graph o cualquier variable PRIVATE del proceso se leen y escriben directamente en cada instancia.',
        },
        {
          name: 'FOREACH tabla',
          syntax: `FOREACH enemies AS e\n    total = total + e.x;\nEND\n\nFOREACH myTable\n    sum = sum + item;\nEND`,
          desc: 'Con AS accedes al elemento por su alias. Sin alias puedes usar item/value y index.',
        },
      ],
    },
    {
      title: 'Control de Flujo',
      desc: 'DIV Games Studio usa FROM ... TO para los bucles contados y END para cerrar todos los bloques.',
      items: [
        {
          name: 'FROM ... TO ... STEP',
          syntax: `FROM i = 1 TO 10\n    sum = sum + i;\nEND\n\nFROM j = 10 TO 1 STEP -1\n    lives = lives - 1;\nEND`,
          desc: 'Bucle contado ascendente o descendente. FOR es un sinónimo aceptado.',
        },
        {
          name: 'WHILE ... END',
          syntax: `WHILE (i > 0)\n    i = i - 1;\nEND`,
          desc: 'Repite mientras la condición sea verdadera.',
        },
        {
          name: 'REPEAT ... UNTIL',
          syntax: `REPEAT\n    i = i + 1;\nUNTIL (i >= 10)`,
          desc: 'Repite hasta que la condición sea verdadera. En español: REPITE ... HASTA.',
        },
        {
          name: 'IF / ELSE IF / ELSE',
          syntax: `IF (x > 0 AND y > 0)\n    ok = 1;\nELSE IF (x = 0)\n    ok = 2;\nELSE\n    ok = 3;\nEND`,
          desc: 'Condicionales encadenados. Operadores lógicos: AND/OR/NOT (en español Y/O/NO). La igualdad se escribe = o ==.',
        },
        {
          name: 'BREAK / CONTINUE',
          syntax: `FROM i = 1 TO 10\n    IF (i = 5)\n        BREAK;\n    END\nEND`,
          desc: 'BREAK corta el bucle; CONTINUE salta a la siguiente iteración.',
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
          name: 'key(k)',
          syntax: `IF (key(_left)) x = x - 3; END\nIF (key(_space)) shoot(x, y); END`,
          desc: 'Devuelve verdadero si la tecla está presionada: _up, _down, _left, _right, _space, _z, _x, _enter, _shift.',
        },
      ],
    },
    {
      title: 'Colisiones y Señales',
      desc: 'Interacción y combate entre procesos:',
      items: [
        {
          name: 'collision(type)',
          syntax: `col = collision(enemy);\nIF (col != 0)\n    sound(2); // Explosión\n    signal(col, s_kill);\n    RETURN;\nEND`,
          desc: 'Comprueba si el proceso actual colisiona con cualquier instancia del tipo indicado. Devuelve el ID del proceso impactado o 0.',
        },
        {
          name: 'signal(id, type)',
          syntax: `signal(col, s_kill); // Destruir proceso objetivo\nsignal(all_process, s_kill); // Destruir todos`,
          desc: 'Envía una señal para eliminar (s_kill) o congelar procesos.',
        },
        {
          name: 'let_me_alone()',
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
          name: 'write(x, y, text, color, align)',
          syntax: `write(10, 10, "SCORE: " + score, 10, align_left);\nwrite(160, 120, "GAME OVER", 8, align_center);`,
          desc: 'Muestra texto retro en pantalla en las coordenadas indicadas.',
        },
        {
          name: 'draw_box / draw_circle / draw_line',
          syntax: `draw_box(x, y, width, height, color, filled);\ndraw_circle(x, y, radius, color);\ndraw_line(x1, y1, x2, y2, color);`,
          desc: 'Dibuja formas con la paleta de color.',
        },
        {
          name: 'sound(id)',
          syntax: `sound(1); // 1: Láser, 2: Explosión, 3: Salto, 4: Golpe, 5: Moneda, 6: Powerup, 7: GameOver`,
          desc: 'Reproduce un efecto de sonido retro instantáneamente.',
        },
        {
          name: 'rand(min, max)',
          syntax: `x = rand(20, 300);`,
          desc: 'Genera un número entero aleatorio comprendido entre min y max.',
        },
      ],
    },
    {
      title: 'Sinónimos en Español',
      desc: 'tokenNormalizer es la única capa que conoce el español: traduce sinónimos a inglés canónico antes de compilar. Las palabras reservadas en español no deben usarse como nombres de variables o procesos.',
      items: [
        {
          name: 'Ejemplo completo',
          syntax: `PROGRAMA MiJuego;\nGLOBALES\n    puntos = 0;\n\nPROCESO principal()\nPRIVADAS\n    velocidad = 3;\nINICIO\n    BUCLE\n        SI (TECLA(_right))\n            x = x + velocidad;\n        FIN\n        CUADRO;\n    FIN\nFIN`,
          desc: 'PROGRAMA→PROGRAM, PROCESO→PROCESS, INICIO/FIN→BEGIN/END, SI→IF, BUCLE→LOOP, CUADRO→FRAME, TECLA→KEY.',
        },
        {
          name: 'Diccionario habitual',
          syntax: `// Estructura\nPROGRAMA PROCESO FUNCION GLOBALES LOCALES PRIVADAS\nINICIO FIN\n\n// Control\nSI SINO MIENTRAS REPITE DESDE HASTA PASO\nRECORRE ROMPE CONTINUA RETORNA\n\n// Lógicos y valores\nY O NO VERDADERO FALSO\n\n// Funciones\nESCRIBE TECLA SONIDO ALEATORIO COLISION SENAL\nDEJAME_SOLO LIMPIAR_PANTALLA COLOR_FONDO`,
          desc: 'La variable y (coordenada) se respeta: Y solo se traduce a AND cuando actúa como operador entre dos expresiones.',
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
          Sintaxis canónica de DIV Games Studio (inglés) adaptada a la consola de fantasía DIV-8. También puedes escribir sinónimos en español.
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
