/**
 * Pruebas del compilador / runtime DIV-8.
 * Ejecutar con: node node_modules/tsx/dist/cli.mjs scripts/test-engine.ts
 *
 * El lenguaje canÃ³nico es DIV Games Studio en inglÃ©s. Los tests con
 * sinÃ³nimos en espaÃ±ol validan la capa tokenNormalizer.
 */
import { CARTRIDGES } from '../src/demos/index';
import { DivCompiler } from '../src/engine/compiler';
import { DivRuntime } from '../src/engine/runtime';
import { newProjectTemplate } from '../src/demos/newProject';
import { normalizeTokens, isNormalized } from '../src/engine/tokenNormalizer';

interface RunResult {
  runtime: DivRuntime;
  globals: Record<string, any>;
  locals: (proc: string) => Record<string, any>;
  logs: string[];
}

function run(code: string, ticks = 20, label = 'snippet'): RunResult {
  const compiled = DivCompiler.compile(code);
  if (compiled.errors.length > 0) {
    throw new Error(`[${label}] error de compilaciÃ³n lÃ­nea ${compiled.errors[0].line}: ${compiled.errors[0].message}`);
  }

  const runtime = new DivRuntime();
  const logs: string[] = [];
  runtime.onLog = (msg, type) => {
    logs.push(`${type}: ${msg}`);
    if (type === 'error') throw new Error(`[${label}] runtime: ${msg}`);
  };

  const runner = compiled.compiled!.createRunner(runtime);
  runtime.globals = runner.initGlobals();
  runner.initProcesses(runtime);

  for (let i = 0; i < ticks; i++) runtime.tick();

  return {
    runtime,
    globals: runtime.globals,
    locals: (type) => runtime.processes.find((p) => p.type === type.toLowerCase())?.locals ?? {},
    logs,
  };
}

function expectEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${JSON.stringify(expected)}, recibido ${JSON.stringify(actual)}`);
  }
}

const tests: { name: string; fn: () => void }[] = [];

tests.push({
  name: 'funciones de usuario, parÃ¡metros, return y recursiÃ³n',
  fn: () => {
    const { globals } = run(`
PROGRAM Functions;
GLOBAL
    result = 0;

FUNCTION sum(a, b)
BEGIN
    RETURN a + b;
END

FUNCTION fact(n)
BEGIN
    IF (n <= 1)
        RETURN 1;
    END
    RETURN n * fact(n - 1);
END

FUNCTION withLocal(a)
PRIVATE
    tmp = 2;
BEGIN
    tmp = tmp + a;
    RETURN tmp;
END

PROCESS main()
BEGIN
    result = sum(2, 3) + fact(5) + withLocal(4);
    LOOP
        FRAME;
    END
END
`, 3, 'funciones');
    expectEqual(globals.result, 131, 'sum + factorial + local de función');
  },
});

tests.push({
  name: 'tablas: declaraciÃ³n, inicializaciÃ³n, multidimensionales y len',
  fn: () => {
    const { globals } = run(`
PROGRAM Tables;
GLOBAL
    t[5] = {10, 20, 30, 40, 50};
    m[2, 3];
    total = 0;

PROCESS main()
BEGIN
    t[1] = t[0] + t[4];
    m[0, 1] = 7;
    m[1, 2] = 5;
    total = t[1] + m[0, 1] + m[1, 2] + len(t);
    LOOP
        FRAME;
    END
END
`, 3, 'tablas');
    expectEqual(globals.total, 77, 'tablas 1D/2D');
  },
});

tests.push({
  name: 'FOREACH proceso con propiedades y locales implÃ­citos',
  fn: () => {
    const { globals, runtime } = run(`
PROGRAM ForeachProcess;
GLOBAL
    sum_x = 0;
    count = 0;

PROCESS enemy(x, y, life)
PRIVATE
    active = 1;
BEGIN
    LOOP
        FRAME;
    END
END

PROCESS main()
BEGIN
    enemy(10, 20, 5);
    enemy(30, 40, 5);

    FOREACH enemy
        sum_x = sum_x + x;
        count = count + active;
        IF (x > 20)
            life = life - 1;
        END
    END

    LOOP
        FRAME;
    END
END
`, 5, 'FOREACH proceso');

    expectEqual(globals.sum_x, 40, 'suma de x');
    expectEqual(globals.count, 2, 'locales implÃ­citos');
    const enemies = runtime.processes.filter((p) => p.type === 'enemy');
    expectEqual(enemies[1].locals.life, 4, 'asignaciÃ³n implÃ­cita al proceso iterado');
  },
});

tests.push({
  name: 'FOREACH array con alias, item e index',
  fn: () => {
    const { globals } = run(`
PROGRAM ForeachArray;
GLOBAL
    t[4] = {10, 20, 30, 40};
    total = 0;
    index_sum = 0;

PROCESS main()
BEGIN
    FOREACH t AS value
        total = total + value;
        index_sum = index_sum + index;
    END

    FOREACH t
        total = total + item;
    END

    LOOP
        FRAME;
    END
END
`, 3, 'FOREACH array');

    expectEqual(globals.total, 200, 'suma con alias + item');
    expectEqual(globals.index_sum, 6, 'Ã­ndice implÃ­cito');
  },
});

tests.push({
  name: 'FROM/FOR, WHILE, REPEAT/UNTIL, ELSE IF y operadores lÃ³gicos',
  fn: () => {
    const { locals } = run(`
PROGRAM Control;
PROCESS main()
PRIVATE
    sum = 0;
    i = 0;
    ok = 0;
BEGIN
    FROM i = 1 TO 10
        sum = sum + i;
    END

    FOR j = 10 TO 1 STEP -1
        sum = sum + 1;
    END

    WHILE (i > 0)
        i = i - 1;
    END

    REPEAT
        i = i + 1;
    UNTIL (i >= 2)

    IF (sum = 65 AND i = 2)
        ok = 1;
    ELSE IF (sum > 100)
        ok = 2;
    ELSE
        ok = 3;
    END

    LOOP
        FRAME;
    END
END
`, 3, 'control');
    expectEqual(locals('main').ok, 1, 'ELSE IF y lÃ³gicos');
    expectEqual(locals('main').sum, 65, 'FROM ascendente y FOR descendente');
    expectEqual(locals('main').i, 2, 'WHILE y REPEAT');
  },
});

tests.push({
  name: 'acceso a propiedades y locales de otro proceso por id',
  fn: () => {
    const { globals } = run(`
PROGRAM ProcessMember;
GLOBAL
    total = 0;

PROCESS enemy(x, life)
PRIVATE
    active = 1;
BEGIN
    LOOP
        FRAME;
    END
END

PROCESS main()
PRIVATE
    id = 0;
BEGIN
    id = enemy(5, 9);
    total = id.x + id.life + id.active;
    id.life = id.life - 1;
    total = total + id.life;

    LOOP
        FRAME;
    END
END
`, 3, 'miembro de proceso');

    expectEqual(globals.total, 23, 'lectura y escritura id.propiedad');
  },
});

tests.push({
  name: 'EXIT termina todos los procesos',
  fn: () => {
    const { globals, runtime } = run(`
PROGRAM ExitTest;
GLOBAL
    done = 0;

PROCESS main()
BEGIN
    done = 1;
    EXIT;
END

PROCESS other()
BEGIN
    LOOP
        FRAME;
    END
END
`, 3, 'EXIT');

    expectEqual(globals.done, 1, 'EXIT ejecutado');
    expectEqual(runtime.processes.filter((p) => p.alive).length, 0, 'procesos terminados');
  },
});

tests.push({
  name: 'IF con sentencias en la misma lÃ­nea consume todo el bloque hasta END',
  fn: () => {
    const { locals } = run(`
PROGRAM InlineIf;
PROCESS main()
PRIVATE
    a = 0;
    b = 0;
    c = 0;
BEGIN
    IF (1) a = 1; b = 2; END
    IF (0) c = 9; ELSE c = 3; END

    LOOP
        FRAME;
    END
END
`, 3, 'IF inline');
    expectEqual(locals('main').a, 1, 'primera sentencia del IF inline');
    expectEqual(locals('main').b, 2, 'segunda sentencia del IF inline');
    expectEqual(locals('main').c, 3, 'ELSE inline');
  },
});

tests.push({
  name: 'LOCAL de programa: cada proceso recibe su propia copia',
  fn: () => {
    const { runtime } = run(`
PROGRAM ProgramLocal;
LOCAL
    energy = 7;
    data[2] = {4, 5};

PROCESS actor(x)
BEGIN
    energy = energy - 1;
    data[0] = data[0] + 1;
    LOOP
        FRAME;
    END
END

PROCESS main()
BEGIN
    actor(1);
    actor(2);
    LOOP
        FRAME;
    END
END
`, 3, 'LOCAL programa');

    const actors = runtime.processes.filter((p) => p.type === 'actor');
    expectEqual(actors[0].locals.energy, 6, 'primera copia');
    expectEqual(actors[1].locals.energy, 6, 'segunda copia');
    expectEqual(actors[0].locals.data[0], 5, 'tabla LOCAL independiente');
  },
});

tests.push({
  name: 'sinÃ³nimos en espaÃ±ol: programa, proceso, inicio/fin, si/sino, mientras, desde/hasta, recorre',
  fn: () => {
    const { globals, locals } = run(`
PROGRAMA Sinonimos;
GLOBALES
    total = 0;
    valor = 5;
    ok = 0;

FUNCION doble(n)
INICIO
    RETORNA n * 2;
FIN

PROCESO enemigo(x, y)
PRIVADAS
    vida = 3;
INICIO
    BUCLE
        CUADRO;
    FIN
FIN

PROCESO principal()
LOCALES
    i = 0;
INICIO
    enemigo(10, 20);
    enemigo(30, 40);

    RECORRE enemigo
        total = total + x + y;
    FIN

    DESDE i = 0 HASTA 3
        total = total + doble(i);
    FIN

    i = 0;
    MIENTRAS (i < 2)
        i = i + 1;
    FIN

    REPITE
        i = i + 1;
    HASTA (i >= 3)

    SI (total = 112 Y valor = 5 Y NO (i = 0))
        ok = 1;
    SINO
        ok = 2;
    FIN

    SI (ok = 0 O ok = 2)
        ok = 3;
    FIN

    BUCLE
        CUADRO;
    FIN
FIN
`, 5, 'sinÃ³nimos ES');

    expectEqual(globals.total, 112, 'RECORRE + DESDE/HASTA + funciÃ³n espaÃ±ola');
    expectEqual(globals.valor, 5, 'la variable y no se convierte en AND');
    expectEqual(globals.ok, 1, 'SI/SINO/Y/NO/O/HASTA');
  },
});

tests.push({
  name: 'normalizador: strings, comentarios, propiedades e idempotencia',
  fn: () => {
    const source = `
PROGRAMA Demo;
// proceso y fin dentro de un comentario
GLOBALES
    y = 1;
    texto = "proceso y fin";
    objeto.proceso = 2;
PROCESO principal()
INICIO
    SI (y = 1 Y texto != "")
        CUADRO;
    FIN
FIN
`;
    const normalized = normalizeTokens(source);
    if (!normalized.includes('program Demo')) throw new Error('PROGRAMA no normalizado');
    if (!normalized.includes('global')) throw new Error('GLOBALES no normalizado');
    if (!normalized.includes('process principal')) throw new Error('PROCESO no normalizado');
    if (!normalized.includes('"proceso y fin"')) throw new Error('string modificado');
    if (!normalized.includes('// proceso y fin')) throw new Error('comentario modificado');
    if (!normalized.includes('objeto.proceso')) throw new Error('propiedad modificada');
    if (!normalized.includes('y = 1')) throw new Error('variable y modificada');
    if (!normalized.includes('if (y = 1 and texto')) throw new Error('SI/Y contextual no normalizado');
    if (!isNormalized(normalized)) throw new Error('normalizar dos veces cambia el resultado');
  },
});

tests.push({
  name: 'plantilla de proyecto nuevo',
  fn: () => {
    const { globals } = run(newProjectTemplate('My Great Game', 'User'), 10, 'plantilla');
    expectEqual(globals.score, 0, 'plantilla ejecuta');
  },
});

tests.push({
  name: 'todos los cartuchos de ejemplo compilan y se ejecutan',
  fn: () => {
    for (const cart of CARTRIDGES) {
      try {
        run(cart.code, 120, cart.id);
      } catch (err: any) {
        throw new Error(`Cartucho "${cart.id}": ${err.message}`);
      }
    }
  },
});

let passed = 0;
for (const test of tests) {
  try {
    test.fn();
    passed++;
    console.log(`OK   ${test.name}`);
  } catch (err: any) {
    console.error(`FAIL ${test.name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${tests.length} pruebas correctas`);

