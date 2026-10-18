import { frase } from "./jerga";
import type { Boton, Motor } from "./motor";
import type { Pais } from "./paises";
import { PAL, Pincel, W, facil } from "./pincel";

/**
 * ATRAPA LA MULA — «golpea al topo» con cuentas bancarias. Asoman cuentas
 * con una etiqueta: si es señal de mula (cuenta nueva, recibe de extraños,
 * reenvía todo), tócala; si es una cuenta normal (la bodega, tu mamá, el
 * sueldo), déjala. Enseña a reconocer una mula en dos palabras, que es lo
 * que nuestro DETECTIVE hace con evidencia.
 */

type Etiqueta = { l1: string; l2: string; mula: boolean; jefe?: boolean };

const MULAS: Etiqueta[] = [
  { l1: "CUENTA", l2: "NUEVA", mula: true },
  { l1: "REENVÍA", l2: "TODO", mula: true },
  { l1: "RECIBE", l2: "Y SACA", mula: true },
  { l1: "RETIRA", l2: "EN 1 H", mula: true },
  { l1: "ABIERTA", l2: "AYER", mula: true },
  { l1: "PRESTA", l2: "SU DNI", mula: true },
];
const NORMALES: Etiqueta[] = [
  { l1: "BODEGA", l2: "9 AÑOS", mula: false },
  { l1: "MAMÁ", l2: "SIEMPRE", mula: false },
  { l1: "SUELDO", l2: "MENSUAL", mula: false },
  { l1: "HOTEL", l2: "11 AÑOS", mula: false },
  { l1: "LUZ Y", l2: "AGUA", mula: false },
  { l1: "COLEGIO", l2: "PENSIÓN", mula: false },
];
const JEFE: Etiqueta = { l1: "JEFE", l2: "DE RED", mula: true, jefe: true };

type Hoyo = {
  cuenta: Etiqueta | null;
  /** Cuadro en que asomó y cuántos cuadros se queda arriba. */
  desde: number;
  dura: number;
  golpe: number;
  resultado: "bien" | "mal" | null;
};

export type ResultadoALM = {
  puntaje: number;
  aciertos: number;
  errores: number;
  escapados: number;
  mejorCombo: number;
  vidas: number;
};

const SEGUNDOS = 40;
const VIDAS = 3;
const CORAZON = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];

export function atrapaLaMula(m: Motor, pais: Pais): Promise<ResultadoALM> {
  const hoyos: Hoyo[] = Array.from({ length: 9 }, () => ({ cuenta: null, desde: 0, dura: 0, golpe: 0, resultado: null }));
  let fase: "cuenta" | "juego" | "fin" = "cuenta";
  let inicioFase = m.t;
  let restante = SEGUNDOS * 60;
  let vidas = VIDAS;
  let puntaje = 0;
  let mostrado = 0;
  let combo = 0;
  let mejorCombo = 0;
  let aciertos = 0;
  let errores = 0;
  let escapados = 0;
  let proximo = 0;
  let resolver: (r: ResultadoALM) => void = () => {};
  const terminado = new Promise<ResultadoALM>((r) => (resolver = r));

  const grilla = (h: number) => {
    const arriba = 46;
    const abajo = h - 10;
    const alto = Math.min(84, Math.floor((abajo - arriba) / 3));
    const y0 = arriba + Math.round((abajo - arriba - alto * 3) / 2);
    return (i: number) => ({ x: 2 + (i % 3) * 63, y: y0 + Math.floor(i / 3) * alto, w: 62, h: alto - 4 });
  };

  const terminar = () => {
    if (fase === "fin") return;
    fase = "fin";
    inicioFase = m.t;
    m.musica(null);
    m.audio.ritmo = 1;
    window.setTimeout(() => {
      m.minijuego(null);
      resolver({ puntaje, aciertos, errores, escapados, mejorCombo, vidas });
    }, 1600);
  };

  const transcurrido = () => SEGUNDOS * 60 - restante;

  const asomar = (t: number) => {
    const libres = hoyos.map((hh, i) => (hh.cuenta ? -1 : i)).filter((i) => i >= 0);
    if (libres.length === 0) return;
    const i = libres[Math.floor(Math.random() * libres.length)];
    const k = transcurrido() / (SEGUNDOS * 60);
    const r = Math.random();
    const cuenta = k > 0.3 && r < 0.06 ? JEFE : r < 0.6 ? MULAS[Math.floor(Math.random() * MULAS.length)] : NORMALES[Math.floor(Math.random() * NORMALES.length)];
    hoyos[i] = { cuenta, desde: t, dura: Math.round((cuenta.jefe ? 55 : 110) - k * 45), golpe: 0, resultado: null };
  };

  const golpear = (i: number) => {
    if (fase !== "juego") return;
    const hh = hoyos[i];
    if (!hh.cuenta || hh.resultado) return;
    const g = grilla(m.h)(i);
    hh.golpe = m.t;
    if (hh.cuenta.mula) {
      hh.resultado = "bien";
      combo++;
      aciertos++;
      mejorCombo = Math.max(mejorCombo, combo);
      const mult = Math.min(4, 1 + Math.floor(combo / 4));
      const pts = (hh.cuenta.jefe ? 500 : 100) * mult;
      puntaje += pts;
      m.audio.congelar();
      m.vibrar(12);
      m.particulas_(g.x + g.w / 2, g.y + g.h / 2, 16, { colores: [PAL.celeste, PAL.blanco], vel: 1.8, g: 0, vida: 24 });
      m.flotante(`+${pts}`, g.x + 8, g.y + 4, hh.cuenta.jefe ? PAL.ambar : PAL.celeste);
      if (combo > 0 && combo % 4 === 0) m.flotante(`COMBO x${mult}!`, 50, 46, PAL.ambar);
      if (hh.cuenta.jefe) m.comentar(frase(pais.id, "racha"), { y: 30 });
      else if ([4, 8, 12, 16].includes(combo)) m.comentar(frase(pais.id, "mula"), { y: 30 });
    } else {
      hh.resultado = "mal";
      combo = 0;
      errores++;
      vidas--;
      m.audio.error();
      m.vibrar([60, 40, 60]);
      m.sacudir(10);
      m.flotante("¡INOCENTE!", g.x, g.y + 4, PAL.rojo);
      m.comentar(frase(pais.id, "inocente"), { y: 30, color: "#f4c7c3" });
      if (vidas <= 0) terminar();
    }
  };

  const tocar = (x: number, y: number) => {
    const g = grilla(m.h);
    for (let i = 0; i < 9; i++) {
      const c = g(i);
      if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return golpear(i);
    }
  };

  const tecla = (b: Boton) => {
    // escritorio: el centro de la grilla con «a»
    if (b === "a") golpear(4);
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    const f = t - inicioFase;
    if (fase === "cuenta") {
      if (f % 40 === 0 && f < 120) m.audio.cuenta(false);
      if (f >= 120) {
        fase = "juego";
        inicioFase = t;
        m.audio.cuenta(true);
        m.musica("mula");
      }
    } else if (fase === "juego") {
      restante--;
      if (restante === 10 * 60) m.audio.ritmo = 1.2;
      if (restante <= 600 && restante % 45 === 0) m.audio.latido();
      if (restante <= 0) terminar();
      if (t >= proximo) {
        asomar(t);
        const k = transcurrido() / (SEGUNDOS * 60);
        proximo = t + Math.round(42 - k * 22);
        if (k > 0.5 && Math.random() < 0.3) asomar(t);
      }
      for (const hh of hoyos) {
        if (!hh.cuenta) continue;
        if (hh.resultado && t - hh.golpe > 18) hh.cuenta = null;
        else if (!hh.resultado && t - hh.desde > hh.dura) {
          if (hh.cuenta.mula) {
            escapados++;
            combo = 0;
            m.audio.drenar();
          }
          hh.cuenta = null;
        }
      }
    }
    mostrado += Math.ceil((puntaje - mostrado) / 5);

    // fondo: pared del banco
    p.degradado(0, h, "#0e2a3a", "#0b1a2a");
    for (let x = 0; x < W; x += 24) p.alfa(0.08, () => p.rect(PAL.celeste, x, 0, 1, h));

    // HUD
    p.textoSombra(String(mostrado).padStart(5, "0"), 6, 5, PAL.ambar, PAL.tinta);
    if (combo >= 2) p.textoSombra(`x${Math.min(4, 1 + Math.floor(combo / 4))}`, 52, 5, PAL.verde, PAL.tinta);
    for (let i = 0; i < VIDAS; i++) p.sprite(CORAZON, { X: i < vidas ? PAL.rojo : "#4a4560" }, 128 + i * 11, 6, 1);
    const k = restante / (SEGUNDOS * 60);
    p.barra(6, 20, W - 12, k, k > 0.5 ? PAL.verde : k > 0.2 ? PAL.ambar : PAL.rojo);
    p.texto(`Mulas ${aciertos}`, 6, 30, PAL.celeste);
    if (escapados) p.texto(`Se fueron ${escapados}`, W - 6 - p.ancho(`Se fueron ${escapados}`), 30, PAL.rojo);

    const g = grilla(h);
    for (let i = 0; i < 9; i++) {
      const c = g(i);
      const hh = hoyos[i];
      // ventanilla y hoyo
      const yh = c.y + c.h - 12;
      p.alfa(0.35, () => p.rect("#1d4058", c.x + 3, c.y + 2, c.w - 6, c.h - 8));
      p.alfa(0.5, () => p.rect("#2a5878", c.x + 3, c.y + 2, c.w - 6, 2));
      p.elipse(c.x + c.w / 2, yh, 26, 7, "#05101a");
      p.elipse(c.x + c.w / 2, yh - 1, 24, 5, "#0a1824");
      if (!hh.cuenta) continue;
      const cu = hh.cuenta;
      const vida = t - hh.desde;
      const sube = facil.salida(Math.min(1, vida / 8));
      const baja = hh.resultado ? Math.min(1, (t - hh.golpe) / 18) : Math.max(0, (vida - (hh.dura - 8)) / 8);
      const alto = Math.min(c.h - 14, 50);
      const y = yh - Math.round(alto * sube * (1 - baja));
      // la tarjeta, recortada por el hoyo
      const ctx = p.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x, c.y - 4, c.w, yh - c.y + 4);
      ctx.clip();
      const fondo = hh.resultado === "bien" ? "#bfe8ff" : hh.resultado === "mal" ? "#f4c7c3" : cu.jefe ? PAL.ambar : PAL.crema;
      p.rect(PAL.tinta, c.x + 1, y, c.w - 2, alto);
      p.rect(fondo, c.x + 2, y + 1, c.w - 4, alto - 2);
      // carita: con capucha si es mula (pista visual suave)
      const cx = c.x + c.w / 2;
      p.rect(cu.mula ? "#33384d" : PAL.pelo, cx - 6, y + 4, 12, 4);
      p.rect(PAL.piel, cx - 5, y + 7, 10, 7);
      p.rect(PAL.tinta, cx - 3, y + 9, 2, 2);
      p.rect(PAL.tinta, cx + 2, y + 9, 2, 2);
      p.centrado(cu.l1, y + 17, PAL.tinta, 8, undefined, c.x, c.w);
      p.centrado(cu.l2, y + 27, cu.jefe ? PAL.rojoOscuro : PAL.azul, 8, undefined, c.x, c.w);
      if (hh.resultado === "bien") p.centrado("¡MULA!", y + 37, PAL.azul, 8, undefined, c.x, c.w);
      else if (hh.resultado === "mal") p.centrado("NORMAL", y + 37, PAL.rojoOscuro, 8, undefined, c.x, c.w);
      ctx.restore();
      // barra de tiempo de la cuenta
      if (!hh.resultado) {
        const q = Math.max(0, 1 - vida / hh.dura);
        p.rect(q > 0.35 ? PAL.verde : PAL.rojo, c.x + 6, c.y + c.h - 3, Math.round((c.w - 12) * q), 2);
      }
    }

    if (fase === "cuenta") {
      p.alfa(0.6, () => p.rect(PAL.negro, 0, 40, W, h - 40));
      const n = 3 - Math.floor(f / 40);
      p.centrado("Toca las MULAS.", Math.round(h * 0.3), PAL.celeste, 8, PAL.tinta);
      p.centrado("Deja las normales.", Math.round(h * 0.3) + 14, PAL.crema, 8, PAL.tinta);
      p.escalado(W / 2, Math.round(h * 0.5), 1 + (1 - facil.salida((f % 40) / 40)), () =>
        p.centrado(n > 0 ? String(n) : "¡YA!", Math.round(h * 0.5) - 8, PAL.ambar, 16, PAL.tinta),
      );
    } else if (fase === "fin") {
      p.alfa(0.6, () => p.rect(PAL.negro, 0, 40, W, h - 40));
      p.escalado(W / 2, Math.round(h * 0.45), 1 + Math.max(0, 1 - f / 10), () =>
        p.centrado(vidas <= 0 ? "¡SIN VIDAS!" : "¡TIEMPO!", Math.round(h * 0.45) - 8, vidas <= 0 ? PAL.rojo : PAL.ambar, 16, PAL.tinta),
      );
      p.centrado(`${puntaje} PUNTOS`, Math.round(h * 0.45) + 16, PAL.crema, 8, PAL.tinta);
    }
  };

  const info = () => ({
    fase,
    hoyos: hoyos.map((hh, i) => ({ ...grilla(m.h)(i), activa: !!hh.cuenta && !hh.resultado, mula: hh.cuenta?.mula ?? false })),
  });
  m.minijuego({ dibujar, tocar, tecla, info });
  return terminado;
}
