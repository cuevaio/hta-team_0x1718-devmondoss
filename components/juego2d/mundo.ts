import { PAL, type Pincel } from "./pincel";
import { PALETAS, persona, type Direccion } from "./sprites";

/**
 * El barrio (docs/Te_Estan_Robando/docs/06): un mapa de 15×10 tiles de 16 px
 * que cabe en una pantalla. Bodega de Rosa, Banco Andino (ficticio), hotel,
 * cabina telefónica, mercado de Don Pepe y la plaza.
 */

export const TILE = 16;

const MAPA = [
  "BBBBB.KKKK.HHHH",
  "BBBBB.KKKK.HHHH",
  "BBBBBPKKKK.HHHH",
  "BBbBB.KkKK.HHhH",
  "===============",
  "===============",
  "MMMM.,,,,,.TfTf",
  "MMMM.,ww,,..f..",
  "....,,ww,,.....",
  "TT..,,,,,,...TT",
];

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

export type Evento =
  | { tipo: "objetivo"; id: string }
  | { tipo: "hablar"; lineas: string[] };

export type ConfigMundo = {
  jugador: keyof typeof PALETAS;
  inicio: { x: number; y: number; dir: Direccion };
  noche: boolean;
  objetivo: string;
  npcs: Npc[];
  /** Lo que se dice al tocar una puerta que no es el objetivo. */
  puertas: Record<string, string[]>;
};

const DELTA: Record<Direccion, [number, number]> = {
  arriba: [0, -1],
  abajo: [0, 1],
  izq: [-1, 0],
  der: [1, 0],
};

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
  private bloqueado: string | null = null;

  constructor(readonly cfg: ConfigMundo) {
    this.x = cfg.inicio.x;
    this.y = cfg.inicio.y;
    this.dir = cfg.inicio.dir;
  }

  get quieto() {
    return this.resto === 0;
  }

  /** Avanza la animación de un paso. */
  actualizar() {
    if (this.resto > 0) {
      this.resto -= 2;
      if (this.resto === 8) this.paso = this.paso === 0 ? 1 : 0;
    }
  }

  soltar() {
    this.bloqueado = null;
  }

  /** Intenta caminar. Devuelve un evento si chocó con una puerta o un NPC. */
  mover(dir: Direccion): Evento | null {
    if (this.resto > 0) return null;
    this.dir = dir;
    const [dx, dy] = DELTA[dir];
    const nx = this.x + dx;
    const ny = this.y + dy;
    const clave = `${nx},${ny}`;
    const npc = this.cfg.npcs.find((n) => n.x === nx && n.y === ny);
    const tile = tileEn(nx, ny);
    if (npc || SOLIDOS.has(tile)) {
      // Una puerta se activa al caminar hacia ella (una vez por choque).
      if (!npc && PUERTAS[tile] && this.bloqueado !== clave) {
        this.bloqueado = clave;
        return this.tocar(PUERTAS[tile]);
      }
      return null;
    }
    this.bloqueado = null;
    this.x = nx;
    this.y = ny;
    this.resto = TILE;
    return null;
  }

  /** Botón A: hablar o entrar a lo que está enfrente. */
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

  dibujar(p: Pincel, t: number) {
    dibujarMapa(p, t, this.cfg.noche);

    const [dx, dy] = DELTA[this.dir];
    const ox = -dx * this.resto;
    const oy = -dy * this.resto;
    const figuras = [
      ...this.cfg.npcs.map((n) => ({ y: n.y * TILE, dibujar: () => figura(p, n.x * TILE, n.y * TILE, n.dir, 0, n.paleta) })),
      {
        y: this.y * TILE + oy,
        dibujar: () => figura(p, this.x * TILE + ox, this.y * TILE + oy, this.dir, this.resto > 0 ? this.paso : 0, this.cfg.jugador),
      },
    ].sort((a, b) => a.y - b.y);
    for (const f of figuras) f.dibujar();

    if (this.cfg.noche) noche(p, t);

    const obj = posicionObjetivo(this.cfg.objetivo, this.cfg.npcs);
    if (obj) {
      const rebote = Math.round(Math.sin(t / 8) * 2);
      p.flechaAbajo(obj.x * TILE + 4, obj.y * TILE - 9 + rebote, PAL.ambar);
      p.flechaAbajo(obj.x * TILE + 4, obj.y * TILE - 10 + rebote, PAL.rojo);
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
  for (let i = 0; i < 4; i++) {
    const px = (h >> (i * 4)) % 14;
    const py = (h >> (i * 4 + 2)) % 14;
    p.rect("#5aa64f", x + px, y + py, 1, 2);
  }
}

function dibujarTile(p: Pincel, ch: string, x: number, y: number, t: number) {
  const X = x * TILE;
  const Y = y * TILE;
  switch (ch) {
    case "=": {
      p.rect("#e3d2a4", X, Y, TILE, TILE);
      const h = hash(x, y);
      p.rect("#cdb987", X + (h % 13), Y + ((h >> 3) % 13), 2, 1);
      p.rect("#cdb987", X + ((h >> 5) % 13), Y + ((h >> 8) % 13), 1, 1);
      if (y === 4) p.rect("#cdb987", X, Y, TILE, 1);
      break;
    }
    case ",":
      p.rect("#d9d2c6", X, Y, TILE, TILE);
      p.rect("#c4bcae", X, Y + 7, TILE, 1);
      p.rect("#c4bcae", X + ((y % 2) * 8 + 7) % 16, Y, 1, 7);
      p.rect("#c4bcae", X + ((y % 2) * 8 + 3) % 16, Y + 8, 1, 8);
      break;
    case "f":
      pasto(p, X, Y);
      p.rect(PAL.rojo, X + 3, Y + 4, 2, 2);
      p.rect(PAL.ambar, X + 10, Y + 9, 2, 2);
      p.rect(PAL.blanco, X + 6, Y + 11, 2, 2);
      break;
    case "T":
      pasto(p, X, Y);
      p.rect(PAL.maderaOscura, X + 6, Y + 10, 4, 6);
      p.circulo(X + 8, Y + 7, 7, "#2f7a3a");
      p.circulo(X + 7, Y + 6, 5, "#47a052");
      p.rect("#6cc06e", X + 5, Y + 3, 2, 2);
      break;
    case "w":
    case "M":
    case "B":
    case "K":
    case "H":
    case "b":
    case "k":
    case "h":
    case "P":
      // los bloques grandes se dibujan aparte
      pasto(p, X, Y);
      break;
    default:
      pasto(p, X, Y);
  }
  void t;
}

function dibujarMapa(p: Pincel, t: number, esNoche: boolean) {
  for (let y = 0; y < MAPA.length; y++) for (let x = 0; x < MAPA[y].length; x++) dibujarTile(p, MAPA[y][x], x, y, t);

  // Bodega de Rosa
  p.rect("#b9573a", 0, 0, 80, 30);
  for (let i = 0; i < 80; i += 8) p.rect("#9e4a31", i, 0, 1, 30);
  p.rect("#7d3a26", 0, 28, 80, 2);
  p.rect(PAL.crema, 0, 30, 80, 34);
  p.rect(PAL.verdeOscuro, 14, 31, 52, 11);
  p.rect(PAL.verde, 15, 32, 50, 9);
  p.texto("BODEGA", 16, 33, PAL.crema);
  ventana(p, 6, 46, esNoche);
  ventana(p, 58, 46, esNoche);
  puerta(p, 32, 48);

  // Cabina telefónica
  p.rect(PAL.rojoOscuro, 82, 30, 12, 18);
  p.rect(PAL.rojo, 83, 31, 10, 16);
  p.rect(PAL.celeste, 85, 34, 6, 8);
  p.rect(PAL.tinta, 87, 37, 2, 3);

  // Banco Andino (ficticio)
  p.rect("#1d3d63", 96, 0, 64, 22);
  for (let i = 0; i < 10; i++) p.rect("#24507f", 128 - i * 3, 2 + i * 2, i * 6, 2);
  p.rect(PAL.grisClaro, 96, 22, 64, 42);
  for (let c = 0; c < 5; c++) {
    p.rect(PAL.blanco, 99 + c * 12, 30, 6, 30);
    p.rect(PAL.gris, 104 + c * 12, 30, 1, 30);
  }
  p.rect(PAL.navy, 104, 23, 48, 10);
  p.texto("BANCO", 108, 24, PAL.ambar);
  puerta(p, 112, 48, PAL.navy);

  // Hotel
  p.rect("#5d3f7d", 176, 0, 64, 24);
  for (let i = 0; i < 64; i += 8) p.rect("#4c3268", 176 + i, 0, 1, 24);
  p.rect("#e3d4f0", 176, 24, 64, 40);
  p.rect("#5d3f7d", 188, 25, 40, 10);
  p.texto("HOTEL", 188, 26, PAL.crema);
  ventana(p, 180, 40, esNoche);
  ventana(p, 228, 40, esNoche);
  puerta(p, 208, 48, "#5d3f7d");

  // Mercado de Don Pepe
  for (let i = 0; i < 64; i += 8) p.rect(i % 16 === 0 ? PAL.rojo : PAL.blanco, i, 96, 8, 12);
  p.rect(PAL.rojoOscuro, 0, 108, 64, 2);
  p.textoSombra("MERCADO", 4, 98, PAL.blanco, PAL.tinta);
  p.rect(PAL.madera, 0, 110, 64, 18);
  p.rect(PAL.maderaClara, 0, 110, 64, 3);
  const frutas = [PAL.rojo, PAL.ambar, PAL.verde, "#f2d14b", PAL.rojo, PAL.verde];
  for (let i = 0; i < 6; i++) p.circulo(6 + i * 10, 117, 3, frutas[i]);

  // Pileta de la plaza
  p.circulo(112, 128, 15, "#a9a196");
  p.circulo(112, 128, 13, "#4f8fd1");
  const ola = Math.floor(t / 15) % 2;
  p.rect("#9fd3f5", 104 + ola * 2, 122, 6, 1);
  p.rect("#9fd3f5", 112 - ola * 2, 132, 6, 1);
  p.rect("#a9a196", 110, 118, 4, 10);
  p.rect("#9fd3f5", 111, 114 + ola, 2, 4);
}

function ventana(p: Pincel, x: number, y: number, esNoche: boolean) {
  p.rect(PAL.tinta, x, y, 16, 12);
  p.rect(esNoche ? "#ffe08a" : PAL.celeste, x + 1, y + 1, 14, 10);
  p.rect(PAL.tinta, x + 7, y + 1, 1, 10);
}

function puerta(p: Pincel, x: number, y: number, color: string = PAL.maderaOscura) {
  p.rect(PAL.tinta, x, y, 16, 16);
  p.rect(color, x + 1, y + 1, 14, 15);
  p.rect(PAL.ambar, x + 11, y + 9, 2, 2);
}

function noche(p: Pincel, t: number) {
  p.alfa(0.55, () => p.rect("#0b1640", 0, 0, 240, 160));
  // luces de ventanas y faroles
  const brillo = 0.18 + Math.sin(t / 20) * 0.03;
  p.alfa(brillo, () => {
    for (const [x, y] of [
      [14, 52],
      [66, 52],
      [188, 46],
      [236, 46],
      [88, 40],
    ]) p.circulo(x, y, 12, "#ffd77a");
  });
  for (const [x, y] of [
    [6, 46],
    [58, 46],
    [180, 40],
    [228, 40],
  ]) {
    p.rect("#ffe08a", x + 1, y + 1, 6, 10);
    p.rect("#ffe08a", x + 8, y + 1, 7, 10);
  }
}
