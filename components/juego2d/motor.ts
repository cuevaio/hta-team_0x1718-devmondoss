import { Explorador, type ConfigMundo } from "./mundo";
import { CARACTER, ESCALA, H, PAL, Pincel, W, envolver, limpiar } from "./pincel";
import { cara } from "./sprites";
import type { Direccion } from "./sprites";

/**
 * Motor del juego 2D: bucle a 60 fps, entrada, diálogos, menús, teclado de
 * nombre y exploración del barrio. Los guiones (guion.ts) son funciones
 * `async` que esperan al jugador: `await m.decir(...)`, `await m.menu(...)`.
 *
 * El motor solo presenta: toda decisión financiera la toma la API.
 */

export type Boton = "arriba" | "abajo" | "izq" | "der" | "a" | "b" | "start";
export type Dibujo = (p: Pincel, t: number) => void;
export type Opcion = { texto: string; info?: string };
type Caja = { x: number; y: number; w: number; h: number };

const CAJA_DIALOGO: Caja = { x: 2, y: 108, w: 236, h: 50 };
const COLUMNAS_TEXTO = 27;
const LINEAS_POR_PAGINA = 3;

type Dialogo = {
  paginas: string[][];
  pagina: number;
  mostrados: number;
  quien?: string;
  /** false = la última página no espera A (la usa una pregunta). */
  esperarFinal: boolean;
  resolver: () => void;
};

type Menu = {
  opciones: Opcion[];
  idx: number;
  cols: number;
  caja: Caja;
  titulo?: string;
  estilo: "lista" | "caras";
  cancelable: boolean;
  limite?: number;
  resolver: (i: number) => void;
};

type Teclado = {
  nombre: string;
  fila: number;
  col: number;
  error: string | null;
  validar: (s: string) => string | null;
  resolver: (s: string) => void;
};

const FILAS_TECLADO = [
  "ABCDEFGHI",
  "JKLMNÑOPQ",
  "RSTUVWXYZ",
  "012345678",
  "9-_.     ",
];
const MAX_NOMBRE = 10;

class Sonido {
  private ctx: AudioContext | null = null;
  silencio = false;

  desbloquear() {
    if (this.ctx || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  tono(freq: number, dur: number, vol = 0.04, cuando = 0, tipo: OscillatorType = "square") {
    if (this.silencio || !this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime + cuando);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + cuando + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + cuando);
    o.stop(c.currentTime + cuando + dur + 0.02);
  }

  blip() {
    this.tono(880, 0.03, 0.015);
  }
  mover() {
    this.tono(660, 0.04, 0.03);
  }
  confirmar() {
    this.tono(990, 0.05, 0.035);
    this.tono(1320, 0.06, 0.035, 0.05);
  }
  ring() {
    for (let i = 0; i < 6; i++) this.tono(i % 2 ? 1400 : 1100, 0.06, 0.04, i * 0.07);
  }
  exito() {
    [523, 659, 784, 1046].forEach((f, i) => this.tono(f, 0.12, 0.04, i * 0.1));
  }
  fallo() {
    [392, 330, 262].forEach((f, i) => this.tono(f, 0.18, 0.04, i * 0.16, "triangle"));
  }
  golpe() {
    this.tono(120, 0.12, 0.06, 0, "sawtooth");
  }
}

export class Motor {
  t = 0;
  escena: Dibujo = () => {};
  /** Sacudida de pantalla (frames). */
  sacudida = 0;
  /** 0 = visible, 1 = negro. */
  fundido = 0;
  readonly sonido = new Sonido();

  private dialogo: Dialogo | null = null;
  private menuActivo: Menu | null = null;
  private teclado: Teclado | null = null;
  private explorador: Explorador | null = null;
  private resolverExplorar: ((id: string) => void) | null = null;
  private resolverBoton: (() => void) | null = null;
  private hablandoEnMundo = false;
  private cola: Boton[] = [];
  private sostenidos = new Set<Boton>();
  private raf = 0;
  private readonly pincel: Pincel;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    fuente: string,
  ) {
    canvas.width = W * ESCALA;
    canvas.height = H * ESCALA;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d no disponible");
    ctx.imageSmoothingEnabled = false;
    this.pincel = new Pincel(ctx, fuente);
  }

  iniciar() {
    const bucle = () => {
      this.t++;
      this.procesar();
      this.dibujar();
      this.raf = requestAnimationFrame(bucle);
    };
    this.raf = requestAnimationFrame(bucle);
  }

  detener() {
    cancelAnimationFrame(this.raf);
  }

  // ── Entrada ──────────────────────────────────────────────

  pulsar(b: Boton) {
    this.sonido.desbloquear();
    this.cola.push(b);
  }

  sostener(b: Boton, activo: boolean) {
    if (activo) this.sostenidos.add(b);
    else {
      this.sostenidos.delete(b);
      this.explorador?.soltar();
    }
  }

  /** Toque en la pantalla (coordenadas lógicas): elige la opción tocada o equivale a A. */
  tocar(x: number, y: number) {
    this.sonido.desbloquear();
    const m = this.menuActivo;
    if (m) {
      const i = this.opcionEn(m, x, y);
      if (i !== null) {
        m.idx = i;
        this.cola.push("a");
      }
      return;
    }
    if (this.teclado) {
      const celda = this.celdaTeclado(x, y);
      if (celda) {
        this.teclado.fila = celda.fila;
        this.teclado.col = celda.col;
        this.cola.push("a");
      }
      return;
    }
    if (this.dialogo || this.resolverBoton) this.cola.push("a");
  }

  private procesar() {
    const b = this.cola.shift();
    if (this.teclado) {
      if (b) this.entradaTeclado(b);
      return;
    }
    if (this.menuActivo) {
      if (this.menuActivo.limite !== undefined && this.t >= this.menuActivo.limite) {
        const m = this.menuActivo;
        this.menuActivo = null;
        m.resolver(-2);
        return;
      }
      if (b) this.entradaMenu(b);
      return;
    }
    if (this.dialogo) {
      this.avanzarTexto();
      if (b === "a" || b === "b") this.entradaDialogo();
      return;
    }
    if (this.resolverBoton) {
      if (b === "a" || b === "start") {
        const r = this.resolverBoton;
        this.resolverBoton = null;
        this.sonido.confirmar();
        r();
      }
      return;
    }
    if (this.explorador && !this.hablandoEnMundo) {
      this.explorador.actualizar();
      if (b === "a") this.manejarEvento(this.explorador.interactuar());
      const dir = (["arriba", "abajo", "izq", "der"] as Direccion[]).find((d) => this.sostenidos.has(d));
      const pulsado = b && (["arriba", "abajo", "izq", "der"] as string[]).includes(b) ? (b as Direccion) : null;
      const intento = dir ?? pulsado;
      if (intento) this.manejarEvento(this.explorador.mover(intento));
    }
  }

  // ── Diálogos ─────────────────────────────────────────────

  /** Muestra un texto (con páginas de 3 líneas) y espera A al final. */
  decir(texto: string, quien?: string): Promise<void> {
    return this.escribir(texto, quien, true);
  }

  private escribir(texto: string, quien: string | undefined, esperarFinal: boolean): Promise<void> {
    const lineas = envolver(texto, COLUMNAS_TEXTO);
    const paginas: string[][] = [];
    for (let i = 0; i < lineas.length; i += LINEAS_POR_PAGINA) paginas.push(lineas.slice(i, i + LINEAS_POR_PAGINA));
    return new Promise((resolver) => {
      this.dialogo = { paginas, pagina: 0, mostrados: 0, quien: quien ? limpiar(quien) : undefined, esperarFinal, resolver };
    });
  }

  private totalPagina(d: Dialogo) {
    return d.paginas[d.pagina].join("").length;
  }

  private avanzarTexto() {
    const d = this.dialogo!;
    const total = this.totalPagina(d);
    if (d.mostrados < total) {
      d.mostrados = Math.min(total, d.mostrados + 1);
      if (d.mostrados % 3 === 0) this.sonido.blip();
    } else if (!d.esperarFinal && d.pagina === d.paginas.length - 1) {
      const r = d.resolver;
      r();
    }
  }

  private entradaDialogo() {
    const d = this.dialogo!;
    const total = this.totalPagina(d);
    if (d.mostrados < total) {
      d.mostrados = total;
      return;
    }
    if (d.pagina < d.paginas.length - 1) {
      d.pagina++;
      d.mostrados = 0;
      this.sonido.mover();
      return;
    }
    if (d.esperarFinal) {
      this.dialogo = null;
      this.sonido.mover();
      d.resolver();
    }
  }

  // ── Menús ────────────────────────────────────────────────

  /**
   * Menú con cursor. Devuelve el índice elegido, -1 si se canceló con B y -2
   * si se acabó el tiempo (`limiteFrames`).
   */
  menu(
    opciones: Opcion[],
    o: { cols?: number; caja?: Caja; titulo?: string; estilo?: "lista" | "caras"; cancelable?: boolean; limiteFrames?: number; inicial?: number } = {},
  ): Promise<number> {
    const cols = o.cols ?? 1;
    const estilo = o.estilo ?? "lista";
    let caja = o.caja;
    if (!caja) {
      if (estilo === "caras") caja = { x: 60, y: 60, w: 120, h: 30 };
      else {
        const ancho = Math.max(...opciones.map((op) => limpiar(op.texto).length)) * CARACTER + 24;
        const filas = Math.ceil(opciones.length / cols);
        const h = filas * 14 + 12 + (o.titulo ? 12 : 0);
        if (opciones.some((op) => op.info)) {
          // Con descripción: la info va arriba y el menú abajo, a todo lo ancho.
          caja = { x: 2, y: H - h - 2, w: 236, h };
        } else {
          const w = Math.min(236, Math.max(ancho * cols, o.titulo ? limpiar(o.titulo).length * CARACTER + 16 : 0));
          caja = { x: W - w - 2, y: CAJA_DIALOGO.y - h - 2, w, h };
        }
      }
    }
    return new Promise((resolver) => {
      this.menuActivo = {
        opciones,
        idx: o.inicial ?? 0,
        cols,
        caja: caja!,
        titulo: o.titulo,
        estilo,
        cancelable: o.cancelable ?? false,
        limite: o.limiteFrames !== undefined ? this.t + o.limiteFrames : undefined,
        resolver: (i) => {
          this.dialogo = null;
          resolver(i);
        },
      };
    });
  }

  /**
   * Texto + menú, como «¿Seguro? SÍ / NO». Si la pregunta no cabe en una
   * página, se lee completa primero y el menú aparece con `corta`.
   */
  async pregunta(
    texto: string,
    opciones: Opcion[],
    quien?: string,
    o: Parameters<Motor["menu"]>[1] & { corta?: string } = {},
  ): Promise<number> {
    if (envolver(texto, COLUMNAS_TEXTO).length > LINEAS_POR_PAGINA) {
      await this.escribir(texto, quien, true);
      await this.escribir(o.corta ?? "¿Qué respondes?", quien, false);
    } else {
      await this.escribir(texto, quien, false);
    }
    return this.menu(opciones, o);
  }

  get framesRestantesMenu(): number | null {
    const m = this.menuActivo;
    return m?.limite !== undefined ? Math.max(0, m.limite - this.t) : null;
  }

  private entradaMenu(b: Boton) {
    const m = this.menuActivo!;
    const n = m.opciones.length;
    const mover = (nuevo: number) => {
      if (nuevo >= 0 && nuevo < n && nuevo !== m.idx) {
        m.idx = nuevo;
        this.sonido.mover();
      }
    };
    if (m.estilo === "caras") {
      if (b === "izq") mover(m.idx - 1);
      if (b === "der") mover(m.idx + 1);
    } else {
      if (b === "arriba") mover(m.idx - m.cols);
      if (b === "abajo") mover(m.idx + m.cols);
      if (b === "izq" && m.cols > 1 && m.idx % m.cols > 0) mover(m.idx - 1);
      if (b === "der" && m.cols > 1 && m.idx % m.cols < m.cols - 1) mover(m.idx + 1);
    }
    if (b === "a" || b === "start") {
      this.menuActivo = null;
      this.sonido.confirmar();
      m.resolver(m.idx);
    }
    if (b === "b" && m.cancelable) {
      this.menuActivo = null;
      this.sonido.mover();
      m.resolver(-1);
    }
  }

  private rectOpcion(m: Menu, i: number): Caja {
    const { x, y, w } = m.caja;
    if (m.estilo === "caras") return { x: x + 8 + i * 22, y: y + 6, w: 18, h: 18 };
    const dy = m.titulo ? 12 : 0;
    const anchoCelda = (w - 12) / m.cols;
    const col = i % m.cols;
    const fila = Math.floor(i / m.cols);
    return { x: x + 6 + col * anchoCelda, y: y + 6 + dy + fila * 14, w: anchoCelda, h: 14 };
  }

  private opcionEn(m: Menu, x: number, y: number): number | null {
    for (let i = 0; i < m.opciones.length; i++) {
      const r = this.rectOpcion(m, i);
      if (x >= r.x && x < r.x + r.w && y >= r.y - 2 && y < r.y + r.h) return i;
    }
    return null;
  }

  // ── Teclado de nombre ────────────────────────────────────

  nombre(validar: (s: string) => string | null): Promise<string> {
    return new Promise((resolver) => {
      this.teclado = { nombre: "", fila: 0, col: 0, error: null, validar, resolver };
    });
  }

  private celdaTeclado(x: number, y: number): { fila: number; col: number } | null {
    for (let fila = 0; fila < FILAS_TECLADO.length + 1; fila++) {
      for (let col = 0; col < 9; col++) {
        const r = this.rectTecla(fila, col);
        if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { fila, col };
      }
    }
    return null;
  }

  /** La última fila son «BORRAR» (cols 0–3) y «LISTO» (cols 5–8). */
  private rectTecla(fila: number, col: number): Caja | null {
    if (fila === FILAS_TECLADO.length) {
      if (col <= 3) return { x: 24, y: 136, w: 88, h: 14 };
      if (col >= 5) return { x: 128, y: 136, w: 88, h: 14 };
      return null;
    }
    return { x: 28 + col * 21, y: 56 + fila * 15, w: 18, h: 14 };
  }

  private entradaTeclado(b: Boton) {
    const k = this.teclado!;
    const filas = FILAS_TECLADO.length + 1;
    const ultima = FILAS_TECLADO.length;
    if (b === "arriba") k.fila = (k.fila + filas - 1) % filas;
    if (b === "abajo") k.fila = (k.fila + 1) % filas;
    if (b === "izq" || b === "der") {
      // En la fila BORRAR / LISTO, izquierda y derecha alternan los dos botones.
      if (k.fila === ultima) k.col = k.col <= 4 ? 5 : 0;
      else k.col = (k.col + (b === "izq" ? 8 : 1)) % 9;
    }
    if (["arriba", "abajo", "izq", "der"].includes(b)) {
      if (k.fila === ultima) k.col = k.col <= 4 ? 0 : 5;
      this.sonido.mover();
      return;
    }
    if (b === "b") {
      k.nombre = k.nombre.slice(0, -1);
      k.error = null;
      return;
    }
    const listo = () => {
      const error = k.nombre.trim() ? k.validar(k.nombre.trim()) : "Escribe un apodo.";
      if (error) {
        k.error = error;
        this.sonido.fallo();
        return;
      }
      this.teclado = null;
      this.sonido.confirmar();
      k.resolver(k.nombre.trim());
    };
    if (b === "start") return listo();
    if (b !== "a") return;
    if (k.fila === FILAS_TECLADO.length) {
      if (k.col <= 3) k.nombre = k.nombre.slice(0, -1);
      else listo();
      return;
    }
    const ch = FILAS_TECLADO[k.fila][k.col];
    if (ch && ch !== " " && k.nombre.length < MAX_NOMBRE) {
      k.nombre += ch;
      k.error = null;
      this.sonido.blip();
    }
  }

  // ── Exploración ──────────────────────────────────────────

  /** Deja caminar al jugador por el barrio hasta que alcance el objetivo. */
  explorar(cfg: ConfigMundo): Promise<string> {
    this.explorador = new Explorador(cfg);
    const exp = this.explorador;
    this.escena = (p, t) => exp.dibujar(p, t);
    return new Promise((resolver) => {
      this.resolverExplorar = (id) => {
        this.explorador = null;
        this.resolverExplorar = null;
        resolver(id);
      };
    });
  }

  private manejarEvento(e: ReturnType<Explorador["interactuar"]>) {
    if (!e) return;
    if (e.tipo === "objetivo") {
      this.sonido.confirmar();
      this.resolverExplorar?.(e.id);
      return;
    }
    this.hablandoEnMundo = true;
    void (async () => {
      for (const linea of e.lineas) await this.decir(linea);
      this.hablandoEnMundo = false;
    })();
  }

  // ── Utilidades para guiones ──────────────────────────────

  /** Espera A o START (pantalla de título). */
  esperarA(): Promise<void> {
    return new Promise((r) => {
      this.resolverBoton = r;
    });
  }

  /** Corre `paso(i)` durante `frames` cuadros (animaciones de guion). */
  async animar(frames: number, paso: (i: number) => void) {
    for (let i = 1; i <= frames; i++) {
      paso(i / frames);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  esperar(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
  }

  async fundirA(negro: boolean, frames = 18) {
    const desde = this.fundido;
    const hasta = negro ? 1 : 0;
    for (let i = 1; i <= frames; i++) {
      this.fundido = desde + ((hasta - desde) * i) / frames;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  sacudir(frames = 16) {
    this.sacudida = frames;
  }

  // ── Dibujo ───────────────────────────────────────────────

  private dibujar() {
    const p = this.pincel;
    const c = p.ctx;
    c.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
    c.imageSmoothingEnabled = false;
    p.rect(PAL.negro, 0, 0, W, H);

    c.save();
    if (this.sacudida > 0) {
      this.sacudida--;
      c.translate(((this.t % 4) - 2) * 1, ((this.t % 3) - 1) * 1);
    }
    if (this.teclado) this.dibujarTeclado(p);
    else this.escena(p, this.t);
    c.restore();

    if (this.dialogo) this.dibujarDialogo(p, this.dialogo);
    if (this.menuActivo) this.dibujarMenu(p, this.menuActivo);
    if (this.fundido > 0) p.alfa(this.fundido, () => p.rect(PAL.negro, 0, 0, W, H));
  }

  private dibujarDialogo(p: Pincel, d: Dialogo) {
    const { x, y, w, h } = CAJA_DIALOGO;
    if (d.quien) {
      const ancho = d.quien.length * CARACTER + 12;
      p.caja(x, y - 14, ancho, 17, PAL.navy, PAL.tinta, PAL.ambar);
      p.texto(d.quien, x + 6, y - 9, PAL.crema);
    }
    p.caja(x, y, w, h);
    let resto = d.mostrados;
    d.paginas[d.pagina].forEach((linea, i) => {
      const visible = linea.slice(0, Math.max(0, resto));
      resto -= linea.length;
      p.texto(visible, x + 9, y + 8 + i * 13, PAL.tinta);
    });
    const completa = d.mostrados >= this.totalPagina(d);
    const ultima = d.pagina === d.paginas.length - 1;
    if (completa && (d.esperarFinal || !ultima) && Math.floor(this.t / 20) % 2 === 0) {
      p.flechaAbajo(x + w - 16, y + h - 11);
    }
  }

  private dibujarMenu(p: Pincel, m: Menu) {
    const { x, y, w, h } = m.caja;
    p.caja(x, y, w, h);
    if (m.titulo) p.texto(m.titulo, x + 8, y + 6, PAL.azul);
    m.opciones.forEach((op, i) => {
      const r = this.rectOpcion(m, i);
      if (m.estilo === "caras") {
        if (i === m.idx) p.rect(PAL.ambar, r.x - 2, r.y - 2, 18, 18);
        cara(p, r.x, r.y, i);
        return;
      }
      p.texto(op.texto, r.x + 10, r.y + 2, PAL.tinta);
      if (i === m.idx && Math.floor(this.t / 16) % 4 !== 3) p.cursor(r.x + 1, r.y + 2);
    });
    const info = m.opciones[m.idx]?.info;
    if (info) {
      const lineas = envolver(info, 27).slice(0, 4);
      const alto = lineas.length * 12 + 12;
      p.caja(2, 2, 236, alto, PAL.crema, PAL.tinta, PAL.ambar);
      lineas.forEach((l, i) => p.texto(l, 10, 8 + i * 12, PAL.tinta));
    }
  }

  private dibujarTeclado(p: Pincel) {
    const k = this.teclado!;
    p.rect(PAL.crema, 0, 0, W, H);
    for (let i = 0; i < W; i += 16) p.rect("#efe0c4", i, 0, 8, H);
    p.caja(4, 4, 232, 42);
    p.texto("¿Cómo te llamas?", 14, 12, PAL.azul);
    const relleno = k.nombre.padEnd(MAX_NOMBRE, "_");
    p.texto(relleno, 14, 24, PAL.tinta);
    if (k.error) p.texto(limpiar(k.error).slice(0, 27), 14, 34, PAL.rojo);
    else p.texto("A: letra  B: borrar", 14, 34, PAL.gris);
    p.caja(18, 50, 204, 104);
    FILAS_TECLADO.forEach((fila, fi) => {
      for (let col = 0; col < 9; col++) {
        const ch = fila[col];
        if (!ch || ch === " ") continue;
        const r = this.rectTecla(fi, col)!;
        if (k.fila === fi && k.col === col) p.rect(PAL.ambar, r.x - 1, r.y - 1, r.w, r.h);
        p.texto(ch, r.x + 4, r.y + 3, PAL.tinta);
      }
    });
    const borrar = this.rectTecla(FILAS_TECLADO.length, 0)!;
    const listo = this.rectTecla(FILAS_TECLADO.length, 5)!;
    const fUlt = k.fila === FILAS_TECLADO.length;
    if (fUlt && k.col <= 3) p.rect(PAL.ambar, borrar.x, borrar.y, borrar.w, borrar.h);
    if (fUlt && k.col >= 5) p.rect(PAL.ambar, listo.x, listo.y, listo.w, listo.h);
    p.texto("BORRAR", borrar.x + 20, borrar.y + 3, PAL.rojoOscuro);
    p.texto("LISTO", listo.x + 24, listo.y + 3, PAL.verdeOscuro);
  }

  get lienzo() {
    return this.canvas;
  }

  /** Foto del estado, para pruebas end-to-end (`/play?depurar`). */
  estado() {
    const d = this.dialogo;
    const m = this.menuActivo;
    return {
      t: this.t,
      dialogo: d ? d.paginas[d.pagina].join(" ") : null,
      quien: d?.quien ?? null,
      menu: m ? { opciones: m.opciones.map((o) => o.texto), rects: m.opciones.map((_, i) => this.rectOpcion(m, i)) } : null,
      teclado: this.teclado ? { nombre: this.teclado.nombre } : null,
      explorando: this.explorador ? { x: this.explorador.x, y: this.explorador.y, quieto: this.explorador.quieto } : null,
      esperandoA: this.resolverBoton !== null,
    };
  }
}
