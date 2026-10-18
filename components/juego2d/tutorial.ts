import type { Motor } from "./motor";
import { PAL, Pincel, W, envolver, facil } from "./pincel";

/**
 * Pantallas que explican sin texto largo: «CÓMO SE JUEGA» (3 pasos con
 * dibujo) antes de cada minijuego, y «LO QUE TE LLEVAS» (consejos prácticos)
 * al terminar.
 */

export type Icono = (p: Pincel, x: number, y: number, t: number) => void;

export type Paso = { icono: Icono; texto: string };

// ── Íconos de 32×32 ────────────────────────────────────────────

export const icono = {
  /** Botón con una X roja o un visto verde. */
  boton(tipo: "x" | "ok"): Icono {
    return (p, x, y) => {
      const base = tipo === "x" ? "#f4c7c3" : "#bfe8c9";
      p.rect(PAL.tinta, x + 2, y + 6, 28, 22);
      p.rect(base, x + 3, y + 7, 26, 20);
      const c = tipo === "x" ? PAL.rojoOscuro : PAL.verdeOscuro;
      if (tipo === "x") for (let i = 0; i < 10; i++) {
        p.rect(c, x + 11 + i, y + 12 + i, 2, 2);
        p.rect(c, x + 20 - i, y + 12 + i, 2, 2);
      }
      else {
        for (let i = 0; i < 4; i++) p.rect(c, x + 9 + i, y + 16 + i, 2, 2);
        for (let i = 0; i < 9; i++) p.rect(c, x + 13 + i, y + 19 - i, 2, 2);
      }
    };
  },
  /** Una notificación del celular que entra. */
  carta: ((p, x, y, t) => {
    const d = Math.round(Math.sin(t / 10) * 2);
    p.rect(PAL.tinta, x + 4, y + 2 + d, 24, 28);
    p.rect(PAL.crema, x + 5, y + 3 + d, 22, 26);
    p.rect(PAL.azul, x + 5, y + 3 + d, 22, 6);
    for (let i = 0; i < 3; i++) p.rect(PAL.gris, x + 8, y + 13 + i * 5 + d, 16 - i * 4, 2);
  }) as Icono,
  /** Un dedo que toca. */
  dedo: ((p, x, y, t) => {
    const b = Math.floor(t / 15) % 2 ? 2 : 0;
    p.rect(PAL.piel, x + 12, y + 4 + b, 6, 14);
    p.rect(PAL.piel, x + 8, y + 14 + b, 16, 14);
    p.rect("#a86e45", x + 12, y + 4 + b, 1, 14);
    if (b) for (const [dx, dy] of [[-3, 0], [8, -4], [19, 0]]) p.rect(PAL.ambar, x + 6 + dx, y + 2 + dy, 3, 3);
  }) as Icono,
  corazon: ((p, x, y) => {
    const g = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
    p.sprite(g, { X: PAL.rojo }, x + 2, y + 6, 4);
  }) as Icono,
  reloj: ((p, x, y, t) => {
    p.circulo(x + 16, y + 16, 13, PAL.tinta);
    p.circulo(x + 16, y + 16, 11, PAL.crema);
    const a = (t / 20) % (Math.PI * 2);
    for (let i = 0; i < 9; i++) p.rect(PAL.rojo, x + 16 + Math.cos(a) * i, y + 16 + Math.sin(a) * i, 2, 2);
    p.rect(PAL.tinta, x + 15, y + 8, 2, 9);
  }) as Icono,
  combo: ((p, x, y, t) => {
    const s = 1 + (Math.floor(t / 12) % 2) * 0.15;
    p.escalado(x + 16, y + 16, s, () => p.textoSombra("x4", x + 4, y + 9, PAL.ambar, PAL.tinta, 16));
  }) as Icono,
  /** Una cuenta mula: billetes y una bandera roja. */
  mula: ((p, x, y, t) => {
    p.circulo(x + 16, y + 18, 11, PAL.tinta);
    p.circulo(x + 16, y + 18, 10, PAL.crema);
    for (let i = 0; i < 4; i++) p.rect(PAL.ambar, x + 10 + (i % 2) * 6, y + 13 + Math.floor(i / 2) * 6, 4, 4);
    const ond = Math.floor(t / 10) % 2;
    p.rect(PAL.tinta, x + 24, y + 1, 2, 14);
    p.rect(PAL.rojo, x + 26, y + 1 + ond, 6, 5);
  }) as Icono,
  /** Una cuenta normal: tiendita. */
  tienda: ((p, x, y) => {
    p.rect(PAL.madera, x + 4, y + 12, 24, 16);
    for (let i = 0; i < 6; i++) p.rect(i % 2 ? PAL.blanco : PAL.rojo, x + 2 + i * 5, y + 6, 5, 7);
    p.rect(PAL.celeste, x + 8, y + 16, 7, 7);
    p.rect(PAL.maderaOscura, x + 18, y + 16, 6, 12);
  }) as Icono,
  hielo: ((p, x, y, t) => {
    const c = Math.floor(t / 8) % 2 ? PAL.blanco : PAL.celeste;
    p.rect(c, x + 15, y + 3, 3, 26);
    p.rect(c, x + 3, y + 15, 26, 3);
    for (let i = 0; i < 8; i++) {
      p.rect(c, x + 7 + i * 2, y + 7 + i * 2, 2, 2);
      p.rect(c, x + 23 - i * 2, y + 7 + i * 2, 2, 2);
    }
  }) as Icono,
  lupa: ((p, x, y) => {
    p.circulo(x + 13, y + 13, 9, PAL.tinta);
    p.circulo(x + 13, y + 13, 7, PAL.celeste);
    p.rect(PAL.blanco, x + 9, y + 9, 3, 3);
    for (let i = 0; i < 8; i++) p.rect(PAL.maderaOscura, x + 19 + i, y + 19 + i, 3, 3);
  }) as Icono,
  pausa: ((p, x, y) => {
    p.rect(PAL.tinta, x + 2, y + 4, 28, 24);
    p.rect(PAL.ambar, x + 3, y + 5, 26, 22);
    p.rect(PAL.tinta, x + 10, y + 9, 4, 14);
    p.rect(PAL.tinta, x + 18, y + 9, 4, 14);
  }) as Icono,
  pasa: ((p, x, y) => {
    p.rect(PAL.tinta, x + 2, y + 4, 28, 24);
    p.rect(PAL.verde, x + 3, y + 5, 26, 22);
    for (let i = 0; i < 7; i++) p.rect(PAL.tinta, x + 11 + i, y + 9 + i, 3, 14 - i * 2);
  }) as Icono,
  /** Fichas de señales: roja = riesgo, verde = normal. */
  senales: ((p, x, y) => {
    p.rect(PAL.rojo, x + 2, y + 6, 28, 8);
    p.rect(PAL.verde, x + 2, y + 18, 28, 8);
    p.rect(PAL.blanco, x + 5, y + 9, 12, 2);
    p.rect(PAL.blanco, x + 5, y + 21, 16, 2);
  }) as Icono,
  dinero: ((p, x, y, t) => {
    for (let i = 0; i < 3; i++) {
      const k = ((t / 30 + i / 3) % 1) * 24;
      p.rect(PAL.ambarOscuro, x + 2 + k, y + 8 + i * 7, 6, 5);
      p.rect(PAL.ambar, x + 2 + k, y + 8 + i * 7, 5, 4);
    }
  }) as Icono,
  banda: ((p, x, y) => {
    p.rect(PAL.tinta, x + 8, y + 4, 16, 14);
    p.rect("#2a2d3e", x + 9, y + 5, 14, 12);
    p.rect(PAL.piel, x + 11, y + 9, 10, 6);
    p.rect(PAL.tinta, x + 12, y + 11, 2, 2);
    p.rect(PAL.tinta, x + 18, y + 11, 2, 2);
    p.rect("#33384d", x + 6, y + 18, 20, 12);
  }) as Icono,
};

// ── CÓMO SE JUEGA ──────────────────────────────────────────────

export async function comoSeJuega(
  m: Motor,
  cfg: { titulo: string; color: string; pasos: Paso[]; meta?: string; record?: string },
) {
  const inicio = m.t;
  m.barraSuperior = null;
  m.descubrirYa();
  m.escena = (p, t) => {
    const f = t - inicio;
    const h = p.h;
    p.degradado(0, h, "#141a3a", "#2a1240");
    for (let i = 0; i < 16; i++) p.alfa(0.25, () => p.rect(PAL.crema, (i * 53 + t * 0.2) % W, (i * 97) % h, 1, 1));
    // título
    const k = facil.salida(Math.min(1, f / 14));
    const lineasTitulo = cfg.titulo.split("\n");
    const altoTitulo = lineasTitulo.length * 18 + 12;
    p.rect(cfg.color, 0, 18, W, altoTitulo);
    p.rect("rgba(0,0,0,0.25)", 0, 14 + altoTitulo, W, 4);
    p.escalado(W / 2, 18 + altoTitulo / 2, 1 + (1 - k) * 0.6, () =>
      lineasTitulo.forEach((l, i) => p.centrado(l, 25 + i * 18, PAL.blanco, 16, PAL.tinta)),
    );
    const yComo = 26 + altoTitulo;
    p.centrado("CÓMO SE JUEGA", yComo, PAL.ambar, 8, PAL.tinta);
    // pasos
    const arriba = yComo + 14;
    const alto = Math.min(64, Math.floor((h - 112 - arriba) / cfg.pasos.length));
    cfg.pasos.forEach((paso, i) => {
      const kk = facil.salida(Math.min(1, Math.max(0, (f - 10 - i * 12) / 14)));
      const y = arriba + i * alto;
      const x = 8 + Math.round((1 - kk) * W);
      p.rect(PAL.tinta, x, y, W - 16, alto - 6);
      p.rect("#1f2650", x + 1, y + 1, W - 18, alto - 8);
      p.textoSombra(String(i + 1), x + 4, y + 4, PAL.ambar, PAL.tinta);
      paso.icono(p, x + 12, y + Math.round((alto - 6 - 32) / 2), t);
      const lineas = envolver(paso.texto, 15).slice(0, Math.max(2, Math.floor((alto - 8) / 11)));
      const y0 = y + Math.round((alto - 6 - lineas.length * 11) / 2) + 1;
      lineas.forEach((l, j) => p.texto(l, x + 52, y0 + j * 11, PAL.crema));
    });
    const yb = h - 58;
    const meta = cfg.meta ? envolver(cfg.meta, 23).slice(0, 2) : [];
    meta.forEach((l, i) => p.centrado(l, yb - 12 - (meta.length - 1 - i) * 11, PAL.celeste, 8, PAL.tinta));
    if (cfg.record) envolver(cfg.record, 23).slice(0, 2).forEach((l, i, ls) => p.centrado(l, yb - 14 - meta.length * 11 - (ls.length - 1 - i) * 11, PAL.ambar, 8, PAL.tinta));
    if (f > 30) {
      const pulso = 1 + (Math.floor(f / 18) % 2) * 0.06;
      p.escalado(W / 2, yb + 16, pulso, () => p.boton({ x: 24, y: yb, w: W - 48, h: 34 }, "¡A JUGAR!", { color: PAL.ambar }));
    }
  };
  m.musica("titulo");
  await m.fundirA(false, 10);
  await m.esperar(500);
  await m.esperarToque();
  m.audio.cuenta(true);
  await m.fundirA(true, 10);
}

// ── LO QUE TE LLEVAS ───────────────────────────────────────────

export async function teLlevas(m: Motor, titulo: string, consejos: string[], color: string = PAL.verde) {
  const inicio = m.t;
  m.barraSuperior = null;
  m.descubrirYa();
  m.escena = (p, t) => {
    const f = t - inicio;
    const h = p.h;
    p.rect("#f6ebd7", 0, 0, W, h);
    for (let y = 0; y < h; y += 14) p.rect("#ece0c8", 0, y, W, 1);
    p.rect(color, 0, 16, W, 26);
    p.centrado(titulo, 25, PAL.blanco, 8, PAL.tinta);
    let y = 54;
    consejos.forEach((c, i) => {
      const kk = Math.min(1, Math.max(0, (f - 8 - i * 14) / 10));
      const lineas = envolver(c, 19);
      p.alfa(kk, () => {
        p.rect(color, 10, y + 2, 6, 6);
        p.rect(PAL.tinta, 12, y + 4, 2, 2);
        lineas.forEach((l, j) => p.texto(l, 22, y + j * 12, PAL.tinta));
      });
      y += lineas.length * 12 + 10;
    });
    if (f > 40 && Math.floor(f / 25) % 2 === 0) p.centrado("toca para seguir", h - 18, PAL.gris);
  };
  m.musica("guardian");
  await m.fundirA(false, 10);
  await m.esperar(600);
  await m.esperarToque(15000);
  await m.fundirA(true, 10);
}
