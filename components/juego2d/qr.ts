import QRCode from "qrcode";
import { PAL, type Pincel } from "./pincel";

/**
 * Código QR dibujado con píxeles del juego (para entrar a una sala con la
 * cámara). Se calcula una vez por texto.
 */

const cache = new Map<string, { n: number; datos: Uint8Array }>();

function modulos(texto: string) {
  let q = cache.get(texto);
  if (!q) {
    const m = QRCode.create(texto, { errorCorrectionLevel: "M" }).modules;
    q = { n: m.size, datos: m.data as unknown as Uint8Array };
    cache.set(texto, q);
  }
  return q;
}

/** Dibuja el QR en un cuadrado de `lado` px (con margen blanco). */
export function dibujarQR(p: Pincel, texto: string, x: number, y: number, lado: number) {
  const { n, datos } = modulos(texto);
  const borde = 2;
  const celda = Math.max(1, Math.floor(lado / (n + borde * 2)));
  const total = celda * (n + borde * 2);
  p.rect(PAL.blanco, x, y, total, total);
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (datos[f * n + c]) p.rect(PAL.negro, x + (c + borde) * celda, y + (f + borde) * celda, celda, celda);
    }
  }
  return total;
}
