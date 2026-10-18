import type { Boton, Motor } from "./motor";
import { PAL, Pincel, W, dibujarBandera, facil, type Bandera, type Caja } from "./pincel";
import type { Icono } from "./tutorial";

/**
 * Menú principal como pantalla propia (no tarjetas sobre otra escena): rango
 * arriba, EN VIVO destacado, los arcades con ícono y estrellas, y abajo los
 * accesos chicos. Todo se toca; las flechas sirven en escritorio.
 */

export type ItemHub = {
  id: string;
  nombre: string;
  sub: string;
  color: string;
  icono?: Icono;
  estrellas?: number;
  mejor?: number;
  nuevo?: boolean;
  marca?: { texto: string; color: string };
};

export type DatosHub = {
  rango: { nombre: string; total: number; k: number; siguiente: string | null };
  envivo: ItemHub;
  arcades: ItemHub[];
  chicos: ItemHub[];
};

const ESTRELLA = ["..X..", "XXXXX", ".XXX.", ".X.X."];

function layout(h: number, nArcades: number, nChicos: number) {
  const arriba = 34;
  const vivo: Caja = { x: 6, y: arriba, w: W - 12, h: 34 };
  const filasChicas = Math.ceil(nChicos / 2);
  const altoChico = 24;
  const bloqueChico = filasChicas * (altoChico + 4);
  const libre = h - (arriba + vivo.h + 6) - bloqueChico - 8;
  const alto = Math.max(34, Math.min(56, Math.floor(libre / nArcades) - 4));
  const usado = nArcades * (alto + 4);
  const y0 = arriba + vivo.h + 6 + Math.max(0, Math.floor((libre - usado) / 2));
  const arcades = Array.from({ length: nArcades }, (_, i): Caja => ({ x: 6, y: y0 + i * (alto + 4), w: W - 12, h: alto }));
  const yChicos = h - bloqueChico - 6;
  const chicos = Array.from({ length: nChicos }, (_, i): Caja => ({
    x: 6 + (i % 2) * 92,
    y: yChicos + Math.floor(i / 2) * (altoChico + 4),
    w: 88,
    h: altoChico,
  }));
  return { vivo, arcades, chicos };
}

export function menuHub(m: Motor, d: DatosHub): Promise<string> {
  const items = [d.envivo, ...d.arcades, ...d.chicos];
  const inicio = m.t;
  let sel = 1;
  let elegido: { i: number; t: number } | null = null;
  let resolver: (id: string) => void = () => {};
  const listo = new Promise<string>((r) => (resolver = r));

  const cajas = () => {
    const l = layout(m.h, d.arcades.length, d.chicos.length);
    return [l.vivo, ...l.arcades, ...l.chicos];
  };

  const elegir = (i: number) => {
    if (elegido) return;
    sel = i;
    elegido = { i, t: m.t };
    m.audio.confirmar();
    m.vibrar(12);
    window.setTimeout(() => {
      m.minijuego(null);
      resolver(items[i].id);
    }, 140);
  };

  // Tocar marca; se entra al soltar sobre la misma tarjeta (un roce no te manda a un juego).
  let armado: number | null = null;
  const bajo = (x: number, y: number) =>
    cajas().findIndex((c) => x >= c.x - 2 && x < c.x + c.w + 2 && y >= c.y - 2 && y < c.y + c.h + 2);
  const tocar = (x: number, y: number) => {
    const i = bajo(x, y);
    armado = i >= 0 ? i : null;
    if (i >= 0) sel = i;
  };
  const soltar = (x: number, y: number) => {
    if (armado !== null && bajo(x, y) === armado) elegir(armado);
    armado = null;
  };

  const tecla = (b: Boton) => {
    if (elegido) return;
    const n = items.length;
    const antes = sel;
    if (b === "abajo") sel = Math.min(n - 1, sel + (sel >= 1 + d.arcades.length ? 2 : 1));
    if (b === "arriba") sel = Math.max(0, sel - (sel > 1 + d.arcades.length ? 2 : 1));
    if (b === "der" && sel >= 1 + d.arcades.length) sel = Math.min(n - 1, sel + 1);
    if (b === "izq" && sel > 1 + d.arcades.length) sel = sel - 1;
    if (sel !== antes) m.audio.mover();
    if (b === "a") elegir(sel);
  };

  const tarjeta = (p: Pincel, c: Caja, it: ItemHub, i: number, t: number) => {
    const f = t - inicio;
    const kk = facil.salida(Math.min(1, Math.max(0, (f - i * 3) / 12)));
    const dx = Math.round((1 - kk) * (i % 2 ? -W : W) * 0.6);
    const hundido = elegido?.i === i || armado === i ? 2 : 0;
    const activo = sel === i;
    const x = c.x + dx;
    const y = c.y + hundido;
    p.alfa(0.4, () => p.rect(PAL.negro, x + 1, c.y + 3, c.w, c.h));
    p.rect(activo ? PAL.ambar : PAL.tinta, x, y, c.w, c.h);
    p.rect(PAL.crema, x + 1, y + 1, c.w - 2, c.h - 2);
    p.rect(it.color, x + 1, y + 1, 4, c.h - 2);
    return { x, y };
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    p.degradado(0, h, "#141a3a", "#2a1240");
    for (let i = 0; i < 18; i++) p.alfa(0.2 + 0.2 * Math.sin(t / 25 + i), () => p.rect(PAL.crema, (i * 53 + t * 0.15) % W, (i * 97) % h, 1, 1));

    // ── Rango ──
    const r = d.rango;
    p.textoSombra(r.nombre, 6, 5, PAL.verde, PAL.tinta);
    // XP: todo lo que jugaste suma (no es el puntaje del ranking, que es tu mejor partida).
    const tot = `${r.total} XP`;
    p.texto(tot, 166 - p.ancho(tot), 5, PAL.ambar);
    p.rect(PAL.tinta, 6, 16, 160, 6);
    p.rect("#3a3560", 7, 17, 158, 4);
    p.rect(PAL.verde, 7, 17, Math.round(158 * Math.min(1, r.k)), 4);
    p.texto(r.siguiente ? `> ${r.siguiente}` : "¡RANGO MÁXIMO!", 6, 24, PAL.gris);

    const l = layout(h, d.arcades.length, d.chicos.length);

    // ── EN VIVO ──
    {
      const it = d.envivo;
      const { x, y } = tarjeta(p, l.vivo, it, 0, t);
      const c = l.vivo;
      p.rect(PAL.rojo, x + 1, y + 1, c.w - 2, c.h - 2);
      p.rect("rgba(255,255,255,0.18)", x + 1, y + 1, c.w - 2, 2);
      const brillo = ((t * 3) % (c.w + 80)) - 40;
      p.alfa(0.25, () => p.rect(PAL.blanco, x + brillo, y + 1, 10, c.h - 2));
      if (Math.floor(t / 20) % 2 === 0) p.circulo(x + 12, y + 11, 3, PAL.blanco);
      p.texto("EN VIVO", x + 20, y + 7, PAL.blanco);
      p.texto(it.sub.slice(0, 21), x + 8, y + 21, PAL.crema);
      // dos jugadores
      for (const [ox, col] of [[c.w - 34, PAL.ambar], [c.w - 20, PAL.celeste]] as const) {
        p.rect(PAL.piel, x + ox, y + 7, 8, 7);
        p.rect(col, x + ox - 1, y + 15, 10, 10);
      }
    }

    // ── Arcades ──
    d.arcades.forEach((it, j) => {
      const c = l.arcades[j];
      const { x, y } = tarjeta(p, c, it, j + 1, t);
      const iy = y + Math.round((c.h - 32) / 2);
      p.rect("#1f2650", x + 7, iy, 32, 32);
      it.icono?.(p, x + 7, iy, t);
      // Línea 1: el nombre (ocupa todo el ancho). Línea 2: si es nuevo, de qué
      // trata + NUEVO; si ya se jugó, estrellas + récord. Nada se pisa.
      const y1 = y + Math.round(c.h / 2) - 10;
      const y2 = y + Math.round(c.h / 2) + 3;
      p.texto(it.nombre.slice(0, 17), x + 44, y1, PAL.tinta);
      if (it.nuevo) {
        p.texto(it.sub.slice(0, 11), x + 44, y2, PAL.gris);
        p.rect(PAL.rojo, x + c.w - 46, y2 - 2, 42, 11);
        p.texto("NUEVO", x + c.w - 44, y2 - 1, PAL.blanco);
      } else {
        for (let s = 0; s < 3; s++) p.sprite(ESTRELLA, { X: s < (it.estrellas ?? 0) ? PAL.ambar : "#c9bfa9" }, x + 44 + s * 7, y2 + 1, 1);
        if (it.mejor !== undefined) p.texto(`récord ${it.mejor}`, x + 70, y2, PAL.ambarOscuro);
      }
    });

    // ── Accesos chicos ──
    d.chicos.forEach((it, j) => {
      const c = l.chicos[j];
      const { x, y } = tarjeta(p, c, it, j + 1 + d.arcades.length, t);
      p.texto(it.nombre.slice(0, 10), x + 9, y + Math.round((c.h - 8) / 2), PAL.tinta);
      if (it.marca) {
        const mw = p.ancho(it.marca.texto) + 4;
        p.rect(it.marca.color, x + c.w - mw - 3, y + 3, mw, c.h - 6);
        p.texto(it.marca.texto, x + c.w - mw - 1, y + Math.round((c.h - 8) / 2), PAL.blanco);
      }
    });
  };

  const info = () => ({ hub: true, items: items.map((it, i) => ({ id: it.id, ...cajas()[i] })) });
  m.minijuego({ dibujar, tocar, soltar, tecla, info });
  return listo;
}

/** Elegir país: grilla de 2 columnas con bandera grande (caben los 9). */
export function menuPaises(
  m: Motor,
  lista: Array<{ id: string; nombre: string; bandera: Bandera }>,
  conVolver = false,
): Promise<string> {
  // «VOLVER» como una casilla más (cuando se cambia de país desde MÁS).
  const paises = conVolver ? [...lista, { id: "volver", nombre: "< VOLVER", bandera: { colores: ["#8c97a3"], vertical: false } }] : lista;
  const inicio = m.t;
  let sel = 0;
  let elegido: number | null = null;
  let resolver: (id: string) => void = () => {};
  const listo = new Promise<string>((r) => (resolver = r));
  const filas = Math.ceil(paises.length / 2);

  const caja = (i: number): Caja => {
    const arriba = 44;
    const alto = Math.max(30, Math.min(52, Math.floor((m.h - arriba - 8) / filas) - 4));
    const y0 = arriba + Math.max(0, Math.floor((m.h - arriba - 8 - filas * (alto + 4)) / 2));
    // El último impar va centrado.
    const solo = i === paises.length - 1 && paises.length % 2 === 1;
    return { x: solo ? 52 : 6 + (i % 2) * 92, y: y0 + Math.floor(i / 2) * (alto + 4), w: 88, h: alto };
  };

  const elegir = (i: number) => {
    if (elegido !== null) return;
    elegido = i;
    sel = i;
    m.audio.confirmar();
    m.vibrar(12);
    window.setTimeout(() => {
      m.minijuego(null);
      resolver(paises[i].id);
    }, 160);
  };

  let armado: number | null = null;
  const bajo = (x: number, y: number) =>
    paises.findIndex((_, i) => {
      const c = caja(i);
      return x >= c.x - 2 && x < c.x + c.w + 2 && y >= c.y - 2 && y < c.y + c.h + 2;
    });
  const tocar = (x: number, y: number) => {
    const i = bajo(x, y);
    armado = i >= 0 ? i : null;
    if (i >= 0) sel = i;
  };
  const soltar = (x: number, y: number) => {
    if (armado !== null && bajo(x, y) === armado) elegir(armado);
    armado = null;
  };

  const tecla = (b: Boton) => {
    const antes = sel;
    if (b === "der") sel = Math.min(paises.length - 1, sel + 1);
    if (b === "izq") sel = Math.max(0, sel - 1);
    if (b === "abajo") sel = Math.min(paises.length - 1, sel + 2);
    if (b === "arriba") sel = Math.max(0, sel - 2);
    if (sel !== antes) m.audio.mover();
    if (b === "a") elegir(sel);
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    p.degradado(0, h, "#141a3a", "#2a1240");
    p.centrado("¿DE DÓNDE JUEGAS?", 16, PAL.ambar, 8, PAL.tinta);
    p.centrado("Lo adaptamos a tu país", 28, PAL.grisClaro);
    paises.forEach((pa, i) => {
      const c = caja(i);
      const f = t - inicio;
      const k = facil.salida(Math.min(1, Math.max(0, (f - i * 3) / 12)));
      const y = c.y + Math.round((1 - k) * 30) + (elegido === i || armado === i ? 2 : 0);
      p.alfa(k, () => {
        p.alfa(0.4, () => p.rect(PAL.negro, c.x + 1, y + 3, c.w, c.h));
        p.rect(sel === i ? PAL.ambar : PAL.tinta, c.x, y, c.w, c.h);
        p.rect(PAL.crema, c.x + 1, y + 1, c.w - 2, c.h - 2);
        // Bandera arriba y nombre abajo, centrados: entran nombres de hasta 10 letras.
        const bw = 24;
        const bh = 14;
        const by = y + Math.max(3, Math.round((c.h - bh - 12) / 2));
        const bx = c.x + Math.round((c.w - bw) / 2);
        p.rect(PAL.tinta, bx - 1, by - 1, bw + 2, bh + 2);
        dibujarBandera(p, pa.bandera, bx, by, bw, bh);
        p.centrado(pa.nombre.slice(0, 10), by + bh + 4, PAL.tinta, 8, undefined, c.x, c.w);
      });
    });
  };

  const info = () => ({ paises: paises.map((pa, i) => ({ id: pa.id, nombre: pa.nombre, ...caja(i) })) });
  m.minijuego({ dibujar, tocar, soltar, tecla, info });
  return listo;
}
