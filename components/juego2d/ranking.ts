import type { FilaRanking } from "@/components/juego/api";
import { PAISES, type PaisId } from "./paises";
import { PAL, Pincel, W, facil } from "./pincel";

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
};

export function escenaResultado(inicio: number, d: DatosResultado): Escena {
  return (p, t) => {
    const f = t - inicio;
    fondoArcade(p, t);
    const k = facil.salida(Math.min(1, f / 18));
    p.escalado(W / 2, 40, 1 + (1 - k) * 1.2, () => p.centrado(d.titulo, 32, d.color, 16, PAL.tinta));
    const cuenta = Math.round(d.puntaje * Math.min(1, Math.max(0, (f - 15) / 50)));
    p.centrado("PUNTOS", 64, PAL.grisClaro);
    p.centrado(String(cuenta), 78, PAL.ambar, 16, PAL.tinta);
    d.lineas.forEach((l, i) => {
      const kk = Math.min(1, Math.max(0, (f - 60 - i * 10) / 10));
      p.alfa(kk, () => p.centrado(l.texto, 108 + i * 14, l.color ?? PAL.crema, 8, PAL.tinta));
    });
    if (d.posicion) {
      const kk = Math.min(1, Math.max(0, (f - 100) / 12));
      const y = 116 + d.lineas.length * 14;
      p.alfa(kk, () => {
        p.escalado(W / 2, y + 12, 1 + (1 - facil.rebote(kk)) * 0.6, () => {
          const texto = `PUESTO #${d.posicion}`;
          const ancho = p.ancho(texto) + 16;
          p.rect(PAL.tinta, (W - ancho) / 2 - 1, y - 1, ancho + 2, 22);
          p.rect(d.posicion! <= 3 ? PAL.ambar : PAL.azul, (W - ancho) / 2, y, ancho, 20);
          p.centrado(texto, y + 6, d.posicion! <= 3 ? PAL.tinta : PAL.blanco);
        });
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
      const mio = propio !== null && fila.alias.toLowerCase() === propio.toLowerCase();
      p.rect(PAL.tinta, x, y, W - 16, 17);
      p.rect(mio ? "#4a3a12" : "#1f2650", x + 1, y + 1, W - 18, 15);
      p.texto(String(i + 1).padStart(2, " "), x + 4, y + 5, i < 3 ? MEDALLAS[i] : PAL.grisClaro);
      const bandera = PAISES[fila.pais as PaisId]?.bandera;
      if (bandera) {
        bandera.colores.forEach((c, j) => {
          const n = bandera.colores.length;
          if (bandera.vertical) p.rect(c, x + 24 + Math.round((j * 12) / n), y + 4, Math.ceil(12 / n), 9);
          else p.rect(c, x + 24, y + 4 + Math.round((j * 9) / n), 12, Math.ceil(9 / n));
        });
      }
      p.texto(fila.alias.toUpperCase().slice(0, 10), x + 42, y + 5, mio ? PAL.ambar : PAL.crema);
      const pts = String(fila.puntaje);
      p.texto(pts, x + W - 20 - p.ancho(pts), y + 5, PAL.ambar);
    });
    const y = 64 + Math.min(max, filas.length) * 19 + 8;
    p.centrado(`${jugadores} ${jugadores === 1 ? "persona jugó" : "personas jugaron"}`, y, PAL.grisClaro);
  };
}
