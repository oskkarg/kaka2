/**
 * Plantilla de proyecto nuevo para DIV-8.
 * Se usa al crear un juego con "Nuevo" para que el usuario escriba su nombre.
 *
 * El lenguaje canónico es DIV Games Studio en inglés. El usuario puede
 * escribir después sinónimos en español: tokenNormalizer los traduce.
 */

export function toProgramName(title: string): string {
  const cleaned = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();

  if (!cleaned) return 'MyGame';

  const pascal = cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return /^[A-Za-z]/.test(pascal) ? pascal : `Game${pascal}`;
}

export function newProjectTemplate(title: string, author = 'User'): string {
  const programName = toProgramName(title);
  const safeTitle = title.replace(/\*\//g, '* /');

  return `// ==========================================
// ${safeTitle}
// Author: ${author}
// Created with DIV-8 Studio
// ==========================================

PROGRAM ${programName};

GLOBAL
    score = 0;
    lives = 3;

// ------------------------------------------
// User functions: callable from any process.
// ------------------------------------------
FUNCTION clamp(value, minimum, maximum)
BEGIN
    IF (value < minimum)
        RETURN minimum;
    END
    IF (value > maximum)
        RETURN maximum;
    END
    RETURN value;
END

// ------------------------------------------
// Main process
// ------------------------------------------
PROCESS main()
BEGIN
    screen_color(1); // Blue background

    player(160, 200);
    hud();

    LOOP
        FRAME;
    END
END

// ------------------------------------------
// Player controlled with the arrow keys
// ------------------------------------------
PROCESS player(x, y)
PRIVATE
    speed = 3;
BEGIN
    graph = 1; // Ship / character

    LOOP
        IF (key(_left))
            x = clamp(x - speed, 8, 312);
        END
        IF (key(_right))
            x = clamp(x + speed, 8, 312);
        END
        IF (key(_up))
            y = clamp(y - speed, 8, 232);
        END
        IF (key(_down))
            y = clamp(y + speed, 8, 232);
        END

        FRAME;
    END
END

// ------------------------------------------
// On-screen HUD
// ------------------------------------------
PROCESS hud()
BEGIN
    LOOP
        write(10, 10, "SCORE: " + score, 10);
        write(240, 10, "LIVES: " + lives, 14);
        FRAME;
    END
END
`;
}
