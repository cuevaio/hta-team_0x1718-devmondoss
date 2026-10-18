import { accionSala, verSala, type VistaSala } from "@/components/juego/api";
import { CARTAS } from "@/lib/juego/cartas";
import { frase } from "./jerga";
import type { Boton, Motor } from "./motor";
import { PAISES, type Pais, type PaisId } from "./paises";
import { TICKETS, dibujarTicket } from "./pausaOPasa";
import { PAL, Pincel, W, envolver, facil, type Caja } from "./pincel";
import { dibujarQR } from "./qr";
import { dibujarCarta, mazo } from "./realOEstafa";

/**
 * Pantalla de una sala EN VIVO (multijugador). El servidor lleva el reloj y
 * califica; aquí solo se consulta su estado cada ~0,6 s y se dibuja la fase:
 * espera (código y jugadores), cuenta, responder, revelar (qué respondió la
 * sala) y fin (podio). Quien creó la sala puede empezar y pedir otra ronda.
 */

export type RespuestaSala = { carta: string; categoria: string; estafa: boolean; dijo_estafa: boolean; ms: number };
export type ResultadoSala = { puntaje: number; posicion: number; jugadores: number; respuestas: RespuestaSala[] };

const SONDEO_MS = 600;

const NOMBRE_JUEGO: Record<VistaSala["juego"], string> = { real_o_estafa: "¿REAL O ESTAFA?", pausa_o_pasa: "¿PAUSA O PASA?", banda: "LA BANDA" };

/** Esta pantalla es de cartas; LA BANDA tiene la suya (`salaBanda.ts`). */
const cartasDe = (j: VistaSala["juego"]) => (j === "banda" ? [] : CARTAS[j]);

export function pantallaSala(
  m: Motor,
  cfg: { codigo: string; token: string | null; alias: string; pais: Pais; alTerminar: (r: ResultadoSala) => void },
): Promise<void> {
  const { codigo, token, alias, pais } = cfg;
  const cartasROE = mazo(pais);
  const nombres = [pais.rosa, pais.jorge, pais.lucia];
  let vista: VistaSala | null = null;
  let recibida = 0;
  let error: string | null = null;
  let faseVista = "";
  let rondaVista = -1;
  let cambio = m.t;
  let miRespuesta: { ronda: number; dijo: boolean } | null = null;
  let presionado: string | null = null;
  let respuestas: RespuestaSala[] = [];
  let terminadoEnviado = false;
  let salir = false;
  let ultimoTic = -1;
  let resolver: () => void = () => {};
  const listo = new Promise<void>((r) => (resolver = r));
  const lemaLobby = frase(pais.id, "lobby");
  const urlSala = `${window.location.origin}/play?sala=${codigo}`;

  const restante = () => (vista?.restante_ms == null ? 0 : Math.max(0, vista.restante_ms - (performance.now() - recibida)));

  const alCambiarFase = (v: VistaSala) => {
    cambio = m.t;
    if (v.fase === "cuenta") m.musica(null);
    if (v.fase === "responder") {
      if (v.ronda === 0) m.musica("jefe");
      m.audio.whoosh();
      miRespuesta = null;
    }
    if (v.fase === "revelar") {
      const ultima = v.mio?.ultima;
      const rep = v.reparto;
      const respondieron = rep ? rep.estafa + rep.real : 0;
      const fallaron = rep && v.verdad !== null ? (v.verdad ? rep.real : rep.estafa) : 0;
      const y = m.h - 50;
      if (respondieron >= 2 && fallaron / respondieron >= 0.5) m.comentar(frase(pais.id, "muchosCayeron"), { y, color: "#f4c7c3" });
      else if (respondieron >= 2 && fallaron === 0) m.comentar(frase(pais.id, "nadieCayo"), { y, color: "#bfe8c9" });
      else if (ultima) m.comentar(frase(pais.id, ultima.correcto ? "acierto" : v.verdad ? "cayo" : "desconfiado"), { y });
      if (ultima?.correcto) {
        m.audio.acierto(3);
        m.audio.monedas();
        m.vibrar(15);
      } else {
        m.audio.error();
        m.vibrar([50, 40, 50]);
      }
      // Guardar la respuesta propia de esta ronda para los datos.
      if (v.carta && v.verdad !== null && ultima && !respuestas.some((r) => r.carta === v.carta)) {
        const verdad = cartasDe(v.juego).find((c) => c.id === v.carta);
        respuestas.push({ carta: v.carta, categoria: verdad?.categoria ?? "real", estafa: v.verdad, dijo_estafa: ultima.dijo_estafa, ms: ultima.ms });
      }
    }
    if (v.fase === "fin") {
      m.musica("guardian");
      if (v.jugadores[0]) m.comentar(frase(pais.id, "podio", v.jugadores[0].alias.toUpperCase()), { y: m.h - 96 });
      const pos = v.mio?.posicion ?? 0;
      if (pos > 0 && pos <= 3) {
        m.audio.exito();
        m.confeti();
      } else m.audio.boom();
      if (!terminadoEnviado) {
        terminadoEnviado = true;
        cfg.alTerminar({ puntaje: v.mio?.puntaje ?? 0, posicion: pos, jugadores: v.jugadores.length, respuestas });
      }
    }
    if (v.fase === "espera") {
      m.musica("titulo");
      terminadoEnviado = false;
      respuestas = [];
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
      if (v.fase !== faseVista || v.ronda !== rondaVista) {
        faseVista = v.fase;
        rondaVista = v.ronda;
        alCambiarFase(v);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Sin conexión";
    }
    if (!salir) window.setTimeout(() => void consultar(), SONDEO_MS);
  };
  void consultar();

  const botones = (h: number) => {
    const esFin = vista?.fase === "fin";
    const esEspera = vista?.fase === "espera";
    const anfitrion = token !== null;
    if (vista?.fase === "responder") return { izq: { x: 8, y: h - 58, w: 84, h: 46 } as Caja, der: { x: 100, y: h - 58, w: 84, h: 46 } as Caja };
    if ((esEspera || esFin) && anfitrion) return { principal: { x: 8, y: h - 48, w: 116, h: 36 } as Caja, salir: { x: 130, y: h - 48, w: 54, h: 36 } as Caja };
    if (esEspera || esFin) return { salir: { x: 40, y: h - 48, w: 112, h: 36 } as Caja };
    return {};
  };

  const pulsar = (id: string) => {
    presionado = id;
    window.setTimeout(() => (presionado = null), 140);
  };

  const responder = async (dijo: boolean) => {
    if (!vista || vista.fase !== "responder" || miRespuesta?.ronda === vista.ronda) return;
    miRespuesta = { ronda: vista.ronda, dijo };
    pulsar(dijo ? "izq" : "der");
    m.audio.confirmar();
    m.vibrar(10);
    try {
      vista = await accionSala(codigo, { accion: "responder", alias, ronda: vista.ronda, dijo_estafa: dijo });
      recibida = performance.now();
    } catch {
      // ronda cerrada o sin conexión: se verá al revelar
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
        .confirmar(fin ? "¿Otra ronda? Los puntajes vuelven a cero." : "Solo estás tú en la sala. ¿Empezar igual?", fin ? "¡OTRA RONDA!" : "EMPEZAR", "ESPERAR")
        .catch(() => false);
      confirmando = false;
      if (!ok) return;
    }
    try {
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
    // Si eres el anfitrión y hay gente esperando, salir deja la sala sin quien la empiece.
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
    if (en(b.izq)) void responder(true);
    else if (en(b.der)) void responder(false);
    else if (en(b.principal)) void principal();
    else if (en(b.salir)) void irse();
  };

  const tecla = (bt: Boton) => {
    if (bt === "izq") void responder(true);
    if (bt === "der") void responder(false);
    if (bt === "a" && token && (vista?.fase === "espera" || vista?.fase === "fin")) void principal();
    if (bt === "b" && (vista?.fase === "espera" || vista?.fase === "fin")) void irse();
  };

  const dibujarCartaSala = (p: Pincel, c: Caja, id: string, sello: "pausa" | "pasa" | null) => {
    if (vista?.juego === "pausa_o_pasa") {
      const tk = TICKETS.find((x) => x.id === id);
      if (tk) dibujarTicket(p, c, tk, { pais, nombre: nombres[tk.quien], sello, selloK: (m.t - cambio) / 8 });
      return;
    }
    const carta = cartasROE.find((x) => x.id === id);
    if (carta) dibujarCarta(p, c, carta);
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
    p.rect(PAL.rojo, 0, 0, W, 20);
    if (Math.floor(t / 20) % 2 === 0) p.circulo(9, 10, 3, PAL.blanco);
    p.texto(`EN VIVO ${codigo}`, 16, 6, PAL.blanco);
    if (v) p.texto(`${v.jugadores.length}`, 156 - p.ancho(String(v.jugadores.length)), 6, PAL.crema);

    if (!v) {
      p.centrado(error ? "Sin conexión..." : "Conectando...", h / 2, PAL.crema, 8, PAL.tinta);
      return;
    }

    const b = botones(h) as Record<string, Caja | undefined>;
    const juego = NOMBRE_JUEGO[v.juego];

    if (v.fase === "espera") {
      p.centrado(juego, 26, PAL.ambar, 8, PAL.tinta);
      // QR que entra directo a esta sala, y el código para dictarlo.
      dibujarQR(p, urlSala, 8, 38, 78);
      p.centrado("CÓDIGO", 42, PAL.grisClaro, 8, undefined, 92, 96);
      const pulso = 1 + (Math.floor(t / 30) % 2) * 0.05;
      p.escalado(140, 62, pulso * 2, () => p.centrado(codigo, 58, PAL.blanco, 8, PAL.rojoOscuro, 92, 96));
      p.centrado("¡ESCANEA!", 82, PAL.ambar, 8, undefined, 92, 96);
      p.centrado("o en /play", 94, PAL.crema, 8, undefined, 92, 96);
      p.centrado("> EN VIVO", 106, PAL.celeste, 8, undefined, 92, 96);
      p.rect(PAL.tinta, 6, 120, W - 12, 1);
      if (Math.floor(t / 240) % 2 === 1) {
        p.alfa(0.92, () => p.rect(PAL.ambar, 6, h - 92, W - 12, 26));
        envolver(lemaLobby, 21).slice(0, 2).forEach((l, i) => p.centrado(l, h - 88 + i * 11, PAL.tinta));
      }
      const filas = Math.max(1, Math.floor((h - 226) / 12));
      v.jugadores.slice(0, filas * 2).forEach((j, i) => {
        const x = 8 + (i % 2) * 92;
        const y = 128 + Math.floor(i / 2) * 12;
        const band = PAISES[j.pais as PaisId]?.bandera;
        if (band) band.colores.forEach((col, k) => p.rect(col, x + (band.vertical ? Math.round((k * 9) / band.colores.length) : 0), y + (band.vertical ? 0 : Math.round((k * 7) / band.colores.length)), band.vertical ? 3 : 9, band.vertical ? 7 : 3));
        const mio = (v.mio?.alias ?? alias).toLowerCase();
        p.texto(j.alias.toUpperCase().slice(0, 9), x + 12, y, j.alias.toLowerCase() === mio ? PAL.ambar : PAL.crema);
      });
      if (v.jugadores.length > filas * 2) p.centrado(`+${v.jugadores.length - filas * 2} más`, 128 + filas * 12, PAL.gris);
      if (!token) {
        const puntos = ".".repeat(1 + (Math.floor(t / 20) % 3));
        p.centrado(`Esperando a ${v.host.toUpperCase().slice(0, 10)}${puntos}`, h - 64, PAL.grisClaro);
      } else {
        p.centrado(v.jugadores.length < 2 ? "Dicta el código" : "Cuando estén todos:", h - 64, PAL.grisClaro);
      }
    } else if (v.fase === "cuenta") {
      const n = Math.ceil(restante() / 1000);
      if (n !== ultimoTic && n > 0) {
        ultimoTic = n;
        m.audio.cuenta(false);
      }
      p.centrado(juego, Math.round(h * 0.25), PAL.ambar, 8, PAL.tinta);
      p.centrado("¡PREPÁRATE!", Math.round(h * 0.33), PAL.crema, 8, PAL.tinta);
      p.escalado(W / 2, Math.round(h * 0.48), 1 + (1 - ((restante() % 1000) / 1000)) * 0.8, () =>
        p.centrado(String(Math.max(1, n)), Math.round(h * 0.48) - 8, PAL.ambar, 16, PAL.tinta),
      );
      p.centrado(`${v.rondas} rondas · todos a la vez`, Math.round(h * 0.62), PAL.grisClaro);
    } else if ((v.fase === "responder" || v.fase === "revelar") && v.carta) {
      // barra de ronda y reloj
      p.texto(`RONDA ${v.ronda + 1}/${v.rondas}`, 6, 26, PAL.crema);
      const mio = v.mio;
      if (mio) p.texto(`${mio.puntaje}`, W - 6 - p.ancho(String(mio.puntaje)), 26, PAL.ambar);
      const total = v.fase === "responder" ? 10000 : 4500;
      const q = restante() / total;
      if (v.fase === "responder") {
        p.barra(6, 36, W - 12, q, q > 0.4 ? PAL.verde : q > 0.2 ? PAL.ambar : PAL.rojo);
        const seg = Math.ceil(restante() / 1000);
        if (seg <= 3 && seg !== ultimoTic && seg > 0) {
          ultimoTic = seg;
          m.audio.tic();
        }
      }
      const alto = Math.min(v.juego === "pausa_o_pasa" ? 130 : 150, h - (v.fase === "responder" ? 130 : 190));
      const c: Caja = { x: 12, y: 46, w: W - 24, h: alto };
      const sello = v.fase === "revelar" && v.juego === "pausa_o_pasa" ? (v.verdad ? "pausa" : "pasa") : null;
      dibujarCartaSala(p, c, v.carta, sello);

      if (v.fase === "responder") {
        const ya = miRespuesta?.ronda === v.ronda || mio?.respondio;
        const etiquetas = v.juego === "pausa_o_pasa" ? ["PAUSA", "PASA"] : ["ESTAFA", "REAL"];
        const colores = v.juego === "pausa_o_pasa" ? [PAL.ambar, "#bfe8c9"] : ["#f4c7c3", "#bfe8c9"];
        p.alfa(ya ? 0.4 : 1, () => {
          p.boton(b.izq!, etiquetas[0], { color: colores[0], presionado: presionado === "izq" || (ya && miRespuesta?.dijo === true) });
          p.boton(b.der!, etiquetas[1], { color: colores[1], presionado: presionado === "der" || (ya && miRespuesta?.dijo === false) });
        });
        if (ya) {
          const y = c.y + c.h + 10;
          p.caja(20, y, W - 40, 30, PAL.crema, PAL.tinta, PAL.ambar);
          p.centrado("¡RESPONDIDO!", y + 6, PAL.verdeOscuro);
          p.centrado(`${v.respondieron}/${v.jugadores.length} respondieron`, y + 17, PAL.gris);
        } else {
          p.centrado(`${v.respondieron}/${v.jugadores.length} ya respondieron`, c.y + c.h + 12, PAL.grisClaro);
        }
      } else {
        // revelar
        const k = facil.salida(Math.min(1, f / 10));
        const verdad = v.verdad;
        const etiqueta = v.juego === "pausa_o_pasa" ? (verdad ? "¡HABÍA QUE PAUSAR!" : "¡DEBÍA PASAR!") : verdad ? "¡ERA ESTAFA!" : "¡ERA REAL!";
        let y = c.y + c.h + 6;
        p.escalado(W / 2, y + 8, 1 + (1 - k) * 0.8, () => {
          p.rect(PAL.tinta, 8, y, W - 16, 16);
          p.rect(verdad ? PAL.rojo : PAL.verde, 9, y + 1, W - 18, 14);
          p.centrado(etiqueta, y + 4, PAL.blanco);
        });
        y += 22;
        const r = v.reparto ?? { estafa: 0, real: 0, sin_responder: 0 };
        const tot = Math.max(1, r.estafa + r.real + r.sin_responder);
        const nombresBarra = v.juego === "pausa_o_pasa" ? ["PAUSA", "PASA"] : ["ESTAFA", "REAL"];
        [[nombresBarra[0], r.estafa, PAL.rojo], [nombresBarra[1], r.real, PAL.verde]].forEach(([nom, n, col], i) => {
          const yy = y + i * 13;
          p.texto(String(nom), 8, yy, PAL.crema);
          const w = Math.round((W - 100) * (Number(n) / tot) * Math.min(1, f / 20));
          p.rect(String(col), 62, yy, Math.max(1, w), 8);
          p.texto(`${Math.round((Number(n) / tot) * 100)}%`, 66 + w, yy, PAL.grisClaro);
        });
        y += 30;
        const ultima = mio?.ultima;
        const txt = !ultima ? "No respondiste" : ultima.correcto ? `¡BIEN! +${ultima.puntos}` : "Fallaste: +0";
        p.centrado(txt, y, !ultima ? PAL.gris : ultima.correcto ? PAL.verde : PAL.rojo, 8, PAL.tinta);
        if (mio) p.centrado(`Vas #${mio.posicion} de ${v.jugadores.length}`, y + 13, PAL.ambar, 8, PAL.tinta);
      }
    } else if (v.fase === "fin") {
      p.centrado("¡PODIO!", 30, PAL.ambar, 16, PAL.tinta);
      const top = v.jugadores.slice(0, 3);
      const base = Math.min(h - 110, 170);
      const orden = [1, 0, 2];
      orden.forEach((i, col) => {
        const j = top[i];
        if (!j) return;
        const alturas = [70, 50, 36];
        const k = facil.salida(Math.min(1, Math.max(0, (f - col * 8) / 20)));
        const ah = Math.round(alturas[i] * k);
        const x = 14 + col * 58;
        p.rect(PAL.tinta, x, base - ah, 50, ah);
        p.rect([PAL.ambar, PAL.grisClaro, "#d08a4e"][i], x + 1, base - ah + 1, 48, ah - 1);
        p.centrado(String(i + 1), base - ah + 6, PAL.tinta, 16, undefined, x, 50);
        p.centrado(j.alias.toUpperCase().slice(0, 6), base - ah - 22, PAL.crema, 8, PAL.tinta, x - 4, 58);
        p.centrado(String(j.puntaje), base - ah - 11, PAL.ambar, 8, undefined, x - 4, 58);
      });
      const mio = v.mio;
      if (mio) {
        p.centrado(`Quedaste #${mio.posicion} de ${v.jugadores.length}`, base + 10, PAL.crema, 8, PAL.tinta);
        p.centrado(`${mio.puntaje} puntos`, base + 23, PAL.ambar, 8, PAL.tinta);
      }
      if (!token) p.centrado("El anfitrión puede jugar otra", h - 62, PAL.grisClaro);
    }

    // Botones de la sala
    if (b.principal) p.boton(b.principal, v.fase === "fin" ? "OTRA RONDA" : "¡EMPEZAR!", { color: PAL.ambar, presionado: presionado === "principal" });
    if (b.salir) p.boton(b.salir, "SALIR", { presionado: presionado === "salir" });
    if (error) p.centrado(error.slice(0, 23), h - 8, PAL.rojo);
  };

  const info = () => ({ sala: true, codigo, jugadores: vista?.jugadores.length ?? 0, fase: vista?.fase ?? null, carta: vista?.carta ?? null, ronda: vista?.ronda ?? null, botones: botones(m.h), respondio: miRespuesta?.ronda === vista?.ronda });
  m.minijuego({ dibujar, tocar, tecla, info });
  return listo;
}
