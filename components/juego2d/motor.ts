import { Audio } from "./audio";
import { Explorador, TILE, type ConfigMundo } from "./mundo";
import { CARACTER, PAL, Pincel, W, envolver, facil, limpiar, type Caja } from "./pincel";
import { cara } from "./sprites";
import type { Direccion } from "./sprites";

/**
 * Motor del juego 2D para celular: pantalla completa en vertical, todo se
 * maneja tocando (el teclado queda como respaldo en escritorio).
 *
 * Los guiones (guion.ts) son funciones `async` que esperan al jugador:
 * `await m.decir(...)`, `await m.menu(...)`. El motor solo presenta: toda
 * decisión financiera la toma la API.
 */

export type Boton = "arriba" | "abajo" | "izq" | "der" | "a" | "b";
export type Dibujo = (p: Pincel, t: number) => void;
export type Opcion = {
  texto: string;
  info?: string;
  color?: string;
  /** Solo estilo «tarjetas»: segunda línea, bandera e insignia. */
  sub?: string;
  bandera?: { colores: string[]; vertical: boolean };
  marca?: { texto: string; color: string };
  /** Solo «tarjetas»: 0..3 estrellas ganadas (se dibujan en vez de la marca). */
  estrellas?: number;
};
type EstiloMenu = "lista" | "combate" | "caras" | "tarjetas";

/** Escena con reglas propias en tiempo real (minijuegos). */
export type Minijuego = {
  dibujar: Dibujo;
  tocar?: (x: number, y: number) => void;
  tecla?: (b: Boton) => void;
  /** Estado para pruebas end-to-end (`/play?depurar`). */
  info?: () => unknown;
};

const COLUMNAS = 20;
const LINEAS = 5;
const ALTO_DIALOGO = 82;
const LETRAS = ["ABCDEFG", "HIJKLMN", "ÑOPQRST", "UVWXYZ-"];
const MAX_NOMBRE = 10;
const BOTON_SONIDO: Caja = { x: W - 20, y: 2, w: 18, h: 16 };
const AVISO_CUADROS = 105;

type Dialogo = {
  paginas: string[][];
  pagina: number;
  mostrados: number;
  quien?: string;
  esperarFinal: boolean;
  entrada: number;
  resolver: () => void;
};

type Menu = {
  opciones: Opcion[];
  idx: number;
  estilo: EstiloMenu;
  titulo?: string;
  cancelable: boolean;
  limite?: number;
  elegido: { idx: number; cuadros: number } | null;
  entrada: number;
  resolver: (i: number) => void;
};

type Teclado = {
  nombre: string;
  idx: number;
  error: string | null;
  validar: (s: string) => string | null;
  resolver: (s: string) => void;
  max: number;
  titulo: string;
  ayuda: string;
};

type Particula = { x: number; y: number; vx: number; vy: number; vida: number; max: number; color: string; tam: number; g: number };
type Flotante = { texto: string; x: number; y: number; vida: number; color: string };
type Sello = { texto: string; sub?: string; color: string; cuadro: number };
type Comentario = { texto: string[]; y: number; color: string; cuadro: number };
type Aviso = { titulo: string; sub: string; color: string; cuadro: number };
type Cortina = { tipo: "barras" | "iris"; k: number; cx: number; cy: number };

export class Motor {
  t = 0;
  escena: Dibujo = () => {};
  sacudida = 0;
  fundido = 0;
  destello = 0;
  readonly audio = new Audio();
  /** Barra superior: progreso u objetivo. */
  barraSuperior: { texto: string; color?: string } | null = null;

  private dialogo: Dialogo | null = null;
  private menuActivo: Menu | null = null;
  private teclado: Teclado | null = null;
  private explorador: Explorador | null = null;
  private resolverExplorar: ((id: string) => void) | null = null;
  private resolverToque: (() => void) | null = null;
  private hablandoEnMundo = false;
  private mini: Minijuego | null = null;
  private particulas: Particula[] = [];
  private flotantes: Flotante[] = [];
  private sello: Sello | null = null;
  private avisos: Aviso[] = [];
  private comentario: Comentario | null = null;
  private cortina: Cortina | null = null;
  private cola: Boton[] = [];
  private sostenidos = new Set<Boton>();
  private raf = 0;
  private escala = 4;
  private readonly pincel: Pincel;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    fuente: string,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d no disponible");
    this.pincel = new Pincel(ctx, fuente);
  }

  get h() {
    return this.pincel.h;
  }

  /** Ajusta la resolución lógica al tamaño de la pantalla (vertical). */
  ajustar(anchoCss: number, altoCss: number, dpr: number) {
    const h = Math.round(Math.max(300, Math.min(420, (W * altoCss) / Math.max(1, anchoCss))));
    this.pincel.h = h;
    this.escala = Math.max(2, Math.min(8, Math.ceil((anchoCss * dpr) / W)));
    this.canvas.width = W * this.escala;
    this.canvas.height = h * this.escala;
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
    this.audio.detener();
  }

  // ── Audio y vibración ────────────────────────────────────

  musica(nombre: Parameters<Audio["musica"]>[0]) {
    this.audio.musica(nombre);
  }

  vibrar(patron: number | number[]) {
    if (this.audio.silencio) return;
    // Chrome bloquea (y avisa en consola) la vibración antes del primer toque.
    if (typeof navigator !== "undefined" && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      navigator.vibrate?.(patron);
    } catch {
      // sin vibración
    }
  }

  // ── Entrada ──────────────────────────────────────────────

  /** Toque en la pantalla, en coordenadas lógicas. */
  tocar(x: number, y: number) {
    this.audio.desbloquear();
    const b = BOTON_SONIDO;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h + 4) {
      this.audio.silencio = !this.audio.silencio;
      return;
    }
    if (this.cortina) return;
    const m = this.menuActivo;
    if (m) {
      if (m.elegido) return;
      for (let i = 0; i < m.opciones.length; i++) {
        const r = this.rectOpcion(m, i);
        if (x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2) {
          m.idx = i;
          this.elegir(m);
          return;
        }
      }
      return;
    }
    if (this.teclado) return this.toqueTeclado(x, y);
    if (this.dialogo) return this.avanzarDialogo();
    if (this.resolverToque) return this.cumplirToque();
    if (this.mini) return this.mini.tocar?.(x, y);
    if (this.explorador && !this.hablandoEnMundo) {
      this.explorador.irA(Math.floor(x / TILE), Math.floor((y + this.explorador.camY) / TILE));
    }
  }

  /** Teclado físico (escritorio). */
  pulsar(b: Boton) {
    this.audio.desbloquear();
    this.cola.push(b);
  }

  sostener(b: Boton, activo: boolean) {
    if (activo) this.sostenidos.add(b);
    else this.sostenidos.delete(b);
  }

  /** Letra escrita con el teclado físico mientras se pide el nombre. */
  letra(ch: string) {
    const k = this.teclado;
    if (!k) return;
    if (ch === "Backspace") k.nombre = k.nombre.slice(0, -1);
    else if (ch === "Enter") this.confirmarNombre();
    else if (/^[a-zñA-ZÑ-]$/.test(ch) && k.nombre.length < k.max) k.nombre += ch.toUpperCase();
  }

  get pidiendoNombre() {
    return this.teclado !== null;
  }

  private procesar() {
    const b = this.cola.shift();
    if (this.menuActivo) {
      const m = this.menuActivo;
      if (m.elegido) {
        if (--m.elegido.cuadros <= 0) {
          this.menuActivo = null;
          this.dialogo = null;
          m.resolver(m.elegido.idx);
        }
        return;
      }
      if (m.limite !== undefined && this.t >= m.limite) {
        this.menuActivo = null;
        this.dialogo = null;
        m.resolver(-2);
        return;
      }
      if (b) this.teclaMenu(m, b);
      return;
    }
    if (this.dialogo) {
      this.escribirLetras();
      if (b === "a" || b === "b") this.avanzarDialogo();
      return;
    }
    if (this.teclado) return;
    if (this.resolverToque) {
      if (b === "a") this.cumplirToque();
      return;
    }
    if (this.mini) {
      if (b) this.mini.tecla?.(b);
      return;
    }
    if (this.explorador && !this.hablandoEnMundo) {
      const e = this.explorador;
      const evento = e.actualizar();
      if (e.pisada) {
        this.audio.pisada();
        const pie = e.pies();
        this.particulas_(pie.x, pie.y, 3, { colores: ["#d8c79a", "#efe2bd"], vel: 0.4, g: -0.01, vida: 14, tam: 1 });
      }
      if (evento) this.manejarEvento(evento);
      else if (b === "a") this.manejarEvento(e.interactuar());
      else {
        const dir = (["arriba", "abajo", "izq", "der"] as Direccion[]).find((d) => this.sostenidos.has(d) || b === d);
        if (dir && e.quieto) this.manejarEvento(e.mover(dir));
      }
    }
  }

  // ── Diálogos ─────────────────────────────────────────────

  decir(texto: string, quien?: string): Promise<void> {
    return this.escribir(texto, quien, true);
  }

  private escribir(texto: string, quien: string | undefined, esperarFinal: boolean): Promise<void> {
    const lineas = envolver(texto, COLUMNAS);
    const paginas: string[][] = [];
    for (let i = 0; i < lineas.length; i += LINEAS) paginas.push(lineas.slice(i, i + LINEAS));
    const entrada = this.dialogo ? this.t - 20 : this.t;
    return new Promise((resolver) => {
      this.dialogo = { paginas, pagina: 0, mostrados: 0, quien: quien ? limpiar(quien) : undefined, esperarFinal, entrada, resolver };
    });
  }

  private total(d: Dialogo) {
    return d.paginas[d.pagina].join("").length;
  }

  private escribirLetras() {
    const d = this.dialogo!;
    if (this.t - d.entrada < 6) return;
    const total = this.total(d);
    if (d.mostrados < total) {
      d.mostrados = Math.min(total, d.mostrados + 1);
      if (d.mostrados % 3 === 0) this.audio.blip();
    } else if (!d.esperarFinal && d.pagina === d.paginas.length - 1) {
      d.resolver();
    }
  }

  private avanzarDialogo() {
    const d = this.dialogo!;
    const total = this.total(d);
    if (d.mostrados < total) {
      d.mostrados = total;
      return;
    }
    if (d.pagina < d.paginas.length - 1) {
      d.pagina++;
      d.mostrados = 0;
      this.audio.mover();
      return;
    }
    if (d.esperarFinal) {
      this.dialogo = null;
      this.audio.mover();
      d.resolver();
    }
  }

  // ── Menús ────────────────────────────────────────────────

  /** Devuelve el índice elegido, -1 si se canceló y -2 si se acabó el tiempo. */
  menu(
    opciones: Opcion[],
    o: { estilo?: EstiloMenu; titulo?: string; cancelable?: boolean; limiteCuadros?: number; inicial?: number } = {},
  ): Promise<number> {
    return new Promise((resolver) => {
      this.menuActivo = {
        opciones,
        idx: o.inicial ?? 0,
        estilo: o.estilo ?? "lista",
        titulo: o.titulo,
        cancelable: o.cancelable ?? false,
        limite: o.limiteCuadros !== undefined ? this.t + o.limiteCuadros : undefined,
        elegido: null,
        entrada: this.t,
        resolver,
      };
    });
  }

  /** Texto + opciones. Si la pregunta no cabe en una página, se lee primero completa. */
  async pregunta(
    texto: string,
    opciones: Opcion[],
    quien?: string,
    o: Parameters<Motor["menu"]>[1] & { corta?: string } = {},
  ): Promise<number> {
    if (envolver(texto, COLUMNAS).length > LINEAS) {
      await this.escribir(texto, quien, true);
      await this.escribir(o.corta ?? "¿Qué respondes?", quien, false);
    } else {
      await this.escribir(texto, quien, false);
    }
    return this.menu(opciones, o);
  }

  get cuadrosRestantesMenu(): number | null {
    const m = this.menuActivo;
    return m?.limite !== undefined ? Math.max(0, m.limite - this.t) : null;
  }

  private elegir(m: Menu) {
    m.elegido = { idx: m.idx, cuadros: 7 };
    this.audio.confirmar();
    this.vibrar(12);
  }

  private teclaMenu(m: Menu, b: Boton) {
    const n = m.opciones.length;
    const cols = m.estilo === "combate" ? 2 : m.estilo === "caras" ? n : 1;
    const mover = (i: number) => {
      if (i >= 0 && i < n && i !== m.idx) {
        m.idx = i;
        this.audio.mover();
      }
    };
    if (b === "arriba") mover(m.idx - cols);
    if (b === "abajo") mover(m.idx + cols);
    if (b === "izq" && cols > 1) mover(m.idx - 1);
    if (b === "der" && cols > 1) mover(m.idx + 1);
    if (b === "a") this.elegir(m);
    if (b === "b" && m.cancelable) {
      this.menuActivo = null;
      this.dialogo = null;
      m.resolver(-1);
    }
  }

  private cajaDialogo(): Caja {
    return { x: 4, y: this.h - ALTO_DIALOGO - 4, w: W - 8, h: ALTO_DIALOGO };
  }

  private rectOpcion(m: Menu, i: number): Caja {
    const d = this.cajaDialogo();
    if (m.estilo === "combate") {
      const col = i % 2;
      const fila = Math.floor(i / 2);
      return { x: d.x + 6 + col * 89, y: d.y + 22 + fila * 29, w: 84, h: 25 };
    }
    if (m.estilo === "caras") {
      return { x: 14 + i * 34, y: d.y - 46, w: 30, h: 30 };
    }
    const n = m.opciones.length;
    const base = this.dialogo ? d.y - 8 : this.h - 10;
    if (m.estilo === "tarjetas") {
      const sep = 4;
      const disponible = base - 44;
      const alto = Math.min(32, Math.floor((disponible - (n - 1) * sep) / n));
      const arriba = base - n * alto - (n - 1) * sep;
      return { x: 8, y: arriba + i * (alto + sep), w: W - 16, h: alto };
    }
    const alto = 22;
    const sep = 5;
    const arriba = base - n * alto - (n - 1) * sep;
    return { x: 10, y: arriba + i * (alto + sep), w: W - 20, h: alto };
  }

  private dibujarTarjeta(p: Pincel, r: Caja, op: Opcion, activo: boolean, presionado: boolean) {
    const hundido = presionado ? 2 : 0;
    const y = r.y + hundido;
    p.alfa(0.35, () => p.rect(PAL.negro, r.x + 1, r.y + 3, r.w, r.h));
    p.rect(PAL.tinta, r.x, y, r.w, r.h);
    p.rect(activo ? "#fff4dc" : PAL.crema, r.x + 1, y + 1, r.w - 2, r.h - 2);
    p.rect(op.color ?? PAL.azul, r.x + 1, y + 1, 5, r.h - 2);
    if (activo) {
      p.rect(PAL.ambar, r.x + 1, y + 1, r.w - 2, 2);
      p.rect(PAL.ambar, r.x + 1, y + r.h - 3, r.w - 2, 2);
    }
    let tx = r.x + 12;
    if (op.bandera) {
      const { colores, vertical } = op.bandera;
      const bw = 18;
      const bh = 12;
      const by = y + Math.round((r.h - bh) / 2);
      p.rect(PAL.tinta, tx - 1, by - 1, bw + 2, bh + 2);
      colores.forEach((c, i) => {
        if (vertical) p.rect(c, tx + Math.round((i * bw) / colores.length), by, Math.ceil(bw / colores.length), bh);
        else p.rect(c, tx, by + Math.round((i * bh) / colores.length), bw, Math.ceil(bh / colores.length));
      });
      tx += bw + 7;
    }
    const maxChars = Math.floor((r.x + r.w - 6 - tx) / 8) - (op.estrellas !== undefined ? 3 : op.marca ? op.marca.texto.length + 1 : 0);
    const dosLineas = op.sub && r.h >= 26;
    p.texto(limpiar(op.texto).slice(0, maxChars), tx, y + (dosLineas ? 5 : Math.round((r.h - 8) / 2)), PAL.tinta);
    if (dosLineas) p.texto(limpiar(op.sub!).slice(0, Math.floor((r.x + r.w - 6 - tx) / 8)), tx, y + r.h - 13, PAL.gris);
    if (op.estrellas !== undefined) {
      const g = ["..X..", "XXXXX", ".XXX.", ".X.X."];
      for (let i = 0; i < 3; i++) p.sprite(g, { X: i < op.estrellas ? PAL.ambar : "#c9bfa9" }, r.x + r.w - 26 + i * 7, y + 5, 1);
      if (op.marca) {
        const mw = op.marca.texto.length * 8 + 6;
        p.rect(op.marca.color, r.x + r.w - mw - 4, y + r.h - 15, mw, 12);
        p.texto(op.marca.texto, r.x + r.w - mw - 1, y + r.h - 13, PAL.blanco);
      }
    } else if (op.marca) {
      const mw = op.marca.texto.length * 8 + 6;
      p.rect(op.marca.color, r.x + r.w - mw - 4, y + 4, mw, 12);
      p.texto(op.marca.texto, r.x + r.w - mw - 1, y + 6, PAL.blanco);
    }
  }

  // ── Teclado de nombre ────────────────────────────────────

  nombre(
    validar: (s: string) => string | null,
    o: { titulo?: string; ayuda?: string; max?: number } = {},
  ): Promise<string> {
    return new Promise((resolver) => {
      this.teclado = {
        nombre: "",
        idx: 0,
        error: null,
        validar,
        resolver,
        max: o.max ?? MAX_NOMBRE,
        titulo: o.titulo ?? "¿Cómo te llamas?",
        ayuda: o.ayuda ?? "Usa un apodo",
      };
    });
  }

  /** Teclado anclado abajo, en la zona del pulgar. */
  private rectTecla(fila: number, col: number): Caja {
    return { x: 6 + col * 26, y: this.h - 168 + fila * 28, w: 24, h: 25 };
  }

  private rectBorrar(): Caja {
    return { x: 8, y: this.h - 46, w: 84, h: 30 };
  }

  private rectListo(): Caja {
    return { x: 100, y: this.h - 46, w: 84, h: 30 };
  }

  private dentro(c: Caja, x: number, y: number) {
    return x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;
  }

  private toqueTeclado(x: number, y: number) {
    const k = this.teclado!;
    if (this.dentro(this.rectBorrar(), x, y)) {
      k.nombre = k.nombre.slice(0, -1);
      k.error = null;
      this.audio.mover();
      return;
    }
    if (this.dentro(this.rectListo(), x, y)) return this.confirmarNombre();
    LETRAS.forEach((fila, fi) => {
      [...fila].forEach((ch, ci) => {
        if (this.dentro(this.rectTecla(fi, ci), x, y) && k.nombre.length < k.max) {
          k.nombre += ch;
          k.error = null;
          k.idx = fi * 7 + ci;
          this.audio.blip();
          this.vibrar(8);
        }
      });
    });
  }

  private confirmarNombre() {
    const k = this.teclado!;
    const error = k.nombre.trim() ? k.validar(k.nombre.trim()) : "Escribe un apodo.";
    if (error) {
      k.error = error;
      this.audio.fallo();
      return;
    }
    this.teclado = null;
    this.audio.confirmar();
    k.resolver(k.nombre.trim());
  }

  // ── Minijuegos ───────────────────────────────────────────

  /** Pone un minijuego en pantalla: recibe toques y teclas mientras no haya diálogo ni menú. */
  minijuego(mj: Minijuego | null) {
    this.mini = mj;
    if (mj) this.escena = mj.dibujar;
  }

  // ── Exploración ──────────────────────────────────────────

  /** Cámara del último barrio explorado (para cerrar el iris sobre una puerta). */
  camaraMundo = 0;

  explorar(cfg: ConfigMundo): Promise<string> {
    this.explorador = new Explorador(cfg);
    const exp = this.explorador;
    this.escena = (p, t) => exp.dibujar(p, t);
    return new Promise((resolver) => {
      this.resolverExplorar = (id) => {
        this.camaraMundo = exp.camY;
        this.explorador = null;
        this.resolverExplorar = null;
        resolver(id);
      };
    });
  }

  private manejarEvento(e: ReturnType<Explorador["interactuar"]>) {
    if (!e) return;
    if (e.tipo === "objetivo") {
      this.audio.confirmar();
      this.resolverExplorar?.(e.id);
      return;
    }
    this.hablandoEnMundo = true;
    void (async () => {
      for (const linea of e.lineas) await this.decir(linea);
      this.hablandoEnMundo = false;
    })();
  }

  // ── Efectos ──────────────────────────────────────────────

  particulas_(
    x: number,
    y: number,
    n: number,
    o: { colores: string[]; vel?: number; g?: number; vida?: number; tam?: number; haciaX?: number; haciaY?: number },
  ) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = (o.vel ?? 1.5) * (0.4 + Math.random() * 0.8);
      let vx = Math.cos(ang) * v;
      let vy = Math.sin(ang) * v;
      const vida = (o.vida ?? 40) * (0.7 + Math.random() * 0.6);
      if (o.haciaX !== undefined && o.haciaY !== undefined) {
        vx = (o.haciaX - x) / vida + (Math.random() - 0.5) * 0.8;
        vy = (o.haciaY - y) / vida - 1.2 + Math.random() * 0.6;
      }
      this.particulas.push({ x, y, vx, vy, vida, max: vida, color: o.colores[i % o.colores.length], tam: o.tam ?? 2, g: o.g ?? 0.06 });
    }
  }

  confeti() {
    for (let i = 0; i < 70; i++) {
      this.particulas.push({
        x: Math.random() * W,
        y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.6 + Math.random() * 1.2,
        vida: 160,
        max: 160,
        color: [PAL.ambar, PAL.verde, PAL.celeste, PAL.rojo, PAL.blanco][i % 5],
        tam: 2,
        g: 0.01,
      });
    }
  }

  flotante(texto: string, x: number, y: number, color: string = PAL.rojo) {
    this.flotantes.push({ texto, x, y, vida: 50, color });
  }

  async sellar(texto: string, color: string, sub?: string, ms = 1400) {
    this.sello = { texto, sub, color, cuadro: 0 };
    this.audio.sello();
    this.vibrar([30, 40, 30]);
    this.sacudir(8);
    await this.esperar(ms);
    this.sello = null;
  }

  /** Cartel que baja desde arriba (logros, récords, subir de rango). No bloquea. */
  aviso(titulo: string, sub: string, color: string = PAL.ambar) {
    this.avisos.push({ titulo, sub, color, cuadro: 0 });
  }

  /**
   * El comentarista: un globo corto (jerga del país) que aparece en `y` y se
   * va solo. Reemplaza al anterior; no bloquea el juego.
   */
  comentar(texto: string, o: { y?: number; color?: string } = {}) {
    this.comentario = { texto: envolver(texto, 21).slice(0, 3), y: o.y ?? 40, color: o.color ?? PAL.ambar, cuadro: 0 };
  }

  /** Cuadros que faltan para que se vean todos los avisos en cola. */
  get avisosPendientes() {
    return this.avisos.reduce((s, a) => s + (AVISO_CUADROS - a.cuadro), 0);
  }

  sacudir(cuadros = 16) {
    this.sacudida = cuadros;
  }

  // ── Transiciones ─────────────────────────────────────────

  /** Barras horizontales que cubren la pantalla (entrada al combate). */
  async barras(cubrir: boolean) {
    this.cortina = { tipo: "barras", k: cubrir ? 0 : 1, cx: 0, cy: 0 };
    await this.animar(22, (k) => {
      this.cortina!.k = cubrir ? k : 1 - k;
    });
    if (!cubrir) this.cortina = null;
  }

  /** Círculo que se cierra sobre (cx, cy) o se abre desde ahí. */
  async iris(cerrar: boolean, cx = W / 2, cy?: number) {
    const y = cy ?? this.h / 2;
    this.cortina = { tipo: "iris", k: cerrar ? 0 : 1, cx, cy: y };
    await this.animar(24, (k) => {
      this.cortina!.k = cerrar ? facil.salida(k) : 1 - facil.salida(k);
    });
    if (!cerrar) this.cortina = null;
  }

  async fundirA(negro: boolean, cuadros = 16) {
    const desde = this.fundido;
    const hasta = negro ? 1 : 0;
    await this.animar(cuadros, (k) => {
      this.fundido = desde + (hasta - desde) * k;
    });
    this.fundido = hasta;
  }

  /** Quita cualquier cortina y fundido de golpe (al cambiar de escena tapada). */
  descubrirYa() {
    this.cortina = null;
  }

  // ── Utilidades para guiones ──────────────────────────────

  /** Espera un toque; con `ms`, sigue sola pasado ese tiempo. */
  esperarToque(ms?: number): Promise<void> {
    return new Promise((r) => {
      this.resolverToque = r;
      if (ms) {
        window.setTimeout(() => {
          if (this.resolverToque === r) {
            this.resolverToque = null;
            r();
          }
        }, ms);
      }
    });
  }

  private cumplirToque() {
    const r = this.resolverToque!;
    this.resolverToque = null;
    this.audio.confirmar();
    r();
  }

  esperar(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
  }

  async animar(cuadros: number, paso: (k: number) => void) {
    for (let i = 1; i <= cuadros; i++) {
      paso(i / cuadros);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  // ── Dibujo ───────────────────────────────────────────────

  private dibujar() {
    const p = this.pincel;
    const c = p.ctx;
    c.setTransform(this.escala, 0, 0, this.escala, 0, 0);
    c.imageSmoothingEnabled = false;
    p.rect(PAL.negro, 0, 0, W, this.h);

    c.save();
    if (this.sacudida > 0) {
      this.sacudida--;
      c.translate(((this.t % 4) - 2) * 1, ((this.t % 3) - 1) * 1);
    }
    if (this.teclado) this.dibujarTeclado(p);
    else this.escena(p, this.t);
    this.dibujarParticulas(p);
    c.restore();

    if (this.destello > 0) {
      this.destello--;
      if (this.destello % 4 < 2) p.alfa(0.7, () => p.rect(PAL.blanco, 0, 0, W, this.h));
    }
    if (this.sello) this.dibujarSello(p, this.sello);
    if (this.comentario) this.dibujarComentario(p, this.comentario);
    if (this.avisos.length > 0) this.dibujarAviso(p, this.avisos[0]);
    if (this.barraSuperior && !this.teclado) this.dibujarBarraSuperior(p);
    if (this.dialogo) this.dibujarDialogo(p, this.dialogo);
    if (this.menuActivo) this.dibujarMenu(p, this.menuActivo);
    if (this.cortina) this.dibujarCortina(p, this.cortina);
    if (this.fundido > 0) p.alfa(this.fundido, () => p.rect(PAL.negro, 0, 0, W, this.h));
    this.dibujarBotonSonido(p);
  }

  private dibujarParticulas(p: Pincel) {
    this.particulas = this.particulas.filter((q) => q.vida > 0);
    for (const q of this.particulas) {
      q.vida--;
      q.x += q.vx;
      q.y += q.vy;
      q.vy += q.g;
      p.alfa(Math.min(1, (q.vida / q.max) * 2), () => p.rect(q.color, q.x, q.y, q.tam, q.tam));
    }
    this.flotantes = this.flotantes.filter((f) => f.vida > 0);
    for (const f of this.flotantes) {
      f.vida--;
      f.y -= 0.5;
      p.alfa(Math.min(1, f.vida / 15), () => p.textoSombra(f.texto, f.x, f.y, f.color, PAL.tinta));
    }
  }

  private dibujarSello(p: Pincel, s: Sello) {
    s.cuadro++;
    const k = Math.min(1, s.cuadro / 10);
    const escala = 1 + (1 - facil.salida(k)) * 1.5;
    const cy = Math.round(this.h * 0.32);
    p.alfa(k, () =>
      p.escalado(W / 2, cy, escala, () => {
        const ancho = Math.max(p.ancho(s.texto, 16), s.sub ? p.ancho(s.sub) : 0) + 20;
        const x = (W - ancho) / 2;
        const alto = s.sub ? 40 : 30;
        p.rect(PAL.tinta, x - 2, cy - alto / 2 - 2, ancho + 4, alto + 4);
        p.rect(s.color, x, cy - alto / 2, ancho, alto);
        p.rect("rgba(255,255,255,0.35)", x + 2, cy - alto / 2 + 2, ancho - 4, 2);
        p.centrado(s.texto, cy - alto / 2 + 7, PAL.blanco, 16, PAL.tinta);
        if (s.sub) p.centrado(s.sub, cy + 8, PAL.tinta);
      }),
    );
  }

  private dibujarComentario(p: Pincel, c: Comentario) {
    c.cuadro++;
    const dura = 80 + c.texto.join("").length * 2;
    if (c.cuadro > dura) {
      this.comentario = null;
      return;
    }
    const k = facil.rebote(Math.min(1, c.cuadro / 10));
    const salida = Math.max(0, (c.cuadro - (dura - 10)) / 10);
    const alto = c.texto.length * 11 + 8;
    const ancho = Math.max(...c.texto.map((l) => l.length)) * 8 + 16;
    const x = Math.round((W - ancho) / 2);
    p.alfa(1 - salida, () =>
      p.escalado(W / 2, c.y + alto / 2, 0.6 + 0.4 * k, () => {
        p.alfa(0.4, () => p.rect(PAL.negro, x + 2, c.y + 3, ancho, alto));
        p.rect(PAL.tinta, x, c.y, ancho, alto);
        p.rect(c.color, x + 1, c.y + 1, ancho - 2, alto - 2);
        p.rect("rgba(255,255,255,0.3)", x + 2, c.y + 2, ancho - 4, 1);
        // colita del globo
        p.rect(PAL.tinta, x + 10, c.y + alto, 6, 3);
        p.rect(c.color, x + 11, c.y + alto - 1, 4, 3);
        c.texto.forEach((l, i) => p.centrado(l, c.y + 5 + i * 11, PAL.tinta, 8, undefined, x, ancho));
      }),
    );
  }

  private dibujarAviso(p: Pincel, a: Aviso) {
    if (a.cuadro === 0) {
      this.audio.logro();
      this.vibrar([20, 30, 20]);
    }
    a.cuadro++;
    const entrada = facil.salida(Math.min(1, a.cuadro / 12));
    const salida = Math.max(0, (a.cuadro - (AVISO_CUADROS - 12)) / 12);
    // Arriba de todo, en la franja de cabeceras: no tapa botones ni tarjetas.
    const y = Math.round(-34 + 36 * entrada - 36 * salida);
    const x = 4;
    const w = W - 28;
    p.alfa(0.4, () => p.rect(PAL.negro, x + 2, y + 3, w, 28));
    p.rect(PAL.tinta, x, y, w, 28);
    p.rect(a.color, x + 1, y + 1, w - 2, 26);
    p.rect("rgba(255,255,255,0.35)", x + 2, y + 2, w - 4, 2);
    // brillo que cruza
    const bx = ((a.cuadro * 4) % (w + 60)) - 30;
    p.alfa(0.35, () => p.rect(PAL.blanco, x + bx, y + 1, 6, 26));
    // estrella
    const sx = x + 6;
    const sy = y + 6;
    p.rect(PAL.blanco, sx + 6, sy, 4, 16);
    p.rect(PAL.blanco, sx, sy + 6, 16, 4);
    p.rect(PAL.blanco, sx + 3, sy + 3, 10, 10);
    p.rect(a.color, sx + 6, sy + 6, 4, 4);
    p.texto(limpiar(a.titulo).slice(0, 15), x + 28, y + 5, PAL.tinta);
    p.texto(limpiar(a.sub).slice(0, 15), x + 28, y + 16, PAL.blanco);
    if (a.cuadro >= AVISO_CUADROS) this.avisos.shift();
  }

  private dibujarBarraSuperior(p: Pincel) {
    const b = this.barraSuperior!;
    const texto = limpiar(b.texto).slice(0, 19);
    const ancho = texto.length * CARACTER + 14;
    p.alfa(0.35, () => p.rect(PAL.negro, 4, 5, ancho, 14));
    p.rect(PAL.tinta, 3, 2, ancho, 14);
    p.rect(b.color ?? PAL.navy, 4, 3, ancho - 2, 12);
    p.texto(texto, 10, 5, PAL.crema);
  }

  private dibujarBotonSonido(p: Pincel) {
    const b = BOTON_SONIDO;
    p.rect(PAL.tinta, b.x, b.y, b.w, b.h);
    p.rect(PAL.navy, b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // parlante
    p.rect(PAL.crema, b.x + 4, b.y + 6, 3, 4);
    p.rect(PAL.crema, b.x + 7, b.y + 4, 2, 8);
    if (this.audio.silencio) {
      for (let i = 0; i < 5; i++) {
        p.rect(PAL.rojo, b.x + 10 + i, b.y + 5 + i, 1, 1);
        p.rect(PAL.rojo, b.x + 14 - i, b.y + 5 + i, 1, 1);
      }
    } else {
      p.rect(PAL.crema, b.x + 11, b.y + 6, 1, 4);
      p.rect(PAL.crema, b.x + 13, b.y + 4, 1, 8);
    }
  }

  private dibujarDialogo(p: Pincel, d: Dialogo) {
    const c = this.cajaDialogo();
    const k = Math.min(1, (this.t - d.entrada) / 6);
    const y = c.y + Math.round((1 - facil.salida(k)) * 30);
    if (d.quien) {
      const ancho = d.quien.length * CARACTER + 12;
      p.caja(c.x + 4, y - 14, ancho, 17, PAL.navy, PAL.tinta, PAL.ambar);
      p.texto(d.quien, c.x + 10, y - 9, PAL.crema);
    }
    p.caja(c.x, y, c.w, c.h);
    let resto = d.mostrados;
    d.paginas[d.pagina].forEach((linea, i) => {
      p.texto(linea.slice(0, Math.max(0, resto)), c.x + 9, y + 9 + i * 13, PAL.tinta);
      resto -= linea.length;
    });
    const completa = d.mostrados >= this.total(d);
    const ultima = d.pagina === d.paginas.length - 1;
    if (completa && (d.esperarFinal || !ultima)) {
      const rebote = Math.floor(this.t / 10) % 2;
      p.flechaAbajo(c.x + c.w - 15, y + c.h - 12 + rebote);
    }
  }

  private dibujarMenu(p: Pincel, m: Menu) {
    const k = Math.min(1, (this.t - m.entrada) / 8);
    const c = this.cajaDialogo();
    if (m.estilo === "combate") {
      p.caja(c.x, c.y, c.w, c.h);
      if (m.titulo) p.texto(m.titulo, c.x + 9, c.y + 8, PAL.azul);
    }
    if (m.estilo === "caras") {
      const r0 = this.rectOpcion(m, 0);
      p.caja(6, r0.y - 8, W - 12, 46);
    }
    if (m.estilo === "tarjetas") {
      // Tablero sólido detrás de las tarjetas: que no se asome la escena por los huecos.
      const r0 = this.rectOpcion(m, 0);
      const arriba = r0.y - (m.titulo ? 28 : 8);
      const kk = facil.salida(Math.min(1, k * 1.5));
      const y = Math.round(arriba + (1 - kk) * 40);
      p.alfa(0.3, () => p.rect(PAL.negro, 0, y - 3, W, 3));
      p.rect(PAL.tinta, 0, y, W, this.h - y);
      p.rect("#232c45", 0, y + 2, W, this.h - y - 2);
      p.rect(PAL.ambar, 0, y, W, 2);
      for (let i = 6; i < W; i += 12) p.rect("#2b3554", i, y + 6, 2, 2);
    }
    if (m.titulo && (m.estilo === "lista" || m.estilo === "tarjetas")) {
      const r0 = this.rectOpcion(m, 0);
      const ancho = p.ancho(m.titulo) + 12;
      p.caja(10, r0.y - 20, ancho, 17, PAL.navy, PAL.tinta, PAL.ambar);
      p.texto(m.titulo, 16, r0.y - 15, PAL.crema);
    }
    m.opciones.forEach((op, i) => {
      const r = this.rectOpcion(m, i);
      const desfase = Math.round((1 - facil.salida(Math.max(0, Math.min(1, k * 1.4 - i * 0.12 + 0.12)))) * 24);
      const presionado = m.elegido?.idx === i;
      const activo = i === m.idx;
      if (m.estilo === "caras") {
        if (activo) p.rect(PAL.ambar, r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        p.escalado(r.x + 15, r.y + 15, presionado ? 1.8 : 2, () => cara(p, r.x + 8, r.y + 8, i));
        return;
      }
      const caja = { ...r, x: r.x + (m.estilo === "lista" || m.estilo === "tarjetas" ? desfase : 0) };
      if (m.estilo === "tarjetas") this.dibujarTarjeta(p, caja, op, activo, presionado);
      else p.boton(caja, op.texto, { activo, presionado, color: op.color });
    });
    const info = m.opciones[m.idx]?.info;
    if (info) {
      const lineas = envolver(info, 21).slice(0, 7);
      const alto = lineas.length * 12 + 14;
      p.caja(4, 22, W - 8, alto, PAL.crema, PAL.tinta, PAL.ambar);
      lineas.forEach((l, i) => p.texto(l, 11, 29 + i * 12, PAL.tinta));
    }
  }

  private dibujarTeclado(p: Pincel) {
    const k = this.teclado!;
    p.rect(PAL.crema, 0, 0, W, this.h);
    for (let i = 0; i < W; i += 16) p.rect("#efe0c4", i, 0, 8, this.h);
    p.caja(6, 24, W - 12, 46);
    p.texto(k.titulo, 14, 33, PAL.azul);
    if (k.error) envolver(k.error, 20).slice(0, 1).forEach((l) => p.texto(l, 14, 51, PAL.rojo));
    else p.texto(k.ayuda, 14, 51, PAL.gris);
    // El apodo, grande, en el centro
    const medio = Math.round((70 + this.h - 168) / 2) - 8;
    const visible = k.nombre + (this.t % 40 < 20 ? "_" : " ");
    p.centrado(visible.padEnd(k.max + 1, " ").slice(0, k.max + 1).trimEnd() || "_", medio, PAL.tinta, 16, PAL.ambar);
    LETRAS.forEach((fila, fi) => {
      [...fila].forEach((ch, ci) => {
        const r = this.rectTecla(fi, ci);
        p.boton(r, ch, { activo: fi * 7 + ci === k.idx && this.t % 60 < 40 && k.nombre.length > 0 });
      });
    });
    p.boton(this.rectBorrar(), "BORRAR", { color: "#f4c7c3" });
    p.boton(this.rectListo(), "LISTO", { color: "#bfe8c9" });
  }

  private dibujarCortina(p: Pincel, c: Cortina) {
    if (c.tipo === "barras") {
      const n = 12;
      const alto = Math.ceil(this.h / n);
      for (let i = 0; i < n; i++) {
        const w = Math.round(W * Math.min(1, c.k * 1.3 - (i % 3) * 0.1));
        if (w <= 0) continue;
        p.rect(PAL.negro, i % 2 ? W - w : 0, i * alto, w, alto);
      }
      return;
    }
    // iris
    const r = Math.max(0, (1 - c.k) * Math.hypot(W, this.h));
    const ctx = p.ctx;
    ctx.save();
    ctx.fillStyle = PAL.negro;
    ctx.beginPath();
    ctx.rect(0, 0, W, this.h);
    ctx.arc(c.cx, c.cy, r, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }

  /** Foto del estado, para pruebas end-to-end (`/play?depurar`). */
  estado() {
    const d = this.dialogo;
    const m = this.menuActivo;
    return {
      t: this.t,
      h: this.h,
      dialogo: d ? d.paginas[d.pagina].join(" ") : null,
      quien: d?.quien ?? null,
      menu: m ? { opciones: m.opciones.map((o) => o.texto), rects: m.opciones.map((_, i) => this.rectOpcion(m, i)) } : null,
      teclado: this.teclado ? { nombre: this.teclado.nombre } : null,
      explorando: this.explorador ? { x: this.explorador.x, y: this.explorador.y, quieto: this.explorador.quieto, camY: this.explorador.camY } : null,
      esperandoToque: this.resolverToque !== null,
      barra: this.barraSuperior?.texto ?? null,
      cortina: this.cortina !== null,
      minijuego: this.mini ? (this.mini.info?.() ?? true) : null,
    };
  }
}
