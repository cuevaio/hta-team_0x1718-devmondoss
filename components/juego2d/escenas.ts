import type { Motor } from "./motor";
import { H, PAL, W, type Pincel } from "./pincel";
import {
  ANALISTA,
  ATACANTE_ESPALDA,
  COLORES_ANALISTA,
  COLORES_ATACANTE_ESPALDA,
  COLORES_ESTAFADOR,
  COLORES_GUARDIAN,
  COLORES_ROSA_ESPALDA,
  COLORES_ROSA_FRENTE,
  ESTAFADOR,
  GUARDIAN,
  ROSA_ESPALDA,
  ROSA_FRENTE,
  banco,
  celular,
  insignia,
} from "./sprites";

// ── Título ────────────────────────────────────────────────────

export function titulo(p: Pincel, t: number) {
  p.rect("#0b1640", 0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = (i * 53) % W;
    const y = (i * 29) % 90;
    if ((t / 30 + i) % 7 > 1) p.rect(PAL.crema, x, y, 1, 1);
  }
  p.circulo(206, 22, 9, "#f4e7b0");
  p.circulo(210, 19, 8, "#0b1640");
  // silueta del barrio
  const edificios = [
    [0, 96, 34], [34, 84, 26], [60, 100, 30], [90, 78, 40], [130, 92, 28], [158, 70, 34], [192, 88, 48],
  ];
  for (const [x, y, w] of edificios) {
    p.rect("#16234f", x, y, w, H - y);
    for (let wy = y + 6; wy < H - 20; wy += 10) {
      for (let wx = x + 4; wx < x + w - 6; wx += 8) {
        if (((wx * 7 + wy * 3) >> 2) % 3 === 0) p.rect("#ffd77a", wx, wy, 3, 4);
      }
    }
  }
  p.rect("#0a1230", 0, 138, W, 22);
  p.centrado("TE ESTÁN", 30, PAL.ambar, 16, PAL.rojoOscuro);
  p.centrado("ROBANDO", 50, PAL.ambar, 16, PAL.rojoOscuro);
  p.centrado("El barrio no duerme", 76, PAL.celeste);
  if (Math.floor(t / 30) % 2 === 0) p.centrado("PRESIONA A", 116, PAL.crema, 8, PAL.tinta);
  p.centrado("Simulación · datos ficticios", 146, PAL.gris);
}

// ── Laboratorio de la Analista Vega ───────────────────────────

export function laboratorio(p: Pincel, t: number) {
  p.rect("#e9e4d8", 0, 0, W, 76);
  for (let x = 0; x < W; x += 20) p.rect("#ddd6c6", x, 0, 1, 76);
  p.rect("#c9bfa9", 0, 76, W, 2);
  for (let y = 78; y < H; y += 16) for (let x = 0; x < W; x += 16) p.rect(((x + y) / 16) % 2 ? "#b9c7d6" : "#c7d3df", x, y, 16, 16);
  // pantallas del monitor de agentes
  for (const x of [14, 182]) {
    p.rect(PAL.tinta, x, 14, 44, 32);
    p.rect(PAL.navy, x + 2, 16, 40, 28);
    for (let i = 0; i < 4; i++) p.rect(i === Math.floor(t / 20) % 4 ? PAL.ambar : PAL.verde, x + 6 + i * 9, 34, 6, 6);
    p.rect(PAL.celeste, x + 6, 20, 30, 2);
    p.rect(PAL.celeste, x + 6, 25, 20, 2);
    p.rect(PAL.gris, x + 20, 46, 4, 8);
  }
  p.alfa(0.25, () => p.elipse(120, 102, 22, 4, PAL.negro));
  p.sprite(ANALISTA, COLORES_ANALISTA, 96, 58 - (Math.floor(t / 40) % 2), 2);
}

// ── Bodega de Rosa (interior) ─────────────────────────────────

export type EstadoBodega = {
  telefono: "normal" | "llamada" | "perdio" | "protegido";
  cliente: boolean;
};

const PRODUCTOS = [PAL.rojo, PAL.ambar, PAL.azul, PAL.verde, PAL.crema, PAL.celeste];

function estante(p: Pincel, x: number, y: number, w: number, semilla: number) {
  p.rect(PAL.maderaOscura, x, y, w, 50);
  p.rect(PAL.madera, x + 2, y + 2, w - 4, 46);
  for (let nivel = 0; nivel < 3; nivel++) {
    const base = y + 16 + nivel * 15;
    p.rect(PAL.maderaClara, x + 2, base, w - 4, 2);
    for (let i = 0; i * 7 + 5 < w - 4; i++) {
      const alto = 6 + ((i * 7 + nivel * 3 + semilla) % 5);
      p.rect(PRODUCTOS[(i + nivel + semilla) % PRODUCTOS.length], x + 5 + i * 7, base - alto, 5, alto);
      p.rect("rgba(255,255,255,0.35)", x + 5 + i * 7, base - alto, 1, alto);
    }
  }
}

export function bodega(estado: EstadoBodega): (p: Pincel, t: number) => void {
  return (p, t) => {
    p.rect("#ead9b8", 0, 0, W, 80);
    for (let x = 0; x < W; x += 20) p.rect("#d8c29c", x, 0, 1, 80);
    p.rect(PAL.verdeOscuro, 80, 4, 80, 14);
    p.rect(PAL.verde, 81, 5, 78, 12);
    p.texto("BODEGA ROSA", 76 + 6, 8, PAL.crema);
    estante(p, 6, 24, 66, 0);
    estante(p, 168, 24, 66, 3);
    for (let y = 80; y < H; y += 16) for (let x = 0; x < W; x += 16) p.rect(((x + y) / 16) % 2 ? "#e8c79f" : "#ddb68a", x, y, 16, 16);

    const nerviosa = estado.telefono === "llamada" ? Math.floor(t / 6) % 2 : 0;
    p.sprite(ROSA_FRENTE, COLORES_ROSA_FRENTE, 104 + nerviosa, 52 - (Math.floor(t / 40) % 2), 2);
    if (estado.telefono === "llamada" && Math.floor(t / 20) % 3 !== 0) p.rect(PAL.celeste, 132, 60, 2, 4);

    // mostrador
    p.rect(PAL.maderaOscura, 60, 90, 120, 30);
    p.rect(PAL.madera, 62, 94, 116, 24);
    p.rect(PAL.maderaClara, 60, 88, 120, 4);
    for (let x = 70; x < 176; x += 14) p.rect(PAL.maderaOscura, x, 96, 1, 20);
    // caja registradora
    p.rect(PAL.gris, 150, 74, 20, 14);
    p.rect(PAL.navy, 152, 76, 16, 6);
    p.rect(PAL.verde, 154, 77, 5, 3);

    const vibra = estado.telefono === "llamada" ? (Math.floor(t / 3) % 2) * 2 - 1 : 0;
    const pantalla =
      estado.telefono === "llamada"
        ? Math.floor(t / 10) % 2
          ? PAL.ambar
          : PAL.crema
        : estado.telefono === "perdio"
          ? PAL.rojo
          : estado.telefono === "protegido"
            ? PAL.verde
            : PAL.celeste;
    celular(p, 76 + vibra, 75, pantalla);
    if (estado.telefono === "llamada") {
      const onda = Math.floor(t / 8) % 3;
      for (let k = 0; k <= onda; k++) {
        p.rect(PAL.ambar, 72 - k * 3, 77 + k, 1, 8 - k * 2);
        p.rect(PAL.ambar, 88 + k * 3, 77 + k, 1, 8 - k * 2);
      }
    }
    if (estado.telefono === "protegido") {
      p.rect(PAL.verdeOscuro, 78, 64, 5, 1);
      p.rect(PAL.verdeOscuro, 78, 64, 1, 4);
      p.rect(PAL.verdeOscuro, 82, 64, 1, 4);
      p.rect(PAL.verdeOscuro, 76, 68, 9, 6);
    }
    if (estado.cliente) {
      const paso = Math.floor(t / 30) % 2;
      p.rect(PAL.rojo, 196, 100 + paso, 16, 6);
      p.rect(PAL.piel, 198, 106 + paso, 12, 10);
      p.rect(PAL.ambar, 194, 116 + paso, 20, 18);
      p.rect(PAL.azul, 196, 134 + paso, 16, 14);
    }
  };
}

// ── Combate ───────────────────────────────────────────────────

export type EstadoBatalla = {
  fondo: "bodega" | "sistema";
  rival: "estafador" | "banco";
  rivalNombre: string;
  rivalEtiqueta: string;
  rivalBarra: number;
  rivalColor: string;
  /** 0 = oculto, 1 = presente. */
  rivalVisible: number;
  agentes: Array<{ inicial: string; color: string }>;
  aliado: "rosa" | "atacante" | "guardian";
  /** Desplazamiento horizontal para animar la entrada/salida. */
  aliadoX: number;
  aliadoNombre: string;
  aliadoEtiqueta: string;
  aliadoLinea: string;
  aliadoColor: string;
  /** Tiempo del estafador en frames; mientras hay menú se lee del motor. */
  tiempoTotal: number;
  tiempoRestante: number;
  congelado: boolean;
  destello: number;
};

export function nuevaBatalla(parcial: Partial<EstadoBatalla>): EstadoBatalla {
  return {
    fondo: "bodega",
    rival: "estafador",
    rivalNombre: "ESTAFADOR",
    rivalEtiqueta: "PRESIÓN",
    rivalBarra: 0.15,
    rivalColor: PAL.rojo,
    rivalVisible: 1,
    agentes: [],
    aliado: "rosa",
    aliadoX: 0,
    aliadoNombre: "ROSA",
    aliadoEtiqueta: "TIEMPO",
    aliadoLinea: "S/ 4,800",
    aliadoColor: PAL.verde,
    tiempoTotal: 0,
    tiempoRestante: 0,
    congelado: false,
    destello: 0,
    ...parcial,
  };
}

export function batalla(b: EstadoBatalla, m: Motor): (p: Pincel, t: number) => void {
  return (p, t) => {
    if (b.fondo === "bodega") {
      p.rect("#ead9b8", 0, 0, W, 64);
      estante(p, 4, 6, 60, 1);
      estante(p, 176, 6, 60, 4);
      p.rect("#d9b98e", 0, 64, W, 44);
      p.rect("#cfae82", 0, 64, W, 2);
    } else {
      p.rect("#0e1a3a", 0, 0, W, 108);
      for (let x = 0; x < W; x += 16) p.rect("#16285a", x, 0, 1, 108);
      for (let y = 4; y < 108; y += 16) p.rect("#16285a", 0, y, W, 1);
      const scan = (t * 2) % 108;
      p.alfa(0.2, () => p.rect(PAL.celeste, 0, scan, W, 2));
    }

    // Rival
    const plataforma = b.fondo === "bodega" ? "#c49e70" : "#24406c";
    p.elipse(178, 66, 36, 7, plataforma);
    if (b.rivalVisible > 0) {
      p.alfa(b.rivalVisible, () => {
        if (b.rival === "estafador") p.sprite(ESTAFADOR, COLORES_ESTAFADOR, 154, 18 + (Math.floor(t / 30) % 2), 2);
        else banco(p, 154, 22);
      });
    }

    p.caja(4, 6, 116, 30);
    p.texto(b.rivalNombre, 12, 12, PAL.tinta);
    p.texto(b.rivalEtiqueta, 12, 23, PAL.ambar);
    p.barra(12 + b.rivalEtiqueta.length * 8 + 4, 24, 104 - b.rivalEtiqueta.length * 8 - 4, b.rivalBarra, b.rivalColor);
    b.agentes.forEach((a, i) => insignia(p, 6 + i * 14, 40, a.inicial, a.color));

    // Aliado
    p.elipse(66, 104, 42, 8, plataforma);
    const ax = 42 + b.aliadoX;
    if (b.aliado === "rosa") p.sprite(ROSA_ESPALDA, COLORES_ROSA_ESPALDA, ax, 68, 2);
    else if (b.aliado === "atacante") p.sprite(ATACANTE_ESPALDA, COLORES_ATACANTE_ESPALDA, ax, 76, 2);
    else p.sprite(GUARDIAN, COLORES_GUARDIAN, ax, 66 + (Math.floor(t / 20) % 2), 2);

    p.caja(122, 62, 116, 44);
    p.texto(b.aliadoNombre, 130, 68, PAL.tinta);
    const restante = m.framesRestantesMenu ?? b.tiempoRestante;
    if (b.tiempoTotal > 0) {
      const etiqueta = b.congelado ? "CONGELADO" : b.aliadoEtiqueta;
      p.texto(etiqueta, 130, 78, b.congelado ? PAL.azul : PAL.ambar);
      const valor = b.congelado ? b.tiempoRestante / b.tiempoTotal : restante / b.tiempoTotal;
      const seg = Math.ceil((b.congelado ? b.tiempoRestante : restante) / 60);
      if (!b.congelado) p.texto(`${seg}s`, 206, 78, seg <= 10 ? PAL.rojo : PAL.tinta);
      p.barra(130, 87, 100, valor, b.congelado ? PAL.celeste : valor < 0.25 ? PAL.rojo : b.aliadoColor);
    } else {
      p.texto(b.aliadoEtiqueta, 130, 79, PAL.ambar);
    }
    if (b.aliadoLinea) p.texto(b.aliadoLinea, 130, b.tiempoTotal > 0 ? 94 : 91, PAL.tinta);

    // Caja inferior siempre presente
    p.caja(2, 108, 236, 50);

    if (b.destello > 0) {
      b.destello--;
      if (b.destello % 4 < 2) p.alfa(0.6, () => p.rect(PAL.blanco, 0, 0, W, 108));
    }
  };
}
