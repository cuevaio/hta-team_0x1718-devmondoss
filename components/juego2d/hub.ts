import type { Boton, Motor } from "./motor";
import { PAL, Pincel, W, facil, type Caja } from "./pincel";
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

  const tocar = (x: number, y: number) => {
    cajas().forEach((c, i) => {
      if (x >= c.x - 2 && x < c.x + c.w + 2 && y >= c.y - 2 && y < c.y + c.h + 2) elegir(i);
    });
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
    const hundido = elegido?.i === i ? 2 : 0;
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
    const tot = `${r.total} pts`;
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
      p.texto(it.nombre.slice(0, 17), x + 44, y + Math.round(c.h / 2) - 10, PAL.tinta);
      p.texto(it.sub.slice(0, 11), x + 44, y + Math.round(c.h / 2) + 3, PAL.gris);
      for (let s = 0; s < 3; s++) p.sprite(ESTRELLA, { X: s < (it.estrellas ?? 0) ? PAL.ambar : "#c9bfa9" }, x + c.w - 26 + s * 7, y + 5, 1);
      if (it.nuevo) {
        p.rect(PAL.rojo, x + c.w - 46, y + c.h - 14, 42, 11);
        p.texto("NUEVO", x + c.w - 44, y + c.h - 13, PAL.blanco);
      } else if (it.mejor !== undefined) {
        const txt = String(it.mejor);
        p.texto(txt, x + c.w - 6 - p.ancho(txt), y + c.h - 13, PAL.ambarOscuro);
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
  m.minijuego({ dibujar, tocar, tecla, info });
  return listo;
}
