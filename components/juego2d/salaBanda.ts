import { golpearSala, verSala, type VistaSala } from "@/components/juego/api";
import { DESTINOS, MONTOS, SENALES, TACTICAS, VICTIMAS, explicar, soles } from "@/components/juego/datos";
import type { Caso } from "@/lib/contracts";
import type { Golpe } from "@/lib/juego/golpes";
import type { GolpeRegistrado } from "@/lib/juego/salas";
import { frase } from "./jerga";
import type { Boton, Motor } from "./motor";
import { PAISES, type Pais, type PaisId } from "./paises";
import { PAL, Pincel, W, envolver, facil, type Caja } from "./pincel";
import { dibujarQR } from "./qr";

/**
 * Pantalla de una sala EN VIVO · LA BANDA (DEMO_JUEGO §17).
 *
 * Todos atacan a la vez durante una sola fase. El jugador arma su golpe con
 * cinco perillas (víctima, táctica, cuenta, monto, hora) y lo lanza; el
 * servidor lo pasa por el **pipeline real** y devuelve el caso. Aquí solo se
 * dibuja lo que decidió el sistema: qué señales vieron las reglas, si frenó o
 * pasó, por qué, y cuánta IA costó.
 *
 * El reloj y el puntaje son del servidor (como en las salas de cartas), así
 * que la latencia no rompe la partida.
 *
 * Dueño: Ale_dev.
 */

export type ResultadoBanda = {
  puntaje: number;
  posicion: number;
  jugadores: number;
  golpes: number;
  huecos: number;
  /** Golpes propios, para registrarlos como dato del evento. */
  intentos: Array<{ caso: string; tactica: string }>;
};

const SONDEO_MS = 600;
/** Cuánto se queda en pantalla el resultado de un golpe. */
const RESULTADO_MS = 4_200;

type FilaId = "victima" | "tactica" | "destino" | "monto" | "hora";
const FILAS: Array<{ id: FilaId; etiqueta: string; opciones: number }> = [
  { id: "victima", etiqueta: "A QUIÉN", opciones: VICTIMAS.length },
  { id: "tactica", etiqueta: "CÓMO", opciones: TACTICAS.length },
  { id: "destino", etiqueta: "CUENTA", opciones: DESTINOS.length },
  { id: "monto", etiqueta: "CUÁNTO", opciones: MONTOS.length },
  { id: "hora", etiqueta: "CUÁNDO", opciones: 2 },
];

const ALTO_FILA = 21;
/** Las perillas arrancan debajo del reloj; el resto del alto es para el feed. */
const Y_FILAS = 40;

export function pantallaSalaBanda(
  m: Motor,
  cfg: { codigo: string; token: string | null; alias: string; pais: Pais; alTerminar: (r: ResultadoBanda) => void },
): Promise<void> {
  const { codigo, token, alias, pais } = cfg;
  const nombreVictima = (i: number) => [pais.rosa, pais.jorge, pais.lucia][i] ?? VICTIMAS[i].nombre;
  let vista: VistaSala | null = null;
  let recibida = 0;
  let error: string | null = null;
  let aviso: { texto: string; hasta: number } | null = null;
  let faseVista = "";
  let cambio = m.t;
  let sel = 0;
  const idx: Record<FilaId, number> = { victima: 0, tactica: 0, destino: 0, monto: 0, hora: 0 };
  let presionado: string | null = null;
  let enviando = false;
  let resultado: { golpe: GolpeRegistrado; caso: Caso; hasta: number } | null = null;
  let mios: Array<{ caso: string; tactica: string }> = [];
  let terminadoEnviado = false;
  let salir = false;
  let ultimoTic = -1;
  let resolver: () => void = () => {};
  const listo = new Promise<void>((r) => (resolver = r));
  const urlSala = `${window.location.origin}/play?sala=${codigo}`;

  const restante = () => (vista?.restante_ms == null ? 0 : Math.max(0, vista.restante_ms - (performance.now() - recibida)));

  const golpeActual = (): Golpe => ({
    victima: VICTIMAS[idx.victima].id,
    tactica: TACTICAS[idx.tactica].id,
    destino: DESTINOS[idx.destino].id as Golpe["destino"],
    monto: MONTOS[idx.monto].id,
    madrugada: idx.hora === 1,
  });

  const alCambiarFase = (v: VistaSala) => {
    cambio = m.t;
    if (v.fase === "cuenta") m.musica(null);
    if (v.fase === "ataque") {
      m.musica("llamada");
      m.audio.whoosh();
      m.comentar(frase(pais.id, "lobby"), { y: Math.max(140, m.h - 150) });
    }
    if (v.fase === "espera") {
      m.musica("titulo");
      terminadoEnviado = false;
      mios = [];
      resultado = null;
    }
    if (v.fase === "fin") {
      m.musica("guardian");
      const b = v.banda;
      const pos = v.mio?.posicion ?? 0;
      if (b && b.huecos === 0) m.audio.alarma();
      else m.audio.exito();
      if (pos > 0 && pos <= 3) m.confeti();
      if (!terminadoEnviado) {
        terminadoEnviado = true;
        cfg.alTerminar({
          puntaje: v.mio?.puntaje ?? 0,
          posicion: pos,
          jugadores: v.jugadores.length,
          golpes: v.mio?.banda?.golpes ?? 0,
          huecos: v.mio?.banda?.huecos ?? 0,
          intentos: mios,
        });
      }
    }
  };

  // Si la pantalla deja de dibujarse (se salió por la pausa), se deja de consultar.
  let ultimoDibujo = performance.now();
  let detenido = false;
  const consultar = async () => {
    if (salir) return;
    if (performance.now() - ultimoDibujo > 4000) {
      detenido = true;
      return;
    }
    try {
      const v = await verSala(codigo, alias);
      vista = v;
      recibida = performance.now();
      error = null;
      if (v.fase !== faseVista) {
        faseVista = v.fase;
        alCambiarFase(v);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Sin conexión";
    }
    if (!salir) window.setTimeout(() => void consultar(), SONDEO_MS);
  };
  void consultar();

  const filaCaja = (i: number): Caja => ({ x: 6, y: Y_FILAS + i * ALTO_FILA, w: W - 12, h: ALTO_FILA - 3 });

  const botones = (h: number) => {
    const v = vista;
    const anfitrion = token !== null;
    if (v?.fase === "ataque") return { lanzar: { x: 6, y: h - 52, w: W - 12, h: 40 } as Caja };
    if ((v?.fase === "espera" || v?.fase === "fin") && anfitrion)
      return { principal: { x: 8, y: h - 48, w: 116, h: 36 } as Caja, salir: { x: 130, y: h - 48, w: 54, h: 36 } as Caja };
    if (v?.fase === "espera" || v?.fase === "fin") return { salir: { x: 40, y: h - 48, w: 112, h: 36 } as Caja };
    return {};
  };

  const pulsar = (id: string) => {
    presionado = id;
    window.setTimeout(() => (presionado = null), 140);
  };

  const mover = (fila: FilaId, paso: number) => {
    const f = FILAS.find((x) => x.id === fila)!;
    idx[fila] = (idx[fila] + paso + f.opciones) % f.opciones;
    m.audio.mover();
    m.vibrar(6);
  };

  const lanzar = async () => {
    if (!vista || vista.fase !== "ataque" || enviando || resultado) return;
    enviando = true;
    pulsar("lanzar");
    m.audio.golpe();
    m.vibrar(40);
    m.sacudir(8);
    try {
      const r = await golpearSala(codigo, alias, golpeActual());
      vista = r.vista;
      recibida = performance.now();
      resultado = { golpe: r.golpe, caso: r.caso, hasta: m.t + RESULTADO_MS / 16 };
      mios.push({ caso: r.golpe.caso, tactica: r.golpe.tactica });
      if (r.golpe.frenado) {
        m.audio.alarma();
        m.vibrar([50, 40, 50]);
      } else {
        m.audio.monedas();
        m.confeti();
        m.flotante(`+${r.golpe.puntos}`, W / 2, 70, PAL.ambar);
      }
    } catch (e) {
      const texto = e instanceof Error ? e.message : "No se pudo lanzar";
      aviso = { texto, hasta: m.t + 150 };
      m.audio.error();
    } finally {
      enviando = false;
    }
  };

  let confirmando = false;
  const principal = async () => {
    if (!token || !vista || confirmando) return;
    pulsar("principal");
    m.audio.confirmar();
    const fin = vista.fase === "fin";
    const solo = vista.jugadores.length < 2;
    if (fin || solo) {
      confirmando = true;
      const ok = await m
        .confirmar(
          fin ? "¿Otra ronda? Los puntajes vuelven a cero." : "Solo estás tú en la sala. ¿Empezar igual?",
          fin ? "¡OTRA RONDA!" : "EMPEZAR",
          "ESPERAR",
        )
        .catch(() => false);
      confirmando = false;
      if (!ok) return;
    }
    try {
      const { accionSala } = await import("@/components/juego/api");
      vista = await accionSala(codigo, { accion: vista.fase === "fin" ? "reiniciar" : "iniciar", token });
      recibida = performance.now();
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudo";
    }
  };

  const irse = async () => {
    if (confirmando) return;
    pulsar("salir");
    m.audio.mover();
    if (token && vista?.fase === "espera" && vista.jugadores.length > 1) {
      confirmando = true;
      const ok = await m.confirmar("Hay gente esperando y tú eres el anfitrión. ¿Salir igual?", "SALIR", "QUEDARME").catch(() => false);
      confirmando = false;
      if (!ok) return;
    }
    salir = true;
    window.setTimeout(() => {
      m.minijuego(null);
      resolver();
    }, 150);
  };

  const tocar = (x: number, y: number) => {
    const b = botones(m.h) as Record<string, Caja | undefined>;
    const en = (c?: Caja) => !!c && x >= c.x - 3 && x < c.x + c.w + 3 && y >= c.y - 5 && y < c.y + c.h + 5;
    // Con el resultado en pantalla, tocar lo cierra (y no se arma otro golpe por error).
    if (resultado) {
      resultado = null;
      m.audio.blip();
      return;
    }
    if (en(b.lanzar)) {
      void lanzar();
      return;
    }
    if (en(b.principal)) {
      void principal();
      return;
    }
    if (en(b.salir)) {
      void irse();
      return;
    }
    if (vista?.fase !== "ataque") return;
    for (let i = 0; i < FILAS.length; i++) {
      const c = filaCaja(i);
      if (y >= c.y - 2 && y < c.y + c.h + 2 && x >= c.x - 2 && x < c.x + c.w + 2) {
        sel = i;
        // El tercio izquierdo retrocede; el resto avanza.
        mover(FILAS[i].id, x < c.x + c.w / 3 ? -1 : 1);
        return;
      }
    }
  };

  const tecla = (bt: Boton) => {
    if (resultado) {
      if (bt === "a" || bt === "b") resultado = null;
      return;
    }
    if (vista?.fase === "ataque") {
      if (bt === "abajo") sel = Math.min(FILAS.length - 1, sel + 1);
      if (bt === "arriba") sel = Math.max(0, sel - 1);
      if (bt === "der") mover(FILAS[sel].id, 1);
      if (bt === "izq") mover(FILAS[sel].id, -1);
      if (bt === "a") void lanzar();
      return;
    }
    if (bt === "a" && token && (vista?.fase === "espera" || vista?.fase === "fin")) void principal();
    if (bt === "b" && (vista?.fase === "espera" || vista?.fase === "fin")) void irse();
  };

  const valorFila = (id: FilaId): { texto: string; pista: string } => {
    if (id === "victima") {
      const v = VICTIMAS[idx.victima];
      return { texto: nombreVictima(idx.victima).toUpperCase(), pista: v.situacion };
    }
    if (id === "tactica") {
      const t = TACTICAS[idx.tactica];
      return { texto: t.nombre.toUpperCase(), pista: t.comun };
    }
    if (id === "destino") {
      const d = DESTINOS[idx.destino];
      return { texto: `ALQUILADA #${idx.destino + 1}`, pista: d.detalle };
    }
    if (id === "monto") {
      const mo = MONTOS[idx.monto];
      return { texto: soles(mo.monto), pista: mo.nombre };
    }
    return idx.hora === 1
      ? { texto: "DE MADRUGADA", pista: "Un horario raro es una señal" }
      : { texto: "DE DÍA", pista: "Cuando está ocupada" };
  };

  /** Panel con lo que el sistema decidió: el corazón del modo. */
  const dibujarResultado = (p: Pincel, h: number, t: number) => {
    const r = resultado!;
    const g = r.golpe;
    const k = facil.salida(Math.min(1, (t - (r.hasta - RESULTADO_MS / 16)) / 8));
    const y0 = 24;
    p.alfa(0.9, () => p.rect(PAL.negro, 0, y0, W, h - y0 - 56));
    const sello = g.frenado ? "FRENADO" : "¡HUECO!";
    const color = g.frenado ? PAL.rojo : PAL.ambar;
    p.escalado(W / 2, y0 + 14, 1 + (1 - k) * 0.6, () => {
      p.rect(PAL.tinta, 8, y0 + 6, W - 16, 18);
      p.rect(color, 9, y0 + 7, W - 18, 16);
      p.centrado(sello, y0 + 11, g.frenado ? PAL.blanco : PAL.tinta);
    });

    let y = y0 + 30;
    // Lo que vieron las reglas, sin IA.
    const senales = r.caso.nivel0.senales.slice(0, 3);
    if (senales.length === 0) {
      p.texto("Reglas: ninguna señal", 8, y, PAL.grisClaro);
      y += 11;
    } else {
      for (const s of senales) {
        p.texto(`· ${envolver(SENALES[s] ?? s, 21)[0]}`, 8, y, PAL.crema);
        y += 10;
      }
    }
    y += 3;
    const exp = explicar(g.regla);
    p.texto(exp.titulo.slice(0, 23), 8, y, color);
    y += 11;
    for (const linea of envolver(exp.detalle, 23).slice(0, 4)) {
      p.texto(linea, 8, y, PAL.grisClaro);
      y += 10;
    }
    y += 2;
    if (g.frenado && g.llamadas_ia === 0) {
      p.texto("IA gastada: 0 llamadas", 8, y, PAL.verde);
      y += 11;
    } else if (g.llamadas_ia > 0) {
      p.texto(`IA: ${g.llamadas_ia} llamada(s)`, 8, y, PAL.celeste);
      y += 11;
    }
    const puntos = g.descubrimiento ? `+${g.puntos} ¡DESCUBRIMIENTO!` : `+${g.puntos}`;
    p.texto(puntos, 8, y, PAL.ambar);
    p.centrado("toca para seguir", h - 62, PAL.gris);
  };

  const dibujar = (p: Pincel, t: number) => {
    ultimoDibujo = performance.now();
    if (detenido && !salir) {
      detenido = false;
      void consultar();
    }
    const h = p.h;
    const v = vista;
    const f = t - cambio;
    p.degradado(0, h, "#2a0f1e", "#141a3a");
    for (let i = 0; i < 6; i++) p.alfa(0.08, () => p.rect(PAL.rojo, 0, (i * 67 + t) % h, W, 1));

    // Cabecera
    p.rect(PAL.rojoOscuro, 0, 0, W, 20);
    if (Math.floor(t / 20) % 2 === 0) p.circulo(9, 10, 3, PAL.blanco);
    p.texto(`BANDA ${codigo}`, 16, 6, PAL.blanco);
    if (v) p.texto(`${v.jugadores.length}`, 156 - p.ancho(String(v.jugadores.length)), 6, PAL.crema);

    if (!v) {
      p.centrado(error ? "Sin conexión..." : "Conectando...", h / 2, PAL.crema, 8, PAL.tinta);
      return;
    }
    const b = botones(h) as Record<string, Caja | undefined>;

    if (v.fase === "espera") {
      p.centrado("LA BANDA", 26, PAL.ambar, 8, PAL.tinta);
      dibujarQR(p, urlSala, 8, 38, 78);
      p.centrado("CÓDIGO", 42, PAL.grisClaro, 8, undefined, 92, 96);
      const pulso = 1 + (Math.floor(t / 30) % 2) * 0.05;
      p.escalado(140, 62, pulso * 2, () => p.centrado(codigo, 58, PAL.blanco, 8, PAL.rojoOscuro, 92, 96));
      p.centrado("¡ESCANEA!", 82, PAL.ambar, 8, undefined, 92, 96);
      p.centrado("o en /play", 94, PAL.crema, 8, undefined, 92, 96);
      p.centrado("> EN VIVO", 106, PAL.celeste, 8, undefined, 92, 96);
      p.rect(PAL.tinta, 6, 120, W - 12, 1);
      const filas = Math.max(1, Math.floor((h - 226) / 12));
      v.jugadores.slice(0, filas * 2).forEach((j, i) => {
        const x = 8 + (i % 2) * 92;
        const y = 128 + Math.floor(i / 2) * 12;
        const band = PAISES[j.pais as PaisId]?.bandera;
        if (band)
          band.colores.forEach((col, k) =>
            p.rect(
              col,
              x + (band.vertical ? Math.round((k * 9) / band.colores.length) : 0),
              y + (band.vertical ? 0 : Math.round((k * 7) / band.colores.length)),
              band.vertical ? 3 : 9,
              band.vertical ? 7 : 3,
            ),
          );
        p.texto(j.alias.toUpperCase().slice(0, 9), x + 12, y, j.alias.toLowerCase() === alias.toLowerCase() ? PAL.ambar : PAL.crema);
      });
      if (v.jugadores.length > filas * 2) p.centrado(`+${v.jugadores.length - filas * 2} más`, 128 + filas * 12, PAL.gris);
      p.centrado(
        token ? (v.jugadores.length < 2 ? "Dicta el código" : "Cuando estén todos:") : `Esperando a ${v.host.toUpperCase().slice(0, 10)}...`,
        h - 64,
        PAL.grisClaro,
      );
    } else if (v.fase === "cuenta") {
      const n = Math.ceil(restante() / 1000);
      if (n !== ultimoTic && n > 0) {
        ultimoTic = n;
        m.audio.cuenta(false);
      }
      p.centrado("LA BANDA", Math.round(h * 0.25), PAL.ambar, 8, PAL.tinta);
      p.centrado("¡A ROBAR!", Math.round(h * 0.33), PAL.crema, 8, PAL.tinta);
      p.escalado(W / 2, Math.round(h * 0.48), 1 + (1 - ((restante() % 1000) / 1000)) * 0.8, () =>
        p.centrado(String(Math.max(1, n)), Math.round(h * 0.48) - 8, PAL.ambar, 16, PAL.tinta),
      );
      p.centrado("Busca un hueco en la capa", Math.round(h * 0.62), PAL.grisClaro);
    } else if (v.fase === "ataque") {
      const mio = v.mio;
      const banda = v.banda;
      // Reloj de la sala
      const q = restante() / 150_000;
      p.barra(6, 24, W - 12, q, q > 0.4 ? PAL.verde : q > 0.15 ? PAL.ambar : PAL.rojo);
      const seg = Math.ceil(restante() / 1000);
      if (seg <= 5 && seg !== ultimoTic && seg > 0) {
        ultimoTic = seg;
        m.audio.tic();
      }
      p.texto(`GOLPE ${(mio?.banda?.golpes ?? 0) + 1}/${(mio?.banda?.golpes ?? 0) + (mio?.banda?.restantes ?? 0)}`, 6, 30, PAL.crema);
      const pts = String(mio?.puntaje ?? 0);
      p.texto(pts, W - 6 - p.ancho(pts), 30, PAL.ambar);

      // Perillas del golpe
      FILAS.forEach((fila, i) => {
        const c = filaCaja(i);
        const activo = sel === i;
        p.rect(activo ? PAL.ambar : PAL.tinta, c.x, c.y, c.w, c.h);
        p.rect(PAL.crema, c.x + 1, c.y + 1, c.w - 2, c.h - 2);
        p.texto(fila.etiqueta, c.x + 4, c.y + 2, PAL.gris);
        const { texto, pista } = valorFila(fila.id);
        p.texto(texto.slice(0, 17), c.x + 4, c.y + 10, PAL.tinta);
        p.texto("<", c.x + c.w - 15, c.y + 6, PAL.ambarOscuro);
        p.texto(">", c.x + c.w - 8, c.y + 6, PAL.ambarOscuro);
        if (activo) p.texto(envolver(pista, 23)[0], 6, Y_FILAS + FILAS.length * ALTO_FILA + 1, PAL.grisClaro);
      });

      // Lo que lleva la sala (y lo mío)
      const yb = Y_FILAS + FILAS.length * ALTO_FILA + 13;
      if (banda) {
        p.texto(`SALA: ${banda.golpes} golpes`, 6, yb, PAL.crema);
        const hu = `${banda.huecos} huecos`;
        p.texto(hu, W - 6 - p.ancho(hu), yb, banda.huecos > 0 ? PAL.ambar : PAL.verde);
      }

      // Los intentos de la sala, en vivo: lo mismo que ve el proyector.
      const yFeed = yb + 12;
      const sitio = Math.max(0, (b.lanzar?.y ?? h - 52) - 6 - yFeed);
      const cabe = Math.max(0, Math.min(8, Math.floor(sitio / 11) - 1));
      const ultimos = banda?.ultimos ?? [];
      if (cabe >= 1) {
        p.rect(PAL.tinta, 6, yFeed - 2, W - 12, sitio);
        p.texto("GOLPES DE LA SALA", 9, yFeed + 1, PAL.gris);
        if (ultimos.length === 0) p.texto("esperando golpes...", 9, yFeed + 13, PAL.gris);
        ultimos.slice(0, cabe).forEach((g, i) => {
          const y = yFeed + 13 + i * 11;
          const mio2 = g.alias.toLowerCase() === alias.toLowerCase();
          p.texto(g.frenado ? "X" : "!", 9, y, g.frenado ? PAL.rojo : PAL.ambar);
          p.texto(`${g.alias.toUpperCase().slice(0, 7)} ${g.tactica.replace(/_/g, " ").slice(0, 11)}`, 18, y, mio2 ? PAL.ambar : PAL.crema);
          p.texto(g.frenado ? g.regla : "PASÓ", W - 9 - p.ancho(g.frenado ? g.regla : "PASÓ"), y, g.frenado ? PAL.grisClaro : PAL.ambar);
        });
      }

      if (b.lanzar) {
        const sinGolpes = (mio?.banda?.restantes ?? 1) <= 0;
        p.alfa(sinGolpes || enviando ? 0.5 : 1, () =>
          p.boton(b.lanzar!, sinGolpes ? "SIN GOLPES" : enviando ? "LANZANDO..." : "¡LANZAR!", {
            color: PAL.rojo,
            presionado: presionado === "lanzar",
          }),
        );
      }
      if (resultado) {
        if (t > resultado.hasta) resultado = null;
        else dibujarResultado(p, h, t);
      }
    } else if (v.fase === "fin") {
      const banda = v.banda;
      p.centrado("SE ACABÓ", 26, PAL.ambar, 8, PAL.tinta);
      const top = v.jugadores.slice(0, 3);
      const base = Math.min(h - 150, 150);
      [1, 0, 2].forEach((i, col) => {
        const j = top[i];
        if (!j) return;
        const alturas = [52, 38, 28];
        const k = facil.salida(Math.min(1, Math.max(0, (f - col * 8) / 20)));
        const ah = Math.round(alturas[i] * k);
        const x = 14 + col * 58;
        p.rect(PAL.tinta, x, base - ah, 50, ah);
        p.rect([PAL.ambar, PAL.grisClaro, "#d08a4e"][i], x + 1, base - ah + 1, 48, ah - 1);
        p.centrado(String(i + 1), base - ah + 6, PAL.tinta, 16, undefined, x, 50);
        p.centrado(j.alias.toUpperCase().slice(0, 6), base - ah - 22, PAL.crema, 8, PAL.tinta, x - 4, 58);
        p.centrado(String(j.puntaje), base - ah - 11, PAL.ambar, 8, undefined, x - 4, 58);
      });
      let y = base + 8;
      if (banda) {
        p.centrado(`${banda.golpes} golpes · ${banda.frenados} frenados`, y, PAL.crema, 8, PAL.tinta);
        y += 12;
        p.centrado(
          banda.huecos === 0 ? "La capa aguantó todo" : `${banda.huecos} ${banda.huecos === 1 ? "hueco" : "huecos"} encontrados`,
          y,
          banda.huecos === 0 ? PAL.verde : PAL.ambar,
          8,
          PAL.tinta,
        );
        y += 14;
        const conHueco = banda.por_tactica.filter((x) => x.huecos > 0).slice(0, 3);
        for (const fila of conHueco) {
          p.texto(`· ${fila.tactica.replace(/_/g, " ").slice(0, 16)} ${fila.huecos}`, 8, y, PAL.ambarOscuro);
          y += 10;
        }
      }
      const mio = v.mio;
      if (mio) {
        y += 2;
        p.centrado(`#${mio.posicion} de ${v.jugadores.length} · ${mio.puntaje} pts`, y, PAL.ambar, 8, PAL.tinta);
      }
      if (!token) p.centrado("El anfitrión puede jugar otra", h - 62, PAL.grisClaro);
    }

    if (b.principal) p.boton(b.principal, v.fase === "fin" ? "OTRA RONDA" : "¡EMPEZAR!", { color: PAL.ambar, presionado: presionado === "principal" });
    if (b.salir) p.boton(b.salir, "SALIR", { presionado: presionado === "salir" });
    if (aviso) {
      if (t > aviso.hasta) aviso = null;
      else {
        p.rect(PAL.tinta, 4, h - 72, W - 8, 14);
        p.centrado(aviso.texto.slice(0, 23), h - 68, PAL.ambar);
      }
    }
    if (error) p.centrado(error.slice(0, 23), h - 8, PAL.rojo);
  };

  const info = () => ({
    sala: true,
    juego: "banda",
    codigo,
    jugadores: vista?.jugadores.length ?? 0,
    fase: vista?.fase ?? null,
    golpe: golpeActual(),
    fila: FILAS[sel].id,
    mis_golpes: vista?.mio?.banda?.golpes ?? 0,
    huecos_sala: vista?.banda?.huecos ?? 0,
    resultado: resultado ? { frenado: resultado.golpe.frenado, regla: resultado.golpe.regla, puntos: resultado.golpe.puntos } : null,
    botones: botones(m.h),
  });
  m.minijuego({ dibujar, tocar, tecla, info });
  return listo;
}
