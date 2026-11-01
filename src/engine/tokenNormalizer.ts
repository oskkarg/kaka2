/**
 * DIV-8 Token Normalizer
 *
 * Capa de compatibilidad para escribir en español. Convierte sinónimos
 * españoles a las palabras reservadas canónicas en inglés que entienden
 * divParser.ts y compiler.ts.
 *
 * El lenguaje por defecto es el DIV Games Studio oficial:
 *
 *   PROGRAM, GLOBAL, LOCAL, PRIVATE, PROCESS, FUNCTION,
 *   BEGIN/END, IF/ELSE, FROM/TO/STEP, WHILE, REPEAT/UNTIL,
 *   LOOP, FOREACH, FRAME, RETURN, BREAK, CONTINUE, EXIT
 *
 * Este módulo es la ÚNICA parte del engine que conoce el español. El parser
 * y el compilador solo ven inglés canónico.
 *
 * Reglas:
 *  - Solo sustituye identificadores completos.
 *  - No toca strings, comentarios de línea o bloque, ni nombres de
 *    propiedades (lo que va después de un punto).
 *  - No distingue mayúsculas/minúsculas ni acentos.
 *  - Es idempotente: normalizar dos veces no cambia el resultado.
 */

// ---------------------------------------------------------------------------
// Diccionario de sinónimos ES -> EN
// ---------------------------------------------------------------------------

const TOKEN_ALIASES: Record<string, string> = {
  // Estructura del programa
  programa: 'program',
  proceso: 'process',
  procesos: 'process',
  funcion: 'function',
  funciones: 'function',
  global: 'global',
  globales: 'global',
  local: 'local',
  locales: 'local',
  privada: 'private',
  privadas: 'private',
  privado: 'private',
  privados: 'private',
  constante: 'constants',
  constantes: 'constants',

  // Bloques
  inicio: 'begin',
  comienzo: 'begin',
  fin: 'end',
  bucle: 'loop',
  cuadro: 'frame',

  // Control de flujo
  si: 'if',
  sino: 'else',
  sino_si: 'elseif',
  entonces: 'then',
  mientras: 'while',
  repite: 'repeat',
  repetir: 'repeat',
  hasta: 'to',
  desde: 'from',
  para: 'for',
  cada: 'each',
  en: 'in',
  de: 'of',
  paso: 'step',
  retorna: 'return',
  retornar: 'return',
  regresa: 'return',
  regresar: 'return',
  devuelve: 'return',
  devolver: 'return',
  rompe: 'break',
  romper: 'break',
  continua: 'continue',
  continuar: 'continue',
  sigue: 'continue',
  seguir: 'continue',
  salir: 'exit',
  terminar: 'exit',
  recorre: 'foreach',
  recorrer: 'foreach',
  recorrido: 'foreach',

  // Operadores lógicos y valores
  y: 'and',
  o: 'or',
  no: 'not',
  verdadero: 'true',
  cierto: 'true',
  falso: 'false',

  // Propiedades de proceso
  grafico: 'graph',
  tamano: 'size',
  tamaño: 'size',
  angulo: 'angle',
  ángulo: 'angle',
  banderas: 'flags',
  padre: 'father',

  // Funciones integradas (runtime)
  escribe: 'write',
  escribir: 'write',
  imprime: 'print',
  imprimir: 'print',
  tecla: 'key',
  sonido: 'sound',
  reproducir: 'sound',
  aleatorio: 'rand',
  azar: 'rand',
  colision: 'collision',
  colisión: 'collision',
  senal: 'signal',
  señal: 'signal',
  dejame_solo: 'let_me_alone',
  déjame_solo: 'let_me_alone',
  solo_yo: 'let_me_alone',
  limpiar_pantalla: 'screen_clear',
  borrar_pantalla: 'screen_clear',
  color_fondo: 'screen_color',
  rectangulo: 'draw_box',
  rectángulo: 'draw_box',
  rect: 'draw_box',
  circulo: 'draw_circle',
  círculo: 'draw_circle',
  linea: 'draw_line',
  línea: 'draw_line',
  distancia: 'get_dist',
  angulo_entre: 'get_angle',
  ancho: 'width',
  alto: 'height',
  pausa: 'pause',
};

const ALIAS_KEYS = new Map<string, string>();
for (const [key, value] of Object.entries(TOKEN_ALIASES)) {
  ALIAS_KEYS.set(stripAccents(key).toLowerCase(), value);
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isIdentifierStart(c: string): boolean {
  return /[A-Za-z_\u00C0-\u00FF]/.test(c);
}

function isIdentifierPart(c: string): boolean {
  return /[A-Za-z0-9_\u00C0-\u00FF]/.test(c);
}

function prevNonSpaceChar(source: string, index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    if (!/\s/.test(source[i])) return source[i];
  }
  return '';
}

function nextNonSpaceChar(source: string, index: number): string {
  for (let i = index; i < source.length; i++) {
    if (!/\s/.test(source[i])) return source[i];
  }
  return '';
}

function prevWord(source: string, index: number): string {
  let i = index - 1;
  while (i >= 0 && /\s/.test(source[i])) i--;
  const end = i + 1;
  while (i >= 0 && isIdentifierPart(source[i])) i--;
  return source.slice(i + 1, end);
}

/** Palabras que pueden preceder a un NOT unario. */
const UNARY_PRECEDERS = new Set([
  'if', 'while', 'until', 'then', 'do', 'and', 'or', 'not', 'return', 'else', 'elseif',
  'si', 'mientras', 'hasta', 'entonces', 'sino', 'y', 'o', 'no',
  'retorna', 'retornar', 'devuelve', 'devolver', 'regresa', 'regresar',
]);

/** ¿La palabra en esta posición actúa como AND/OR binario? */
function isBinaryWordPosition(source: string, start: number, end: number): boolean {
  const prev = prevNonSpaceChar(source, start);
  const next = nextNonSpaceChar(source, end);
  if (!prev || !next) return false;
  // A la izquierda debe terminar una expresión, no un operador.
  if (!/[A-Za-z0-9_\u00C0-\u00FF\)\]"']/.test(prev)) return false;
  // A la derecha debe empezar una expresión.
  return /[A-Za-z0-9_\u00C0-\u00FF\(\["'\-\+!]/.test(next);
}

/** ¿La palabra en esta posición actúa como NOT unario? */
function isUnaryNotPosition(source: string, start: number, end: number): boolean {
  const next = nextNonSpaceChar(source, end);
  if (!next || !/[A-Za-z0-9_\u00C0-\u00FF\(\["'\-\+!]/.test(next)) return false;

  const prev = prevNonSpaceChar(source, start);
  if (!prev) return true;
  if ('(,=<>!+-*/%&|:;'.includes(prev)) return true;

  return UNARY_PRECEDERS.has(prevWord(source, start).toLowerCase());
}

/** ¿La palabra conecta la variable de un bucle con su colección? */
function isLoopConnectorPosition(source: string, start: number, end: number): boolean {
  const prev = prevNonSpaceChar(source, start);
  const next = nextNonSpaceChar(source, end);
  if (!/[A-Za-z0-9_\u00C0-\u00FF\]\)]/.test(prev)) return false;
  if (!/[A-Za-z_\u00C0-\u00FF]/.test(next)) return false;

  let lineStart = start;
  while (lineStart > 0 && source[lineStart - 1] !== '\n' && source[lineStart - 1] !== ';') lineStart--;
  const prefix = source.slice(lineStart, start);
  return /\b(for|para|from|desde|foreach|recorre|recorrer|each|cada)\b/i.test(prefix);
}

/**
 * Normaliza los tokens de un código fuente a inglés canónico.
 */
export function normalizeTokens(source: string): string {
  const out: string[] = [];
  let i = 0;
  let inBlockComment = false;
  let inLineComment = false;
  let inString: string | null = null;

  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];

    // Comentario de bloque /* ... */
    if (inBlockComment) {
      out.push(c);
      if (c === '*' && n === '/') {
        out.push(n);
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }

    // Comentario de línea // ...
    if (inLineComment) {
      out.push(c);
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }

    // String "..." o '...'
    if (inString) {
      out.push(c);
      if (c === '\\' && i + 1 < source.length) {
        out.push(source[i + 1]);
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      i++;
      continue;
    }

    // Inicio de comentario de bloque
    if (c === '/' && n === '*') {
      out.push(c, n);
      i += 2;
      inBlockComment = true;
      continue;
    }

    // Inicio de comentario de línea
    if (c === '/' && n === '/') {
      out.push(c, n);
      i += 2;
      inLineComment = true;
      continue;
    }

    // Inicio de string
    if (c === '"' || c === "'") {
      inString = c;
      out.push(c);
      i++;
      continue;
    }

    // Identificador: posible sinónimo
    if (isIdentifierStart(c)) {
      let j = i + 1;
      while (j < source.length && isIdentifierPart(source[j])) j++;
      const word = source.slice(i, j);

      // No normalizar propiedades (objeto.proceso) ni palabras ya inglesas
      let prev = i - 1;
      while (prev >= 0 && /\s/.test(source[prev])) prev--;
      const isProperty = prev >= 0 && source[prev] === '.';

      const key = stripAccents(word).toLowerCase();
      let canonical: string | undefined;

      if (!isProperty) {
        if (key === 'y' || key === 'o') {
          // Solo como operador binario: `a y b`, no como variable `y`.
          if (isBinaryWordPosition(source, i, j)) canonical = ALIAS_KEYS.get(key);
        } else if (key === 'no') {
          // Solo como NOT unario; no como variable/parámetro `no`.
          if (isUnaryNotPosition(source, i, j)) canonical = ALIAS_KEYS.get(key);
        } else if (key === 'de' || key === 'en') {
          // Solo en bucles: `for each x en tabla` / `of`.
          if (isLoopConnectorPosition(source, i, j)) canonical = ALIAS_KEYS.get(key);
        } else {
          canonical = ALIAS_KEYS.get(key);
        }
      }

      out.push(canonical ?? word);
      i = j;
      continue;
    }

    out.push(c);
    i++;
  }

  return out.join('');
}

/**
 * Devuelve true si el texto no contiene ningún sinónimo del diccionario
 * fuera de strings y comentarios. Útil para tests.
 */
export function isNormalized(source: string): boolean {
  return normalizeTokens(source) === source;
}

/** Lista de sinónimos disponibles (para documentación y tests). */
export function getSpanishAliases(): Record<string, string> {
  return { ...TOKEN_ALIASES };
}
