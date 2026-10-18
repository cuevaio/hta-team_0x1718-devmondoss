import type { Motor } from "./motor";
import { PAL, W, facil, type Pincel } from "./pincel";
import {
  ANALISTA,
  ATACANTE_ESPALDA,
  COLORES_ANALISTA,
  COLORES_ATACANTE_ESPALDA,
  COLORES_ESTAFADOR,
  COLORES_GUARDIAN,
  COLORES_JORGE_ESPALDA,
  COLORES_LUCIA_ESPALDA,
  COLORES_ROSA_ESPALDA,
  COLORES_ROSA_FRENTE,
  ESTAFADOR,
  GUARDIAN,
  PALETAS,
  ROSA_ESPALDA,
  ROSA_FRENTE,
  banco,
  celular,
  insignia,
  persona,
} from "./sprites";

type Escena = (p: Pincel, t: number) => void;

// ── Título ────────────────────────────────────────────────────

function ciudad(p: Pincel, base: number, desplaz: number, color: string, ventanas: boolean, semilla: number) {
  const anchoBloque = 260;
  for (let rep = -1; rep < 2; rep++) {
    const inicio = rep * anchoBloque - (desplaz % anchoBloque);
    let x = inicio;
    let i = semilla;
    while (x < inicio + anchoBloque) {
      const w = 22 + ((i * 37) % 26);
      const alto = 40 + ((i * 53) % 60);
      p.rect(color, x, base - alto, w, alto);
      if (ventanas) {
        for (let wy = base - alto + 6; wy < base - 8; wy += 9) {
          for (let wx = x + 4; wx < x + w - 5; wx += 7) if ((Math.floor(wx * 7 + wy * 3 + i) >> 2) % 3 === 0) p.rect("#ffd77a", wx, wy, 3, 4);
        }
      }
      x += w + 2;
      i++;
    }
  }
}

export function titulo(inicio: number): Escena {
  return (p, t) => {
    const f = t - inicio;
    const h = p.h;
    p.degradado(0, h, "#070d2b", "#2b3a85");
    for (let i = 0; i < 60; i++) {
      const x = (i * 53) % W;
      const y = (i * 29) % Math.round(h * 0.55);
      if ((Math.floor(f / 25) + i) % 6 > 0) p.rect(i % 7 === 0 ? PAL.ambar : PAL.crema, x, y, 1, 1);
    }
    p.circulo(160, 92, 10, "#f4e7b0");
    p.circulo(165, 88, 9, "#101a48");

    const calle = h - 56;
    ciudad(p, calle, f * 0.15, "#1a2a66", false, 3);
    ciudad(p, calle, f * 0.35, "#121d4a", true, 7);
    p.rect("#2a2f45", 0, calle, W, 56);
    p.rect("#3a4060", 0, calle, W, 3);
    for (let x = -((f * 0.6) % 32); x < W; x += 32) p.rect("#c9b56a", x, calle + 26, 14, 2);
    for (let x = 20 - ((f * 0.6) % 96); x < W; x += 96) {
      p.rect(PAL.gris, x, calle - 34, 2, 34);
      p.rect("#ffe08a", x - 2, calle - 38, 6, 4);
      p.alfa(0.15, () => p.circulo(x + 1, calle - 30, 14, "#ffe08a"));
    }

    // Rosa camina... y alguien la sigue
    const paso = (Math.floor(f / 8) % 2) as 0 | 1;
    const rx = ((f * 0.5) % (W + 80)) - 30;
    p.sprite(persona("der", paso), PALETAS.rosa, rx, calle + 6, 2);
    p.alfa(0.85, () => p.sprite(persona("der", paso === 0 ? 1 : 0), PALETAS.atacante, rx - 46, calle + 6, 2));

    // Logo con rebote
    const k = Math.min(1, f / 45);
    const ly = 26 + Math.round((1 - facil.rebote(k)) * -120);
    p.centrado("TE ESTAN", ly, PAL.ambar, 16, PAL.rojoOscuro);
    p.centrado("ROBANDO", ly + 22, PAL.ambar, 16, PAL.rojoOscuro);
    if (k >= 1 && f % 90 < 20) {
      const brillo = Math.round(((f % 90) / 20) * 140) + 26;
      p.alfa(0.6, () => p.rect(PAL.blanco, brillo, ly, 3, 38));
    }
    if (f > 50) p.alfa(Math.min(1, (f - 50) / 20), () => p.centrado("El barrio no duerme", ly + 48, PAL.celeste));

    // Un celular gigante que suena
    const cy = Math.round(26 + 70 + (calle - 34 - 96) / 2) - 40;
    if (f > 30) {
      const ap = facil.salida(Math.min(1, (f - 30) / 25));
      const vibra = Math.floor(f / 3) % 2 ? 1 : -1;
      p.alfa(ap, () => {
        p.escalado(96, cy + 40, 0.6 + ap * 0.4, () => {
          p.rect(PAL.tinta, 72 + vibra, cy, 48, 80);
          p.rect("#2b3a55", 74 + vibra, cy + 2, 44, 76);
          p.rect(Math.floor(f / 12) % 2 ? PAL.ambar : PAL.crema, 76 + vibra, cy + 8, 40, 56);
          p.rect(PAL.tinta, 90 + vibra, cy + 70, 12, 3);
          p.centrado("?", cy + 22, PAL.tinta, 16, undefined, 72 + vibra, 48);
          p.centrado("BANCO", cy + 44, PAL.tinta, 8, undefined, 72 + vibra, 48);
          const onda = Math.floor(f / 8) % 3;
          for (let i = 0; i <= onda; i++) {
            p.rect(PAL.ambar, 64 - i * 6, cy + 24 + i * 3, 2, 30 - i * 6);
            p.rect(PAL.ambar, 126 + i * 6, cy + 24 + i * 3, 2, 30 - i * 6);
          }
        });
      });
    }
    if (f > 70) {
      const pulso = 1 + Math.sin(f / 8) * 0.04;
      p.escalado(96, cy + 103, pulso, () => p.boton({ x: 26, y: cy + 92, w: 140, h: 22 }, "TOCA PARA EMPEZAR", { activo: true }));
    }
    p.centrado("Datos 100% ficticios", h - 12, PAL.gris);
  };
}

// ── Tarjeta de capítulo ───────────────────────────────────────

export function capitulo(inicio: number, etiqueta: string, titulo1: string, sub: string, color: string): Escena {
  return (p, t) => {
    const f = t - inicio;
    const h = p.h;
    p.rect(PAL.navy, 0, 0, W, h);
    for (let i = -h; i < W; i += 24) {
      const x = i + ((f * 1.5) % 24);
      for (let y = 0; y < h; y += 4) p.rect("#14304f", x + y, y, 10, 4);
    }
    const k = facil.salida(Math.min(1, f / 18));
    const cx = Math.round((1 - k) * -W);
    const cy = Math.round(h * 0.34);
    p.alfa(0.4, () => p.rect(PAL.negro, cx + 3, cy + 4, W, 88));
    p.rect(PAL.tinta, cx, cy, W, 88);
    p.rect(color, cx, cy + 2, W, 84);
    p.rect("rgba(255,255,255,0.25)", cx, cy + 4, W, 2);
    p.texto(etiqueta, cx + 12, cy + 12, PAL.tinta);
    p.textoSombra(titulo1, cx + 12, cy + 30, PAL.blanco, PAL.tinta, 16);
    sub.split("\n").forEach((l, i) => p.texto(l, cx + 12, cy + 56 + i * 12, PAL.tinta));
    if (f > 40 && Math.floor(f / 25) % 2 === 0) p.centrado("toca para seguir", cy + 110, PAL.celeste);
  };
}

// ── Laboratorio de la Analista Vega ───────────────────────────

export function laboratorio(p: Pincel, t: number) {
  const h = p.h;
  const piso = Math.round(h * 0.42);
  p.rect("#e9e4d8", 0, 0, W, piso);
  for (let x = 0; x < W; x += 20) p.rect("#ddd6c6", x, 0, 1, piso);
  p.rect("#c9bfa9", 0, piso, W, 2);
  for (let y = piso + 2; y < h; y += 16) for (let x = 0; x < W; x += 16) p.rect(((x + y) / 16) % 2 ? "#b9c7d6" : "#c7d3df", x, y, 16, 16);
  for (const x of [10, 138]) {
    p.rect(PAL.tinta, x, 28, 44, 32);
    p.rect(PAL.navy, x + 2, 30, 40, 28);
    for (let i = 0; i < 4; i++) p.rect(i === Math.floor(t / 20) % 4 ? PAL.ambar : PAL.verde, x + 6 + i * 9, 48, 6, 6);
    p.rect(PAL.celeste, x + 6, 34, 30, 2);
    p.rect(PAL.celeste, x + 6, 39, 20 + (Math.floor(t / 15) % 10), 2);
    p.rect(PAL.gris, x + 20, 60, 4, 8);
  }
  const vx = 60;
  const vy = piso - 58 - (Math.floor(t / 40) % 2);
  p.alfa(0.25, () => p.elipse(96, piso + 8, 30, 5, PAL.negro));
  p.sprite(ANALISTA, COLORES_ANALISTA, vx, vy, 3);
  if (t % 180 < 8) p.rect("#d6a07a", vx + 21, vy + 15, 30, 3); // parpadeo
}

// ── Bodega de Rosa (interior) ─────────────────────────────────

/** `cliente`: 0 = no hay, 0..1 = entrando, 1 = pidiendo su vuelto. */
export type EstadoBodega = {
  telefono: "normal" | "llamada" | "perdio" | "protegido";
  cliente: number;
  /** Texto del cliente (por defecto, «¡Mi vuelto!»). */
  pedido?: string;
  /** Captura de pago que muestra el cliente (ruta «el comprobante»). */
  captura?: { monto: string; billetera: string; k: number };
  /** Nombre en el letrero. */
  letrero?: string;
};

const PRODUCTOS = [PAL.rojo, PAL.ambar, PAL.azul, PAL.verde, PAL.crema, PAL.celeste];

function estante(p: Pincel, x: number, y: number, w: number, alto: number, semilla: number) {
  p.rect(PAL.maderaOscura, x, y, w, alto);
  p.rect(PAL.madera, x + 2, y + 2, w - 4, alto - 4);
  for (let nivel = 0; nivel * 15 + 16 < alto; nivel++) {
    const base = y + 16 + nivel * 15;
    p.rect(PAL.maderaClara, x + 2, base, w - 4, 2);
    for (let i = 0; i * 7 + 5 < w - 4; i++) {
      const a = 6 + ((i * 7 + nivel * 3 + semilla) % 5);
      p.rect(PRODUCTOS[(i + nivel + semilla) % PRODUCTOS.length], x + 5 + i * 7, base - a, 5, a);
      p.rect("rgba(255,255,255,0.35)", x + 5 + i * 7, base - a, 1, a);
    }
  }
}

export function bodega(estado: EstadoBodega): Escena {
  return (p, t) => {
    const h = p.h;
    const pared = Math.round(h * 0.44);
    const mostrador = pared - 22;
    p.rect("#ead9b8", 0, 0, W, pared);
    for (let x = 0; x < W; x += 20) p.rect("#d8c29c", x, 0, 1, pared);
    p.rect(PAL.verdeOscuro, 46, 24, 100, 14);
    p.rect(PAL.verde, 47, 25, 98, 12);
    p.centrado(estado.letrero ?? "BODEGA ROSA", 28, PAL.crema);
    estante(p, 4, 44, 50, mostrador - 44, 0);
    estante(p, 138, 44, 50, mostrador - 44, 3);
    for (let y = pared; y < h; y += 16) for (let x = 0; x < W; x += 16) p.rect(((x + y) / 16) % 2 ? "#e8c79f" : "#ddb68a", x, y, 16, 16);

    // Rosa, grande, detrás del mostrador
    const nerviosa = estado.telefono === "llamada" ? Math.floor(t / 6) % 2 : 0;
    p.sprite(ROSA_FRENTE, COLORES_ROSA_FRENTE, 64 + nerviosa, mostrador - 58 - (Math.floor(t / 40) % 2), 4);
    if (estado.telefono === "llamada" && Math.floor(t / 20) % 3 !== 0) p.rect(PAL.celeste, 124, mostrador - 48, 3, 6);

    // mostrador
    p.rect(PAL.maderaOscura, 20, mostrador, 152, 36);
    p.rect(PAL.madera, 22, mostrador + 4, 148, 30);
    p.rect(PAL.maderaClara, 20, mostrador - 2, 152, 4);
    for (let x = 32; x < 168; x += 14) p.rect(PAL.maderaOscura, x, mostrador + 6, 1, 26);
    p.rect(PAL.gris, 134, mostrador - 18, 24, 16);
    p.rect(PAL.navy, 136, mostrador - 16, 20, 7);
    p.rect(PAL.verde, 138, mostrador - 15, 6, 3);

    // Mercadería en el piso
    for (let i = 0; i < 3; i++) {
      p.rect("#c9b48a", 10 + i * 16, h - 112 + (i % 2) * 6, 14, 18);
      p.rect("#e9dcb8", 12 + i * 16, h - 108 + (i % 2) * 6, 10, 4);
    }
    p.rect(PAL.maderaClara, 150, h - 120, 30, 22);
    p.rect(PAL.madera, 150, h - 120, 30, 3);
    p.rect(PAL.maderaClara, 156, h - 138, 22, 18);
    p.rect(PAL.madera, 156, h - 138, 22, 3);

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
    const cx = 40;
    const cyTel = mostrador - 26;
    p.escalado(cx + 4, cyTel + 6, 2, () => celular(p, cx + vibra / 2, cyTel, pantalla));
    if (estado.telefono === "llamada") {
      const onda = Math.floor(t / 8) % 3;
      for (let k = 0; k <= onda; k++) {
        p.rect(PAL.ambar, cx - 10 - k * 4, cyTel - 4 + k * 2, 2, 14 - k * 4);
        p.rect(PAL.ambar, cx + 18 + k * 4, cyTel - 4 + k * 2, 2, 14 - k * 4);
      }
    }
    if (estado.cliente > 0) {
      const x = W - Math.round(facil.salida(Math.min(1, estado.cliente)) * 60);
      const paso = (Math.floor(t / 15) % 2) as 0 | 1;
      const y = pared + 28;
      p.sprite(persona("izq", estado.cliente < 1 ? paso : 0), PALETAS.vecina, x, y, 3, true);
      if (estado.cliente >= 1) {
        const pedido = estado.pedido ?? "¡Mi vuelto!";
        const ancho = p.ancho(pedido) + 14;
        const bx = Math.max(4, Math.min(W - ancho - 4, x + 24 - ancho));
        p.caja(bx, y - 26, ancho, 20, PAL.blanco, PAL.tinta, PAL.crema, false);
        p.texto(pedido, bx + 7, y - 20, PAL.tinta);
      }
    }
    if (estado.captura && estado.captura.k > 0) {
      const c = estado.captura;
      const k = facil.salida(Math.min(1, c.k));
      const cy = Math.round(pared - 60 + (1 - k) * 120);
      p.alfa(k, () => {
        p.alfa(0.5, () => p.rect(PAL.negro, 0, 0, W, h));
        p.rect(PAL.tinta, 46, cy, 100, 150);
        p.rect("#6b3fa0", 50, cy + 6, 92, 138);
        p.circulo(96, cy + 40, 16, PAL.verde);
        p.rect(PAL.blanco, 88, cy + 40, 6, 3);
        p.rect(PAL.blanco, 92, cy + 34, 3, 9);
        p.centrado("¡PAGO", cy + 64, PAL.blanco, 8, undefined, 50, 92);
        p.centrado("EXITOSO!", cy + 76, PAL.blanco, 8, undefined, 50, 92);
        p.centrado(c.monto, cy + 96, PAL.ambar, 8, undefined, 50, 92);
        p.centrado(c.billetera.slice(0, 11), cy + 116, PAL.crema, 8, undefined, 50, 92);
      });
    }
  };
}

// ── La sierra, sin señal (ruta «sin señal») ──────────────────

export type EstadoSierra = { lugar: string; caminando: boolean };

export function sierra(estado: EstadoSierra): Escena {
  return (p, t) => {
    const h = p.h;
    p.degradado(0, h, "#7ec8f0", "#e8f4fb");
    p.circulo(150, 40, 12, "#fff2b0");
    const capas: Array<[string, number, number]> = [
      ["#8fa6b8", 0.45, 0.08],
      ["#6d8a76", 0.58, 0.16],
      ["#4f6f52", 0.7, 0.3],
    ];
    capas.forEach(([color, base, vel], ci) => {
      const y0 = Math.round(h * base);
      for (let x = -40; x < W + 40; x += 2) {
        const xx = x + ((estado.caminando ? t * vel : 0) % 80);
        const alto = 30 + Math.abs(Math.sin((xx + ci * 37) / 23)) * 40 + Math.abs(Math.sin((xx + ci * 11) / 9)) * 10;
        p.rect(color, x, y0 - alto, 2, h - y0 + alto);
      }
      if (ci === 0) {
        for (let x = 0; x < W; x += 2) {
          const xx = x + ((estado.caminando ? t * vel : 0) % 80);
          const alto = 30 + Math.abs(Math.sin((xx + ci * 37) / 23)) * 40 + Math.abs(Math.sin((xx + ci * 11) / 9)) * 10;
          if (alto > 60) p.rect(PAL.blanco, x, y0 - alto, 2, 5);
        }
      }
    });
    const camino = Math.round(h * 0.78);
    p.rect("#b49a6e", 0, camino, W, h - camino);
    p.rect("#9c8460", 0, camino, W, 2);
    const paso = (estado.caminando ? Math.floor(t / 10) % 2 : 0) as 0 | 1;
    p.sprite(persona("der", paso), PALETAS.lucia, 70, camino - 46, 3);
    // celular sin señal
    const cx = 128;
    const cy = camino - 70;
    p.caja(cx, cy, 52, 40, PAL.blanco, PAL.tinta, PAL.rojo, true);
    for (let i = 0; i < 4; i++) p.rect(PAL.grisClaro, cx + 10 + i * 6, cy + 24 - i * 4, 4, 6 + i * 4);
    p.rect(PAL.rojo, cx + 8, cy + 8, 28, 2);
    if (t % 40 < 28) p.texto("SIN", cx + 28, cy + 10, PAL.rojo);
    p.centrado(estado.lugar.slice(0, 22), camino + 18, PAL.tinta);
  };
}

// ── Combate ───────────────────────────────────────────────────

export type EstadoBatalla = {
  fondo: "bodega" | "sistema" | "casa";
  rival: "estafador" | "banco" | "misterio";
  rivalNombre: string;
  rivalEtiqueta: string;
  rivalBarra: number;
  rivalColor: string;
  rivalVisible: number;
  rivalDX: number;
  rivalGolpe: number;
  agentes: Array<{ inicial: string; color: string; nace: number }>;
  aliado: "rosa" | "atacante" | "guardian" | "lucia" | "jorge";
  aliadoDX: number;
  aliadoGolpe: number;
  aliadoNombre: string;
  aliadoEtiqueta: string;
  aliadoLinea: string;
  aliadoColor: string;
  /** 0..1: entrada deslizada de los HUD. */
  hud: number;
  tiempoTotal: number;
  tiempoRestante: number;
  congelado: boolean;
  /** Valor mostrado de la barra del rival (persigue a `rivalBarra`). */
  barraVisible: number;
  /** Símbolo de la moneda en el edificio del banco. */
  simbolo: string;
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
    rivalDX: W,
    rivalGolpe: 0,
    agentes: [],
    aliado: "rosa",
    aliadoDX: -W,
    aliadoGolpe: 0,
    aliadoNombre: "ROSA",
    aliadoEtiqueta: "TIEMPO",
    aliadoLinea: "S/ 4,800",
    aliadoColor: PAL.verde,
    hud: 0,
    tiempoTotal: 0,
    tiempoRestante: 0,
    congelado: false,
    barraVisible: 0,
    simbolo: "S/",
    ...parcial,
  };
}

/** Geometría del combate según el alto de la pantalla. */
function geometria(h: number) {
  const baseRival = Math.round(h * 0.36);
  const baseAliado = h - 96;
  return { baseRival, baseAliado };
}

/** Coordenadas de pantalla útiles para efectos del guion. */
export function puntosBatalla(h: number) {
  const g = geometria(h);
  return { rival: { x: 152, y: g.baseRival - 36 }, aliado: { x: 44, y: g.baseAliado - 36 } };
}

export function batalla(b: EstadoBatalla, m: Motor): Escena {
  return (p, t) => {
    const h = p.h;
    const { baseRival, baseAliado } = geometria(h);
    b.barraVisible += (b.rivalBarra - b.barraVisible) * 0.12;

    if (b.fondo === "bodega") {
      p.rect("#ead9b8", 0, 0, W, baseRival + 14);
      for (let x = 0; x < W; x += 20) p.rect("#d8c29c", x, 0, 1, baseRival + 14);
      estante(p, 4, baseRival - 74, 44, 76, 1);
      p.rect("#d9b98e", 0, baseRival + 14, W, h - baseRival - 14);
      p.rect("#cfae82", 0, baseRival + 14, W, 2);
      for (let y = baseRival + 30; y < h; y += 18) p.rect("#cfae82", 0, y, W, 1);
    } else if (b.fondo === "casa") {
      p.rect("#cfe0e8", 0, 0, W, baseRival + 14);
      for (let x = 0; x < W; x += 12) p.rect("#c2d6e0", x, 0, 6, baseRival + 14);
      p.rect(PAL.tinta, 12, baseRival - 70, 44, 36);
      p.rect("#ffd77a", 14, baseRival - 68, 40, 32);
      p.rect(PAL.tinta, 33, baseRival - 68, 2, 32);
      p.rect(PAL.madera, 66, baseRival - 60, 22, 16);
      p.rect(PAL.crema, 68, baseRival - 58, 18, 12);
      p.rect(PAL.piel, 74, baseRival - 55, 6, 6);
      p.rect("#c28d6b", 0, baseRival + 14, W, h - baseRival - 14);
      for (let y = baseRival + 14; y < h; y += 10) p.rect("#b07a58", 0, y, W, 1);
      for (let y = baseRival + 14, f = 0; y < h; y += 10, f++) for (let x = (f % 2) * 24; x < W; x += 48) p.rect("#b07a58", x, y, 1, 10);
    } else {
      p.degradado(0, h, "#0a1430", "#16285a");
      for (let x = 0; x < W; x += 16) p.rect("#1b3166", x, 0, 1, h);
      for (let y = (t / 2) % 16; y < h; y += 16) p.rect("#1b3166", 0, y, W, 1);
      p.alfa(0.18, () => p.rect(PAL.celeste, 0, (t * 2) % h, W, 2));
      for (let i = 0; i < 8; i++) {
        const x = (i * 41 + t) % W;
        const y = (i * 67) % h;
        p.rect(i % 2 ? PAL.celeste : PAL.ambar, x, y, 1, 1);
      }
    }
    const plataforma = b.fondo === "bodega" ? "#c49e70" : b.fondo === "casa" ? "#a8714f" : "#24406c";

    // Rival
    p.elipse(152 + b.rivalDX, baseRival, 40, 8, plataforma);
    if (b.rivalVisible > 0) {
      const rx = 116 + b.rivalDX;
      const persona_ = b.rival !== "banco";
      const ry = baseRival - (persona_ ? 70 : 64) + (persona_ ? Math.floor(t / 30) % 2 : 0);
      p.alfa(b.rivalVisible, () => {
        if (b.rival === "misterio") {
          p.silueta(ESTAFADOR, b.rivalGolpe > 0 && b.rivalGolpe % 4 < 2 ? PAL.blanco : "#232a4a", rx, ry, 3);
          if (t % 60 < 45) p.texto("?", rx + 32, ry + 20, PAL.ambar, 16);
        } else if (b.rival === "estafador") {
          if (b.rivalGolpe > 0 && b.rivalGolpe % 4 < 2) p.silueta(ESTAFADOR, PAL.blanco, rx, ry, 3);
          else p.sprite(ESTAFADOR, COLORES_ESTAFADOR, rx, ry, 3);
        } else p.escalado(rx + 36, ry + 64, 1.5, () => banco(p, rx + 12, ry + 20, b.simbolo));
      });
    }
    if (b.rivalGolpe > 0) b.rivalGolpe--;

    // HUD del rival
    const hx = Math.round((1 - facil.salida(b.hud)) * -130);
    p.caja(6 + hx, 24, 108, 32);
    p.texto(b.rivalNombre, 14 + hx, 31, PAL.tinta);
    p.texto(b.rivalEtiqueta, 14 + hx, 43, PAL.ambar);
    const bx = 14 + b.rivalEtiqueta.length * 8 + 4;
    p.barra(bx + hx, 44, 108 - (bx - 6) - 10, b.barraVisible, b.rivalColor);
    b.agentes.forEach((a, i) => {
      const edad = Math.min(1, (t - a.nace) / 10);
      p.escalado(12 + i * 15, 66, 0.4 + facil.rebote(edad) * 0.6, () => insignia(p, 6 + i * 15, 60, a.inicial, a.color));
    });

    // Aliado (de espaldas, grande)
    p.elipse(44 + b.aliadoDX, baseAliado, 52, 10, plataforma);
    const ax = -4 + b.aliadoDX;
    const parpadeo = b.aliadoGolpe > 0 && b.aliadoGolpe % 6 < 3;
    if (b.aliadoGolpe > 0) b.aliadoGolpe--;
    if (!parpadeo) {
      if (b.aliado === "rosa") p.sprite(ROSA_ESPALDA, COLORES_ROSA_ESPALDA, ax, baseAliado - 68, 4);
      else if (b.aliado === "lucia") p.sprite(ROSA_ESPALDA, COLORES_LUCIA_ESPALDA, ax, baseAliado - 68, 4);
      else if (b.aliado === "jorge") p.sprite(ATACANTE_ESPALDA, COLORES_JORGE_ESPALDA, ax, baseAliado - 52, 4);
      else if (b.aliado === "atacante") p.sprite(ATACANTE_ESPALDA, COLORES_ATACANTE_ESPALDA, ax, baseAliado - 52, 4);
      else {
        p.sprite(GUARDIAN, COLORES_GUARDIAN, ax, baseAliado - 66 + (Math.floor(t / 20) % 2), 4);
        if (t % 50 < 25) p.rect(PAL.blanco, ax + 12, baseAliado - 60, 3, 3);
      }
    }

    // HUD del aliado
    const ux = Math.round((1 - facil.salida(b.hud)) * 130);
    const uy = Math.max(baseRival + 14, baseAliado - 112);
    p.caja(86 + ux, uy, 102, 48);
    p.texto(b.aliadoNombre.slice(0, 11), 93 + ux, uy + 7, PAL.tinta);
    const restante = m.cuadrosRestantesMenu ?? b.tiempoRestante;
    if (b.tiempoTotal > 0) {
      const actual = b.congelado ? b.tiempoRestante : restante;
      const valor = actual / b.tiempoTotal;
      const seg = Math.ceil(actual / 60);
      p.texto(b.congelado ? "CONGELADO" : b.aliadoEtiqueta, 93 + ux, uy + 18, b.congelado ? PAL.azul : PAL.ambar);
      if (!b.congelado) p.texto(`${seg}s`, 160 + ux, uy + 18, seg <= 10 && t % 20 < 10 ? PAL.rojo : PAL.tinta);
      p.barra(93 + ux, uy + 28, 88, valor, b.congelado ? PAL.celeste : valor < 0.25 ? PAL.rojo : b.aliadoColor);
    } else {
      p.texto(b.aliadoEtiqueta.slice(0, 11), 93 + ux, uy + 18, PAL.ambar);
    }
    if (b.aliadoLinea) p.texto(b.aliadoLinea.slice(0, 11), 93 + ux, uy + 37, PAL.tinta);

    // caja inferior siempre presente
    p.caja(4, h - 86, W - 8, 82);
  };
}
