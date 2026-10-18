import type { Boton, Motor } from "./motor";
import { frase } from "./jerga";
import { dinero, type Pais } from "./paises";
import { PAL, Pincel, W, facil, type Caja } from "./pincel";
import { PALETAS, persona } from "./sprites";

/**
 * SIGUE EL DINERO — eres el DETECTIVE. El dinero de 14 víctimas entra a una
 * red de cuentas mula y salta de cuenta en cuenta hasta salir del sistema.
 * Toca una cuenta para investigarla y congélala antes de que el dinero se
 * esfume. Cuidado: congelar a un comercio honesto es un falso positivo.
 *
 * Es lo que un sistema de «patrones de comportamiento» no hace: mirar el
 * OTRO lado de la transferencia. La red sale del seed sintético del sistema
 * (M-01 recibe de 14 remitentes nuevos y reenvía a M-02 y M-03; la bodega
 * recibe de muchos, pero de clientes de siempre y sin reenviar).
 */

type IdNodo = "victimas" | "m1" | "m2" | "m3" | "salida" | "vecinos" | "bodega" | "prov" | "hotel" | "turistas";

type Nodo = {
  id: IdNodo;
  codigo: string;
  /** Fracciones del área del mapa. */
  fx: number;
  fy: number;
  cuenta: boolean;
  mula: boolean;
  /** Evidencia del Detective. `r` = señal de mula, `a` = ojo, `v` = normal. */
  pistas: Array<[string, "r" | "a" | "v"]>;
  saldo: number;
  congelada: boolean;
  /** Cuadros que quedan de la marca roja por falso positivo. */
  error: number;
  /** Cuadro en que se congeló (para la animación). */
  hielo: number;
  ritmo: number;
  destinos: IdNodo[];
  turno: number;
};

type Moneda = { de: IdNodo; a: IdNodo; k: number; valor: number; robada: boolean };

export type ResultadoSED = {
  puntaje: number;
  recuperadoPct: number;
  recuperado: number;
  perdido: number;
  total: number;
  mulas: number;
  falsosPositivos: number;
  segundos: number;
};

const SEGUNDOS = 45;
const VICTIMAS = 14;
/** Lo que M-01 recibió de sus 14 remitentes en el seed (PEN). */
const TOTAL_ROBADO = 42_477;
const MONEDAS = 42;

function nodos(): Record<IdNodo, Nodo> {
  const n = (id: IdNodo, codigo: string, fx: number, fy: number, o: Partial<Nodo> = {}): Nodo => ({
    id, codigo, fx, fy, cuenta: true, mula: false, pistas: [], saldo: 0, congelada: false, error: 0, hielo: 0, ritmo: 0, destinos: [], turno: 0, ...o,
  });
  return {
    victimas: n("victimas", "VÍCTIMAS", 0.14, 0.08, { cuenta: false }),
    m1: n("m1", "4471", 0.36, 0.3, { mula: true, ritmo: 26, destinos: ["m2", "m3"], pistas: [["Abierta hace 9 días", "r"], ["14 remitentes NUEVOS", "r"], ["Reenvía 91% en <2 h", "r"]] }),
    m2: n("m2", "8820", 0.76, 0.2, { mula: true, ritmo: 34, destinos: ["m3"], pistas: [["Abierta hace 8 días", "r"], ["Solo recibe de 4471", "r"], ["Reenvía todo a 1093", "r"]] }),
    m3: n("m3", "1093", 0.68, 0.6, { mula: true, ritmo: 22, destinos: ["salida"], pistas: [["Abierta hace 7 días", "r"], ["Recibe de 2 cuentas", "a"], ["Lo retira TODO", "r"]] }),
    salida: n("salida", "RETIRO", 0.88, 0.92, { cuenta: false }),
    vecinos: n("vecinos", "VECINOS", 0.1, 0.55, { cuenta: false }),
    bodega: n("bodega", "5128", 0.26, 0.75, { ritmo: 200, destinos: ["prov"], pistas: [["Bodega, hace 9 años", "v"], ["Le pagan 35 vecinos", "a"], ["Paga a su proveedor", "v"]] }),
    prov: n("prov", "6642", 0.5, 0.94, { ritmo: 0, pistas: [["Mayorista, 6 años", "v"], ["Le pagan 6 bodegas", "a"], ["Paga sueldos", "v"]] }),
    hotel: n("hotel", "3307", 0.88, 0.42, { ritmo: 0, pistas: [["Hotel, hace 11 años", "v"], ["Pagos de huéspedes", "v"], ["No reenvía nada", "v"]] }),
    turistas: n("turistas", "", 1.08, 0.3, { cuenta: false }),
  };
}

export function sigueElDinero(m: Motor, pais: Pais): Promise<ResultadoSED> {
  const red = nodos();
  const monedas: Moneda[] = [];
  const valor = Math.round(TOTAL_ROBADO / MONEDAS);
  let emitidas = 0;
  let perdido = 0;
  let recuperado = 0;
  let falsos = 0;
  let restante = SEGUNDOS * 60;
  let fase: "cuenta" | "juego" | "fin" = "cuenta";
  let inicioFase = m.t;
  let seleccion: IdNodo | null = null;
  let investigoAlguna = false;
  let abierta = 0;
  let presionado: "congelar" | "cerrar" | null = null;
  let mensaje: { texto: string; sub: string; color: string; hasta: number } | null = null;

  let resolver: (r: ResultadoSED) => void = () => {};
  const terminado = new Promise<ResultadoSED>((r) => (resolver = r));

  // En pantallas bajas el panel se achica para dejarle más alto al mapa.
  const chico = (h: number) => h < 340;
  const area = (h: number) => ({ top: chico(h) ? 36 : 40, bottom: h - panel(h).h - 26 });
  const pos = (id: IdNodo, h: number) => {
    const a = area(h);
    const nd = red[id];
    return { x: Math.round(14 + nd.fx * (W - 28)), y: Math.round(a.top + nd.fy * (a.bottom - a.top)) };
  };
  const panel = (h: number): Caja => {
    const alto = chico(h) ? 98 : 110;
    return { x: 4, y: h - alto - 4, w: W - 8, h: alto };
  };
  const botones = (h: number) => {
    const p = panel(h);
    return {
      congelar: { x: p.x + 8, y: p.y + p.h - (chico(h) ? 31 : 36), w: 96, h: chico(h) ? 25 : 28 },
      cerrar: { x: p.x + 110, y: p.y + p.h - (chico(h) ? 31 : 36), w: p.w - 118, h: chico(h) ? 25 : 28 },
    };
  };

  const mulas = () => (["m1", "m2", "m3"] as IdNodo[]).filter((id) => red[id].congelada).length;

  const terminar = () => {
    if (fase === "fin") return;
    // Lo que sigue en mulas sin congelar se esfuma; lo que no se emitió y va a
    // una 4471 congelada, queda protegido.
    const enRed = (["m1", "m2", "m3"] as IdNodo[]).reduce((s, id) => s + (red[id].congelada ? 0 : red[id].saldo), 0);
    const enCamino = monedas.filter((c) => c.robada && !red[c.a].congelada).reduce((s, c) => s + c.valor, 0);
    const porEmitir = (MONEDAS - emitidas) * valor;
    if (red.m1.congelada) recuperado += porEmitir;
    else perdido += porEmitir;
    perdido += enRed + enCamino;
    recuperado += monedas.filter((c) => c.robada && red[c.a].congelada).reduce((s, c) => s + c.valor, 0);
    monedas.length = 0;
    fase = "fin";
    inicioFase = m.t;
    m.musica(null);
    const total = recuperado + perdido;
    const pct = total === 0 ? 0 : Math.round((recuperado / total) * 100);
    const segundos = Math.round((SEGUNDOS * 60 - restante) / 60);
    const puntaje = Math.max(0, pct * 40 + mulas() * 400 + Math.floor(restante / 60) * 25 - falsos * 500);
    if (mulas() === 3) {
      m.audio.exito();
      m.confeti();
    } else m.audio.fallo();
    window.setTimeout(() => {
      m.minijuego(null);
      resolver({ puntaje, recuperadoPct: pct, recuperado, perdido, total, mulas: mulas(), falsosPositivos: falsos, segundos });
    }, 1800);
  };

  const congelar = () => {
    if (fase !== "juego" || !seleccion) return;
    const nd = red[seleccion];
    if (nd.congelada || nd.error > 0) return;
    presionado = "congelar";
    window.setTimeout(() => (presionado = null), 120);
    const p = pos(nd.id, m.h);
    if (nd.mula) {
      nd.congelada = true;
      nd.hielo = m.t;
      recuperado += nd.saldo;
      m.flotante(`+${dinero(pais, nd.saldo)}`, Math.max(4, p.x - 30), p.y - 16, PAL.celeste);
      nd.saldo = 0;
      m.audio.congelar();
      m.vibrar([20, 30, 20]);
      m.particulas_(p.x, p.y, 26, { colores: [PAL.celeste, PAL.blanco, "#bfe8ff"], vel: 2, g: 0, vida: 30 });
      mensaje = { texto: "¡MULA CONGELADA!", sub: `Cuenta ${nd.codigo}`, color: PAL.celeste, hasta: m.t + 90 };
      m.comentar(frase(pais.id, "mula"), { y: 68 });
      seleccion = null;
      if (mulas() === 3) window.setTimeout(terminar, 500);
    } else {
      falsos++;
      nd.error = 150;
      m.audio.error();
      m.vibrar([80, 40, 80]);
      m.sacudir(12);
      const quien = nd.id === "bodega" ? `Era ${pais.pepe}` : nd.id === "hotel" ? "Era un hotel" : "Era un mayorista";
      mensaje = { texto: "¡FALSO POSITIVO!", sub: quien, color: PAL.rojo, hasta: m.t + 150 };
      m.comentar(frase(pais.id, "inocente"), { y: 68, color: "#f4c7c3" });
      seleccion = null;
    }
  };

  const tocar = (x: number, y: number) => {
    if (fase !== "juego") return;
    const h = m.h;
    if (seleccion) {
      const b = botones(h);
      const en = (c: Caja) => x >= c.x - 3 && x < c.x + c.w + 3 && y >= c.y - 4 && y < c.y + c.h + 4;
      if (en(b.congelar)) return congelar();
      if (en(b.cerrar)) {
        presionado = "cerrar";
        window.setTimeout(() => (presionado = null), 120);
        seleccion = null;
        m.audio.mover();
        return;
      }
    }
    let mejor: IdNodo | null = null;
    let dist = 18;
    for (const nd of Object.values(red)) {
      if (!nd.cuenta) continue;
      const p = pos(nd.id, h);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) {
        dist = d;
        mejor = nd.id;
      }
    }
    if (mejor && mejor !== seleccion) {
      seleccion = mejor;
      investigoAlguna = true;
      abierta = m.t;
      m.audio.confirmar();
    }
  };

  const tecla = (b: Boton) => {
    if (b === "b") seleccion = null;
    if (b === "a") congelar();
  };

  const enviar = (de: IdNodo, a: IdNodo, v: number, robada: boolean) => monedas.push({ de, a, k: 0, valor: v, robada });

  const actualizar = (t: number) => {
    restante--;
    if (restante <= 0) return terminar();
    if (restante === 600) m.audio.ritmo = 1.2;
    if (restante <= 600 && restante % 45 === 0) m.audio.latido();
    // víctimas → 4471
    if (emitidas < MONEDAS && t % 38 === 0) {
      emitidas++;
      enviar("victimas", "m1", valor, true);
    }
    // ruido legítimo
    if (t % 50 === 0) enviar("vecinos", "bodega", 0, false);
    if (t % 90 === 45) enviar("turistas", "hotel", 0, false);
    // reenvíos
    for (const nd of Object.values(red)) {
      if (nd.error > 0) nd.error--;
      if (!nd.ritmo || nd.congelada || nd.destinos.length === 0) continue;
      if (t % nd.ritmo !== 0) continue;
      if (nd.mula) {
        if (nd.saldo <= 0) continue;
        const v = Math.min(nd.saldo, valor);
        nd.saldo -= v;
        enviar(nd.id, nd.destinos[nd.turno++ % nd.destinos.length], v, true);
      } else {
        enviar(nd.id, nd.destinos[0], 0, false);
      }
    }
    // monedas en camino
    for (let i = monedas.length - 1; i >= 0; i--) {
      const c = monedas[i];
      c.k += c.robada ? 1 / 44 : 1 / 60;
      if (c.k < 1) continue;
      monedas.splice(i, 1);
      const destino = red[c.a];
      if (!c.robada) continue;
      if (destino.congelada) {
        recuperado += c.valor;
        continue;
      }
      if (destino.id === "salida") {
        perdido += c.valor;
        const p = pos("salida", m.h);
        m.flotante(`-${dinero(pais, c.valor)}`, p.x - 50, p.y - 18, PAL.rojo);
        m.audio.monedas();
        continue;
      }
      destino.saldo += c.valor;
    }
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    const f = t - inicioFase;
    if (fase === "cuenta" && f % 34 === 0 && f < 100) m.audio.cuenta(false);
    if (fase === "cuenta" && f >= 100) {
      m.audio.cuenta(true);
      fase = "juego";
      inicioFase = t;
      m.musica("detective");
    }
    if (fase === "juego") actualizar(t);

    // ── fondo: mapa nocturno ──
    p.degradado(0, h, "#0d1b2a", "#10243d");
    for (let x = 0; x < W; x += 12) p.alfa(0.07, () => p.rect(PAL.celeste, x, 0, 1, h));
    for (let y = 0; y < h; y += 12) p.alfa(0.07, () => p.rect(PAL.celeste, 0, y, W, 1));

    // ── aristas ──
    const aristas: Array<[IdNodo, IdNodo, boolean]> = [
      ["victimas", "m1", true], ["m1", "m2", true], ["m1", "m3", true], ["m2", "m3", true], ["m3", "salida", true],
      ["vecinos", "bodega", false], ["bodega", "prov", false], ["turistas", "hotel", false],
    ];
    for (const [a, b, robada] of aristas) {
      const pa = pos(a, h);
      const pb = pos(b, h);
      const pasos = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 4);
      for (let i = 0; i < pasos; i++) {
        if ((i + Math.floor(t / 6)) % 3 !== 0) continue;
        const k = i / pasos;
        p.alfa(robada ? 0.35 : 0.2, () => p.rect(robada ? PAL.ambar : PAL.celeste, pa.x + (pb.x - pa.x) * k, pa.y + (pb.y - pa.y) * k, 1, 1));
      }
    }

    // ── monedas ──
    for (const c of monedas) {
      const pa = pos(c.de, h);
      const pb = pos(c.a, h);
      const x = pa.x + (pb.x - pa.x) * c.k;
      const y = pa.y + (pb.y - pa.y) * c.k;
      if (c.robada) {
        p.rect(PAL.ambarOscuro, x - 2, y - 2, 5, 5);
        p.rect(PAL.ambar, x - 2, y - 2, 4, 4);
        p.rect("#ffe08a", x - 1, y - 1, 1, 1);
      } else {
        p.rect(PAL.celeste, x - 1, y - 1, 3, 3);
      }
    }

    // ── nodos ──
    for (const nd of Object.values(red)) {
      const q = pos(nd.id, h);
      if (nd.id === "turistas") continue;
      if (!nd.cuenta) {
        if (nd.id === "salida") {
          p.rect(PAL.rojoOscuro, q.x - 12, q.y - 7, 24, 14);
          p.rect(PAL.rojo, q.x - 11, q.y - 6, 22, 12);
          p.centrado("$>", q.y - 3, PAL.blanco, 8, undefined, q.x - 12, 24);
          p.centrado(nd.codigo, q.y + 10, PAL.rojo, 8, undefined, q.x - 30, 60);
        } else {
          for (let i = 0; i < (nd.id === "victimas" ? 7 : 4); i++) {
            const dx = (i % 4) * 7 - 10;
            const dy = Math.floor(i / 4) * 7 - 4;
            p.rect(nd.id === "victimas" ? PAL.piel : PAL.grisClaro, q.x + dx, q.y + dy, 5, 5);
          }
          p.centrado(nd.codigo, q.y + 12, nd.id === "victimas" ? PAL.ambar : PAL.gris, 8, undefined, q.x - 50, 100);
        }
        continue;
      }
      const sel = seleccion === nd.id;
      const r = 10;
      if (sel) p.circulo(q.x, q.y, r + 3 + (Math.floor(t / 8) % 2), PAL.ambar);
      const color = nd.error > 0 ? PAL.rojo : nd.congelada ? "#bfe8ff" : PAL.crema;
      p.circulo(q.x, q.y, r + 1, PAL.tinta);
      p.circulo(q.x, q.y, r, color);
      // ícono: billetes acumulados
      const lleno = Math.min(6, Math.ceil(nd.saldo / valor));
      for (let i = 0; i < lleno; i++) p.rect(PAL.ambar, q.x - 6 + (i % 3) * 4, q.y - 3 + Math.floor(i / 3) * 4, 3, 3);
      if (nd.congelada) {
        const kk = Math.min(1, (t - nd.hielo) / 12);
        p.alfa(kk, () => {
          p.rect(PAL.celeste, q.x - 7, q.y - 1, 14, 2);
          p.rect(PAL.celeste, q.x - 1, q.y - 7, 2, 14);
          p.rect(PAL.blanco, q.x - 4, q.y - 4, 2, 2);
          p.rect(PAL.blanco, q.x + 3, q.y + 3, 2, 2);
        });
      }
      if (nd.error > 0) p.centrado("X", q.y - 3, PAL.blanco, 8, undefined, q.x - 10, 20);
      const etiqueta = nd.congelada ? "MULA" : nd.codigo;
      p.rect(PAL.tinta, q.x - 17, q.y + r + 2, 34, 10);
      p.centrado(etiqueta, q.y + r + 3, nd.congelada ? PAL.celeste : PAL.crema, 8, undefined, q.x - 17, 34);
    }

    // primera vez: flecha a la cuenta que recibe el dinero
    if (fase === "juego" && !investigoAlguna) {
      const q = pos("m1", h);
      const rebote = Math.floor(t / 10) % 2 ? 3 : 0;
      for (let i = 0; i < 6; i++) p.rect(PAL.ambar, q.x - 6 + i, q.y - 24 + i + rebote, 12 - i * 2, 1);
      p.rect(PAL.ambar, q.x - 2, q.y - 32 + rebote, 4, 8);
      if (!chico(h)) p.textoSombra("¡TOCA AQUÍ!", q.x - 44, q.y + 26, PAL.ambar, PAL.tinta);
    }

    // ── HUD ──
    const k = restante / (SEGUNDOS * 60);
    p.textoSombra("SIGUE EL DINERO", 4, 4, PAL.ambar, PAL.tinta);
    p.barra(4, 16, W - 8, k, k > 0.5 ? PAL.verde : k > 0.2 ? PAL.ambar : PAL.rojo);
    p.rect(PAL.celeste, 4, 27, 6, 6);
    p.rect(PAL.blanco, 6, 29, 2, 2);
    p.texto(dinero(pais, recuperado), 13, 26, PAL.celeste);
    const perd = `-${dinero(pais, perdido)}`;
    p.texto(perd, W - 4 - p.ancho(perd), 26, PAL.rojo);

    // ── panel inferior ──
    const pn = panel(h);
    p.caja(pn.x, pn.y, pn.w, pn.h, PAL.crema, PAL.tinta, PAL.ambar);
    if (fase === "cuenta") {
      p.texto("Eres el DETECTIVE.", pn.x + 10, pn.y + 10, PAL.azul);
      p.texto("El dinero de 14", pn.x + 10, pn.y + 26, PAL.tinta);
      p.texto("víctimas salta de", pn.x + 10, pn.y + 38, PAL.tinta);
      p.texto("cuenta en cuenta.", pn.x + 10, pn.y + 50, PAL.tinta);
      p.texto("Toca una cuenta y", pn.x + 10, pn.y + 66, PAL.tinta);
      p.texto("congela las MULAS.", pn.x + 10, pn.y + 78, PAL.rojoOscuro);
      const n = 3 - Math.floor(f / 34);
      if (n > 0) p.textoSombra(String(n), pn.x + pn.w - 26, pn.y + 10, PAL.ambar, PAL.tinta, 16);
    } else if (fase === "fin") {
      const todas = mulas() === 3;
      p.escalado(W / 2, pn.y + 30, 1 + Math.max(0, 1 - f / 10), () =>
        p.centrado(todas ? "¡RED DESARMADA!" : "¡SE ESFUMÓ!", pn.y + 22, todas ? PAL.verdeOscuro : PAL.rojoOscuro, 8),
      );
      p.centrado(`Mulas: ${mulas()}/3`, pn.y + 46, PAL.tinta);
      p.centrado(`Falsos positivos: ${falsos}`, pn.y + 62, falsos ? PAL.rojoOscuro : PAL.tinta);
    } else if (seleccion) {
      const nd = red[seleccion];
      p.texto(`CUENTA ${nd.codigo}`, pn.x + 10, pn.y + (chico(h) ? 7 : 9), PAL.azul);
      const reveladas = Math.min(nd.pistas.length, Math.floor((t - abierta) / 12) + 1);
      const sep = chico(h) ? 11 : 13;
      const y0 = chico(h) ? 20 : 23;
      for (let i = 0; i < reveladas; i++) {
        const kk = Math.min(1, (t - abierta - i * 12) / 8);
        const [texto, tono] = nd.pistas[i];
        const color = tono === "r" ? PAL.rojo : tono === "a" ? PAL.ambar : PAL.verde;
        p.alfa(kk, () => {
          p.rect(color, pn.x + 9, pn.y + y0 + i * sep, 5, 7);
          p.texto(texto, pn.x + 17, pn.y + y0 + i * sep, tono === "r" ? PAL.rojoOscuro : PAL.tinta);
        });
      }
      const listo = reveladas >= nd.pistas.length;
      if (!listo && Math.floor(t / 10) % 2 === 0) p.texto("investigando...", pn.x + 17, pn.y + y0 + reveladas * sep, PAL.gris);
      const rojas = nd.pistas.filter(([, tono]) => tono === "r").length;
      if (listo && !nd.congelada && nd.error === 0) {
        p.texto(rojas >= 2 ? `${rojas} rojas: ¡es MULA!` : "Parece normal.", pn.x + 10, pn.y + y0 + nd.pistas.length * sep + 2, rojas >= 2 ? PAL.rojoOscuro : PAL.verdeOscuro);
      }
      const b = botones(h);
      const bloqueada = nd.congelada || nd.error > 0;
      const invita = listo && rojas >= 2 && !bloqueada && Math.floor(t / 12) % 2 === 0;
      p.alfa(bloqueada ? 0.4 : 1, () => p.boton(b.congelar, nd.congelada ? "CONGELADA" : "CONGELAR", { color: invita ? PAL.celeste : "#bfe8ff", activo: invita, presionado: presionado === "congelar" }));
      p.boton(b.cerrar, rojas >= 2 ? "CERRAR" : "ES NORMAL", { color: !bloqueada && listo && rojas < 2 ? "#bfe8c9" : undefined, presionado: presionado === "cerrar" });
    } else {
      p.texto("Toca una cuenta", pn.x + 10, pn.y + 12, PAL.tinta);
      p.texto("para investigarla.", pn.x + 10, pn.y + 24, PAL.tinta);
      p.rect(PAL.ambar, pn.x + 10, pn.y + 45, 4, 4);
      p.texto("= dinero robado", pn.x + 18, pn.y + 43, PAL.gris);
      p.rect(PAL.celeste, pn.x + 10, pn.y + 59, 3, 3);
      p.texto("= pagos normales", pn.x + 18, pn.y + 57, PAL.gris);
      p.texto(`Mulas ${mulas()}/3`, pn.x + 10, pn.y + 80, PAL.azul);
      if (falsos) p.texto(`Errores ${falsos}`, pn.x + 96, pn.y + 80, PAL.rojoOscuro);
    }

    if (mensaje && t < mensaje.hasta) {
      const kk = facil.salida(Math.min(1, (mensaje.hasta - t) / 12));
      const sub = mensaje.sub.slice(0, 22);
      const ancho = Math.min(W - 8, Math.max(p.ancho(mensaje.texto), p.ancho(sub)) + 12);
      p.alfa(kk, () => {
        p.rect(PAL.tinta, (W - ancho) / 2, 38, ancho, 25);
        p.rect(mensaje!.color, (W - ancho) / 2 + 1, 39, ancho - 2, 23);
        p.centrado(mensaje!.texto, 41, PAL.tinta);
        p.centrado(sub, 52, PAL.tinta);
      });
    }
  };

  const info = () => ({
    fase,
    seleccion,
    nodos: Object.values(red)
      .filter((nd) => nd.cuenta)
      .map((nd) => ({ id: nd.id, mula: nd.mula, congelada: nd.congelada, ...pos(nd.id, m.h) })),
    botones: botones(m.h),
  });
  m.minijuego({ dibujar, tocar, tecla, info });
  return terminado;
}

/**
 * APRENDE: la siguiente víctima transfiere a la mula ya confirmada y la
 * Memoria la frena al instante, sin gastar IA.
 */
export function escenaMemoria(estado: { k: number; nombre: string; monto: string; escudo: number }) {
  return (p: Pincel, t: number) => {
    const h = p.h;
    p.degradado(0, h, "#0d1b2a", "#1d3557");
    for (let x = 0; x < W; x += 12) p.alfa(0.07, () => p.rect(PAL.celeste, x, 0, 1, h));
    const cy = Math.round(h * 0.36);
    const vx = 34;
    const mx = 156;
    // víctima
    p.alfa(0.3, () => p.elipse(vx, cy + 16, 12, 3, PAL.negro));
    p.sprite(persona("der", Math.floor(t / 20) % 2 === 0 ? 0 : 1), PALETAS.jorge, vx - 16, cy - 16, 2);
    p.centrado(estado.nombre, cy + 22, PAL.crema, 8, PAL.tinta, vx - 40, 80);
    // mula congelada
    p.circulo(mx, cy, 13, PAL.tinta);
    p.circulo(mx, cy, 12, "#bfe8ff");
    p.rect(PAL.celeste, mx - 8, cy - 1, 16, 2);
    p.rect(PAL.celeste, mx - 1, cy - 8, 2, 16);
    p.centrado("4471", cy + 16, PAL.celeste, 8, PAL.tinta, mx - 30, 60);
    p.centrado("MEMORIA:", cy - 32, PAL.ambar, 8, PAL.tinta, mx - 40, 80);
    p.centrado("MULA", cy - 22, PAL.ambar, 8, PAL.tinta, mx - 40, 80);
    // moneda viajando
    if (estado.k > 0 && estado.k < 1) {
      const x = vx + 14 + (mx - 60 - vx) * estado.k;
      p.rect(PAL.ambarOscuro, x - 3, cy - 3, 7, 7);
      p.rect(PAL.ambar, x - 3, cy - 3, 6, 6);
      p.texto(estado.monto, x - 20, cy - 16, PAL.ambar);
    }
    // escudo
    if (estado.escudo > 0) {
      const ex = mx - 40;
      const s = estado.escudo;
      p.alfa(s, () => {
        for (let i = -16; i <= 16; i++) {
          const w = 3 + Math.round(2 * Math.sin(t / 6 + i / 3));
          p.rect(PAL.celeste, ex + Math.abs(i) / 4, cy + i, w, 1);
        }
      });
    }
  };
}
