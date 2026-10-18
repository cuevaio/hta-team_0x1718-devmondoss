import type { Boton, Motor } from "./motor";
import { dinero, type Pais } from "./paises";
import { PAL, Pincel, W, envolver, facil, type Caja } from "./pincel";

/**
 * ¿PAUSA O PASA? — eres nuestro sistema. Llegan transferencias con sus
 * señales y decides en segundos: PAUSA (y el Guardián pregunta, el Detective
 * investiga) o PASA (no molestar al cliente). Si no decides a tiempo, el
 * dinero sale: así de rápido es en la vida real.
 *
 * Enseña lo que no hace un «detector de patrones»: una señal sola no basta
 * (llamada + pago a su mamá = pasa), la cuenta destino importa (Detective) y
 * lo aprendido vale para todos (Memoria).
 */

type Tono = "riesgo" | "normal" | "memoria";
type Agente = "guardian" | "detective" | "memoria" | "normal";

type Ticket = {
  id: string;
  riesgosa: boolean;
  quien: 0 | 1 | 2;
  destino: string;
  monto: number;
  senales: Array<{ texto: string; tono: Tono }>;
  agente: Agente;
  razon: string;
};

const R = (texto: string) => ({ texto, tono: "riesgo" as const });
const N = (texto: string) => ({ texto, tono: "normal" as const });

const TICKETS: Ticket[] = [
  { id: "llamada_todo", riesgosa: true, quien: 0, destino: "Cuenta nueva", monto: 4800, senales: [R("En llamada ahora"), R("Destino nuevo"), R("Monto alto: todo")], agente: "guardian", razon: "En llamada y pagando a alguien nuevo." },
  { id: "celular_madrugada", riesgosa: true, quien: 2, destino: "Cuenta nueva", monto: 3000, senales: [R("Celular nuevo hoy"), R("Destino nuevo"), R("3:00 a.m.")], agente: "guardian", razon: "Celular nuevo, de madrugada y a alguien nuevo." },
  { id: "memoria_mula", riesgosa: true, quien: 1, destino: "Cuenta 4471", monto: 300, senales: [N("Monto chico"), N("De día"), { texto: "MEMORIA: es mula", tono: "memoria" }], agente: "memoria", razon: "Ya es mula confirmada: pausa al instante, 0 IA." },
  { id: "destino_extranos", riesgosa: true, quien: 1, destino: "Cuenta nueva", monto: 1500, senales: [N("Celular de siempre"), R("Destino nuevo"), R("Recibe de extraños")], agente: "detective", razon: "La cuenta destino recibe de 14 extraños: mula." },
  { id: "chip_duplicado", riesgosa: true, quien: 0, destino: "Cuenta nueva", monto: 2500, senales: [R("Chip duplicado hoy"), R("Monto alto"), R("Destino nuevo")], agente: "guardian", razon: "Le duplicaron el chip: verificamos por otro canal." },
  { id: "vacia_cuenta", riesgosa: true, quien: 2, destino: "Cuenta nueva", monto: 6200, senales: [R("Vacía la cuenta"), R("Destino nuevo"), N("De día")], agente: "guardian", razon: "Vaciar la cuenta hacia alguien nuevo." },
  { id: "bodega", riesgosa: false, quien: 0, destino: "Bodega", monto: 380, senales: [N("Bodega de siempre"), N("Monto normal"), N("Hora habitual")], agente: "normal", razon: "Pago de siempre: no molestamos." },
  { id: "llamada_mama", riesgosa: false, quien: 1, destino: "Mamá", monto: 120, senales: [R("En llamada ahora"), N("Paga a su mamá"), N("Monto chico")], agente: "normal", razon: "Una llamada sola no basta: es su mamá de siempre." },
  { id: "celular_alquiler", riesgosa: false, quien: 2, destino: "Alquiler", monto: 900, senales: [R("Celular nuevo"), N("Alquiler mensual"), N("Monto de siempre")], agente: "normal", razon: "Cambió de celular, pero paga lo de siempre." },
  { id: "luz", riesgosa: false, quien: 0, destino: "Luz", monto: 95, senales: [N("Recibo de luz"), N("Cada mes"), N("Monto normal")], agente: "normal", razon: "Su recibo de cada mes." },
  { id: "alto_alquiler", riesgosa: false, quien: 1, destino: "Casero", monto: 1800, senales: [R("Monto alto"), N("Destino de siempre"), N("Cada mes")], agente: "normal", razon: "Alto, pero es su alquiler de cada mes." },
  { id: "hotel_sin_senal", riesgosa: false, quien: 2, destino: "Hotel", monto: 650, senales: [N("Hotel de siempre"), R("Sin señal"), N("Monto normal")], agente: "normal", razon: "Sin señal, pero es su hotel de siempre." },
];

const AGENTE: Record<Agente, { nombre: string; color: string }> = {
  guardian: { nombre: "GUARDIÁN", color: PAL.verde },
  detective: { nombre: "DETECTIVE", color: PAL.celeste },
  memoria: { nombre: "MEMORIA", color: PAL.ambar },
  normal: { nombre: "TODO NORMAL", color: PAL.grisClaro },
};

export type RespuestaPOP = { carta: string; categoria: string; estafa: boolean; dijo_estafa: boolean; ms: number };

export type ResultadoPOP = {
  puntaje: number;
  aciertos: number;
  total: number;
  robos: number;
  molestias: number;
  mejorCombo: number;
  vidas: number;
  respuestas: RespuestaPOP[];
};

const SEGUNDOS = 45;
const VIDAS = 3;
const CORAZON = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pausaOPasa(m: Motor, pais: Pais): Promise<ResultadoPOP> {
  const nombres = [pais.rosa, pais.jorge, pais.lucia];
  // Primero uno obvio de cada lado; después, al azar.
  const primeros = [TICKETS[0], TICKETS[6]];
  let mazo = [...primeros, ...barajar(TICKETS.filter((x) => !primeros.includes(x)))];
  let idx = 0;
  let fase: "cuenta" | "juego" | "bien" | "mal" | "fin" = "cuenta";
  let inicioFase = m.t;
  let restante = SEGUNDOS * 60;
  let vidas = VIDAS;
  let puntaje = 0;
  let mostrado = 0;
  let combo = 0;
  let mejorCombo = 0;
  let aparecio = m.t;
  let limite = 300;
  let robos = 0;
  let molestias = 0;
  let presionado: "pausa" | "pasa" | null = null;
  let ultimo: { t: Ticket; pauso: boolean; porTiempo: boolean } | null = null;
  const respuestas: RespuestaPOP[] = [];
  let resolver: (r: ResultadoPOP) => void = () => {};
  const terminado = new Promise<ResultadoPOP>((r) => (resolver = r));

  const botones = (h: number) => ({ pausa: { x: 8, y: h - 60, w: 84, h: 48 }, pasa: { x: 100, y: h - 60, w: 84, h: 48 } });
  const cajaTicket = (h: number): Caja => ({ x: 12, y: 40, w: W - 24, h: Math.min(140, Math.max(108, h - 200)) });

  const cambiar = (f: typeof fase) => {
    fase = f;
    inicioFase = m.t;
  };

  const terminar = () => {
    if (fase === "fin") return;
    cambiar("fin");
    m.musica(null);
    window.setTimeout(() => {
      m.minijuego(null);
      resolver({
        puntaje,
        aciertos: respuestas.filter((r) => r.estafa === r.dijo_estafa).length,
        total: respuestas.length,
        robos,
        molestias,
        mejorCombo,
        vidas,
        respuestas,
      });
    }, 1600);
  };

  const siguiente = () => {
    idx++;
    if (idx >= mazo.length) {
      mazo = barajar(TICKETS);
      idx = 0;
    }
    if (vidas <= 0 || restante <= 0) return terminar();
    aparecio = m.t;
    // Cada vez hay menos tiempo para decidir: 5 s → 2,5 s.
    limite = Math.max(150, 300 - respuestas.length * 12);
    cambiar("juego");
  };

  const decidir = (pauso: boolean, porTiempo = false) => {
    if (fase !== "juego") return;
    const t = mazo[idx];
    const ms = Math.round(((m.t - aparecio) * 1000) / 60);
    respuestas.push({ carta: t.id, categoria: t.agente, estafa: t.riesgosa, dijo_estafa: pauso, ms });
    ultimo = { t, pauso, porTiempo };
    if (!porTiempo) {
      presionado = pauso ? "pausa" : "pasa";
      window.setTimeout(() => (presionado = null), 120);
    }
    const c = cajaTicket(m.h);
    if (pauso === t.riesgosa) {
      combo++;
      mejorCombo = Math.max(mejorCombo, combo);
      const mult = Math.min(4, 1 + Math.floor(combo / 3));
      const rapido = ms < 2000 ? 50 : 0;
      const pts = 100 * mult + rapido;
      puntaje += pts;
      m.flotante(`+${pts}`, W / 2 - 16, c.y + 10, PAL.verde);
      if (pauso) {
        m.audio.sello();
        m.particulas_(W / 2, c.y + c.h / 2, 18, { colores: [PAL.ambar, PAL.blanco], vel: 2, g: 0, vida: 26 });
      } else {
        m.audio.acierto(combo);
        m.audio.monedas();
      }
      if (combo > 0 && combo % 3 === 0) m.flotante(`COMBO x${mult}!`, 54, c.y + c.h + 4, PAL.ambar);
      m.vibrar(10);
      cambiar("bien");
    } else {
      combo = 0;
      vidas--;
      if (t.riesgosa) {
        robos++;
        m.audio.drenar();
      } else {
        molestias++;
        m.audio.error();
      }
      m.vibrar([60, 40, 90]);
      m.sacudir(14);
      m.destello = 6;
      cambiar("mal");
    }
  };

  const tocar = (x: number, y: number) => {
    if (fase === "mal") {
      if (m.t - inicioFase > 24) siguiente();
      return;
    }
    if (fase !== "juego") return;
    const b = botones(m.h);
    const en = (c: Caja) => x >= c.x - 4 && x < c.x + c.w + 4 && y >= c.y - 6 && y < c.y + c.h + 6;
    if (en(b.pausa)) decidir(true);
    else if (en(b.pasa)) decidir(false);
  };

  const tecla = (b: Boton) => {
    if (b === "izq") decidir(true);
    else if (b === "der") decidir(false);
    else if (b === "a" && fase === "mal" && m.t - inicioFase > 24) siguiente();
  };

  const dibujarTicket = (p: Pincel, c: Caja, t: Ticket, k: number, sello: "pausa" | "pasa" | null) => {
    p.alfa(0.4, () => p.rect(PAL.negro, c.x + 3, c.y + 5, c.w, c.h));
    p.rect(PAL.tinta, c.x, c.y, c.w, c.h);
    p.rect(PAL.crema, c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    p.rect(PAL.navy, c.x + 2, c.y + 2, c.w - 4, 16);
    p.texto("ENVÍO", c.x + 8, c.y + 6, PAL.crema);
    const monto = dinero(pais, t.monto);
    p.texto(monto, c.x + c.w - 8 - p.ancho(monto), c.y + 6, PAL.ambar);
    p.texto(`De: ${nombres[t.quien]}`.slice(0, 19), c.x + 8, c.y + 24, PAL.gris);
    p.texto(`A:  ${t.destino}`.slice(0, 19), c.x + 8, c.y + 36, PAL.tinta);
    p.rect(PAL.grisClaro, c.x + 8, c.y + 48, c.w - 16, 1);
    const hueco = Math.max(14, Math.min(20, Math.floor((c.h - 62) / 3)));
    t.senales.forEach((s, i) => {
      const y = c.y + 54 + i * hueco;
      const color = s.tono === "riesgo" ? PAL.rojo : s.tono === "memoria" ? PAL.ambar : PAL.verde;
      p.rect(color, c.x + 6, y, c.w - 12, hueco - 3);
      p.rect("rgba(255,255,255,0.25)", c.x + 6, y, c.w - 12, 1);
      p.texto(s.texto.slice(0, 19), c.x + 10, y + Math.round((hueco - 3 - 8) / 2), s.tono === "normal" ? PAL.tinta : PAL.blanco);
    });
    // reloj de decisión
    if (fase === "juego") {
      const q = Math.max(0, 1 - k);
      p.rect(PAL.tinta, c.x, c.y + c.h + 3, c.w, 5);
      p.rect(q > 0.35 ? PAL.verde : PAL.rojo, c.x + 1, c.y + c.h + 4, Math.round((c.w - 2) * q), 3);
    }
    // El sello va sobre la cabecera: no tapa las señales, que son lo que se aprende.
    if (sello) {
      const kk = facil.salida(Math.min(1, (m.t - inicioFase) / 8));
      p.escalado(c.x + c.w / 2, c.y + 10, 1 + (1 - kk) * 1.5, () => {
        p.rect(PAL.tinta, c.x + 1, c.y, c.w - 2, 20);
        p.rect(sello === "pausa" ? PAL.ambar : PAL.verde, c.x + 2, c.y + 1, c.w - 4, 18);
        p.centrado(sello === "pausa" ? "|| PAUSADA" : "> ENVIADA", c.y + 6, PAL.tinta, 8, undefined, c.x, c.w);
      });
    }
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    const f = t - inicioFase;
    if (fase === "cuenta") {
      if (f % 40 === 0 && f < 120) m.audio.cuenta(false);
      if (f >= 120) {
        m.audio.cuenta(true);
        m.musica("jefe");
        aparecio = t;
        cambiar("juego");
      }
    } else if (fase === "juego") {
      restante--;
      if (restante === 10 * 60) m.audio.ritmo = 1.15;
      if (restante <= 600 && restante % 50 === 0) m.audio.latido();
      if (restante <= 0) terminar();
      else if (t - aparecio >= limite) decidir(false, true);
      else if ((limite - (t - aparecio)) % 30 === 0 && limite - (t - aparecio) <= 90) m.audio.tic();
    } else if (fase === "bien" && f >= 40) siguiente();
    else if (fase === "mal" && f >= 300) siguiente();
    mostrado += Math.ceil((puntaje - mostrado) / 5);

    // fondo: sala de control
    p.degradado(0, h, "#0b1830", "#122a4a");
    for (let i = 0; i < 6; i++) {
      const y = (i * 61 + t) % h;
      p.alfa(0.1, () => p.rect(PAL.verde, 0, y, W, 1));
    }

    // HUD
    p.textoSombra(String(mostrado).padStart(5, "0"), 6, 5, PAL.ambar, PAL.tinta);
    if (combo >= 2) p.textoSombra(`x${Math.min(4, 1 + Math.floor(combo / 3))}`, 52, 5, PAL.verde, PAL.tinta);
    for (let i = 0; i < VIDAS; i++) p.sprite(CORAZON, { X: i < vidas ? PAL.rojo : "#4a4560" }, 128 + i * 11, 6, 1);
    const k = restante / (SEGUNDOS * 60);
    p.barra(6, 20, W - 12, k, k > 0.5 ? PAL.verde : k > 0.2 ? PAL.ambar : PAL.rojo);
    p.texto(`${Math.ceil(restante / 60)}s`, W - 30, 28, PAL.grisClaro);

    const c = cajaTicket(h);
    if (fase === "cuenta") {
      p.centrado("ERES EL SISTEMA", c.y + 16, PAL.ambar, 8, PAL.tinta);
      p.centrado("¿PAUSA o PASA?", c.y + 34, PAL.crema, 8, PAL.tinta);
      const n = 3 - Math.floor(f / 40);
      p.escalado(W / 2, c.y + 80, 1 + (1 - facil.salida((f % 40) / 40)), () => p.centrado(n > 0 ? String(n) : "¡YA!", c.y + 72, PAL.ambar, 16, PAL.tinta));
    } else if (fase === "fin") {
      p.escalado(W / 2, c.y + 60, 1 + Math.max(0, 1 - f / 10), () =>
        p.centrado(vidas <= 0 ? "¡SIN VIDAS!" : "¡TIEMPO!", c.y + 52, vidas <= 0 ? PAL.rojo : PAL.ambar, 16, PAL.tinta),
      );
      p.centrado(`${puntaje} PUNTOS`, c.y + 78, PAL.crema, 8, PAL.tinta);
    } else if (fase === "juego") {
      const kk = facil.salida(Math.min(1, (t - aparecio) / 10));
      dibujarTicket(p, { ...c, x: c.x + Math.round((1 - kk) * W) }, mazo[idx], (t - aparecio) / limite, null);
    } else if (ultimo) {
      const u = ultimo;
      dibujarTicket(p, c, u.t, 1, u.pauso ? "pausa" : "pasa");
      // explicación
      const ag = AGENTE[u.t.agente];
      const bien = fase === "bien";
      const titulo = bien ? (u.pauso ? "¡BIEN PAUSADA!" : "¡BIEN, PASÓ!") : u.t.riesgosa ? (u.porTiempo ? "¡NADIE ACTUÓ!" : "¡SE ROBARON TODO!") : "¡CLIENTE MOLESTO!";
      const lineas = envolver(u.t.razon, 20).slice(0, 3);
      const y = c.y + c.h + 12;
      const alto = 32 + lineas.length * 11;
      p.caja(8, y, W - 16, alto, PAL.crema, PAL.tinta, bien ? PAL.verde : PAL.rojo);
      p.texto(titulo, 15, y + 7, bien ? PAL.verdeOscuro : PAL.rojoOscuro);
      p.rect(ag.color, 15, y + 18, p.ancho(ag.nombre) + 6, 10);
      p.texto(ag.nombre, 18, y + 19, PAL.tinta);
      lineas.forEach((l, i) => p.texto(l, 15, y + 31 + i * 11, PAL.tinta));
      if (!bien && f > 24 && Math.floor(f / 20) % 2 === 0) p.centrado("toca para seguir", y + alto + 3, PAL.crema, 8, PAL.tinta);
    }

    // botones
    const b = botones(h);
    p.alfa(fase === "juego" ? 1 : 0.45, () => {
      p.boton(b.pausa, "", { color: PAL.ambar, presionado: presionado === "pausa" });
      p.boton(b.pasa, "", { color: "#bfe8c9", presionado: presionado === "pasa" });
      const d1 = presionado === "pausa" ? 2 : 0;
      const d2 = presionado === "pasa" ? 2 : 0;
      p.rect(PAL.tinta, b.pausa.x + 35, b.pausa.y + 8 + d1, 4, 14);
      p.rect(PAL.tinta, b.pausa.x + 45, b.pausa.y + 8 + d1, 4, 14);
      for (let i = 0; i < 7; i++) p.rect(PAL.verdeOscuro, b.pasa.x + 37 + i, b.pasa.y + 8 + i + d2, 3, 14 - i * 2);
      p.centrado("PAUSA", b.pausa.y + 30 + d1, PAL.tinta, 8, undefined, b.pausa.x, b.pausa.w);
      p.centrado("PASA", b.pasa.y + 30 + d2, PAL.tinta, 8, undefined, b.pasa.x, b.pasa.w);
    });
  };

  const info = () => ({ fase, riesgosa: fase === "juego" ? mazo[idx].riesgosa : null, botones: botones(m.h) });
  m.minijuego({ dibujar, tocar, tecla, info });
  return terminado;
}
