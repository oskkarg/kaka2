/**
 * DIV-8 Preloaded Cartridges / Examples
 */

import { Cartridge } from '../engine/types';

export const CARTRIDGES: Cartridge[] = [
  {
    id: 'sonic_parallax',
    title: '🌀 Sonic Parallax Scroll (DIV)',
    author: 'J. Manuel Habas / DIV-8 Team',
    description: 'Demostración de break_back_scroll, multiscroll en 17 tiras de parallax y colisión con tilemap.',
    code: `// ==========================================
// SONIC SMS - GREEN HILL PARALLAX
// DIV Games Studio / DivGO
// break_back_scroll & tilemap demo
// ==========================================

program sonic_green_hill;
global
    fpg_zona1, fpg_sonic;
    tilemap; tile;
    
    // Alto de cada fragmento (17 franjas de parallax)
    fragmento[] = 137, 15, 15, 2, 3, 5, 5, 5, 5, 8, 8, 8, 16, 16, 16, 16, 8;
    // Velocidad de desplazamiento de cada fragmento
    velocidad[] = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17;

local
    en_suelo = false;
    velocidad_gravedad = 0;

begin
    set_title("Sonic SMS");
    set_mode(320, 200, 2);
    set_fps(60, 0);
    
    screen_scanline(40);
    screen_smooth(false);
    
    tilemap = new_tilemap("0030");

    text_size = 60;
    text_color = cc_black;
    write_int(0, 11, 11, 0, offset fps);
    
    text_color = cc_white;
    write_int(0, 10, 10, 0, offset fps);
    
    // Iniciar scroll con tilemap frontal y fondo 101
    start_scroll(0, 0, tilemap, 101, 0, 4);
    
    // Trocear el fondo en 17 tiras con velocidades independientes
    break_back_scroll(0, 0, fragmento, velocidad);
            
    // Spawnea a Sonic
    sonic(160, 180);
    
    loop
        frame;
    end
end

process sonic(x, y);
private
    anima       = 0;
    salto       = 0;
    observa     = 0;
    agachado    = 0;
    grafic      = 1;
    veces       = 0;
    old_x       = 0;
    incr_x      = 0;
    
begin
    graph = 1;
    size  = 100;
    z     = 20;
    ctype = c_scroll;
    
    scroll.camera = id;
        
    loop
        anima    = 0;
        observa  = 0;
        agachado = 0;
        if (en_suelo) salto = 0; end
        
        if (key(_up) and en_suelo) grafic = 20; observa = 1; end
        if (key(_down) and en_suelo) observa = 1; agachado = 1; end
        
        if (key(_right) and not observa)
            if (get_tile(tilemap, x + 8, y + 16) <> 4)
                flags = 0; x += 4; anima = 1;
            end
        end
        if (key(_left) and x > 16 and not observa)
            if (get_tile(tilemap, x - 8, y + 16) <> 6)
                flags = 1; x -= 4; anima = 1;
            end
        end
        
        // Salto con botones B, N, M, X o Space
        if ((key(_b) or key(_n) or key(_m) or key(_x) or key(_space)) and en_suelo)
            velocidad_gravedad = -11;
            salto = 1;
            grafic = 29.5;
            sound(3);
        end

        if (observa == 0)
            if (salto == 0)
                if (anima == 1)
                    if (grafic == 1) grafic = 4.5; veces = 0; end
                    grafic += 0.3;
                    if (grafic > 10) veces++; end
                    if (veces > 1)
                        if (grafic > 14) grafic = 11; end
                    else
                        if (grafic > 10) grafic = 5; end
                    end
                else
                    grafic = 1;
                end
            else
                grafic += 0.3;
                if (grafic > 34) grafic = 30; end
            end
        end
        
        graph = grafic;
        
        // Gravedad y colisiones con el tilemap
        en_suelo = false;
        if (get_tile(tilemap, x, y + 16) <> 0)
            en_suelo = true;
            velocidad_gravedad = 0;
            y = ((y + 16) / 16) * 16 - 16;
        else
            velocidad_gravedad += 0.7;
            if (velocidad_gravedad > 10) velocidad_gravedad = 10; end
            y += velocidad_gravedad;
        end
        
        frame;
    end
end`,
  },
  {
    id: 'space_shooter',
    title: '🚀 Space Shooter (DIV)',
    author: 'DIV Studio Team',
    description: 'Juego arcade espacial con procesos cooperativos: nave, disparos, oleadas de aliens, estrellas y explosiones.',
    code: `// ==========================================
// SPACE SHOOTER - DIV Games Studio
// Consola Fantasía DIV-8
// ==========================================

PROGRAM SpaceShooter;

GLOBAL
    score = 0;
    vidas = 3;
    oleada = 1;
    game_over = 0;

// Proceso principal: inicializa el juego
PROCESS main()
BEGIN
    score = 0;
    vidas = 3;
    game_over = 0;
    screen_color(0); // Fondo negro
    
    // Generar fondo de estrellas estelares
    for i = 1 to 40
        estrella(rand(0, 320), rand(0, 240), rand(1, 3));
    end
    
    // Crear la nave del jugador
    jugador(160, 200);
    
    // Iniciar generador de enemigos
    spawner();
    
    // Mostrar marcador HUD
    hud();
    
    LOOP
        FRAME;
    END
END

// Proceso estrella de fondo
PROCESS estrella(x, y, vel)
BEGIN
    graph = 13; // Sprite de estrella
    size = vel * 25;
    z = -10; // Dibujar al fondo
    
    LOOP
        y = y + vel;
        if (y > 240)
            y = 0;
            x = rand(0, 320);
        end
        FRAME;
    END
END

// Proceso del jugador
PROCESS jugador(x, y)
LOCAL
    speed = 3;
    cadencia = 0;
BEGIN
    graph = 1; // Sprite nave
    size = 100;
    
    LOOP
        // Movimiento suave con teclas o D-Pad
        if (key(_left) and x > 16) x = x - speed; end
        if (key(_right) and x < 304) x = x + speed; end
        if (key(_up) and y > 30) y = y - speed; end
        if (key(_down) and y < 225) y = y + speed; end
        
        // Disparar con [A] o Barra Espaciadora / Z
        if (key(_space) and cadencia <= 0 and game_over == 0)
            disparo(x - 5, y - 8);
            disparo(x + 5, y - 8);
            sound(1); // Sonido láser pew-pew
            cadencia = 8;
        end
        
        if (cadencia > 0)
            cadencia = cadencia - 1;
        end
        
        // Detectar colisión con enemigos
        col = collision(enemigo);
        if (col != 0 and game_over == 0)
            explosion(x, y);
            sound(2); // Explosión
            vidas = vidas - 1;
            signal(col, s_kill);
            
            if (vidas <= 0)
                game_over = 1;
                sound(7); // Game over sound
                return; // Nave destruida
            end
        end
        
        FRAME;
    END
END

// Proceso de proyectil láser
PROCESS disparo(x, y)
LOCAL
    speed = 6;
BEGIN
    graph = 2; // Sprite láser
    size = 100;
    
    LOOP
        y = y - speed;
        
        // Colisión con enemigo
        col = collision(enemigo);
        if (col != 0)
            explosion(x, y);
            sound(2); // Explosión
            score = score + 100;
            signal(col, s_kill); // Destruir enemigo
            return;
        end
        
        // Salir de pantalla
        if (y < -10)
            return;
        end
        
        FRAME;
    END
END

// Proceso de enemigos aliens
PROCESS enemigo(x, y, tipo)
LOCAL
    base_x = 0;
    tiempo = 0;
    vel_y = 1.5;
BEGIN
    graph = 3; // Sprite alien rojo
    size = 100;
    base_x = x;
    tiempo = rand(0, 50);
    
    LOOP
        tiempo = tiempo + 0.05;
        // Movimiento ondulado sinusoidal
        x = base_x + Math.sin(tiempo * 3) * 25;
        y = y + vel_y;
        
        // Si el alien escapa por abajo
        if (y > 250)
            return;
        end
        
        FRAME;
    END
END

// Generador de oleadas de enemigos
PROCESS spawner()
LOCAL
    temporizador = 0;
BEGIN
    LOOP
        temporizador = temporizador + 1;
        
        if (temporizador > 40 and game_over == 0)
            enemigo(rand(30, 290), -15, rand(0, 2));
            temporizador = 0;
        end
        
        FRAME;
    END
END

// Explosión animada
PROCESS explosion(x, y)
LOCAL
    timer = 0;
BEGIN
    graph = 5; // Sprite explosión
    size = 60;
    
    LOOP
        size = size + 15;
        timer = timer + 1;
        if (timer > 6)
            return;
        end
        FRAME;
    END
END

// Marcador en pantalla HUD
PROCESS hud()
BEGIN
    LOOP
        // Escribir estadísticas en pantalla
        write(10, 10, "SCORE: " + score, 10, align_left);
        write(240, 10, "VIDAS: " + vidas, 14, align_left);
        
        if (game_over == 1)
            write(160, 110, "GAME OVER", 8, align_center);
            write(160, 130, "PULSA ENTER PARA REINICIAR", 7, align_center);
            
            if (key(_enter))
                let_me_alone();
                main();
                return;
            end
        end
        
        FRAME;
    END
END
`,
  },

  {
    id: 'naalaa_español',
    title: '🇪🇸 Space Shooter (Sintaxis Naalaa/DIV Español)',
    author: 'Código del Usuario',
    description: 'El ejemplo original en sintaxis española con PROCESO, RECORRE, SI, DISPARA, DIBUJA y traducción directa.',
    code: `// ========================================
// SPACE SHOOTER - Versión Naalaa Español
// Sintaxis directa con PROCESO y RECORRE
// ========================================

PROGRAMA SpaceShooterNaalaa;

GLOBALES
    score = 0;
    vidas = 3;
    frame_count = 0;

// Proceso inicial que arranca los componentes
PROCESO inicio()
INICIO
    screen_color(0); // Fondo oscuro
    
    // Crear el jugador
    jugador(160, 200);
    
    // Iniciar generador de enemigos
    generador();
    
    // Marcador
    marcador();
    
    BUCLE
        CUADRO;
    FIN
FIN

// Proceso del jugador con sintaxis española
PROCESO jugador(x, y)
LOCALES
    velocidad = 3;
    recarga = 0;
INICIO
    graph = 1; // Nave
    size = 100;
    
    BUCLE
        // Teclas en español
        si (tecla(_left) y x > 15) x = x - velocidad; fin
        si (tecla(_right) y x < 305) x = x + velocidad; fin
        si (tecla(_up) y y > 20) y = y - velocidad; fin
        si (tecla(_down) y y < 220) y = y + velocidad; fin
        
        // Disparo con tecla Espacio o Botón A
        si (tecla(_space) y recarga <= 0)
            disparo(x, y - 8);
            sonido(1);
            recarga = 10;
        fin
        
        si (recarga > 0)
            recarga = recarga - 1;
        fin
        
        CUADRO;
    FIN
FIN

// Proceso bala
PROCESO disparo(x, y)
LOCALES
    velocidad = 5;
INICIO
    graph = 2; // Láser
    
    BUCLE
        y = y - velocidad;
        
        // Detectar colisión con enemigo
        col = colision(enemigo);
        si (col != 0)
            explosion(x, y);
            sonido(2);
            score = score + 50;
            senal(col, s_kill);
            retorna;
        fin
        
        si (y < -10)
            retorna;
        fin
        
        CUADRO;
    FIN
FIN

// Proceso enemigo con movimiento
PROCESO enemigo(x, y)
LOCALES
    baseX = 0;
    tiempo = 0;
    velocidad = 1.2;
INICIO
    graph = 3; // Alien
    baseX = x;
    
    BUCLE
        tiempo = tiempo + 0.05;
        x = baseX + Math.sin(tiempo * 2) * 20;
        y = y + velocidad;
        
        si (y > 250)
            retorna;
        fin
        
        CUADRO;
    FIN
FIN

// Proceso generador
PROCESO generador()
LOCALES
    timer = 0;
INICIO
    BUCLE
        timer = timer + 1;
        si (timer > 45)
            enemigo(aleatorio(30, 290), -10);
            timer = 0;
        fin
        CUADRO;
    FIN
FIN

// Proceso explosión
PROCESO explosion(x, y)
LOCALES
    t = 0;
INICIO
    graph = 5;
    size = 80;
    BUCLE
        size = size + 10;
        t = t + 1;
        si (t > 5) retorna; fin
        CUADRO;
    FIN
FIN

// Marcador
PROCESO marcador()
INICIO
    BUCLE
        escribe(10, 10, "PUNTOS: " + score, 10);
        escribe(220, 10, "NAALAA DIV-8", 12);
        CUADRO;
    FIN
FIN
`,
  },

  {
    id: 'platformer_hero',
    title: '🍄 Platformer Hero',
    author: 'DIV Retro Studios',
    description: 'Plataformas clásico con físicas de gravedad, salto, monedas coleccionables, enemigo patrullero y sonido.',
    code: `// ==========================================
// PLATFORMER HERO - DIV Games Studio
// Físicas, plataformas y recolección
// ==========================================

PROGRAM PlatformerGame;

GLOBAL
    monedas = 0;
    vidas = 3;

PROCESS main()
BEGIN
    screen_color(1); // Fondo azul medianoche
    
    // Crear suelo y plataformas
    for i = 0 to 20
        bloque(i * 16, 220);
    end
    
    // Plataformas flotantes
    for i = 3 to 7
        bloque(i * 16, 170);
    end
    
    for i = 11 to 15
        bloque(i * 16, 120);
    end
    
    // Monedas de oro
    moneda(70, 150);
    moneda(200, 100);
    moneda(230, 100);
    moneda(160, 200);
    
    // Enemigo que patrulla
    enemigo(180, 204);
    
    // El héroe
    heroe(30, 190);
    
    // Interfaz
    marcador();
    
    LOOP
        FRAME;
    END
END

// Bloque de plataforma
PROCESS bloque(x, y)
BEGIN
    graph = 10; // Ladrillo
    size = 100;
    LOOP
        FRAME;
    END
END

// Moneda coleccionable
PROCESS moneda(x, y)
LOCAL
    anim = 0;
BEGIN
    graph = 7; // Moneda oro
    size = 100;
    LOOP
        anim = anim + 0.1;
        y = y + Math.sin(anim) * 0.3;
        
        col = collision(heroe);
        if (col != 0)
            sound(5); // Chime de moneda
            monedas = monedas + 1;
            return;
        end
        FRAME;
    END
END

// Enemigo patrullero
PROCESS enemigo(x, y)
LOCAL
    dir = 1;
    base_x = 0;
BEGIN
    graph = 8; // Esqueleto / Fantasma
    size = 100;
    base_x = x;
    
    LOOP
        x = x + dir * 1;
        if (x > base_x + 50) dir = -1; flags = 1; end
        if (x < base_x - 50) dir = 1; flags = 0; end
        
        FRAME;
    END
END

// Personaje protagonista
PROCESS heroe(x, y)
LOCAL
    vy = 0;
    en_suelo = 0;
    speed = 2.5;
BEGIN
    graph = 6; // Héroe Diver
    size = 100;
    
    LOOP
        // Control horizontal
        if (key(_left))
            x = x - speed;
            flags = 1; // Voltear sprite a la izquierda
        end
        if (key(_right))
            x = x + speed;
            flags = 0; // Mirar a la derecha
        end
        
        // Físicas: gravedad
        vy = vy + 0.4;
        y = y + vy;
        
        // Suelo principal
        if (y >= 204)
            y = 204;
            vy = 0;
            en_suelo = 1;
        end
        
        // Salto con [A] o Z / Arriba
        if ((key(_space) or key(_up)) and en_suelo == 1)
            vy = -7.5;
            en_suelo = 0;
            sound(3); // Sonido salto
        end
        
        // Colisión con enemigo
        col = collision(enemigo);
        if (col != 0)
            sound(4); // Golpe
            x = 30;
            y = 190;
            vy = 0;
        end
        
        FRAME;
    END
END

// Marcador
PROCESS marcador()
BEGIN
    LOOP
        write(10, 10, "MONEDAS: " + monedas, 10);
        write(200, 10, "USA FLECHAS + Z", 7);
        FRAME;
    END
END
`,
  },

  {
    id: 'cyber_breakout',
    title: '🧱 Cyber Breakout (Arkanoid)',
    author: 'DIV Retro Arcade',
    description: 'Destrucción de ladrillos con física de rebote, pala interactiva, partículas y puntuación.',
    code: `// ==========================================
// CYBER BREAKOUT - DIV Games Studio
// Arcade de rebote de pelota y ladrillos
// ==========================================

PROGRAM Breakout;

GLOBAL
    score = 0;
    vidas = 3;

PROCESS main()
BEGIN
    screen_color(16); // Fondo berenjena retro
    
    // Crear muro de ladrillos multicolor
    for fila = 0 to 4
        for col = 0 to 8
            ladrillo(32 + col * 32, 40 + fila * 14, 8 + fila * 2);
        end
    end
    
    // Crear la pala del jugador
    pala(160, 220);
    
    // Crear la pelota
    pelota(160, 180);
    
    // Marcador
    marcador();
    
    LOOP
        FRAME;
    END
END

// Ladrillo destructor
PROCESS ladrillo(x, y, color_tipo)
BEGIN
    graph = 10; // Sprite bloque
    size = 90;
    LOOP
        col = collision(pelota);
        if (col != 0)
            sound(4); // Sonido impacto
            score = score + 20;
            return;
        end
        FRAME;
    END
END

// Pala controlada por el jugador
PROCESS pala(x, y)
LOCAL
    speed = 4.5;
BEGIN
    graph = 12; // Sprite pala
    size = 110;
    LOOP
        if (key(_left) and x > 30) x = x - speed; end
        if (key(_right) and x < 290) x = x + speed; end
        FRAME;
    END
END

// Pelota con rebotes físicos
PROCESS pelota(x, y)
LOCAL
    vx = 2.5;
    vy = -3;
BEGIN
    graph = 11; // Pelota
    size = 100;
    LOOP
        x = x + vx;
        y = y + vy;
        
        // Rebote en paredes laterales
        if (x <= 10 or x >= 310)
            vx = -vx;
            sound(8);
        end
        
        // Rebote en techo
        if (y <= 15)
            vy = -vy;
            sound(8);
        end
        
        // Rebote en la pala
        col = collision(pala);
        if (col != 0)
            vy = -Math.abs(vy);
            sound(3);
        end
        
        // Rebote en ladrillos
        colLadrillo = collision(ladrillo);
        if (colLadrillo != 0)
            vy = -vy;
        end
        
        // Si cae al vacío
        if (y > 240)
            sound(7);
            x = 160;
            y = 180;
            vy = -3;
            vx = rand(-2, 2);
            if (vx == 0) vx = 2; end
        end
        
        FRAME;
    END
END

PROCESS marcador()
BEGIN
    LOOP
        write(10, 10, "PUNTOS: " + score, 10);
        write(220, 10, "FLECHAS IZQ/DER", 7);
        FRAME;
    END
END
`,
  },

  {
    id: 'dungeon_crawler',
    title: '🗝️ Dungeon Crawler',
    author: 'DIV RPG Adventures',
    description: 'Aventura cenital con antorchas animadas, llaves, cofre del tesoro y esqueletos errantes.',
    code: `// ==========================================
// DUNGEON CRAWLER - DIV Games Studio
// Laberinto RPG con antorchas, llaves y cofres
// ==========================================

PROGRAM DungeonRPG;

GLOBAL
    tiene_llave = 0;
    tesoro_abierto = 0;

PROCESS main()
BEGIN
    screen_color(5); // Piedra oscura
    
    // Antorchas que iluminan las paredes
    antorcha(40, 40);
    antorcha(280, 40);
    antorcha(40, 200);
    antorcha(280, 200);
    
    // Llave y Cofre
    llave(60, 180);
    cofre(260, 60);
    
    // Esqueleto enemigo
    esqueleto(160, 80);
    
    // Héroe explorador
    heroe(160, 180);
    
    marcador();
    
    LOOP
        FRAME;
    END
END

PROCESS antorcha(x, y)
LOCAL
    flicker = 0;
BEGIN
    graph = 15; // Antorcha
    LOOP
        flicker = flicker + 0.2;
        size = 90 + Math.sin(flicker) * 10;
        FRAME;
    END
END

PROCESS llave(x, y)
BEGIN
    graph = 14; // Llave de oro
    LOOP
        col = collision(heroe);
        if (col != 0)
            sound(5); // Chime
            tiene_llave = 1;
            return;
        end
        FRAME;
    END
END

PROCESS cofre(x, y)
BEGIN
    graph = 16; // Cofre
    LOOP
        col = collision(heroe);
        if (col != 0 and tiene_llave == 1 and tesoro_abierto == 0)
            sound(6); // Fanfarria victoria
            tesoro_abierto = 1;
        end
        FRAME;
    END
END

PROCESS esqueleto(x, y)
LOCAL
    timer = 0;
    vx = 1;
BEGIN
    graph = 8;
    LOOP
        timer = timer + 1;
        x = x + vx;
        if (x > 220) vx = -1; flags = 1; end
        if (x < 100) vx = 1; flags = 0; end
        FRAME;
    END
END

PROCESS heroe(x, y)
LOCAL
    speed = 2.5;
BEGIN
    graph = 6;
    LOOP
        if (key(_left)) x = x - speed; flags = 1; end
        if (key(_right)) x = x + speed; flags = 0; end
        if (key(_up)) y = y - speed; end
        if (key(_down)) y = y + speed; end
        
        FRAME;
    END
END

PROCESS marcador()
BEGIN
    LOOP
        if (tiene_llave == 0)
            write(10, 10, "OBJETIVO: BUSCA LA LLAVE", 10);
        else
            if (tesoro_abierto == 0)
                write(10, 10, "¡TIENES LA LLAVE! ABRE EL COFRE", 11);
            else
                write(160, 110, "¡HAS ENCONTRADO EL TESORO!", 10, align_center);
            end
        end
        FRAME;
    END
END
`,
  },

  {
    id: 'demo_scene',
    title: '✨ Demoscene 90s Stars & Scroller',
    author: 'DIV Demoscene Crew',
    description: 'Efecto estrella 3D hiperespacio, scroller ondulante de texto y logotipo retro.',
    code: `// ==========================================
// 90s DEMOSCENE FX - DIV Games Studio
// Warp Starfield y Texto Ondulante
// ==========================================

PROGRAM DemoScene;

PROCESS main()
BEGIN
    screen_color(0);
    
    // Crear campo estelar 3D
    for i = 1 to 50
        star3d(rand(-160, 160), rand(-120, 120), rand(1, 200));
    end
    
    // Logo central
    logo(160, 70);
    
    // Scroller inferior
    scroller();
    
    LOOP
        FRAME;
    END
END

PROCESS star3d(sx, sy, sz)
BEGIN
    LOOP
        sz = sz - 2.5;
        if (sz <= 1)
            sz = 200;
            sx = rand(-160, 160);
            sy = rand(-120, 120);
        end
        
        // Proyección perspectiva 3D a 2D
        k = 150 / sz;
        px = 160 + sx * k;
        py = 120 + sy * k;
        
        if (px >= 0 and px < 320 and py >= 0 and py < 240)
            color_star = 6;
            if (sz < 50) color_star = 7; end
            draw_box(px, py, (200 - sz) / 40, (200 - sz) / 40, color_star, 1);
        end
        
        FRAME;
    END
END

PROCESS logo(x, y)
LOCAL
    anim = 0;
BEGIN
    LOOP
        anim = anim + 0.05;
        ny = y + Math.sin(anim) * 12;
        write(x, ny, "DIV-8 CONSOLE", 10, align_center);
        write(x, ny + 15, "HAMMER RETRO ENGINE", 12, align_center);
        FRAME;
    END
END

PROCESS scroller()
LOCAL
    scroll_x = 320;
    msg = "BIENVENIDO A LA CONSOLA DE FANTASIA DIV-8 -- PROGRAMACION PURA EN PROCESOS MULTITAREA -- DIV GAMES STUDIO RULES! -- ";
BEGIN
    LOOP
        scroll_x = scroll_x - 2;
        if (scroll_x < -700)
            scroll_x = 320;
        end
        
        write(scroll_x, 215, msg, 14, align_left);
        FRAME;
    END
END
`,
  },
  {
    id: 'pixi_hd_demo',
    title: '⚡ Pixi.js GPU 640x480 & Enjambre (set_mode)',
    author: 'DIV-8 Pixi Team',
    description: 'Demostración de alta resolución set_mode(640, 480) y renderizado GPU con cientos de procesos y sprites acelerados por Pixi.js.',
    code: `// ==========================================
// PIXI.JS GPU DEMO - DIV-8
// Alta Resolución set_mode(640, 480)
// Cientos de sprites acelerados por hardware
// ==========================================

PROGRAM PixiGpuDemo;

GLOBAL
    cant_naves = 80;

PROCESS main()
BEGIN
    // Configurar resolución alta en Pixi.js
    set_mode(640, 480);
    screen_color(0);

    // Crear enjambre de naves aceleradas por GPU
    for i = 1 to cant_naves
        orbe(rand(50, 590), rand(70, 410), rand(1, 4), rand(0, 360));
    end

    controlador();

    LOOP
        FRAME;
    END
END

PROCESS orbe(x, y, tipo_graf, ang)
LOCAL
    vel = 2.5;
    rot_speed = 3;
BEGIN
    graph = tipo_graf;
    size = rand(70, 130);
    angle = ang;
    rot_speed = rand(-4, 4);
    if (rot_speed == 0) rot_speed = 2; end

    LOOP
        angle = angle + rot_speed;
        x = x + cos(angle * 3.14159 / 180) * vel;
        y = y + sin(angle * 3.14159 / 180) * vel;

        if (x < 20) x = 20; angle = 180 - angle; end
        if (x > width() - 20) x = width() - 20; angle = 180 - angle; end
        if (y < 60) y = 60; angle = -angle; end
        if (y > height() - 40) y = height() - 40; angle = -angle; end

        FRAME;
    END
END

PROCESS controlador()
BEGIN
    LOOP
        write(320, 15, "PIXI.JS GPU HARDWARE ACCELERATED", 10, align_center);
        write(320, 30, "RESOLUCION ACTIVA: 640x480 (set_mode)", 11, align_center);
        write(320, 455, "MANTEN ESPACIO O [A] PARA AGREGAR +25 PROCESOS", 7, align_center);

        write(20, 15, "PROCESOS: " + cant_naves, 14, align_left);
        write(20, 30, "ANCHO: " + width() + " ALTO: " + height(), 12, align_left);

        if (key(_space) or key(_a))
            for k = 1 to 25
                orbe(rand(50, 590), rand(70, 410), rand(1, 4), rand(0, 360));
                cant_naves = cant_naves + 1;
            end
        end

        FRAME;
    END
END
`,
  },
];
