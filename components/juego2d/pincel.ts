/**
 * Pincel: primitivas de dibujo del juego 2D.
 *
 * Pensado para celular en vertical: ancho lógico fijo de 192 px y alto
 * variable según la pantalla (`p.h`, entre 300 y 420). Se dibuja a escala
 * entera para que los píxeles y la tipografía pixel queden nítidos. Todo el
 * texto usa la misma fuente pixel (Press Start 2P, 8 px por carácter).
 */

export const W = 192;
export const CARACTER = 8;

export const PAL = {
  negro: "#0a0f1a",
  tinta: "#19283b",
  navy: "#10243d",
  azul: "#285ea8",
  celeste: "#79c7e8",
  crema: "#f6ebd7",
  blanco: "#ffffff",
  verde: "#65be83",
  verdeOscuro: "#3f8f5c",
  ambar: "#f1b35b",
  ambarOscuro: "#c4862f",
  rojo: "#e66565",
  rojoOscuro: "#a83d3d",
  gris: "#8c97a3",
  grisClaro: "#d5dce4",
  piel: "#c98c5e",
  pelo: "#2e1d14",
  madera: "#8a5a36",
  maderaOscura: "#5e3b22",
  maderaClara: "#a87249",
  violeta: "#5d3f7d",
};

/** Caracteres que la fuente pixel no tiene (o dibuja mal) → equivalentes. */
export function limpiar(texto: string): string {
  return texto
    .replace(/…/g, "...")
    .replace(/[—–]/g, "-")
    .replace(/→/g, ">")
    .replace(/[✔✓]/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/ /g, " ")
    // En 8 px la fuente dibuja las mayúsculas con tilde como minúsculas:
    // como en los juegos clásicos, van sin tilde.
    .replace(/[ÁÉÍÓÚ]/g, (c) => ({ Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U" })[c] ?? c);
}

/** Parte un texto en líneas de como mucho `max` caracteres (respeta `\n`). */
export function envolver(texto: string, max: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of limpiar(texto).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;
      while (p.length > max) {
        if (actual) {
          lineas.push(actual);
          actual = "";
        }
        lineas.push(p.slice(0, max));
        p = p.slice(max);
      }
      if (!actual) actual = p;
      else if (actual.length + 1 + p.length <= max) actual += ` ${p}`;
      else {
        lineas.push(actual);
        actual = p;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

/** Mezcla dos colores #rrggbb (k = 0 → a, k = 1 → b). */
export function mezclar(a: string, b: string, k: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const canal = (c: number, d: number) => Math.round(((c >> d) & 255) * (1 - k) + ((cb >> d) & 255) * k);
  const r = canal(ca, 16);
  const g = canal(ca, 8);
  const bl = canal(ca, 0);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export type Grilla = string[];
export type Colores = Record<string, string>;
export type Caja = { x: number; y: number; w: number; h: number };

export const facil = {
  salida: (k: number) => 1 - (1 - k) * (1 - k),
  rebote: (k: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};

export class Pincel {
  /** Alto lógico actual (depende de la pantalla). */
  h = 336;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly fuente: string,
  ) {}

  get w() {
    return W;
  }

  rect(color: string, x: number, y: number, w: number, h: number) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  texto(texto: string, x: number, y: number, color: string = PAL.tinta, tam = CARACTER) {
    const c = this.ctx;
    c.font = `${tam}px ${this.fuente}`;
    c.textBaseline = "top";
    c.fillStyle = color;
    c.fillText(limpiar(texto), Math.round(x), Math.round(y));
  }

  textoSombra(texto: string, x: number, y: number, color: string, sombra: string, tam = CARACTER) {
    this.texto(texto, x + 1, y + 1, sombra, tam);
    this.texto(texto, x, y, color, tam);
  }

  ancho(texto: string, tam = CARACTER) {
    return limpiar(texto).length * tam;
  }

  /** Texto centrado en [x, x+w] (por defecto, en toda la pantalla). */
  centrado(texto: string, y: number, color: string = PAL.tinta, tam = CARACTER, sombra?: string, x = 0, w = W) {
    const tx = Math.round(x + (w - this.ancho(texto, tam)) / 2);
    if (sombra) this.textoSombra(texto, tx, y, color, sombra, tam);
    else this.texto(texto, tx, y, color, tam);
  }

  /** Caja con borde doble, esquinas recortadas y sombra. */
  caja(x: number, y: number, w: number, h: number, fondo: string = PAL.blanco, borde: string = PAL.tinta, interior: string = PAL.celeste, sombra = true) {
    if (sombra) this.alfa(0.35, () => this.rect(PAL.negro, x + 2, y + 3, w, h));
    this.rect(borde, x + 1, y, w - 2, h);
    this.rect(borde, x, y + 1, w, h - 2);
    this.rect(interior, x + 2, y + 1, w - 4, h - 2);
    this.rect(interior, x + 1, y + 2, w - 2, h - 4);
    this.rect(fondo, x + 3, y + 3, w - 6, h - 6);
  }

  /** Botón pixel: relieve y estado presionado. */
  boton(c: Caja, texto: string, o: { activo?: boolean; presionado?: boolean; color?: string; tam?: number } = {}) {
    const base = o.color ?? PAL.crema;
    const hundido = o.presionado ? 2 : 0;
    this.alfa(0.35, () => this.rect(PAL.negro, c.x + 1, c.y + 3, c.w, c.h));
    this.rect(PAL.tinta, c.x, c.y + hundido, c.w, c.h);
    this.rect(o.activo ? PAL.ambar : base, c.x + 1, c.y + 1 + hundido, c.w - 2, c.h - 2);
    if (!o.presionado) this.rect(o.activo ? PAL.ambarOscuro : "rgba(0,0,0,0.18)", c.x + 1, c.y + c.h - 3, c.w - 2, 2);
    this.rect("rgba(255,255,255,0.45)", c.x + 2, c.y + 2 + hundido, c.w - 4, 1);
    const tam = o.tam ?? CARACTER;
    this.centrado(texto, c.y + Math.round((c.h - tam) / 2) + hundido, PAL.tinta, tam, undefined, c.x, c.w);
  }

  sprite(grilla: Grilla, colores: Colores, x: number, y: number, escala = 1, espejo = false) {
    const c = this.ctx;
    for (let j = 0; j < grilla.length; j++) {
      const fila = grilla[j];
      for (let i = 0; i < fila.length; i++) {
        const color = colores[fila[i]];
        if (!color) continue;
        const ix = espejo ? fila.length - 1 - i : i;
        c.fillStyle = color;
        c.fillRect(Math.round(x) + ix * escala, Math.round(y) + j * escala, escala, escala);
      }
    }
  }

  /** Silueta de un sprite en un solo color (destellos de golpe). */
  silueta(grilla: Grilla, color: string, x: number, y: number, escala = 1) {
    const c = this.ctx;
    c.fillStyle = color;
    for (let j = 0; j < grilla.length; j++) {
      for (let i = 0; i < grilla[j].length; i++) {
        if (grilla[j][i] !== ".") c.fillRect(Math.round(x) + i * escala, Math.round(y) + j * escala, escala, escala);
      }
    }
  }

  cursor(x: number, y: number, color: string = PAL.tinta) {
    for (let i = 0; i < 4; i++) this.rect(color, x + i, y + i, 1, 7 - i * 2);
  }

  flechaAbajo(x: number, y: number, color: string = PAL.rojo) {
    for (let i = 0; i < 4; i++) this.rect(color, x + i, y + i, 7 - i * 2, 1);
  }

  barra(x: number, y: number, w: number, valor: number, color: string) {
    const v = Math.max(0, Math.min(1, valor));
    this.rect(PAL.tinta, x, y, w, 6);
    this.rect(PAL.grisClaro, x + 1, y + 1, w - 2, 4);
    this.rect(color, x + 1, y + 1, Math.round((w - 2) * v), 4);
    this.rect("rgba(255,255,255,0.5)", x + 1, y + 1, Math.round((w - 2) * v), 1);
  }

  elipse(cx: number, cy: number, rx: number, ry: number, color: string) {
    for (let dy = -ry; dy <= ry; dy++) {
      const ancho = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
      this.rect(color, cx - ancho, cy + dy, ancho * 2, 1);
    }
  }

  circulo(cx: number, cy: number, r: number, color: string) {
    this.elipse(cx, cy, r, r, color);
  }

  alfa(a: number, fn: () => void) {
    const previo = this.ctx.globalAlpha;
    this.ctx.globalAlpha = previo * Math.max(0, Math.min(1, a));
    fn();
    this.ctx.globalAlpha = previo;
  }

  /** Dibuja `fn` escalado alrededor de (cx, cy): sellos y rebotes. */
  escalado(cx: number, cy: number, s: number, fn: () => void) {
    const c = this.ctx;
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);
    c.translate(-cx, -cy);
    fn();
    c.restore();
  }

  /** Degradado vertical suave entre dos colores (cielos), en franjas de 2 px. */
  degradado(y: number, h: number, desde: string, hasta: string) {
    for (let i = 0; i < h; i += 2) this.rect(mezclar(desde, hasta, i / h), 0, y + i, W, 2);
  }
}
