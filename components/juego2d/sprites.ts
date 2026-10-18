import { PAL, type Colores, type Grilla, type Pincel } from "./pincel";

/**
 * Sprites del juego: arte propio, en grillas de caracteres (un carácter = un
 * píxel, `.` = transparente). Sin personajes, logos ni marcas de terceros.
 */

// ── Personas del barrio (12×16, vista desde arriba) ───────────

const CABEZA_FRENTE = [
  "....hhhh....",
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hssssssh..",
  "..hsessesh..",
  "..hssssssh..",
  "...ssmmss...",
];

const CABEZA_ESPALDA = [
  "....hhhh....",
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hhhhhhhh..",
  "..hhhhhhhh..",
  "..hhhhhhhh..",
  "...hhhhhh...",
];

const CABEZA_LADO = [
  "....hhhh....",
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hhhsssss..",
  "..hhhssess..",
  "..hhhsssss..",
  "...hhsssm...",
];

const CUERPO = [
  "..cccccccc..",
  ".sccccccccs.",
  ".sccccccccs.",
  "..cccccccc..",
  "..pppppppp..",
  "..ppp..ppp..",
];

const PIERNAS = [
  ["..ss....ss..", "..ss....ss..", ".ddd....ddd."],
  ["...ss..ss...", "...ss..ss...", "..ddd..ddd.."],
];

export type Direccion = "abajo" | "arriba" | "izq" | "der";

export function persona(dir: Direccion, paso: 0 | 1): Grilla {
  const cabeza = dir === "abajo" ? CABEZA_FRENTE : dir === "arriba" ? CABEZA_ESPALDA : CABEZA_LADO;
  return [...cabeza, ...CUERPO, ...PIERNAS[paso]];
}

export const PALETAS: Record<string, Colores> = {
  rosa: { h: PAL.pelo, s: PAL.piel, e: PAL.tinta, m: PAL.rojo, c: PAL.verde, p: PAL.navy, d: PAL.maderaOscura },
  atacante: { h: "#2a2d3e", s: PAL.piel, e: PAL.tinta, m: "#7a3b3b", c: "#1d1f2b", p: "#33384d", d: PAL.negro },
  pepe: { h: "#b9b9b9", s: "#b8794c", e: PAL.tinta, m: "#4a2c1a", c: PAL.blanco, p: PAL.madera, d: PAL.maderaOscura },
  vecina: { h: "#6b3f7a", s: "#d6a07a", e: PAL.tinta, m: PAL.rojo, c: PAL.rojo, p: PAL.azul, d: PAL.tinta },
  vigilante: { h: PAL.tinta, s: PAL.piel, e: PAL.tinta, m: PAL.rojoOscuro, c: PAL.azul, p: PAL.navy, d: PAL.negro },
  lucia: { h: "#5a3825", s: "#d6a07a", e: PAL.tinta, m: PAL.rojo, c: "#c84b4b", p: "#33384d", d: PAL.maderaOscura },
  jorge: { h: PAL.pelo, s: "#b8794c", e: PAL.tinta, m: "#7a3b3b", c: PAL.azul, p: "#4a4f63", d: PAL.tinta },
};

// ── Combate ───────────────────────────────────────────────────

export const ESTAFADOR: Grilla = [
  "........kkkkkkk.........",
  ".......kkkkkkkkk........",
  "......kkkkkkkkkkk.......",
  ".....kkkkkkkkkkkkkk.....",
  "......sssssssssss.......",
  "......sggggsggggs.......",
  "......sggggsggggs.......",
  "......sssssssssss.pp....",
  "......sssmmmmmsss.pp....",
  ".......sssssssss..pp....",
  "........sssssss..ssp....",
  ".....jjjjjjjjjjjjjjj....",
  "....jjjjjjjjjjjjjjjj....",
  "...jjjjjjjjjjjjjjjjjj...",
  "...jjjjjjjjzzjjjjjjjj...",
  "...jjjjjjjjzzjjjjjjjj...",
  "...jjjjjjjjzzjjjjjjjj...",
  "...jjj.jjjjzzjjjj.jjj...",
  "...sss.jjjjjjjjjj.sss...",
  ".......jjjjjjjjjj.......",
  ".......nnnnnnnnnn.......",
  ".......nnnn..nnnn.......",
  ".......nnnn..nnnn.......",
  "......dddddd.dddddd.....",
];

export const COLORES_ESTAFADOR: Colores = {
  k: "#3a3f55",
  s: PAL.piel,
  g: PAL.negro,
  m: PAL.blanco,
  p: PAL.tinta,
  j: "#5b2a4e",
  z: PAL.gris,
  n: "#2b2f42",
  d: PAL.negro,
};

export const ROSA_ESPALDA: Grilla = [
  ".........hhhhh..........",
  "........hhhhhhh.........",
  "......hhhhhhhhhhh.......",
  ".....hhhhhhhhhhhhh......",
  ".....hhhhhhhhhhhhh......",
  ".....hhhhhhhhhhhhh......",
  "......hhhhhhhhhhh.......",
  ".......shhhhhhhs........",
  "........sssssss.........",
  ".....bbbaaaaaaabbb......",
  "....bbbbabbbbbabbbb.....",
  "...bbbbbabbbbbabbbbb....",
  "...bbbbbaaaaaaabbbbb....",
  "...bbbbbbbbbbbbbbbbb....",
  "...ssbbbbbbbbbbbbbss....",
  "...ss.kkkkkkkkkkk.ss....",
  "......kkkkkkkkkkk.......",
  "......kkkkkkkkkkk.......",
];

export const COLORES_LUCIA_ESPALDA: Colores = {
  h: "#5a3825",
  s: "#d6a07a",
  b: "#c84b4b",
  a: "#7a2f2f",
  k: "#33384d",
};

export const COLORES_JORGE_ESPALDA: Colores = {
  h: PAL.pelo,
  j: PAL.azul,
  s: "#b8794c",
  n: "#4a4f63",
};

export const COLORES_ROSA_ESPALDA: Colores = {
  h: PAL.pelo,
  s: PAL.piel,
  b: PAL.celeste,
  a: PAL.verde,
  k: PAL.navy,
};

export const ATACANTE_ESPALDA: Grilla = [
  ".......hhhhhhhhhh.......",
  "......hhhhhhhhhhhh......",
  ".....hhhhhhhhhhhhhh.....",
  ".....hhhhhhhhhhhhhh.....",
  ".....hhhhhhhhhhhhhh.....",
  "......hhhhhhhhhhhh......",
  "....jjjjjjjjjjjjjjjj....",
  "...jjjjjjjjjjjjjjjjjj...",
  "...jjjjjjjjjjjjjjjjjj...",
  "...jjjjjjjjjjjjjjjjjj...",
  "...ssjjjjjjjjjjjjjjss...",
  "...ss.jjjjjjjjjjjj.ss...",
  "......nnnnnnnnnnnn......",
  "......nnnnnnnnnnnn......",
];

export const COLORES_ATACANTE_ESPALDA: Colores = {
  h: "#2a2d3e",
  j: "#1d1f2b",
  s: PAL.piel,
  n: "#33384d",
};

export const GUARDIAN: Grilla = [
  "...oooooooooooooooooo...",
  "...offffffffffffffffo...",
  "...offffffffffffffffo...",
  "...offwwffffffffwwffo...",
  "...offffffffffffffffo...",
  "...offfeeffffffeefffo...",
  "...offfeeffffffeefffo...",
  "...offffffffffffffffo...",
  "...offffffmmmmffffffo...",
  "...offffffffffffffffo...",
  "....offffffffffffffo....",
  ".....offffffffffffo.....",
  "......offffffffffo......",
  ".......offffffffo.......",
  "........offffffo........",
  ".........offffo.........",
  "..........oooo..........",
];

export const COLORES_GUARDIAN: Colores = {
  o: PAL.verdeOscuro,
  f: PAL.verde,
  w: PAL.crema,
  e: PAL.tinta,
  m: PAL.tinta,
};

export const ANALISTA: Grilla = [
  "........hhhhhhhh........",
  ".......hhhhhhhhhh.......",
  "......hhhhhhhhhhhh......",
  "......hssssssssssh......",
  "......sggggssggggs......",
  "......sgeegssgeegs......",
  "......sggggssggggs......",
  "......ssssssssssss......",
  ".......sssmmmmsss.......",
  "........ssssssss........",
  ".....wwwwwwwwwwwwww.....",
  "....wwwwwwbbwwwwwwww....",
  "....wwwwwwbbwwwwwwww....",
  "....wwwwwwbbwwwwwwww....",
  "....wwww.tttttt.wwww....",
  "....ssww.tttttt.wwss....",
  "......ww.tttttt.ww......",
  "......wwwwwwwwwwww......",
  ".......nnnnnnnnnn.......",
  ".......nnnn..nnnn.......",
  ".......nnnn..nnnn.......",
  "......ddddd..ddddd......",
];

export const COLORES_ANALISTA: Colores = {
  h: "#4a2f1f",
  s: "#d6a07a",
  g: PAL.tinta,
  e: PAL.celeste,
  m: PAL.rojo,
  w: PAL.blanco,
  b: PAL.azul,
  t: PAL.navy,
  n: PAL.navy,
  d: PAL.tinta,
};

/** Rosa de frente, detrás del mostrador (16×22, se dibuja a escala 2). */
export const ROSA_FRENTE: Grilla = [
  "......hhhh......",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "....hssssssh....",
  "....hsessesh....",
  "....hssssssh....",
  "....hssmmssh....",
  ".....ssssss.....",
  "......ssss......",
  "...bbbaaaabbb...",
  "..bbbbaaaabbbb..",
  "..bbbaaaaaabbb..",
  "..sbbaaaaaabbs..",
  "..s.baaaaaab.s..",
  "....aaaaaaaa....",
  "....aaaaaaaa....",
  "....kkkkkkkk....",
  "....kkkkkkkk....",
];

export const COLORES_ROSA_FRENTE: Colores = {
  h: PAL.pelo,
  s: PAL.piel,
  e: PAL.tinta,
  m: PAL.rojo,
  b: PAL.celeste,
  a: PAL.verde,
  k: PAL.navy,
};

// ── Dibujos procedurales ──────────────────────────────────────

/** Edificio de Banco Andino (ficticio), rival del atacante. 48×44. */
export function banco(p: Pincel, x: number, y: number, simbolo = "S/") {
  p.rect(PAL.navy, x, y + 8, 48, 6);
  for (let i = 0; i < 6; i++) p.rect(PAL.navy, x + 24 - i * 4, y + 8 - i, i * 8, 1);
  p.rect(PAL.grisClaro, x + 2, y + 14, 44, 28);
  for (let c = 0; c < 4; c++) {
    p.rect(PAL.blanco, x + 5 + c * 11, y + 15, 5, 26);
    p.rect(PAL.gris, x + 9 + c * 11, y + 15, 1, 26);
  }
  p.rect(PAL.navy, x, y + 42, 48, 2);
  p.texto(simbolo, x + 24 - simbolo.length * 4, y + 3, PAL.ambar);
}

/** Cara de encuesta (14×14): 0 = tranquilo … 4 = muy frustrado. */
export function cara(p: Pincel, x: number, y: number, nivel: number) {
  const fondo = ["#9ee3a5", "#c9e98a", "#f4e07a", "#f6b25c", "#ef7a6a"][nivel];
  p.circulo(x + 7, y + 7, 7, PAL.tinta);
  p.circulo(x + 7, y + 7, 6, fondo);
  p.rect(PAL.tinta, x + 4, y + 4, 2, 2);
  p.rect(PAL.tinta, x + 8, y + 4, 2, 2);
  if (nivel <= 1) {
    // sonrisa (más ancha si está tranquilo)
    p.rect(PAL.tinta, x + 4, y + 9, 1, 1);
    p.rect(PAL.tinta, x + 9, y + 9, 1, 1);
    p.rect(PAL.tinta, x + 5, y + 10, 4, 1);
    if (nivel === 0) {
      p.rect(PAL.tinta, x + 3, y + 8, 1, 1);
      p.rect(PAL.tinta, x + 10, y + 8, 1, 1);
    }
  } else if (nivel === 2) {
    p.rect(PAL.tinta, x + 4, y + 10, 6, 1);
  } else {
    // ceño
    p.rect(PAL.tinta, x + 5, y + 9, 4, 1);
    p.rect(PAL.tinta, x + 4, y + 10, 1, 1);
    p.rect(PAL.tinta, x + 9, y + 10, 1, 1);
    if (nivel === 4) p.rect(PAL.celeste, x + 11, y + 6, 2, 3);
  }
}

/** Insignia de agente (12×12) con su inicial. */
export function insignia(p: Pincel, x: number, y: number, inicial: string, color: string) {
  p.rect(PAL.tinta, x, y, 12, 12);
  p.rect(color, x + 1, y + 1, 10, 10);
  p.texto(inicial, x + 2, y + 2, PAL.tinta);
}

/** Celular pequeño (9×13) para escenas. */
export function celular(p: Pincel, x: number, y: number, pantalla: string) {
  p.rect(PAL.tinta, x, y, 9, 13);
  p.rect(pantalla, x + 1, y + 1, 7, 10);
}
