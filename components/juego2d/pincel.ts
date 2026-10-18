/**
 * Pincel: primitivas de dibujo del juego 2D.
 *
 * Resolución lógica 240×160 (la de una consola portátil clásica), dibujada a
 * escala entera para que los píxeles y la tipografía pixel queden nítidos.
 * Todo el texto del juego usa la misma fuente pixel (Press Start 2P, 8 px por
 * carácter, monoespaciada): no hay otra tipografía dentro de la pantalla.
 */

export const W = 240;
export const H = 160;
export const ESCALA = 4;
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
  rojo: "#e66565",
  rojoOscuro: "#a83d3d",
  gris: "#8c97a3",
  grisClaro: "#d5dce4",
  piel: "#c98c5e",
  pelo: "#2e1d14",
  madera: "#8a5a36",
  maderaOscura: "#5e3b22",
  maderaClara: "#a87249",
};

/** Caracteres que la fuente pixel no tiene → equivalentes seguros. */
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

export type Grilla = string[];
export type Colores = Record<string, string>;

export class Pincel {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly fuente: string,
  ) {}

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

  /** Texto con sombra de 1 px, como en los títulos de las consolas. */
  textoSombra(texto: string, x: number, y: number, color: string, sombra: string, tam = CARACTER) {
    this.texto(texto, x + 1, y + 1, sombra, tam);
    this.texto(texto, x, y, color, tam);
  }

  ancho(texto: string, tam = CARACTER) {
    return limpiar(texto).length * tam;
  }

  centrado(texto: string, y: number, color: string = PAL.tinta, tam = CARACTER, sombra?: string) {
    const x = Math.round((W - this.ancho(texto, tam)) / 2);
    if (sombra) this.textoSombra(texto, x, y, color, sombra, tam);
    else this.texto(texto, x, y, color, tam);
  }

  /** Caja de diálogo con borde doble y esquinas recortadas. */
  caja(x: number, y: number, w: number, h: number, fondo: string = PAL.blanco, borde: string = PAL.tinta, interior: string = PAL.celeste) {
    this.rect(borde, x + 1, y, w - 2, h);
    this.rect(borde, x, y + 1, w, h - 2);
    this.rect(interior, x + 2, y + 1, w - 4, h - 2);
    this.rect(interior, x + 1, y + 2, w - 2, h - 4);
    this.rect(fondo, x + 3, y + 3, w - 6, h - 6);
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

  /** ▶ de 5×7 px. */
  cursor(x: number, y: number, color: string = PAL.tinta) {
    for (let i = 0; i < 4; i++) this.rect(color, x + i, y + i, 1, 7 - i * 2);
  }

  /** ▼ parpadeante al final de una página de diálogo. */
  flechaAbajo(x: number, y: number, color: string = PAL.rojo) {
    for (let i = 0; i < 4; i++) this.rect(color, x + i, y + i, 7 - i * 2, 1);
  }

  barra(x: number, y: number, w: number, valor: number, color: string) {
    const v = Math.max(0, Math.min(1, valor));
    this.rect(PAL.tinta, x, y, w, 5);
    this.rect(PAL.grisClaro, x + 1, y + 1, w - 2, 3);
    this.rect(color, x + 1, y + 1, Math.round((w - 2) * v), 3);
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
    this.ctx.globalAlpha = a;
    fn();
    this.ctx.globalAlpha = previo;
  }
}
