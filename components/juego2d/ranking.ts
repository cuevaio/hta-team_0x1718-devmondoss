import type { FilaRanking } from "@/components/juego/api";
import { PAISES, type PaisId } from "./paises";
import { PAL, Pincel, W, dibujarBandera, facil } from "./pincel";

/** Pantallas de puntaje: resultado de una partida y ranking del evento. */

type Escena = (p: Pincel, t: number) => void;

function fondoArcade(p: Pincel, t: number) {
  const h = p.h;
  p.degradado(0, h, "#141a3a", "#2a1240");
  for (let i = 0; i < 14; i++) {
    const x = (i * 53 + t * 0.3) % W;
    const y = (i * 97) % h;
    p.alfa(0.25 + 0.25 * Math.sin(t / 20 + i), () => p.rect(PAL.crema, x, y, 1, 1));
  }
}

export type DatosResultado = {
  titulo: string;
  color: string;
  puntaje: number;
  lineas: Array<{ texto: string; color?: string }>;
  posicion?: number | null;
  /** 0..3 estrellas; `null` = el modo no tiene estrellas. */
  estrellas?: number | null;
  record?: boolean;
  /** Rango después de sumar la partida. */
  rango?: { nombre: string; total: number; k: number; siguiente: string | null };
};

const ESTRELLA = ["....X....", "...XXX...", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", ".XXX.XXX.", ".XX...XX."];

/** Cuadro (desde `inicio`) en que aparece la estrella `i`. */
export const cuadroEstrella = (i: number) => 70 + i * 22;

export function escenaResultado(inicio: number, d: DatosResultado): Escena {
  return (p, t) => {
    const f = t - inicio;
    fondoArcade(p, t);
    const k = facil.salida(Math.min(1, f / 18));
    p.escalado(W / 2, 34, 1 + (1 - k) * 1.2, () => p.centrado(d.titulo, 26, d.color, d.titulo.length <= 12 ? 16 : 8, PAL.tinta));
    const cuenta = Math.round(d.puntaje * Math.min(1, Math.max(0, (f - 15) / 50)));
    p.centrado("PUNTOS", 50, PAL.grisClaro);
    p.centrado(String(cuenta), 62, PAL.ambar, 16, PAL.tinta);
    let y = 84;
    if (d.record && f > 66) {
      const pulso = Math.floor(f / 10) % 2 === 0;
      p.centrado("¡NUEVO RÉCORD!", y, pulso ? PAL.verde : PAL.crema, 8, PAL.tinta);
    }
    y += 14;
    if (d.estrellas !== undefined && d.estrellas !== null) {
      for (let i = 0; i < 3; i++) {
        const fi = f - cuadroEstrella(i);
        const gano = i < d.estrellas;
        const x = W / 2 - 46 + i * 32;
        if (fi < 0 || !gano) {
          p.sprite(ESTRELLA, { X: "#3a3560" }, x, y, 3);
          continue;
        }
        const kk = facil.rebote(Math.min(1, fi / 14));
        p.escalado(x + 13, y + 10, 0.4 + kk * 0.6 + Math.max(0, 1 - fi / 6) * 0.6, () => p.sprite(ESTRELLA, { X: PAL.ambar }, x, y, 3));
      }
      y += 30;
    }
    d.lineas.forEach((l, i) => {
      const kk = Math.min(1, Math.max(0, (f - 60 - i * 10) / 10));
      p.alfa(kk, () => p.centrado(l.texto, y + i * 13, l.color ?? PAL.crema, 8, PAL.tinta));
    });
    y += d.lineas.length * 13 + 4;
    if (d.posicion) {
      const kk = Math.min(1, Math.max(0, (f - 130) / 12));
      p.alfa(kk, () => {
        p.escalado(W / 2, y + 10, 1 + (1 - facil.rebote(kk)) * 0.6, () => {
          const texto = `PUESTO #${d.posicion} DEL EVENTO`;
          const ancho = Math.min(W - 8, p.ancho(texto) + 12);
          p.rect(PAL.tinta, (W - ancho) / 2 - 1, y - 1, ancho + 2, 20);
          p.rect(d.posicion! <= 3 ? PAL.ambar : PAL.azul, (W - ancho) / 2, y, ancho, 18);
          p.centrado(texto, y + 5, d.posicion! <= 3 ? PAL.tinta : PAL.blanco);
        });
      });
      y += 24;
    }
    // El menú de 3 opciones ocupa los últimos ~86 px: el rango solo si cabe.
    if (d.rango && y + 30 < p.h - 86) {
      const kk = Math.min(1, Math.max(0, (f - 150) / 14));
      p.alfa(kk, () => {
        p.texto(d.rango!.nombre, 10, y, PAL.verde);
        const tot = `${d.rango!.total} XP`;
        p.texto(tot, W - 10 - p.ancho(tot), y, PAL.grisClaro);
        p.barra(10, y + 11, W - 20, d.rango!.k * Math.min(1, kk * 1.2), PAL.verde);
        if (d.rango!.siguiente) p.texto(`> ${d.rango!.siguiente}`, 10, y + 20, PAL.gris);
      });
    }
  };
}

const MEDALLAS = [PAL.ambar, PAL.grisClaro, "#d08a4e"];

export function escenaRanking(inicio: number, titulo: string, filas: FilaRanking[], propio: string | null, jugadores: number): Escena {
  return (p, t) => {
    const f = t - inicio;
    fondoArcade(p, t);
    p.centrado("RANKING", 26, PAL.ambar, 16, PAL.tinta);
    p.centrado(titulo, 46, PAL.crema, 8, PAL.tinta);
    if (filas.length === 0) {
      p.centrado("Aún nadie juega.", 90, PAL.grisClaro);
      p.centrado("¡Sé el primero!", 104, PAL.ambar);
      return;
    }
    const max = Math.max(3, Math.min(10, Math.floor((p.h - 150) / 19)));
    filas.slice(0, max).forEach((fila, i) => {
      const kk = facil.salida(Math.min(1, Math.max(0, (f - i * 4) / 14)));
      const y = 64 + i * 19;
      const x = 8 + Math.round((1 - kk) * W);
      // El servidor marca la fila de este celular (`tuyo`); sin eso, por apodo.
      const mio = fila.tuyo ?? (propio !== null && fila.alias.toLowerCase() === propio.toLowerCase());
      p.rect(PAL.tinta, x, y, W - 16, 17);
      p.rect(mio ? "#4a3a12" : "#1f2650", x + 1, y + 1, W - 18, 15);
      p.texto(String(i + 1).padStart(2, " "), x + 4, y + 5, i < 3 ? MEDALLAS[i] : PAL.grisClaro);
      const bandera = PAISES[fila.pais as PaisId]?.bandera;
      if (bandera) dibujarBandera(p, bandera, x + 24, y + 4, 12, 9);
      p.texto(fila.alias.toUpperCase().slice(0, 10), x + 42, y + 5, mio ? PAL.ambar : PAL.crema);
      const pts = String(fila.puntaje);
      p.texto(pts, x + W - 20 - p.ancho(pts), y + 5, PAL.ambar);
    });
    const y = 64 + Math.min(max, filas.length) * 19 + 8;
    p.centrado(`${jugadores} ${jugadores === 1 ? "persona jugó" : "personas jugaron"}`, y, PAL.grisClaro);
  };
}
