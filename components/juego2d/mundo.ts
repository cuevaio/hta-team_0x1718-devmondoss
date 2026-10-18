import { PAL, W, type Pincel } from "./pincel";
import { PALETAS, persona, type Direccion } from "./sprites";

/**
 * El barrio en vertical (12×18 tiles de 16 px), pensado para celular.
 * Bodega de Rosa, Banco Andino (ficticio), cabina, plaza con pileta,
 * mercado de Don Pepe y hotel. Se camina tocando el piso.
 */

export const TILE = 16;

const MAPA = [
  "BBBBB..KKKKK",
  "BBBBB..KKKKK",
  "BBBBBP.KKKKK",
  "BBbBB..KKkKK",
  "============",
  "============",
  "T.,,,,,,,,.T",
  "f.,,ww,,,,.f",
  "T.,,ww,,,,.T",
  "..,,,,,,,,..",
  "============",
  "============",
  "MMMM...HHHHH",
  "MMMM...HHHHH",
  "....f..HHHHH",
  "TT.....HHhHH",
  "============",
  "TfT..TfT..TT",
  "TT........TT",
  "T..f....f..T",
  "...TT..TT...",
  "f..........f",
  "============",
  "TTfTTTTTfTTT",
  "TTTTTTTTTTTT",
  "TTTTTTTTTTTT",
];

export const ALTO_MAPA = MAPA.length * TILE;

const PUERTAS: Record<string, string> = { b: "bodega", k: "banco", h: "hotel", P: "cabina" };
const SOLIDOS = new Set(["B", "K", "H", "M", "T", "w", "P", "b", "k", "h"]);

export type Npc = {
  id: string;
  x: number;
  y: number;
  dir: Direccion;
  paleta: keyof typeof PALETAS;
  nombre: string;
  lineas: string[];
};

export type Evento = { tipo: "objetivo"; id: string } | { tipo: "hablar"; lineas: string[] };

export type ConfigMundo = {
  jugador: keyof typeof PALETAS;
  inicio: { x: number; y: number; dir: Direccion };
  noche: boolean;
  objetivo: string;
  npcs: Npc[];
  puertas: Record<string, string[]>;
  /** Letrero de la tienda de Rosa según el país (BODEGA, TIENDA, ABARROTES…). */
  letrero?: string;
};

const DELTA: Record<Direccion, [number, number]> = { arriba: [0, -1], abajo: [0, 1], izq: [-1, 0], der: [1, 0] };

function tileEn(x: number, y: number): string {
  if (y < 0 || y >= MAPA.length || x < 0 || x >= MAPA[0].length) return "B";
  return MAPA[y][x];
}

export function posicionObjetivo(id: string, npcs: Npc[]): { x: number; y: number } | null {
  const npc = npcs.find((n) => n.id === id);
  if (npc) return { x: npc.x, y: npc.y };
  for (let y = 0; y < MAPA.length; y++) {
    for (let x = 0; x < MAPA[y].length; x++) if (PUERTAS[MAPA[y][x]] === id) return { x, y };
  }
  return null;
}

export class Explorador {
  x: number;
  y: number;
  dir: Direccion;
  private resto = 0;
  private paso: 0 | 1 = 0;
  private camino: Direccion[] = [];
  private alLlegar: Direccion | null = null;
  /** Marca del lugar tocado (cuadros restantes). */
  marca: { x: number; y: number; vida: number } | null = null;
  /** Se pone en true al iniciar cada paso (para polvo y sonido). */
  pisada = false;
  /** Cámara vertical (px del mapa en el borde superior de la pantalla). */
  camY = 0;
  private camIniciada = false;

  constructor(readonly cfg: ConfigMundo) {
    this.x = cfg.inicio.x;
    this.y = cfg.inicio.y;
    this.dir = cfg.inicio.dir;
  }

  get quieto() {
    return this.resto === 0 && this.camino.length === 0;
  }

  private libre(x: number, y: number) {
    return !SOLIDOS.has(tileEn(x, y)) && !this.cfg.npcs.some((n) => n.x === x && n.y === y);
  }

  /** Camino más corto (BFS) hasta una casilla libre. */
  private ruta(hx: number, hy: number): Direccion[] | null {
    const cola: Array<[number, number, Direccion[]]> = [[this.x, this.y, []]];
    const visto = new Set([`${this.x},${this.y}`]);
    while (cola.length) {
      const [x, y, camino] = cola.shift()!;
      if (x === hx && y === hy) return camino;
      for (const dir of ["arriba", "abajo", "izq", "der"] as Direccion[]) {
        const [dx, dy] = DELTA[dir];
        const nx = x + dx;
        const ny = y + dy;
        const clave = `${nx},${ny}`;
        if (!visto.has(clave) && this.libre(nx, ny)) {
          visto.add(clave);
          cola.push([nx, ny, [...camino, dir]]);
        }
      }
    }
    return null;
  }

  /** Toque en la casilla (tx, ty): caminar hasta ahí, o hasta al lado si es una puerta o un vecino. */
  irA(tx: number, ty: number) {
    this.marca = { x: tx, y: ty, vida: 24 };
    const destinoInteractivo = !this.libre(tx, ty) && (PUERTAS[tileEn(tx, ty)] || this.cfg.npcs.some((n) => n.x === tx && n.y === ty));
    if (!destinoInteractivo) {
      const r = this.ruta(tx, ty);
      if (r) {
        this.camino = r;
        this.alLlegar = null;
      }
      return;
    }
    // Buscar la casilla vecina más cercana desde la que se puede interactuar.
    let mejor: { camino: Direccion[]; mirar: Direccion } | null = null;
    for (const mirar of ["arriba", "abajo", "izq", "der"] as Direccion[]) {
      const [dx, dy] = DELTA[mirar];
      const ax = tx - dx;
      const ay = ty - dy;
      if (!(ax === this.x && ay === this.y) && !this.libre(ax, ay)) continue;
      const r = ax === this.x && ay === this.y ? [] : this.ruta(ax, ay);
      if (r && (!mejor || r.length < mejor.camino.length)) mejor = { camino: r, mirar };
    }
    if (mejor) {
      this.camino = mejor.camino;
      this.alLlegar = mejor.mirar;
    }
  }

  /** Avanza la animación y el camino. Devuelve un evento al llegar a una puerta o vecino. */
  actualizar(): Evento | null {
    this.pisada = false;
    if (this.marca && --this.marca.vida <= 0) this.marca = null;
    if (this.resto > 0) {
      // 1 px por cuadro: 16 cuadros por casilla, el ritmo clásico de caminar.
      this.resto -= 1;
      if (this.resto === 8) this.paso = this.paso === 0 ? 1 : 0;
      return null;
    }
    const sig = this.camino.shift();
    if (sig) {
      this.mover(sig);
      return null;
    }
    if (this.alLlegar) {
      this.dir = this.alLlegar;
      this.alLlegar = null;
      return this.interactuar();
    }
    return null;
  }

  /** Paso con teclado (escritorio). */
  mover(dir: Direccion): Evento | null {
    if (this.resto > 0) return null;
    this.dir = dir;
    const [dx, dy] = DELTA[dir];
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!this.libre(nx, ny)) {
      const puerta = PUERTAS[tileEn(nx, ny)];
      if (puerta && this.camino.length === 0) return this.tocar(puerta);
      this.camino = [];
      return null;
    }
    this.x = nx;
    this.y = ny;
    this.resto = TILE;
    this.pisada = true;
    return null;
  }

  interactuar(): Evento | null {
    if (this.resto > 0) return null;
    const [dx, dy] = DELTA[this.dir];
    const nx = this.x + dx;
    const ny = this.y + dy;
    const npc = this.cfg.npcs.find((n) => n.x === nx && n.y === ny);
    if (npc) {
      npc.dir = this.dir === "arriba" ? "abajo" : this.dir === "abajo" ? "arriba" : this.dir === "izq" ? "der" : "izq";
      return npc.id === this.cfg.objetivo ? { tipo: "objetivo", id: npc.id } : { tipo: "hablar", lineas: npc.lineas };
    }
    const puerta = PUERTAS[tileEn(nx, ny)];
    return puerta ? this.tocar(puerta) : null;
  }

  private tocar(id: string): Evento {
    if (id === this.cfg.objetivo) return { tipo: "objetivo", id };
    return { tipo: "hablar", lineas: this.cfg.puertas[id] ?? ["Está cerrado."] };
  }

  /** Posición en pantalla de los pies del jugador (para partículas). */
  pies() {
    const [dx, dy] = DELTA[this.dir];
    return { x: this.x * TILE + 8 - dx * this.resto, y: this.y * TILE + 15 - dy * this.resto - this.camY };
  }

  /** La cámara sigue al jugador sin salirse del mapa. */
  private seguir(h: number) {
    const [, dy] = DELTA[this.dir];
    const py = this.y * TILE + 8 - dy * this.resto;
    const meta = Math.max(0, Math.min(ALTO_MAPA - h, py - h * 0.45));
    if (!this.camIniciada) {
      this.camY = meta;
      this.camIniciada = true;
    } else this.camY += (meta - this.camY) * 0.15;
  }

  dibujar(p: Pincel, t: number) {
    this.seguir(p.h);
    const cam = Math.round(this.camY);
    p.rect("#2f7a3a", 0, 0, W, p.h);
    p.ctx.save();
    p.ctx.translate(0, -cam);
    dibujarMapa(p, t, this.cfg.noche, this.cfg.letrero ?? "BODEGA");

    if (this.marca && this.marca.vida % 6 < 4) {
      const { x, y } = this.marca;
      p.alfa(0.8, () => {
        p.rect(PAL.blanco, x * TILE + 2, y * TILE + 2, 4, 1);
        p.rect(PAL.blanco, x * TILE + 2, y * TILE + 2, 1, 4);
        p.rect(PAL.blanco, x * TILE + 10, y * TILE + 2, 4, 1);
        p.rect(PAL.blanco, x * TILE + 13, y * TILE + 2, 1, 4);
        p.rect(PAL.blanco, x * TILE + 2, y * TILE + 13, 4, 1);
        p.rect(PAL.blanco, x * TILE + 2, y * TILE + 10, 1, 4);
        p.rect(PAL.blanco, x * TILE + 10, y * TILE + 13, 4, 1);
        p.rect(PAL.blanco, x * TILE + 13, y * TILE + 10, 1, 4);
      });
    }

    const [dx, dy] = DELTA[this.dir];
    const ox = -dx * this.resto;
    const oy = -dy * this.resto;
    const figuras = [
      ...this.cfg.npcs.map((n) => ({
        y: n.y * TILE,
        dibujar: () => figura(p, n.x * TILE, n.y * TILE - (Math.floor(t / 45 + n.x) % 2), n.dir, 0, n.paleta),
      })),
      {
        y: this.y * TILE + oy,
        dibujar: () =>
          figura(p, this.x * TILE + ox, this.y * TILE + oy, this.dir, this.resto > 0 ? this.paso : 0, this.cfg.jugador),
      },
    ].sort((a, b) => a.y - b.y);
    for (const f of figuras) f.dibujar();

    if (this.cfg.noche) noche(p, t);

    const obj = posicionObjetivo(this.cfg.objetivo, this.cfg.npcs);
    if (obj) {
      const rebote = Math.round(Math.abs(Math.sin(t / 10)) * -4);
      p.alfa(0.35, () => p.circulo(obj.x * TILE + 8, obj.y * TILE + 8, 9 + (Math.floor(t / 8) % 3), PAL.ambar));
      p.flechaAbajo(obj.x * TILE + 5, obj.y * TILE - 11 + rebote, PAL.tinta);
      p.flechaAbajo(obj.x * TILE + 5, obj.y * TILE - 12 + rebote, PAL.ambar);
    }
    p.ctx.restore();

    // Si el objetivo quedó fuera de pantalla, una flecha en el borde indica hacia dónde ir.
    if (obj) {
      const sy = obj.y * TILE + 8 - cam;
      const x = obj.x * TILE + 4;
      const pulso = Math.floor(t / 12) % 2;
      if (sy < 22) {
        for (let i = 0; i < 4; i++) p.rect(PAL.ambar, x + 3 - i, 24 + i - pulso, 1 + i * 2, 1);
      } else if (sy > p.h - 6) {
        p.flechaAbajo(x + 1, p.h - 10 + pulso, PAL.ambar);
      }
    }
  }
}

function figura(p: Pincel, x: number, y: number, dir: Direccion, paso: 0 | 1, paleta: keyof typeof PALETAS) {
  p.alfa(0.25, () => p.elipse(x + 8, y + 15, 5, 1, PAL.negro));
  p.sprite(persona(dir, paso), PALETAS[paleta], x + 2, y - (paso ? 1 : 0), 1, dir === "izq");
}

// ── Dibujo del mapa ───────────────────────────────────────────

function hash(x: number, y: number) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function pasto(p: Pincel, x: number, y: number) {
  p.rect("#78c26a", x, y, TILE, TILE);
  const h = hash(x, y);
  for (let i = 0; i < 4; i++) p.rect("#5aa64f", x + ((h >> (i * 4)) % 14), y + ((h >> (i * 4 + 2)) % 14), 1, 2);
}

function dibujarTile(p: Pincel, ch: string, x: number, y: number, t: number) {
  const X = x * TILE;
  const Y = y * TILE;
  if (ch === "=") {
    p.rect("#e3d2a4", X, Y, TILE, TILE);
    const h = hash(x, y);
    p.rect("#cdb987", X + (h % 13), Y + ((h >> 3) % 13), 2, 1);
    p.rect("#cdb987", X + ((h >> 5) % 13), Y + ((h >> 8) % 13), 1, 1);
    return;
  }
  if (ch === ",") {
    p.rect("#d9d2c6", X, Y, TILE, TILE);
    p.rect("#c4bcae", X, Y + 7, TILE, 1);
    p.rect("#c4bcae", X + (((y % 2) * 8 + 7) % 16), Y, 1, 7);
    p.rect("#c4bcae", X + (((y % 2) * 8 + 3) % 16), Y + 8, 1, 8);
    return;
  }
  pasto(p, X, Y);
  if (ch === "f") {
    const s = Math.floor(t / 30 + x) % 2;
    p.rect(PAL.rojo, X + 3, Y + 4 + s, 2, 2);
    p.rect(PAL.ambar, X + 10, Y + 9, 2, 2);
    p.rect(PAL.blanco, X + 6, Y + 11 - s, 2, 2);
  }
  if (ch === "T") {
    p.rect(PAL.maderaOscura, X + 6, Y + 10, 4, 6);
    p.circulo(X + 8, Y + 7, 7, "#2f7a3a");
    p.circulo(X + 7, Y + 6, 5, "#47a052");
    p.rect("#6cc06e", X + 5, Y + 3, 2, 2);
  }
}

function ventana(p: Pincel, x: number, y: number, esNoche: boolean) {
  p.rect(PAL.tinta, x, y, 16, 12);
  p.rect(esNoche ? "#ffe08a" : PAL.celeste, x + 1, y + 1, 14, 10);
  if (!esNoche) p.rect("rgba(255,255,255,0.6)", x + 2, y + 2, 3, 1);
  p.rect(PAL.tinta, x + 7, y + 1, 1, 10);
}

function puerta(p: Pincel, x: number, y: number, color: string = PAL.maderaOscura) {
  p.rect(PAL.tinta, x, y, 16, 16);
  p.rect(color, x + 1, y + 1, 14, 15);
  p.rect("rgba(255,255,255,0.15)", x + 2, y + 2, 5, 13);
  p.rect(PAL.ambar, x + 11, y + 9, 2, 2);
}

function dibujarMapa(p: Pincel, t: number, esNoche: boolean, letrero: string) {
  for (let y = 0; y < MAPA.length; y++) for (let x = 0; x < MAPA[y].length; x++) dibujarTile(p, MAPA[y][x], x, y, t);

  // Bodega de Rosa (0..80, 0..64)
  p.rect("#b9573a", 0, 0, 80, 30);
  for (let i = 0; i < 80; i += 8) p.rect("#9e4a31", i, 0, 1, 30);
  p.rect("#7d3a26", 0, 28, 80, 2);
  p.rect(PAL.crema, 0, 30, 80, 34);
  const ancho = p.ancho(letrero) + 6;
  const lx = Math.round((80 - ancho) / 2);
  p.rect(PAL.verdeOscuro, lx, 31, ancho, 11);
  p.rect(PAL.verde, lx + 1, 32, ancho - 2, 9);
  p.texto(letrero, lx + 3, 33, PAL.crema);
  ventana(p, 6, 46, esNoche);
  ventana(p, 58, 46, esNoche);
  puerta(p, 32, 48);

  // Cabina telefónica (5,2)
  p.rect(PAL.rojoOscuro, 82, 30, 12, 18);
  p.rect(PAL.rojo, 83, 31, 10, 16);
  p.rect(PAL.celeste, 85, 34, 6, 8);
  p.rect(PAL.tinta, 87, 37, 2, 3);

  // Banco Andino (112..192, 0..64)
  p.rect("#1d3d63", 112, 0, 80, 22);
  for (let i = 0; i < 12; i++) p.rect("#24507f", 152 - i * 3, 2 + i * 1.5, i * 6, 2);
  p.rect(PAL.grisClaro, 112, 22, 80, 42);
  for (let c = 0; c < 6; c++) {
    p.rect(PAL.blanco, 115 + c * 13, 34, 6, 28);
    p.rect(PAL.gris, 120 + c * 13, 34, 1, 28);
  }
  p.rect(PAL.navy, 128, 23, 48, 10);
  p.texto("BANCO", 132, 24, PAL.ambar);
  puerta(p, 144, 48, PAL.navy);

  // Pileta de la plaza (centro 80, 128)
  p.circulo(80, 128, 15, "#a9a196");
  p.circulo(80, 128, 13, "#4f8fd1");
  const ola = Math.floor(t / 15) % 2;
  p.rect("#9fd3f5", 72 + ola * 2, 122, 6, 1);
  p.rect("#9fd3f5", 80 - ola * 2, 132, 6, 1);
  p.rect("#a9a196", 78, 118, 4, 10);
  p.rect("#9fd3f5", 79, 112 + ola, 2, 6);
  p.alfa(0.7, () => {
    p.rect("#cdeefe", 76 - ola, 114, 1, 2);
    p.rect("#cdeefe", 83 + ola, 114, 1, 2);
  });

  // Mercado de Don Pepe (0..64, 192..224)
  for (let i = 0; i < 64; i += 8) p.rect(i % 16 === 0 ? PAL.rojo : PAL.blanco, i, 192, 8, 12);
  p.rect(PAL.rojoOscuro, 0, 204, 64, 2);
  p.textoSombra("MERCADO", 4, 194, PAL.blanco, PAL.tinta);
  p.rect(PAL.madera, 0, 206, 64, 18);
  p.rect(PAL.maderaClara, 0, 206, 64, 3);
  const frutas = [PAL.rojo, PAL.ambar, PAL.verde, "#f2d14b", PAL.rojo, PAL.verde];
  for (let i = 0; i < 6; i++) p.circulo(6 + i * 10, 214, 3, frutas[i]);

  // Hotel (112..192, 192..256)
  p.rect(PAL.violeta, 112, 192, 80, 24);
  for (let i = 0; i < 80; i += 8) p.rect("#4c3268", 112 + i, 192, 1, 24);
  p.rect("#e3d4f0", 112, 216, 80, 40);
  p.rect(PAL.violeta, 132, 217, 40, 10);
  p.texto("HOTEL", 132, 218, PAL.crema);
  ventana(p, 116, 232, esNoche);
  ventana(p, 172, 232, esNoche);
  puerta(p, 144, 240, PAL.violeta);
}

function noche(p: Pincel, t: number) {
  p.alfa(0.55, () => p.rect("#0b1640", 0, 0, W, ALTO_MAPA));
  const brillo = 0.18 + Math.sin(t / 20) * 0.03;
  p.alfa(brillo, () => {
    for (const [x, y] of [[14, 52], [66, 52], [88, 40], [124, 238], [180, 238]]) p.circulo(x, y, 12, "#ffd77a");
  });
  for (const [x, y] of [[6, 46], [58, 46], [116, 232], [172, 232]]) {
    p.rect("#ffe08a", x + 1, y + 1, 6, 10);
    p.rect("#ffe08a", x + 8, y + 1, 7, 10);
  }
  // luciérnagas
  for (let i = 0; i < 10; i++) {
    const fx = (i * 47 + Math.sin(t / 40 + i) * 12 + 192) % 192;
    const fy = ((i * 83) % 260) + Math.cos(t / 30 + i * 2) * 8;
    if ((Math.floor(t / 10) + i) % 4 !== 0) p.rect("#e9ff8a", fx, fy, 1, 1);
  }
}
