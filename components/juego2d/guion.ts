import type { Caso } from "@/lib/contracts";
import { motivoAliasInvalido } from "@/lib/juego/alias";
import type { PreguntaEncuesta } from "@/lib/juego/arcade";
import {
  accionSala,
  crearSala,
  registrarArcade,
  registrarPartida,
  responderGuardian,
  resumenArcade,
  transferir,
  type FilaRanking,
  type JuegoVivo,
  type JugadaArcade,
} from "@/components/juego/api";
import {
  DESTINOS,
  ESTAFA_ROSA,
  MAX_INTENTOS,
  MONTOS,
  PAGO_PROVEEDOR,
  RESPUESTAS_GUARDIAN,
  SEGUNDOS_LLAMADA,
  SENALES,
  TACTICAS,
  VICTIMAS,
  actoresDe,
  armarTransferencia,
  explicar,
  huboPausaPreventiva,
  preguntaPendiente,
  puntosDe,
  retiene,
  type Jugada,
} from "@/components/juego/datos";
import { atrapaLaMula } from "./atrapaLaMula";
import { epilogo, introVista, videoIntro } from "./cinematica";
import {
  batalla,
  bodega,
  capitulo,
  laboratorio,
  nuevaBatalla,
  puntosBatalla,
  sierra,
  titulo,
  type EstadoBatalla,
  type EstadoBodega,
  type TablaRecords,
} from "./escenas";
import { SalidaDelJugador, type Motor, type Opcion } from "./motor";
import { TILE, posicionObjetivo, type ConfigMundo, type Npc } from "./mundo";
import { PAISES, dinero, type Pais, type PaisId } from "./paises";
import { PAL, W, facil } from "./pincel";
import { pausaOPasa } from "./pausaOPasa";
import {
  LOGROS,
  MODOS_ARCADE,
  cargarProgreso,
  guardarProgreso,
  proximaEstrella,
  rango,
  sumarPartida,
  type Cosecha,
  type IdLogro,
  type ModoArcade,
  type Progreso,
} from "./progreso";
import { cuadroEstrella, escenaRanking, escenaResultado, type DatosResultado } from "./ranking";
import { mazo, realOEstafa } from "./realOEstafa";
import { escenaMemoria, sigueElDinero } from "./sigueElDinero";
import { comoSeJuega, icono, teLlevas, type Paso } from "./tutorial";
import { frase } from "./jerga";
import { menuHub, menuPaises } from "./hub";
import { apodoRecordado, identificar, paisRecordado, recordar } from "./identidad";
import { pantallaSala, type ResultadoSala } from "./sala";
import { pantallaSalaBanda, type ResultadoBanda } from "./salaBanda";
import type { Direccion } from "./sprites";

/**
 * Guion del juego (docs/DEMO_JUEGO.md). Cada escena es una función `async`
 * que espera al jugador. Las decisiones del sistema salen siempre de la API
 * real; el juego solo las pone en escena. El país cambia nombres, moneda y
 * modalidades locales, no la lógica.
 */

const VEGA = "ANALISTA VEGA";

type RutaId = "llamada" | "senal" | "familiar" | "comprobante" | "banda";
type Marca = { texto: string; color: string };

const HISTORIAS: Array<{ id: RutaId; titulo: string; sub: string; color: string }> = [
  { id: "llamada", titulo: "LA LLAMADA", sub: "Falso banco", color: PAL.ambar },
  { id: "senal", titulo: "SIN SEÑAL", sub: "Viaje sin cobertura", color: PAL.celeste },
  { id: "familiar", titulo: "EL FAMILIAR", sub: "Número nuevo", color: PAL.verde },
  { id: "comprobante", titulo: "EL COMPROBANTE", sub: "Pago falso", color: "#b48be0" },
];

const SALVO: Marca = { texto: "SALVO", color: PAL.verdeOscuro };
const ROBADO: Marca = { texto: "ROBADO", color: PAL.rojoOscuro };

type Sesion = {
  alias: string;
  /** Id del jugador (cookie) o, sin conexión, su apodo: llave de su progreso. */
  claveProg: string;
  pais: Pais;
  prog: Progreso;
  resultados: Partial<Record<RutaId, Marca>>;
  respondidas: Set<PreguntaEncuesta>;
  /** Minijuegos cuyo «cómo se juega» ya se vio en esta sesión. */
  vistos: Set<string>;
  vioDatos: boolean;
};

/** `/play?sala=ABCD` (el QR de una sala): se entra directo a esa sala. */
function salaDelEnlace(): string | null {
  try {
    const c = new URLSearchParams(window.location.search).get("sala")?.trim().toUpperCase() ?? "";
    return /^[A-Z]{4}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}

/** Llena las tablas HI-SCORE del título con los récords guardados (sin hacer esperar). */
function cargarRecords(destino: TablaRecords[]) {
  void resumenArcade()
    .then((r) => {
      destino.length = 0;
      destino.push({ titulo: "GENERAL", filas: r.general });
      for (const modo of MODOS_ARCADE) destino.push({ titulo: ARCADES[modo].nombre, filas: r.ranking[modo] ?? [] });
    })
    .catch(() => undefined);
}

export async function jugar(m: Motor) {
  let sesion: Sesion | null = null;
  // El id de este celular (cookie) se pide en paralelo con la intro.
  const identificacion = identificar();
  const records: TablaRecords[] = [];
  let salaDirecta = salaDelEnlace();
  // Quien llega por el QR de una sala va al grano: sin video.
  if (!introVista() && !salaDirecta) await videoIntro(m);
  for (;;) {
    m.barraSuperior = null;
    cargarRecords(records);
    m.escena = titulo(m.t, records);
    m.musica("titulo");
    m.descubrirYa();
    await m.fundirA(false);
    await m.esperarToque();
    m.audio.whoosh();
    await m.iris(true);
    m.descubrirYa();
    m.fundido = 1;
    if (!sesion) {
      const jugadorId = await identificacion;
      // Como en un arcade: si este celular ya jugó, se le reconoce.
      const recordado = apodoRecordado();
      const paisGuardado = paisRecordado();
      let alias: string;
      let pais: Pais;
      if (recordado && !validarAlias(recordado) && (await bienvenida(m, recordado))) {
        alias = recordado;
        pais = paisGuardado && paisGuardado in PAISES ? PAISES[paisGuardado as PaisId] : await elegirPais(m);
      } else {
        alias = await intro(m);
        pais = await elegirPais(m);
      }
      recordar(alias, pais.id);
      const claveProg = jugadorId ?? alias;
      sesion = { alias, claveProg, pais, prog: cargarProgreso(claveProg, alias), resultados: {}, respondidas: new Set(), vistos: new Set(), vioDatos: false };
      if (salaDirecta) {
        const codigo = salaDirecta;
        salaDirecta = null;
        await protegido(m, () => unirseASala(m, sesion!, codigo));
      } else {
        // Sin vueltas: la primera partida es el arcade.
        await protegido(m, () => modoArcade(m, sesion!, ARCADES.real_o_estafa));
      }
    }
    const s = sesion;

    for (;;) {
      const eleccion = await menuPrincipal(m, s);
      if (eleccion === "titulo") break;
      if (eleccion === "envivo") await protegido(m, () => modoEnVivo(m, s));
      else if (eleccion in ARCADES) await protegido(m, () => modoArcade(m, s, ARCADES[eleccion as ModoArcade]));
      else if (eleccion === "ranking") await protegido(m, () => verRanking(m, s, "general"));
      else if (eleccion === "historias") {
        const ruta = await menuHistorias(m, s);
        if (ruta) await protegido(m, () => jugarRuta(m, s, ruta));
      } else if (eleccion === "banda") await protegido(m, () => jugarRuta(m, s, "banda"));
      else if (eleccion === "mas") {
        const extra = await menuMas(m, s);
        if (extra === "datos") {
          await protegido(m, () => epilogo(m, s.pais));
          s.vioDatos = true;
        } else if (extra === "pais") {
          await protegido(m, async () => {
            const nuevo = await elegirPais(m, true);
            if (nuevo) {
              s.pais = nuevo;
              recordar(s.alias, nuevo.id);
            }
          });
        } else if (extra === "intro") await protegido(m, () => videoIntro(m));
        else if (extra === "titulo") {
          m.escena = laboratorio;
          await m.fundirA(false, 8);
          const seguro = await m.confirmar("¿Volver a la pantalla de inicio? Tu progreso queda guardado.", "SÍ, AL INICIO", "NO", VEGA);
          await m.fundirA(true, 8);
          if (seguro) break;
        }
      }
    }
  }
}

async function jugarRuta(m: Motor, s: Sesion, id: RutaId) {
  if (id === "banda") {
    const jugar = await comoSeJuega(m, {
      titulo: "LA BANDA",
      color: PAL.rojoOscuro,
      pasos: [
        { icono: icono.banda, texto: "Arma tu golpe: eres la banda." },
        { icono: icono.pausa, texto: "¿Te frena el sistema?" },
        { icono: icono.combo, texto: "Cada hueco: +400 puntos." },
      ],
      meta: "Hasta 5 golpes. Datos ficticios.",
    });
    if (!jugar) return;
  }
  const marca = await correrRuta(m, id, s.pais, s.alias);
  if (marca) s.resultados[id] = marca;
  // Puntos por historia: ganar vale más, pero jugarla ya suma.
  const huecos = id === "banda" && marca ? Number.parseInt(marca.texto, 10) || 0 : 0;
  const puntos = id === "banda" ? 300 + huecos * 400 : marca === SALVO ? 600 : 200;
  const logros: IdLogro[] = [];
  if (marca === SALVO) logros.push("salvaste");
  if (huecos > 0) logros.push("hacker_etico");
  const c = sumarPartida(s.prog, null, puntos, logros);
  guardarProgreso(s.claveProg, s.prog);
  m.aviso(`+${puntos + c.bonus} PUNTOS`, id === "banda" ? `${huecos} huecos encontrados` : marca === SALVO ? "¡Saliste a salvo!" : "Por jugar la historia", PAL.ambar);
  anunciarCosecha(m, c);
  await m.esperar(Math.min(3000, (m.avisosPendientes * 1000) / 60));
  if (!s.vioDatos) {
    await epilogo(m, s.pais);
    s.vioDatos = true;
  }
}

/** Si se cae la conexión a mitad de un modo, vuelve al menú sin romper el juego. */
async function protegido(m: Motor, fn: () => Promise<unknown>) {
  m.salidaPermitida = true;
  try {
    await fn();
  } catch (e) {
    if (e instanceof SalidaDelJugador) {
      // El jugador eligió «VOLVER AL MENÚ» en la pausa.
      m.reanudar();
      return;
    }
    m.minijuego(null);
    m.barraSuperior = null;
    m.descubrirYa();
    m.escena = laboratorio;
    m.musica("triste");
    await m.fundirA(false);
    await m.decir("Se perdió la conexión con el sistema. Volvamos al menú.", VEGA).catch(() => undefined);
    await m.fundirA(true).catch(() => undefined);
  } finally {
    m.salidaPermitida = false;
    m.minijuego(null);
  }
}

function correrRuta(m: Motor, id: RutaId, pais: Pais, alias: string): Promise<Marca | null> {
  if (id === "llamada") return rutaLlamada(m, pais, alias);
  if (id === "senal") return rutaSinSenal(m, pais, alias);
  if (id === "familiar") return rutaFamiliar(m, pais, alias);
  if (id === "comprobante") return rutaComprobante(m, pais);
  return rutaBanda(m, pais, alias);
}

// ── Intro, país y menús ───────────────────────────────────────

function validarAlias(alias: string): string | null {
  const motivo = motivoAliasInvalido(alias);
  if (!motivo) return null;
  return motivo.replace(/^el alias/, "El apodo").replace("no puede contener un número de teléfono", "no puede ser un teléfono");
}

/** Jugador que vuelve: ¿sigue con su apodo (y su récord) o cambia? */
async function bienvenida(m: Motor, alias: string): Promise<boolean> {
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  const i = await m.pregunta(
    `¡Volviste, ${alias}! Tu récord sigue aquí, como en las máquinas de antes.`,
    [{ texto: `SEGUIR COMO ${alias.toUpperCase()}`.slice(0, 22), color: "#bfe8c9" }, { texto: "CAMBIAR APODO" }],
    VEGA,
  );
  await m.fundirA(true);
  return i !== 1;
}

async function intro(m: Motor): Promise<string> {
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  await m.decir("¡Hola! Soy la ANALISTA VEGA. Aquí juegas contra las estafas que vacían cuentas en la región.", VEGA);
  await m.decir("Todo es ficticio y anónimo. ¿Cómo te llamo? Usa un apodo.", VEGA);
  await m.fundirA(true);
  const pidiendo = m.nombre(validarAlias);
  await m.fundirA(false);
  const nombre = await pidiendo;
  await m.fundirA(true);
  await m.fundirA(false);
  await m.decir(`¡${nombre}! Gana puntos, sube de rango y entra al RANKING del evento.`, VEGA);
  return nombre;
}

async function elegirPais(m: Motor, conVolver: true): Promise<Pais | null>;
async function elegirPais(m: Motor, conVolver?: false): Promise<Pais>;
async function elegirPais(m: Motor, conVolver = false): Promise<Pais | null> {
  m.barraSuperior = null;
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  const ids = Object.keys(PAISES) as PaisId[];
  await m.fundirA(true, 8);
  const eligiendo = menuPaises(
    m,
    ids.map((id) => ({ id, nombre: PAISES[id].nombre, bandera: PAISES[id].bandera })),
    conVolver,
  );
  await m.fundirA(false, 8);
  const elegido = await m.atar(eligiendo);
  if (elegido === "volver") {
    await m.fundirA(true, 8);
    return null;
  }
  const pais = PAISES[elegido as PaisId];
  await m.fundirA(true, 8);
  m.escena = laboratorio;
  await m.fundirA(false, 8);
  await m.decir(frase(pais.id, "saludo"), VEGA);
  await m.decir(`El banco será «${pais.banco}» y la billetera «${pais.billetera}»: ficticios, como todo aquí.`, VEGA);
  await m.fundirA(true);
  return pais;
}

const ICONO_ARCADE: Record<ModoArcade, Paso["icono"]> = {
  real_o_estafa: icono.carta,
  atrapa_la_mula: icono.mula,
  pausa_o_pasa: icono.pausa,
  sigue_el_dinero: icono.lupa,
};

type Eleccion = ModoArcade | "envivo" | "historias" | "banda" | "ranking" | "mas" | "titulo";

async function menuPrincipal(m: Motor, s: Sesion): Promise<Eleccion> {
  m.barraSuperior = null;
  m.descubrirYa();
  m.musica("barrio");
  const r = rango(s.prog.total);
  const elegido = menuHub(m, {
    rango: { nombre: r.nombre, total: s.prog.total, k: r.k, siguiente: r.siguiente?.nombre ?? null },
    envivo: { id: "envivo", nombre: "EN VIVO", sub: "Juega con todos", color: PAL.rojo },
    arcades: MODOS_ARCADE.map((id) => {
      const a = ARCADES[id];
      return {
        id,
        nombre: a.nombre,
        sub: a.sub,
        color: a.color,
        icono: ICONO_ARCADE[id],
        estrellas: s.prog.estrellas[id] ?? 0,
        mejor: s.prog.mejor[id],
        nuevo: s.prog.mejor[id] === undefined,
      };
    }),
    chicos: [
      { id: "historias", nombre: "HISTORIAS", sub: "", color: PAL.ambar },
      { id: "banda", nombre: "LA BANDA", sub: "", color: PAL.rojoOscuro },
      { id: "ranking", nombre: "RANKING", sub: "", color: PAL.verde },
      { id: "mas", nombre: "MÁS", sub: "", color: PAL.gris },
    ],
  });
  await m.fundirA(false, 10);
  const id = await elegido;
  await m.fundirA(true, 10);
  return id as Eleccion;
}

async function menuHistorias(m: Motor, s: Sesion): Promise<RutaId | null> {
  m.barraSuperior = { texto: "HISTORIAS", color: PAL.ambarOscuro };
  m.escena = laboratorio;
  await m.fundirA(false);
  const opciones: Opcion[] = [
    ...HISTORIAS.map((r) => ({ texto: r.titulo, sub: r.sub, color: r.color, marca: s.resultados[r.id] })),
    { texto: "VOLVER", sub: "Menú", color: PAL.gris },
  ];
  const i = await m.menu(opciones, { estilo: "tarjetas", titulo: "Ganar: +600 XP", cancelable: true });
  await m.fundirA(true);
  return i >= 0 && i < HISTORIAS.length ? HISTORIAS[i].id : null;
}

async function menuMas(m: Motor, s: Sesion): Promise<"datos" | "pais" | "intro" | "titulo" | null> {
  m.barraSuperior = null;
  m.escena = laboratorio;
  await m.fundirA(false);
  const i = await m.menu(
    [
      { texto: "LOS DATOS", sub: "Cifras reales", color: PAL.rojoOscuro },
      { texto: "CAMBIAR PAÍS", sub: s.pais.nombre, color: PAL.gris, bandera: s.pais.bandera },
      { texto: "VER LA INTRO", sub: "El video", color: PAL.azul },
      { texto: "PANTALLA DE INICIO", sub: "Título", color: PAL.gris },
      { texto: "VOLVER", sub: "Menú", color: PAL.gris },
    ],
    { estilo: "tarjetas", titulo: "Más", cancelable: true },
  );
  await m.fundirA(true);
  return (["datos", "pais", "intro", "titulo"] as const)[i] ?? null;
}

// ── Modos arcade ──────────────────────────────────────────────

/** Una pregunta de encuesta como bonus del juego: un toque, +100 puntos. */
const PREGUNTAS: Record<PreguntaEncuesta, { texto: string; opciones: Array<{ texto: string; valor: string }> }> = {
  vivido: {
    texto: "¿A ti o a alguien cercano le pasó algo así DE VERDAD?",
    opciones: [{ texto: "A MÍ", valor: "yo" }, { texto: "A ALGUIEN CERCANO", valor: "cercano" }, { texto: "NO", valor: "no" }],
  },
  protege_hoy: {
    texto: "¿Sientes que tu banco HOY te protege de estas estafas?",
    opciones: [{ texto: "SÍ", valor: "si" }, { texto: "NO", valor: "no" }, { texto: "NO SÉ", valor: "no_se" }],
  },
  espera: {
    texto: "Si tu banco PAUSA un pago raro para protegerte, ¿cuánto esperarías?",
    opciones: [{ texto: "NADA", valor: "nada" }, { texto: "5 MINUTOS", valor: "5min" }, { texto: "1 HORA", valor: "1h" }, { texto: "HASTA 24 H", valor: "24h" }],
  },
  activaria: {
    texto: "¿Activarías esta protección en tu banco, aunque a veces pause un pago?",
    opciones: [{ texto: "SÍ", valor: "si" }, { texto: "NO", valor: "no" }, { texto: "NO SÉ", valor: "no_se" }],
  },
  recomendaria: {
    texto: "¿Le pasarías este juego a un familiar para que no lo estafen?",
    opciones: [{ texto: "SÍ", valor: "si" }, { texto: "NO", valor: "no" }],
  },
};

async function preguntaBonus(m: Motor, s: Sesion, orden: PreguntaEncuesta[]): Promise<Record<string, string>> {
  const id = orden.find((q) => !s.respondidas.has(q)) ?? (Object.keys(PREGUNTAS) as PreguntaEncuesta[]).find((q) => !s.respondidas.has(q));
  if (!id) return {};
  const q = PREGUNTAS[id];
  m.barraSuperior = null;
  m.descubrirYa();
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false, 10);
  m.audio.confirmar();
  const i = await m.pregunta(q.texto, q.opciones.map((o) => ({ texto: o.texto })), "BONUS +100", { corta: "Un toque, +100 puntos:" });
  if (i < 0) return {};
  s.respondidas.add(id);
  m.audio.monedas();
  m.flotante("+100", 80, 80, PAL.ambar);
  await m.fundirA(true, 10);
  return { [id]: q.opciones[i].valor };
}

/** Lo que devuelve cada minijuego, ya traducido para el flujo común. */
type Partida = {
  puntaje: number;
  /** Jugó bien de verdad (no basta con sobrevivir): define «¡CRACK!» o «casi». */
  gano: boolean;
  /** Estrellas aseguradas por precisión (p. ej. 5/5 sin errores da al menos 1). */
  estrellasMin?: number;
  lineas: DatosResultado["lineas"];
  logros: IdLogro[];
  consejos: string[];
  /** Campos propios del modo para `/api/juego/arcade` (sin alias, país, puntaje ni encuesta). */
  registro: Record<string, unknown>;
  /** Escena extra tras la partida (p. ej. APRENDE en SIGUE EL DINERO). */
  despues?: () => Promise<void>;
};

type DefArcade = {
  modo: ModoArcade;
  nombre: string;
  sub: string;
  titulo: string;
  color: string;
  pasos: Paso[];
  meta: string;
  preguntas: PreguntaEncuesta[];
  jugar: (m: Motor, s: Sesion) => Promise<Partida>;
};

const CONSEJOS_BASE = [
  "Tu banco nunca te pide claves ni códigos.",
  "Ante la prisa: cuelga y llama tú al número oficial.",
  "Verifica los pagos en TU app, no en capturas.",
];

const ARCADES: Record<ModoArcade, DefArcade> = {
  real_o_estafa: {
    modo: "real_o_estafa",
    nombre: "¿REAL O ESTAFA?",
    sub: "Decide ya",
    titulo: "¿REAL O\nESTAFA?",
    color: PAL.rojo,
    pasos: [
      { icono: icono.carta, texto: "Llega un mensaje o llamada." },
      { icono: icono.boton("x"), texto: "¿Estafa? Toca la X roja." },
      { icono: icono.boton("ok"), texto: "¿Es normal? Toca REAL." },
    ],
    meta: "45 s · 3 vidas · rachas = x4",
    preguntas: ["vivido", "protege_hoy", "recomendaria"],
    async jugar(m, s) {
      const r = await realOEstafa(m, s.pais);
      const cartas = mazo(s.pais);
      const consejos = r.caidas.slice(0, 3).map((c) => cartas.find((x) => x.categoria === c)?.pista ?? "").filter(Boolean);
      if (r.realesRechazados > 0) consejos.push("Desconfiar de todo también cuesta: un aviso sin links ni pedidos suele ser real.");
      const logros: IdLogro[] = [];
      if (r.caidas.length === 0 && r.total >= 10) logros.push("ojo_halcon");
      if (r.mejorCombo >= 10) logros.push("imparable");
      // Las cartas en que se acabó el tiempo cuentan como fallos.
      const vistas = r.total + r.lentos;
      const perfecto = vistas >= 5 && r.aciertos === vistas;
      return {
        puntaje: r.puntaje,
        gano: r.vidas > 0 && vistas >= 5 && r.aciertos >= vistas * 0.7,
        estrellasMin: perfecto ? 1 : 0,
        lineas: [
          { texto: `Aciertos ${r.aciertos}/${vistas}` },
          { texto: `Mejor racha x${r.mejorCombo}`, color: PAL.ambar },
          { texto: `Caíste en ${r.respuestas.filter((x) => x.estafa && !x.dijo_estafa).length}`, color: PAL.rojo },
        ],
        logros,
        consejos: consejos.length ? consejos.slice(0, 3) : CONSEJOS_BASE,
        registro: { respuestas: r.respuestas },
      };
    },
  },
  atrapa_la_mula: {
    modo: "atrapa_la_mula",
    nombre: "ATRAPA LA MULA",
    sub: "Reflejos",
    titulo: "ATRAPA\nLA MULA",
    color: "#2f7fb0",
    pasos: [
      { icono: icono.mula, texto: "Asoman cuentas. ¡Léelas!" },
      { icono: icono.dedo, texto: "¿NUEVA o REENVÍA? ¡Tócala!" },
      { icono: icono.tienda, texto: "¿BODEGA, MAMÁ? No la toques." },
    ],
    meta: "40 s · 3 vidas · el JEFE DE RED vale x5",
    preguntas: ["espera", "activaria", "recomendaria"],
    async jugar(m, s) {
      const r = await atrapaLaMula(m, s.pais);
      const logros: IdLogro[] = [];
      if (r.aciertos >= 15) logros.push("cazamulas");
      if (r.errores === 0 && r.aciertos >= 5) logros.push("sin_inocentes");
      if (r.mejorCombo >= 10) logros.push("imparable");
      // Atrapar 1 y dejar escapar 55 no es ganar, aunque queden vidas.
      const bien = r.aciertos >= 5 && r.aciertos >= r.escapados;
      return {
        puntaje: r.puntaje,
        gano: r.vidas > 0 && bien,
        estrellasMin: bien && r.errores === 0 ? 1 : 0,
        lineas: [
          { texto: `Mulas atrapadas ${r.aciertos}`, color: PAL.celeste },
          { texto: `Se escaparon ${r.escapados}`, color: r.escapados ? PAL.rojo : PAL.verde },
          { texto: `Inocentes tocados ${r.errores}`, color: r.errores ? PAL.rojo : PAL.verde },
        ],
        logros,
        consejos: [
          "Una mula es una cuenta que recibe dinero robado y lo saca rápido.",
          "Señales: cuenta nueva, le pagan extraños, reenvía o retira todo.",
          "Nunca prestes tu cuenta ni tu DNI: te vuelves parte de la red.",
        ],
        registro: { aciertos: r.aciertos, errores: r.errores, escapados: r.escapados },
      };
    },
  },
  pausa_o_pasa: {
    modo: "pausa_o_pasa",
    nombre: "¿PAUSA O PASA?",
    sub: "Tú decides",
    titulo: "¿PAUSA O\nPASA?",
    color: PAL.ambarOscuro,
    pasos: [
      { icono: icono.senales, texto: "Rojo = riesgo. Verde = normal." },
      { icono: icono.pausa, texto: "¿Riesgo? Toca PAUSA." },
      { icono: icono.pasa, texto: "¿Normal? Toca PASA." },
    ],
    meta: "Si no decides a tiempo, el dinero se va.",
    preguntas: ["espera", "activaria", "protege_hoy"],
    async jugar(m, s) {
      const r = await pausaOPasa(m, s.pais);
      const logros: IdLogro[] = [];
      if (r.robos + r.molestias === 0 && r.total >= 10) logros.push("guardian_perfecto");
      if (r.mejorCombo >= 10) logros.push("imparable");
      return {
        puntaje: r.puntaje,
        gano: r.vidas > 0 && r.total >= 5 && r.aciertos >= r.total * 0.7,
        estrellasMin: r.total >= 5 && r.aciertos === r.total ? 1 : 0,
        lineas: [
          { texto: `Aciertos ${r.aciertos}/${r.total}` },
          { texto: `Robos que pasaron ${r.robos}`, color: r.robos ? PAL.rojo : PAL.verde },
          { texto: `Clientes molestos ${r.molestias}`, color: r.molestias ? PAL.ambar : PAL.verde },
        ],
        logros,
        consejos: [
          "Una señal sola no basta: se mira el conjunto.",
          "Pausar no es bloquear: el dinero espera mientras se verifica contigo.",
          "La cuenta que recibe también delata la estafa.",
        ],
        registro: { respuestas: r.respuestas },
      };
    },
  },
  sigue_el_dinero: {
    modo: "sigue_el_dinero",
    nombre: "SIGUE EL DINERO",
    sub: "Detective",
    titulo: "SIGUE EL\nDINERO",
    color: "#2f7fb0",
    pasos: [
      { icono: icono.dinero, texto: "El dinero robado salta." },
      { icono: icono.lupa, texto: "Toca una cuenta y mira señales" },
      { icono: icono.hielo, texto: "¿Rojo? ¡CONGÉLALA!" },
    ],
    meta: "Congelar a un inocente resta puntos.",
    preguntas: ["espera", "activaria", "recomendaria"],
    async jugar(m, s) {
      const r = await sigueElDinero(m, s.pais);
      const logros: IdLogro[] = [];
      if (r.mulas === 3) logros.push("red_desarmada");
      if (r.falsosPositivos === 0 && r.mulas >= 1) logros.push("sin_inocentes");
      const primera = !s.vistos.has("aprende");
      s.vistos.add("aprende");
      return {
        puntaje: r.puntaje,
        gano: r.mulas === 3,
        lineas: [
          { texto: `Recuperado ${r.recuperadoPct}%`, color: PAL.celeste },
          { texto: `Mulas ${r.mulas}/3` },
          { texto: `Falsos positivos ${r.falsosPositivos}`, color: r.falsosPositivos ? PAL.rojo : PAL.verde },
        ],
        logros,
        consejos: [
          "Un sistema de patrones solo mira a la víctima. Nosotros seguimos el dinero.",
          "Que a una cuenta le paguen muchos no la vuelve mula: mira adónde va el dinero.",
          "Lo que se confirma una vez protege a la siguiente víctima.",
        ],
        registro: { recuperado_pct: r.recuperadoPct, falsos_positivos: r.falsosPositivos, mulas: r.mulas, segundos: r.segundos },
        despues: primera && r.mulas > 0 ? () => aprende(m, s) : undefined,
      };
    },
  },
};

function anunciarCosecha(m: Motor, c: Cosecha) {
  for (const id of c.logros) m.aviso(LOGROS[id].titulo, `+${LOGROS[id].bonus} ${LOGROS[id].sub}`, PAL.ambar);
  if (c.subioA) {
    m.audio.nivel();
    m.aviso(`¡RANGO ${c.subioA}!`, "Subiste de nivel", PAL.verde);
  }
}

async function modoArcade(m: Motor, s: Sesion, def: DefArcade): Promise<void> {
  let otraVez = false;
  for (;;) {
    // La pantalla de «cómo se juega» es también la confirmación: VOLVER o ¡A JUGAR!
    if (!otraVez) {
      const mejor = s.prog.mejor[def.modo];
      const prox = proximaEstrella(def.modo, mejor ?? 0);
      const jugar = await comoSeJuega(m, {
        titulo: def.titulo,
        color: def.color,
        pasos: def.pasos,
        meta: def.meta,
        record: mejor !== undefined ? `Récord ${mejor}${prox ? ` · próxima estrella ${prox}` : ""}` : undefined,
      });
      if (!jugar) return;
      s.vistos.add(def.modo);
    }
    otraVez = false;
    m.barraSuperior = null;
    m.descubrirYa();
    m.fundido = 1;
    const juego = m.atar(def.jugar(m, s));
    await m.fundirA(false, 10);
    const r = await juego;
    await m.fundirA(true);
    if (r.despues) await r.despues();
    await teLlevas(m, "LO QUE TE LLEVAS", r.consejos, def.color);

    const encuesta = await preguntaBonus(m, s, def.preguntas);
    const conBonus = Object.keys(encuesta).length > 0;
    const puntaje = r.puntaje + (conBonus ? 100 : 0);
    let posicion: number | null = null;
    try {
      ({ posicion } = await registrarArcade({
        modo: def.modo,
        alias: s.alias,
        pais: s.pais.id,
        puntaje,
        ...r.registro,
        ...(conBonus ? { encuesta } : {}),
      } as JugadaArcade));
    } catch {
      // sin conexión: el juego sigue
    }
    const c = sumarPartida(s.prog, def.modo, puntaje, r.logros, r.estrellasMin);
    guardarProgreso(s.claveProg, s.prog);
    const rg = rango(s.prog.total);

    m.barraSuperior = null;
    m.descubrirYa();
    const inicio = m.t;
    m.escena = escenaResultado(inicio, {
      titulo: frase(s.pais.id, r.gano ? "ganaste" : "perdiste"),
      color: r.gano ? PAL.verde : PAL.ambar,
      puntaje,
      lineas: r.lineas,
      posicion,
      estrellas: c.estrellas,
      record: c.record,
      rango: { nombre: rg.nombre, total: s.prog.total, k: rg.k, siguiente: rg.siguiente?.nombre ?? null },
    });
    m.musica(r.gano ? "guardian" : "titulo");
    await m.fundirA(false);
    for (let i = 0; i < c.estrellas; i++) {
      await m.esperar(Math.max(0, ((cuadroEstrella(i) - (m.t - inicio)) * 1000) / 60));
      m.audio.estrella(i);
      m.vibrar(15);
    }
    if (c.estrellas === 3 || (posicion !== null && posicion <= 3)) m.confeti();
    anunciarCosecha(m, c);
    await m.esperar(Math.max(600, ((160 - (m.t - inicio)) * 1000) / 60));
    // Que los avisos de logros terminen aquí y no tapen el menú que sigue.
    await m.esperar(Math.min(3000, (m.avisosPendientes * 1000) / 60));
    const sig = await m.menu([{ texto: "OTRA VEZ", color: "#bfe8c9" }, { texto: "VER RANKING" }, { texto: "MENÚ" }]);
    await m.fundirA(true);
    if (sig === 0) {
      otraVez = true;
      continue;
    }
    if (sig === 1) await verRanking(m, s, def.modo);
    return;
  }
}

// ── EN VIVO (multijugador) ────────────────────────────────────

function validarCodigo(c: string): string | null {
  return /^[A-Z]{4}$/.test(c) ? null : "Son 4 letras (sin Ñ).";
}

async function modoEnVivo(m: Motor, s: Sesion) {
  if (!s.vistos.has("envivo")) {
    const jugar = await comoSeJuega(m, {
      titulo: "EN VIVO",
      color: PAL.rojo,
      pasos: [
        { icono: icono.combo, texto: "Uno crea la sala y dicta el código." },
        { icono: icono.dedo, texto: "Los demás entran con ese código." },
        { icono: icono.reloj, texto: "Cartas rápidas o atacar la capa." },
      ],
      meta: "8 rondas · o 2:30 atacando",
    });
    s.vistos.add("envivo");
    if (!jugar) return;
  }
  m.barraSuperior = { texto: "EN VIVO", color: PAL.rojoOscuro };
  m.escena = laboratorio;
  m.musica("titulo");
  await m.fundirA(false, 10);
  const i = await m.menu(
    [
      { texto: "CREAR SALA", sub: "Eres el anfitrión", color: PAL.rojo },
      { texto: "UNIRME", sub: "Tengo un código", color: PAL.azul },
      { texto: "VOLVER", sub: "Menú", color: PAL.gris },
    ],
    { estilo: "tarjetas", titulo: "Multijugador", cancelable: true },
  );
  if (i === 0) {
    const j = await m.menu(
      [
        { texto: "LA BANDA", sub: "Atacan de verdad", color: PAL.rojoOscuro, marca: { texto: "NUEVO", color: PAL.rojo } },
        { texto: "¿REAL O ESTAFA?", sub: "Mensajes y llamadas", color: PAL.rojo },
        { texto: "¿PAUSA O PASA?", sub: "Eres el sistema", color: PAL.ambarOscuro },
        { texto: "VOLVER", sub: "Atrás", color: PAL.gris },
      ],
      { estilo: "tarjetas", titulo: "¿Qué juegan?", cancelable: true },
    );
    if (j < 0 || j > 2) return m.fundirA(true, 10);
    const juego = (["banda", "real_o_estafa", "pausa_o_pasa"] as const)[j];
    const { codigo, token } = await crearSala({ alias: s.alias, pais: s.pais.id, juego });
    await m.fundirA(true, 10);
    await jugarSala(m, s, codigo, token, juego);
    return;
  }
  if (i !== 1) return m.fundirA(true, 10);
  await m.fundirA(true, 10);
  const pidiendo = m.nombre(validarCodigo, { titulo: "Código de la sala", ayuda: "Las 4 letras", max: 4, cancelable: true });
  await m.fundirA(false, 10);
  const codigo = await pidiendo;
  if (!codigo) return m.fundirA(true, 10);
  await unirseASala(m, s, codigo);
}

/** Entra a una sala con su código (escrito o desde el QR); si no existe, ofrece otro. */
async function unirseASala(m: Motor, s: Sesion, primerCodigo: string) {
  let codigo = primerCodigo;
  for (;;) {
    try {
      const v = await accionSala(codigo, { accion: "unirse", alias: s.alias, pais: s.pais.id });
      await m.fundirA(true, 10);
      await jugarSala(m, s, codigo, null, v.juego);
      return;
    } catch {
      m.barraSuperior = null;
      m.descubrirYa();
      m.escena = laboratorio;
      await m.fundirA(false, 10);
      const otra = await m.pregunta(`No encontré la sala ${codigo}. Puede que ya haya cerrado. ¿Probamos otro código?`, [{ texto: "OTRO CÓDIGO" }, { texto: "VOLVER" }], VEGA);
      await m.fundirA(true, 10);
      if (otra !== 0) return;
      const pidiendo = m.nombre(validarCodigo, { titulo: "Código de la sala", ayuda: "Las 4 letras", max: 4, cancelable: true });
      await m.fundirA(false, 10);
      codigo = await pidiendo;
      if (!codigo) return m.fundirA(true, 10);
    }
  }
}

async function jugarSala(m: Motor, s: Sesion, codigo: string, token: string | null, juego: JuegoVivo) {
  m.barraSuperior = null;
  m.descubrirYa();
  if (juego === "banda") return salaDeLaBanda(m, s, codigo, token);
  const sala = pantallaSala(m, {
    codigo,
    token,
    alias: s.alias,
    pais: s.pais,
    alTerminar: (r: ResultadoSala) => {
      // Las respuestas valen como dato; el puntaje de sala no entra al ranking arcade.
      if (r.respuestas.length > 0) {
        void registrarArcade({
          modo: juego,
          alias: s.alias,
          pais: s.pais.id,
          puntaje: Math.min(100_000, r.puntaje),
          respuestas: r.respuestas,
          origen: "sala",
        } as JugadaArcade).catch(() => undefined);
      }
      const puntos = 200 + (r.posicion === 1 ? 600 : r.posicion === 2 ? 400 : r.posicion === 3 ? 250 : 0);
      const logros: IdLogro[] = ["en_vivo"];
      if (r.posicion === 1 && r.jugadores > 1) logros.push("campeon");
      const c = sumarPartida(s.prog, null, puntos, logros);
      guardarProgreso(s.claveProg, s.prog);
      m.aviso(`+${puntos + c.bonus} PUNTOS`, `Puesto #${r.posicion} de ${r.jugadores}`, PAL.ambar);
      anunciarCosecha(m, c);
    },
  });
  await m.fundirA(false, 10);
  await m.atar(sala);
  await m.fundirA(true, 10);
}

/**
 * EN VIVO · LA BANDA: todos atacan a la vez contra la capa real. Los intentos
 * son casos de verdad, así que se registran como partidas de atacante: son el
 * dato que el equipo de seguridad mira después (y lo que proyecta el monitor).
 */
async function salaDeLaBanda(m: Motor, s: Sesion, codigo: string, token: string | null) {
  if (!s.vistos.has("banda_vivo")) {
    const jugar = await comoSeJuega(m, {
      titulo: "LA BANDA",
      color: PAL.rojoOscuro,
      pasos: [
        { icono: icono.banda, texto: "Todos atacan a la vez." },
        { icono: icono.senales, texto: "Arma tu golpe y lánzalo." },
        { icono: icono.combo, texto: "Pasar la capa: +1000." },
      ],
      meta: `${MAX_INTENTOS * 2} golpes · 2:30 · datos ficticios`,
    });
    s.vistos.add("banda_vivo");
    if (!jugar) return;
  }
  m.barraSuperior = null;
  m.descubrirYa();
  const sala = pantallaSalaBanda(m, {
    codigo,
    token,
    alias: s.alias,
    pais: s.pais,
    alTerminar: (r: ResultadoBanda) => {
      if (r.intentos.length > 0) {
        void registrarPartida({ rol: "atacante", alias: s.alias, intentos: r.intentos }).catch(() => undefined);
      }
      // Igual que la historia de LA BANDA: cada hueco vale 400.
      const puntos = 200 + r.huecos * 400 + (r.posicion === 1 ? 600 : r.posicion === 2 ? 400 : r.posicion === 3 ? 250 : 0);
      const logros: IdLogro[] = ["en_vivo"];
      if (r.huecos > 0) logros.push("hacker_etico");
      if (r.posicion === 1 && r.jugadores > 1) logros.push("campeon");
      const c = sumarPartida(s.prog, null, puntos, logros);
      guardarProgreso(s.claveProg, s.prog);
      m.aviso(`+${puntos + c.bonus} PUNTOS`, r.huecos > 0 ? `${r.huecos} hueco(s) · #${r.posicion}` : `Sin huecos · #${r.posicion}`, PAL.ambar);
      anunciarCosecha(m, c);
    },
  });
  await m.fundirA(false, 10);
  await m.atar(sala);
  await m.fundirA(true, 10);
}

/** La mula confirmada protege a la siguiente víctima: 0 IA. */
async function aprende(m: Motor, s: Sesion) {
  const estado = { k: 0, nombre: s.pais.jorge, monto: dinero(s.pais, 1500), escudo: 0 };
  m.barraSuperior = { texto: "APRENDE", color: PAL.verdeOscuro };
  m.escena = escenaMemoria(estado);
  m.musica("suspenso");
  await m.fundirA(false);
  await m.decir("Tú confirmas: es una mula. Desde ahora, la MEMORIA la conoce.", "AUDITOR");
  await m.decir(`Al día siguiente, a ${s.pais.jorge} le escriben «soy tu hijo» y transfiere a esa misma cuenta...`);
  m.audio.tension();
  await m.animar(50, (k) => {
    estado.k = k;
  });
  estado.k = 0;
  m.audio.boom();
  m.sacudir(10);
  await m.animar(10, (k) => {
    estado.escudo = k;
  });
  m.musica("guardian");
  await m.sellar("PAUSA", PAL.verde, "Memoria · 0 IA", 1300);
  await m.decir(`${s.pais.jorge} no pierde nada, y sin gastar IA. Lo que aprendimos con ${s.pais.rosa} lo protegió.`);
  await m.fundirA(true);
}

type VistaRanking = ModoArcade | "general";
const VISTAS: VistaRanking[] = ["general", ...MODOS_ARCADE];
const TITULO_VISTA: Record<VistaRanking, string> = {
  general: "SUMA DE TUS MEJORES",
  real_o_estafa: "¿REAL O ESTAFA?",
  atrapa_la_mula: "ATRAPA LA MULA",
  pausa_o_pasa: "¿PAUSA O PASA?",
  sigue_el_dinero: "SIGUE EL DINERO",
};

async function verRanking(m: Motor, s: Sesion, inicial: VistaRanking) {
  let vista = inicial;
  for (;;) {
    m.barraSuperior = null;
    m.descubrirYa();
    let filas: FilaRanking[] = [];
    let jugadores = 0;
    try {
      const r = await resumenArcade();
      filas = vista === "general" ? r.general : r.ranking[vista];
      jugadores = r.jugadores;
    } catch {
      // sin conexión: ranking vacío
    }
    m.escena = escenaRanking(m.t, TITULO_VISTA[vista], filas, s.alias, jugadores);
    m.musica("titulo");
    await m.fundirA(false);
    const i = await m.menu([{ texto: "SIGUIENTE TABLA >" }, { texto: "VOLVER" }], { cancelable: true });
    await m.fundirA(true);
    if (i !== 0) return;
    vista = VISTAS[(VISTAS.indexOf(vista) + 1) % VISTAS.length];
  }
}

/** Abre el iris desde negro (sirve tanto tras un fundido como tras otro iris). */
async function abrirIris(m: Motor, cx?: number, cy?: number) {
  m.descubrirYa();
  const abrir = m.iris(false, cx, cy);
  m.fundido = 0;
  await abrir;
}

async function tarjeta(m: Motor, etiqueta: string, titulo1: string, sub: string, color: string) {
  m.barraSuperior = null;
  m.descubrirYa();
  m.escena = capitulo(m.t, etiqueta, titulo1, sub, color);
  await m.fundirA(false, 10);
  m.audio.sello();
  await m.esperarToque(3200);
  await m.fundirA(true, 12);
}

async function vega(m: Motor, ...lineas: string[]) {
  m.barraSuperior = null;
  m.descubrirYa();
  m.escena = laboratorio;
  await m.fundirA(false);
  for (const l of lineas) await m.decir(l, VEGA);
}

// ── El barrio ─────────────────────────────────────────────────

function npcs(pais: Pais, atacante: boolean): Npc[] {
  return [
    {
      id: "pepe",
      x: 2,
      y: 14,
      dir: "abajo",
      paleta: "pepe",
      nombre: pais.pepe,
      lineas: atacante ? [`${pais.pepe}: Ya cerré, joven. Vuelve mañana.`] : [`${pais.pepe}: ¡Buenas! Hoy llegó mercadería fresca.`],
    },
    {
      id: "vecina",
      x: 8,
      y: 9,
      dir: "izq",
      paleta: "vecina",
      nombre: "VECINA",
      lineas: atacante
        ? ["VECINA: ...¿y tú qué miras? Ya es tarde."]
        : [
            "VECINA: ¿Supiste? A la señora de la esquina la llamaron haciéndose pasar por el banco.",
            `VECINA: Aquí todos pagamos con ${pais.billeterasReales}. Y los estafadores lo saben.`,
          ],
    },
  ];
}

function mundo(pais: Pais, atacante: boolean, objetivo: string, inicio: { x: number; y: number; dir: Direccion }, jugador: ConfigMundo["jugador"] = atacante ? "atacante" : "rosa"): ConfigMundo {
  return {
    jugador,
    inicio,
    noche: atacante,
    objetivo,
    npcs: npcs(pais, atacante),
    letrero: pais.tienda,
    puertas: {
      bodega: atacante ? ["La tienda de la esquina. Está cerrada."] : ["Tu tienda. Ahora no es momento de entrar."],
      banco: [`${pais.banco.toUpperCase()} (ficticio). La agencia está cerrada: hoy todo se hace por la app.`],
      hotel: ["HOTEL SOL ANDINO. Varios huéspedes salieron de excursión, sin señal."],
      cabina: atacante ? [] : ["Una cabina telefónica. Casi nadie la usa... casi."],
    },
  };
}

let yaExplico = false;

/** Lleva al jugador por el barrio. Se llama con la pantalla en negro. */
async function caminar(m: Motor, cfg: ConfigMundo, objetivo: string, aviso: string, cerrar = true) {
  m.barraSuperior = { texto: `OBJETIVO: ${objetivo}`, color: PAL.verdeOscuro };
  m.musica(cfg.noche ? "noche" : "barrio");
  const llegada = m.explorar(cfg);
  const abrir = m.iris(false);
  m.fundido = 0;
  await abrir;
  await m.decir(yaExplico ? aviso : `${aviso} Toca el piso para caminar.`);
  yaExplico = true;
  await llegada;
  if (!cerrar) return;
  const pos = posicionObjetivo(cfg.objetivo, cfg.npcs);
  await m.iris(true, pos ? pos.x * TILE + 8 : W / 2, pos ? pos.y * TILE + 8 - m.camaraMundo : m.h / 2);
}

// ── Efectos de combate ────────────────────────────────────────

async function entradaCombate(m: Motor, b: EstadoBatalla) {
  m.descubrirYa();
  m.fundido = 0;
  await m.animar(26, (k) => {
    const e = facil.salida(k);
    b.rivalDX = Math.round((1 - e) * W);
    b.aliadoDX = Math.round((1 - e) * -W);
  });
  await m.animar(14, (k) => {
    b.hud = k;
  });
}

async function embestida(m: Motor, b: EstadoBatalla) {
  await m.animar(5, (k) => {
    b.rivalDX = -Math.round(k * 14);
  });
  m.audio.golpe();
  m.sacudir(12);
  m.vibrar(60);
  b.aliadoGolpe = 24;
  await m.animar(8, (k) => {
    b.rivalDX = -Math.round((1 - k) * 14);
  });
}

async function cambiarAliado(m: Motor, b: EstadoBatalla, nuevo: EstadoBatalla["aliado"]) {
  await m.animar(14, (k) => {
    b.aliadoDX = Math.round(-W * facil.salida(k));
  });
  b.aliado = nuevo;
  m.destello = 10;
  const pa = puntosBatalla(m.h).aliado;
  m.particulas_(pa.x, pa.y, 30, { colores: [PAL.verde, PAL.blanco, PAL.ambar], vel: 2.2, g: 0, vida: 40 });
  await m.animar(20, (k) => {
    b.aliadoDX = Math.round(-W * (1 - facil.rebote(k)));
  });
}

async function huida(m: Motor, b: EstadoBatalla) {
  const pr = puntosBatalla(m.h).rival;
  m.particulas_(pr.x, pr.y + 20, 16, { colores: ["#d8c79a", "#efe2bd"], vel: 1.2, g: -0.02, vida: 30 });
  await m.animar(24, (k) => {
    b.rivalDX = Math.round(k * 120);
    b.rivalVisible = 1 - k;
  });
}

async function robo(m: Motor, b: EstadoBatalla, monto: string) {
  const pts = puntosBatalla(m.h);
  m.musica("triste");
  m.audio.drenar();
  m.vibrar([80, 50, 80, 50, 200]);
  m.particulas_(pts.aliado.x, pts.aliado.y, 36, { colores: [PAL.ambar, "#ffe08a", PAL.ambarOscuro], vel: 1, g: 0.02, vida: 50, tam: 3, haciaX: pts.rival.x, haciaY: pts.rival.y });
  b.aliadoLinea = dineroCero(monto);
  await m.sellar("ROBADO", PAL.rojo, `-${monto}`);
}

const dineroCero = (monto: string) => `${monto.split(" ")[0]} 0`;

async function guardianEntra(m: Motor, b: EstadoBatalla, linea: string) {
  b.congelado = true;
  m.musica("guardian");
  m.audio.whoosh();
  await m.decir("¡Adelante, GUARDIÁN!");
  await cambiarAliado(m, b, "guardian");
  b.aliadoNombre = "GUARDIÁN";
  b.aliadoLinea = linea;
  await m.decir("¡GUARDIÁN entró al combate!");
}

/** Preguntas del Guardián (si el motor dejó alguna pendiente). */
async function conversarGuardian(m: Motor, b: EstadoBatalla, caso: Caso): Promise<Caso> {
  let actual = caso;
  for (let n = 0; n < 3 && preguntaPendiente(actual); n++) {
    await m.decir("«¡Dile que no! Dile que lo haces tú.»", "ESTAFADOR");
    const opciones = [{ texto: "SÍ, ME GUÍAN" }, { texto: "NO, LO HAGO YO" }, { texto: "NO RESPONDER" }];
    const i = await m.pregunta(preguntaPendiente(actual)!, opciones, "GUARDIÁN", { corta: "¿Qué le respondes al GUARDIÁN?" });
    actual = await responderGuardian(caso.id, RESPUESTAS_GUARDIAN[Math.max(0, i)].texto);
    if (actual.salidas.guardian) {
      b.rivalBarra = Math.max(0, b.rivalBarra - 0.4);
      m.flotante("-PRESIÓN", 30, 72, PAL.verde);
    }
  }
  return actual;
}

async function frustracion(m: Motor): Promise<number> {
  const caras = [1, 2, 3, 4, 5].map((n) => ({ texto: String(n) }));
  return (await m.pregunta("¿Cuánta frustración sentiste?", caras, VEGA, { estilo: "caras", inicial: 2 })) + 1;
}

async function encuestaFinal(m: Motor) {
  const molesto = await m.pregunta("¿La pausa de seguridad te molestó?", [{ texto: "NO" }, { texto: "UN POCO" }, { texto: "MUCHO" }], VEGA);
  const activaria = await m.pregunta(
    "¿Activarías esta protección en tu banco, aunque a veces retrase un pago?",
    [{ texto: "SÍ", color: "#bfe8c9" }, { texto: "NO" }, { texto: "NO SÉ" }],
    VEGA,
  );
  return {
    pausa_molesto: (["no", "un_poco", "mucho"] as const)[Math.max(0, molesto)],
    activaria: (["si", "no", "no_se"] as const)[Math.max(0, activaria)],
  };
}

// ══ RUTA 1 · LA LLAMADA ═══════════════════════════════════════

type Recuento = { colgo: number; esperoBanco: number; bloqueo: boolean };
type ResultadoLlamada =
  | { tipo: "tiempo"; rec: Recuento; b: EstadoBatalla }
  | { tipo: "cayo"; rec: Recuento; b: EstadoBatalla }
  | { tipo: "motor"; caso: Caso; rec: Recuento; b: EstadoBatalla };

/** Ronda 1 y ronda 2: el mismo tipo de estafa (falso banco), pero con otro truco. */
function movimientosLlamada(pais: Pais, ronda: "a" | "b"): Array<[string, string]> {
  if (ronda === "b")
    return [
      ["NÚMERO OFICIAL", `Le habla ${pais.banco}, área de fraudes. Fíjese: le llamo del número que está detrás de su tarjeta.`],
      ["SUPERVISOR", "Le paso con mi supervisor... Ya bloqueamos a los delincuentes, pero falta un paso."],
      ["NO COMPARTA", "Le llegará un código. NO lo comparta con nadie: solo transfiera a la cuenta de resguardo."],
      ["URGENCIA", "Ya intentan sacar su dinero. Tiene minutos para ponerlo a salvo."],
      ["CULPA", "Si cuelga ahora, el banco no se hace responsable de lo que pierda."],
    ];
  return [
    ["SALUDO OFICIAL", `Buenas tardes, ${pais.rosa.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}. ${pais.llamadaGancho}`],
    ["DATOS FILTRADOS", "Ya validamos sus datos: su documento termina en 47."],
    ["MIEDO", "Detectamos un consumo que usted no hizo. Sus ahorros están en riesgo."],
    ["URGENCIA", "Muévalos YA a una cuenta de resguardo o su cuenta se bloquea."],
    ["INSISTENCIA", "No cuelgue. Es por su seguridad."],
  ];
}

async function llamada(m: Motor, pais: Pais, ronda: "a" | "b", alias: string): Promise<ResultadoLlamada> {
  const estado: EstadoBodega = { telefono: "normal", cliente: 0, letrero: `${pais.tienda}` };
  const monto = dinero(pais, ESTAFA_ROSA.monto);
  m.escena = bodega(estado);
  m.musica("barrio");
  await abrirIris(m, 96, 120);
  const entra = m.animar(40, (k) => {
    estado.cliente = k;
  });
  if (ronda === "a") {
    await m.decir("Son las seis. La tienda está llena y tu proveedor espera su pago.");
    await entra;
    await m.decir(`Se registró un consumo de ${dinero(pais, 1299)} en tu tarjeta. Si no lo reconoces, te llamaremos.`, "SMS");
  } else {
    await m.decir("Otro día de mucho movimiento. Ya cerraste la caja de la mañana.");
    await entra;
    await m.decir("Tu clave dinámica fue solicitada desde otro equipo. Si no fuiste tú, espera nuestra llamada.", "SMS");
  }
  estado.cliente = 0;
  estado.telefono = "llamada";
  m.musica(null);
  m.audio.ring();
  m.vibrar([200, 100, 200, 100, 200]);
  m.sacudir(30);
  await m.decir("¡RIIING! ¡RIIING!");
  await m.decir(ronda === "a" ? `En la pantalla: «Seguridad ${pais.banco}».` : "En la pantalla aparece el número oficial de tu banco. Ese número se puede falsificar.");

  await m.barras(true);
  const total = SEGUNDOS_LLAMADA * 60;
  const b = nuevaBatalla({ tiempoTotal: total, tiempoRestante: total, aliadoNombre: pais.rosa, aliadoLinea: monto });
  m.escena = batalla(b, m);
  m.musica("llamada");
  await entradaCombate(m, b);
  await m.decir("¡El ESTAFADOR te está llamando!");
  if (ronda === "a") await m.decir("Tu reloj solo corre mientras eliges qué hacer. Pero atender clientes o esperar al banco te quita segundos.");

  const rec: Recuento = { colgo: 0, esperoBanco: 0, bloqueo: false };
  const movimientos = movimientosLlamada(pais, ronda);
  for (let turno = 0; ; turno++) {
    const [nombre, frase] = movimientos[Math.min(turno, movimientos.length - 1)];
    await m.decir(`¡ESTAFADOR usó ${nombre}!`);
    await embestida(m, b);
    if (b.tiempoRestante < 20 * 60) m.audio.latido();
    b.rivalBarra = Math.min(1, b.rivalBarra + 0.17);
    m.flotante("+PRESIÓN", 30, 72, PAL.rojo);
    await m.decir(`«${frase}»`, "ESTAFADOR");

    if (turno % 3 === 2) {
      await m.decir("¡Un cliente te pide su vuelto! Lo atiendes y pierdes 4 segundos.");
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 4 * 60);
      m.flotante("-4s", 150, puntosBatalla(m.h).aliado.y - 30, PAL.rojo);
    }
    if (b.tiempoRestante <= 0) return { tipo: "tiempo", rec, b };

    const inicio = m.t;
    const i = await m.menu(
      [{ texto: "TRANSFERIR", color: "#f4c7c3" }, { texto: "COLGAR" }, { texto: "AL BANCO" }, { texto: "BLOQUEAR" }],
      { estilo: "combate", titulo: `¿Qué hará ${pais.rosa}?`, limiteCuadros: b.tiempoRestante },
    );
    b.tiempoRestante = Math.max(0, b.tiempoRestante - (m.t - inicio));
    if (i === -2) return { tipo: "tiempo", rec, b };

    if (i === 1) {
      rec.colgo++;
      await m.decir("Colgaste.");
      m.audio.ring();
      m.vibrar([150, 80, 150]);
      m.sacudir(16);
      await m.decir("¡El ESTAFADOR volvió a llamar!");
    } else if (i === 2) {
      rec.esperoBanco++;
      m.musica(null);
      await m.decir(`Llamas a la línea oficial de ${pais.banco.toUpperCase()}...`);
      await m.decir("«Su llamada es importante para nosotros. Tiempo de espera: 14 minutos.»", pais.banco);
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 10 * 60);
      m.flotante("-10s", 150, puntosBatalla(m.h).aliado.y - 30, PAL.rojo);
      m.musica("llamada");
      await m.decir("Mientras esperabas, ¡el ESTAFADOR volvió a entrar a la línea!");
    } else if (i === 3) {
      if (!rec.bloqueo) {
        rec.bloqueo = true;
        await m.decir("Bloqueaste tu tarjeta en la app. OK.");
        await m.decir("«Bloquear la tarjeta no protege sus ahorros.»", "ESTAFADOR");
      } else {
        await m.decir("Tu tarjeta ya está bloqueada.");
      }
    } else {
      await m.decir(`TRANSFERIR ${monto} a: CUENTA DE RESGUARDO (beneficiario nuevo).`, pais.banco);
      await m.decir("FaceID... OK. Eres tú.", pais.banco);
      await m.decir("Token digital... OK.", pais.banco);
      if (ronda === "a") {
        const ok = await m.pregunta("AVISO: ¿Seguro que deseas continuar con esta operación?", [{ texto: "CONTINUAR", color: "#f4c7c3" }, { texto: "CANCELAR" }], pais.banco);
        if (ok === 0) return { tipo: "cayo", rec, b };
        await m.decir("Cancelaste. La llamada sigue...");
      } else {
        try {
          const caso = await transferir({
            transaccion: { ...ESTAFA_ROSA, moneda: "PEN" },
            // Señal SIMULADA: una web no puede saber si estás en una llamada.
            contexto: { llamada_activa_o_acceso_remoto: true },
            alias,
          });
          return { tipo: "motor", caso, rec, b };
        } catch {
          await m.decir("No hubo conexión con el banco. Intenta otra vez.", pais.banco);
        }
      }
    }
    if (b.tiempoRestante <= 0) return { tipo: "tiempo", rec, b };
  }
}

async function rutaLlamada(m: Motor, pais: Pais, alias: string): Promise<Marca> {
  await tarjeta(m, "LA LLAMADA · RONDA 1/2", "AVISO", "Genérico y simulado:\nFaceID, token y un\n«¿desea continuar?»", PAL.ambar);
  await vega(
    m,
    `Serás ${pais.rosa}. Tiene una ${pais.tienda.toLowerCase()} en el barrio y hoy le toca pagarle a ${pais.pepe}.`,
    `En esta ronda ${pais.banco} solo tiene FaceID, token y un aviso genérico. Es nuestra línea base SIMULADA.`,
  );
  await m.fundirA(true);
  await caminar(m, mundo(pais, false, "bodega", { x: 6, y: 5, dir: "izq" }), "tu tienda", "Ve a tu TIENDA.");

  m.barraSuperior = { texto: "RONDA 1/2", color: PAL.ambarOscuro };
  const a = await llamada(m, pais, "a", alias);
  const cayo = a.tipo === "cayo";
  const monto = dinero(pais, ESTAFA_ROSA.monto);
  if (cayo) {
    await robo(m, a.b, monto);
    await m.decir(`¡Salieron ${monto} de tu cuenta!`);
    await huida(m, a.b);
    await m.decir("El ESTAFADOR colgó. El número ya no existe.");
    await m.fundirA(true);
    m.escena = bodega({ telefono: "perdio", cliente: 0, letrero: pais.tienda });
    await m.fundirA(false);
    await m.decir("Bloqueas tu tarjeta: OK. Pero la transferencia ya salió. Bloquearla no la regresa.");
    await m.decir("Presentas un reclamo. El banco se toma días, a veces semanas, para responder.");
    await m.decir("«La operación fue validada con su token digital.»", pais.banco);
  } else {
    m.musica("barrio");
    await huida(m, a.b);
    await m.decir("El ESTAFADOR colgó... por ahora.");
    const r = a.rec;
    await m.decir(
      `No perdiste dinero. Pero fuiste tu propio equipo de seguridad: colgaste ${r.colgo} ${r.colgo === 1 ? "vez" : "veces"} y esperaste al banco ${r.esperoBanco} ${r.esperoBanco === 1 ? "vez" : "veces"}. Y la tienda siguió llena.`,
    );
  }
  await m.fundirA(true);
  m.musica("triste");
  await vega(m, "No fue tu culpa. Te autenticaste bien: el sistema esperaba que TÚ te dieras cuenta, bajo presión.");
  const fr = await frustracion(m);
  await m.fundirA(true);

  await tarjeta(m, "LA LLAMADA · RONDA 2/2", "LA CAPA", "Otro día, otro truco\ndel falso banco...\ncon nuestros agentes.", PAL.verde);
  await caminar(m, mundo(pais, false, "bodega", { x: 2, y: 5, dir: "arriba" }), "tu tienda", "Vuelve a tu TIENDA. Juega como quieras.");
  m.barraSuperior = { texto: "RONDA 2/2", color: PAL.verdeOscuro };

  const r = await llamada(m, pais, "b", alias);
  let casoEstafa: Caso | null = null;
  let salvo = true;
  if (r.tipo === "motor") {
    const b = r.b;
    casoEstafa = r.caso;
    m.musica(null);
    if (huboPausaPreventiva(r.caso)) {
      m.destello = 12;
      await m.sellar("RETENIDO", PAL.verde, "Antes de cualquier IA");
    }
    await m.decir("Nadie puede mover tu dinero ahora. El reloj del ESTAFADOR ya no sirve.");
    await guardianEntra(m, b, "A SALVO");
    const actual = await conversarGuardian(m, b, r.caso);
    const d = actual.decision!;
    if (retiene(d.accion)) {
      b.rivalBarra = 0;
      b.rivalGolpe = 20;
      m.audio.golpe();
      await huida(m, b);
      m.audio.exito();
      m.confeti();
      await m.decir("¡El ESTAFADOR huyó!");
      await m.decir(`Tus ${monto} siguen en tu cuenta. La transferencia nunca se ejecutó.`);
      await m.decir(explicar(d.regla).detalle, "GUARDIÁN");
      await m.decir("Mentir no servía: la cuenta destino te delataba. Y nunca te pedí tu clave, tu token ni tu tarjeta.", "GUARDIÁN");
    } else {
      salvo = false;
      m.audio.fallo();
      await m.decir("La operación pasó. Es un fallo del sistema, no tuyo: lo registramos.");
    }
  } else {
    await huida(m, r.b);
    await m.decir("El ESTAFADOR colgó. No transferiste nada en esta ronda.");
  }

  // Pago legítimo al proveedor
  await m.barras(true);
  m.descubrirYa();
  m.fundido = 1;
  await caminar(m, mundo(pais, false, "pepe", { x: 2, y: 5, dir: "abajo" }), pais.pepe.slice(0, 9), `Ahora págale a ${pais.pepe} en el MERCADO.`, false);
  const proveedor = dinero(pais, PAGO_PROVEEDOR.monto);
  await m.decir(`¡Hola! Son ${proveedor} de la mercadería de hoy.`, pais.pepe);
  await m.pregunta(`¿Pagarle a ${pais.pepe}?`, [{ texto: `PAGAR ${proveedor}`, color: "#bfe8c9" }]);
  const pago = await transferir({ transaccion: { ...PAGO_PROVEEDOR, moneda: "PEN" }, alias });
  if (pago.decision && !retiene(pago.decision.accion)) {
    m.audio.exito();
    await m.sellar("PAGADO", PAL.verde, "Al instante", 1100);
    await m.decir("Es tu proveedor de siempre: el sistema no te molestó.", pais.banco);
  } else {
    await m.decir("El pago quedó retenido: es un falso positivo y lo registramos como tal.", pais.banco);
  }

  await m.fundirA(true);
  await vega(m, `¡Bien jugado, ${alias}! Dos preguntas rápidas.`);
  const enc = await encuestaFinal(m);
  try {
    await registrarPartida({
      rol: "victima",
      alias,
      ronda_a: { cayo, frustracion: fr },
      // Solo la estafa: un PERMITIR aquí cuenta como «perdió dinero».
      ronda_b: { casos: casoEstafa ? [casoEstafa.id] : [], pausa_molesto: enc.pausa_molesto },
      activaria: enc.activaria,
    });
  } catch {
    // la partida sigue aunque no se guarde
  }
  await m.decir(cayo ? "Con el aviso genérico perdiste el dinero. Con nuestra capa, la misma presión no alcanzó." : "Resististe a puro esfuerzo. Con nuestra capa, no tenías que hacerlo sola.", VEGA);
  await m.fundirA(true);
  return salvo ? SALVO : ROBADO;
}

// ══ RUTA 2 · SIN SEÑAL ════════════════════════════════════════

async function rutaSinSenal(m: Motor, pais: Pais, alias: string): Promise<Marca> {
  const robado = dinero(pais, 3000);
  const hotel = dinero(pais, 650);
  await tarjeta(m, "SIN SEÑAL · RONDA 1/2", "SIN CAPA", "Si no puedes\ncontestar, ¿quién\nte protege?", PAL.celeste);
  await vega(
    m,
    `Serás ${pais.lucia}. Se fue de viaje a ${pais.sierra}: cuatro días sin señal.`,
    "En la región, mucha gente vive con señal a medias o sin datos. Y los avisos del banco llegan... cuando llegan.",
  );
  await m.fundirA(true);

  const est = { lugar: pais.sierra, caminando: true };
  m.escena = sierra(est);
  m.musica("barrio");
  await abrirIris(m);
  await m.decir("Justo antes de perder la señal, llega un SMS:");
  const abrio = await m.pregunta(pais.smsFalso, [{ texto: "ABRIR EL LINK", color: "#f4c7c3" }, { texto: "IGNORARLO" }], "SMS");
  if (abrio === 0) await m.decir("El link pedía tu clave para «no perder la cuenta». La escribiste. Ahora alguien más la tiene.");
  else await m.decir("Bien hecho. Pero esa misma noche, en el bus, alguien te roba el celular de la mochila.");
  m.musica("suspenso");
  m.audio.glitch();
  await m.decir("Y la señal desaparece.");

  // Ronda A: sin capa, no puedes hacer nada
  await m.barras(true);
  const saldoInicial = dinero(pais, 4200);
  const b = nuevaBatalla({ fondo: "sistema", rivalNombre: "LADRÓN", aliado: "lucia", aliadoNombre: pais.lucia, aliadoEtiqueta: "SIN SEÑAL", aliadoLinea: saldoInicial });
  m.escena = batalla(b, m);
  m.musica("llamada");
  m.barraSuperior = { texto: "RONDA 1/2", color: PAL.ambarOscuro };
  await entradaCombate(m, b);
  await m.decir("Mientras tanto, en la ciudad, el LADRÓN entra a tu cuenta desde otro celular.");
  for (let i = 0; i < 2; i++) {
    await m.decir(i === 0 ? `¡LADRÓN usó TRANSFERENCIA! ${robado} a una cuenta nueva.` : "¡LADRÓN usó OTRA MÁS! Vacía lo que queda.");
    await embestida(m, b);
    b.rivalBarra = Math.min(1, b.rivalBarra + 0.4);
    const accion = await m.menu([{ texto: "LLAMAR" }, { texto: "BLOQUEAR" }, { texto: "RESPONDER" }, { texto: "PEDIR AYUDA" }], { estilo: "combate", titulo: `¿Qué hará ${pais.lucia}?` });
    void accion;
    m.vibrar([40, 40, 40]);
    m.sacudir(10);
    m.audio.glitch();
    await m.decir("Sin señal. Nada sale de tu celular.");
  }
  await robo(m, b, saldoInicial);
  await huida(m, b);
  await m.fundirA(true);
  m.escena = sierra({ lugar: pais.sierra, caminando: false });
  m.musica("triste");
  await m.fundirA(false);
  await m.decir("Cuatro días después, vuelve la señal. Llegan los avisos, todos juntos:");
  await m.decir("«¿Reconoces estas operaciones?»", pais.banco);
  await m.decir("Ya es tarde. Notificar no es proteger.");
  await m.fundirA(true);

  // Ronda B: con la capa, sin necesitar tu respuesta
  await tarjeta(m, "SIN SEÑAL · RONDA 2/2", "LA CAPA", "Mismo viaje, misma\nnoche. Sigues sin\nseñal.", PAL.verde);
  m.descubrirYa();
  const b2 = nuevaBatalla({ fondo: "sistema", rivalNombre: "LADRÓN", aliado: "lucia", aliadoNombre: pais.lucia, aliadoEtiqueta: "SIN SEÑAL", aliadoLinea: saldoInicial });
  m.escena = batalla(b2, m);
  m.musica("llamada");
  m.barraSuperior = { texto: "RONDA 2/2", color: PAL.verdeOscuro };
  await entradaCombate(m, b2);
  await m.decir(`¡LADRÓN usó TRANSFERENCIA! ${robado} a una cuenta nueva, desde un celular nuevo.`);
  await embestida(m, b2);
  const caso = await transferir({
    transaccion: { origen: "C-LUCIA", destino: "M-02", monto: 3000, moneda: "PEN" },
    contexto: { dispositivo_nuevo_24h: true },
    alias,
  });
  let salvo = false;
  if (caso.decision && retiene(caso.decision.accion)) {
    salvo = true;
    m.destello = 12;
    await m.sellar("PAUSADO", PAL.verde, "Sin tu respuesta");
    await guardianEntra(m, b2, "A SALVO");
    await m.decir("No pude verificar contigo: estás sin señal. El silencio NO libera el dinero.", "GUARDIÁN");
    await m.decir("Y no te pregunté por tu celular de siempre: podría estar en manos del ladrón.", "GUARDIÁN");
    await m.decir(explicar(caso.decision.regla).detalle, "GUARDIÁN");
    b2.rivalGolpe = 20;
    await huida(m, b2);
  } else {
    await m.decir("La operación pasó. Es un fallo del sistema, no tuyo: lo registramos.");
  }
  await m.decir("Mientras tanto, se cobra tu pago de siempre al hotel...");
  const pagoHotel = await transferir({ transaccion: { origen: "C-LUCIA", destino: "H-SOL", monto: 650, moneda: "PEN" }, alias });
  if (pagoHotel.decision && !retiene(pagoHotel.decision.accion)) {
    m.audio.exito();
    await m.sellar("PAGADO", PAL.verde, `Hotel ${hotel}`, 1100);
    await m.decir("Tu pago habitual sí pasó: proteger no es bloquear todo.");
  }
  await m.fundirA(true);
  m.escena = sierra({ lugar: pais.sierra, caminando: false });
  m.musica("guardian");
  await m.fundirA(false);
  if (salvo) {
    m.confeti();
    await m.decir(`Cuatro días después, ${pais.lucia} vuelve a tener señal y verifica por un canal seguro. La transferencia del ladrón se cancela.`);
  }
  await vega(m, "En la ronda 1 no podías hacer nada: no era tu culpa, era tu disponibilidad. En la ronda 2, la protección no te necesitó.");
  await m.fundirA(true);
  return salvo ? SALVO : ROBADO;
}

// ══ RUTA 3 · EL FAMILIAR ══════════════════════════════════════

type ResultadoFamiliar = { tipo: "verifico" | "tiempo" | "cayo"; b: EstadoBatalla } | { tipo: "motor"; caso: Caso; b: EstadoBatalla };

async function chatFamiliar(m: Motor, pais: Pais, ronda: "a" | "b", alias: string): Promise<ResultadoFamiliar> {
  const monto = dinero(pais, 1500);
  const hijo = pais.hijo;
  const total = 40 * 60;
  const b = nuevaBatalla({
    fondo: "casa",
    rival: "misterio",
    rivalNombre: `¿${hijo.toUpperCase()}?`,
    aliado: "jorge",
    aliadoNombre: pais.jorge,
    tiempoTotal: total,
    tiempoRestante: total,
    aliadoLinea: monto,
  });
  m.descubrirYa();
  m.escena = batalla(b, m);
  m.musica("suspenso");
  m.vibrar([60, 40, 60]);
  m.audio.ring();
  await entradaCombate(m, b);
  await m.decir("Te llega un mensaje de un número desconocido...");
  if (ronda === "a") await m.decir("Tu reloj solo corre mientras eliges qué hacer. Ignorarlo te quita segundos.");
  // Ronda 2: el mismo «falso familiar», con otra historia.
  const mensajes: Array<[string, string]> =
    ronda === "a"
      ? [
          ["NÚMERO NUEVO", `Hola, soy ${hijo}. Se me malogró el cel, guarda este número.`],
          ["URGENCIA", `Tengo que pagar algo HOY o me meto en un problema. ¿Me prestas ${monto}?`],
          ["SECRETO", "No le digas a mamá, porfa. Te devuelvo mañana."],
          ["CULPA", "¿No me vas a ayudar? Pensé que podía contar contigo..."],
          ["INSISTENCIA", "Rápido, porfa. Contesta."],
        ]
      : [
          ["CEL ROBADO", `Soy ${hijo}. Me robaron el cel, te escribo desde el de un amigo.`],
          ["URGENCIA", `Necesito ${monto} para volver y pagar el chip nuevo. Hoy mismo.`],
          ["SECRETO", "No le cuentes a nadie, que me van a reñir."],
          ["CULPA", "¿Me vas a dejar acá sin cómo volver?"],
          ["INSISTENCIA", "Rápido, que mi amigo necesita su cel."],
        ];
  for (let turno = 0; ; turno++) {
    const [nombre, frase] = mensajes[Math.min(turno, mensajes.length - 1)];
    await m.decir(`¡¿${hijo.toUpperCase()}? usó ${nombre}!`);
    await embestida(m, b);
    b.rivalBarra = Math.min(1, b.rivalBarra + 0.18);
    m.flotante("+PRESIÓN", 30, 72, PAL.rojo);
    await m.decir(`«${frase}»`, `¿${hijo.toUpperCase()}?`);
    if (b.tiempoRestante <= 0) return { tipo: "tiempo", b };
    const inicio = m.t;
    const i = await m.menu(
      [{ texto: "TRANSFERIR", color: "#f4c7c3" }, { texto: "VERIFICAR" }, { texto: "PREGUNTAR" }, { texto: "IGNORAR" }],
      { estilo: "combate", titulo: `¿Qué hará ${pais.jorge}?`, limiteCuadros: b.tiempoRestante },
    );
    b.tiempoRestante = Math.max(0, b.tiempoRestante - (m.t - inicio));
    if (i === -2) {
      await m.decir("El número dejó de escribir... por ahora.");
      return { tipo: "tiempo", b };
    }
    if (i === 1) {
      await m.decir(`Llamas al número DE SIEMPRE de ${hijo}...`);
      m.audio.ring();
      await m.decir("«¿Hola? Estoy en clase. ¿Pasó algo?»", hijo.toUpperCase());
      b.rival = "estafador";
      m.destello = 10;
      m.audio.exito();
      await m.sellar("DESCUBIERTO", PAL.verde, "Verificaste por otro canal");
      await huida(m, b);
      return { tipo: "verifico", b };
    }
    if (i === 2) {
      await m.decir("Le preguntas algo que solo tu hijo sabría: «¿Cómo se llamaba nuestro primer perro?»");
      await m.decir("«¡No hay tiempo para eso!!»", `¿${hijo.toUpperCase()}?`);
      await m.decir("Raro... esquivó la pregunta.");
      continue;
    }
    if (i === 3) {
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 5 * 60);
      await m.decir("Lo ignoras... y llegan diez mensajes seguidos.");
      continue;
    }
    await m.decir(`TRANSFERIR ${monto} a una cuenta nueva que te pasó «${hijo}».`, pais.banco);
    await m.decir("FaceID... OK. Token... OK.", pais.banco);
    if (ronda === "a") {
      const ok = await m.pregunta("AVISO: ¿Seguro que deseas continuar?", [{ texto: "CONTINUAR", color: "#f4c7c3" }, { texto: "CANCELAR" }], pais.banco);
      if (ok === 0) return { tipo: "cayo", b };
      continue;
    }
    const caso = await transferir({ transaccion: { origen: "C-JORGE", destino: "M-01", monto: 1500, moneda: "PEN" }, alias });
    return { tipo: "motor", caso, b };
  }
}

async function rutaFamiliar(m: Motor, pais: Pais, alias: string): Promise<Marca> {
  const monto = dinero(pais, 1500);
  await tarjeta(m, "EL FAMILIAR · RONDA 1/2", "AVISO", "Genérico y simulado.\n¿Verificas o\ntransfieres?", PAL.ambar);
  await vega(m, `Serás ${pais.jorge}. Su hijo, ${pais.hijo}, estudia en otra ciudad. Son las once de la noche.`);
  await m.fundirA(true);
  m.barraSuperior = { texto: "RONDA 1/2", color: PAL.ambarOscuro };
  const a = await chatFamiliar(m, pais, "a", alias);
  const cayo = a.tipo === "cayo";
  if (cayo) {
    await robo(m, a.b, monto);
    await m.decir("El número te bloqueó. Llamas a tu hijo de verdad: «¿Pa? Yo nunca te pedí nada».");
    await huida(m, a.b);
  } else if (a.tipo === "verifico") {
    m.confeti();
    await m.decir("¡GANASTE! Verificar por otro canal es la mejor defensa. Pero a las once de la noche, con prisa, no todos lo hacen.");
  }
  await m.fundirA(true);
  await vega(m, cayo ? "Te escribió alguien con la voz de la urgencia. Le creíste porque lo quieres. Eso no es culpa tuya." : "Bien. Ahora veamos qué pasa si alguien sí transfiere.");
  const fr = await frustracion(m);
  await m.fundirA(true);

  await tarjeta(m, "EL FAMILIAR · RONDA 2/2", "LA CAPA", "Otra historia, mismo\ntruco. Esta vez\ntransfiere y mira.", PAL.verde);
  m.barraSuperior = { texto: "RONDA 2/2", color: PAL.verdeOscuro };
  await vega(m, "Esta vez, prueba a TRANSFERIR. Queremos que veas qué hace el sistema.");
  await m.fundirA(true);
  const r = await chatFamiliar(m, pais, "b", alias);
  let caso: Caso | null = null;
  let salvo = true;
  if (r.tipo === "motor") {
    caso = r.caso;
    if (huboPausaPreventiva(r.caso)) await m.sellar("RETENIDO", PAL.verde, "Antes de cualquier IA");
    if (retiene(r.caso.decision!.accion)) {
      m.destello = 10;
      if (!huboPausaPreventiva(r.caso)) await m.sellar("RETENIDO", PAL.verde, "El Detective lo vio");
      await m.decir("¡DETECTIVE investigó la cuenta destino!");
      await m.decir("La cuenta es nueva y recibe dinero de muchas personas que nunca le habían enviado nada. Patrón de cuenta mula.", "DETECTIVE");
      await m.decir(explicar(r.caso.decision!.regla).detalle);
      r.b.rival = "estafador";
      r.b.rivalGolpe = 20;
      await huida(m, r.b);
      m.confeti();
      await m.decir(`Llamas a ${pais.hijo}: está bien. Tus ${monto} nunca salieron.`);
    } else {
      salvo = false;
      await robo(m, r.b, monto);
      await m.decir("La operación pasó. Es un fallo del sistema, no tuyo: lo registramos.");
    }
  } else {
    await m.decir(r.tipo === "verifico" ? "Verificaste otra vez: perfecto. La capa está para cuando no se puede." : "No transferiste. El estafador se aburrió.");
  }
  await m.fundirA(true);
  await vega(m, "Dos preguntas rápidas.");
  const enc = await encuestaFinal(m);
  try {
    await registrarPartida({
      rol: "victima",
      alias,
      ronda_a: { cayo, frustracion: fr },
      ronda_b: { casos: caso ? [caso.id] : [], pausa_molesto: enc.pausa_molesto },
      activaria: enc.activaria,
    });
  } catch {
    // la partida sigue aunque no se guarde
  }
  await m.fundirA(true);
  return salvo ? SALVO : ROBADO;
}

// ══ RUTA 4 · EL COMPROBANTE ═══════════════════════════════════

async function rutaComprobante(m: Motor, pais: Pais): Promise<Marca> {
  const monto = dinero(pais, 250);
  await tarjeta(m, "EL COMPROBANTE", "PAGO FALSO", "Un fraude que NO\npasa por tu cuenta.\nUna sola ronda.", "#b48be0");
  await vega(m, `Otra vez en la ${pais.tienda.toLowerCase()} de ${pais.rosa}. Esta estafa es de las más comunes con comerciantes.`);
  await m.fundirA(true);
  const estado: EstadoBodega = { telefono: "normal", cliente: 0, letrero: pais.tienda, pedido: "¡2 cajas de leche!" };
  m.escena = bodega(estado);
  m.musica("barrio");
  await abrirIris(m, 96, 120);
  const entra = m.animar(40, (k) => {
    estado.cliente = k;
  });
  await m.decir("Entra un cliente apurado.");
  await entra;
  await m.decir(`Son ${monto}. Te muestra su celular:`);
  estado.captura = { monto, billetera: pais.billetera, k: 0 };
  await m.animar(20, (k) => {
    estado.captura!.k = k;
  });
  await m.decir(`«${pais.comprobante}»`, "CLIENTE");
  estado.pedido = "¡Rápido, el taxi!";
  m.musica("suspenso");
  m.audio.tension();
  await m.decir("«¡Apúrese, que el taxi me está esperando!»", "CLIENTE");
  let eleccion = await m.pregunta("¿Qué haces?", [{ texto: "ENTREGAR" }, { texto: "VERIFICAR EN MI APP", color: "#bfe8c9" }, { texto: "PEDIR QUE ESPERE" }]);
  if (eleccion === 2) {
    await m.decir("«¡No tengo tiempo! ¿No ve que ya le pagué?»", "CLIENTE");
    eleccion = await m.pregunta("¿Y ahora?", [{ texto: "ENTREGAR" }, { texto: "VERIFICAR EN MI APP", color: "#bfe8c9" }]);
  }
  estado.captura = undefined;
  let gano: boolean;
  if (eleccion === 1) {
    gano = true;
    await m.decir(`Abres TU app de ${pais.billetera}... Últimos movimientos: nada nuevo.`);
    await m.decir("«Ah... se habrá demorado... ya vuelvo.» Y se va. Sin la leche.", "CLIENTE");
    m.audio.exito();
    m.confeti();
    await m.sellar("DESCUBIERTO", PAL.verde, "Verificaste en tu app");
  } else {
    gano = false;
    estado.cliente = 0;
    await m.decir("Entregas la mercadería. El cliente se va corriendo.");
    await m.decir(`Más tarde revisas tu app de ${pais.billetera}: el pago nunca llegó. La captura era falsa.`);
    m.audio.fallo();
    await m.sellar("ROBADO", PAL.rojo, `-${monto} en productos`);
  }
  m.musica(gano ? "guardian" : "triste");
  await vega(
    m,
    "Seamos honestos: este fraude no mueve dinero de tu cuenta, se lleva tu mercadería. Nuestra capa NO lo ve.",
    pais.defensaComprobante,
    `Dato real: ${pais.modalidad}`,
  );
  await m.fundirA(true);
  return gano ? SALVO : ROBADO;
}

// ══ RUTA 5 · LA BANDA (atacante) ══════════════════════════════

async function planear(m: Motor, pais: Pais): Promise<Jugada> {
  const nombres: Record<string, string> = { rosa: pais.rosa, jorge: pais.jorge, lucia: pais.lucia };
  const v = await m.menu(VICTIMAS.map((x) => ({ texto: nombres[x.id], info: `${nombres[x.id]}: ${x.situacion}.` })), { titulo: "¿A quién apuntas?" });
  const t = await m.menu(
    TACTICAS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.gancho} ${x.comun}.`, color: x.dificil ? "#f4dcc3" : undefined })),
    { titulo: "¿Qué táctica?" },
  );
  const d = await m.menu(DESTINOS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${x.detalle}.` })), { titulo: "¿A qué cuenta va?" });
  const mo = await m.menu(MONTOS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${dinero(pais, x.monto)}.` })), { titulo: "¿Cuánto?" });
  const h = await m.menu(
    [
      { texto: "DE DÍA", info: "A plena luz, cuando la víctima está ocupada." },
      { texto: "DE MADRUGADA", info: "Cuando nadie mira. Un horario raro también es una señal." },
    ],
    { titulo: "¿Cuándo?" },
  );
  return { victima: VICTIMAS[v].id, tactica: TACTICAS[t].id, destino: DESTINOS[d].id, monto: MONTOS[mo].monto, madrugada: h === 1 };
}

const AGENTES: Record<string, { inicial: string; color: string; texto: string }> = {
  memoria: { inicial: "M", color: PAL.ambar, texto: "¡MEMORIA reconoció la cuenta: un analista ya la confirmó como mula!" },
  coordinador: { inicial: "C", color: PAL.celeste, texto: "¡COORDINADOR entró: decide qué agentes hacen falta!" },
  guardian: { inicial: "G", color: PAL.verde, texto: "¡GUARDIÁN entró: le pregunta a la víctima por un canal seguro!" },
  detective: { inicial: "D", color: "#9ab8ff", texto: "¡DETECTIVE entró: investiga la cuenta que recibe el dinero!" },
  auditor: { inicial: "A", color: PAL.crema, texto: "¡AUDITOR entró: arma el expediente con evidencia!" },
};

async function rutaBanda(m: Motor, pais: Pais, alias: string): Promise<Marca> {
  await tarjeta(m, "LA BANDA", "ATACANTE", "Primero, un golpe\nclásico. Después,\ncontra la capa.", PAL.rojo);
  await vega(
    m,
    "Ahora estás del otro lado: eres parte de una BANDA (ficticia).",
    "Tienes lo que tienen las bandas reales: datos filtrados, cuentas «alquiladas» y un teléfono. Sin guiones reales.",
  );
  await m.fundirA(true);
  await caminar(m, mundo(pais, true, "cabina", { x: 6, y: 5, dir: "izq" }), "la cabina", "De noche. Ve a la CABINA telefónica para armar tu golpe.", false);
  const fondoCabina = m.escena;

  // Golpe clásico: contra un banco de HOY (simulado), el atacante gana.
  m.barraSuperior = { texto: "GOLPE CLÁSICO", color: PAL.rojoOscuro };
  await m.decir(`Golpe de práctica: contra ${pais.rosa}, con la seguridad de HOY (simulada).`);
  await m.barras(true);
  const b0 = nuevaBatalla({ simbolo: pais.simbolo, fondo: "sistema", rival: "banco", rivalNombre: "BANCO HOY", rivalEtiqueta: "RIESGO", rivalBarra: 0, rivalColor: PAL.ambar, aliado: "atacante", aliadoNombre: alias.toUpperCase(), aliadoEtiqueta: "CLÁSICO", aliadoLinea: "" });
  m.escena = batalla(b0, m);
  m.musica("llamada");
  await entradaCombate(m, b0);
  await m.decir("¡Lanzaste FALSO BANCO!");
  await embestida(m, b0);
  await m.decir("La víctima, asustada, transfiere. FaceID: OK. Token: OK. Aviso: «¿desea continuar?»... SÍ.");
  m.audio.monedas();
  m.confeti();
  await m.sellar("¡GANASTE!", PAL.ambar, `+${dinero(pais, ESTAFA_ROSA.monto)}`);
  await m.decir("Así de fácil es hoy: la identidad era correcta, la intención no. Ahora, contra la capa.");
  await m.barras(true);
  m.descubrirYa();
  m.escena = fondoCabina;
  await m.iris(false);

  const intentos: Array<{ caso: string; tactica: string }> = [];
  let huecos = 0;
  for (let n = 1; n <= MAX_INTENTOS; n++) {
    m.escena = fondoCabina;
    m.musica("noche");
    m.barraSuperior = { texto: `GOLPE ${n}/${MAX_INTENTOS} HUECOS ${huecos}`, color: PAL.rojoOscuro };
    const jugada = await planear(m, pais);
    const tactica = TACTICAS.find((x) => x.id === jugada.tactica)!;
    const victima = { rosa: pais.rosa, jorge: pais.jorge, lucia: pais.lucia }[jugada.victima];
    const ok = await m.pregunta(
      `${tactica.nombre} contra ${victima}, ${dinero(pais, jugada.monto)} a la ${DESTINOS.find((x) => x.id === jugada.destino)!.nombre}${jugada.madrugada ? ", de madrugada" : ""}.`,
      [{ texto: "EJECUTAR", color: "#f4c7c3" }, { texto: "CAMBIAR" }],
      undefined,
      { corta: "¿Ejecutar el golpe?" },
    );
    if (ok !== 0) {
      n--;
      continue;
    }

    await m.barras(true);
    const b = nuevaBatalla({
      simbolo: pais.simbolo,
      fondo: "sistema",
      rival: "banco",
      rivalNombre: "SISTEMA",
      rivalEtiqueta: "RIESGO",
      rivalBarra: 0,
      rivalColor: PAL.ambar,
      aliado: "atacante",
      aliadoNombre: alias.toUpperCase(),
      aliadoEtiqueta: `INTENTO ${n}/${MAX_INTENTOS}`,
      aliadoLinea: `HUECOS ${huecos}`,
    });
    m.escena = batalla(b, m);
    m.musica("llamada");
    await entradaCombate(m, b);
    await m.decir(`¡Lanzaste ${tactica.nombre.toUpperCase()} contra ${victima}!`);
    m.audio.golpe();
    m.sacudir(12);
    m.vibrar(50);

    const caso = await transferir(armarTransferencia(jugada, alias));
    intentos.push({ caso: caso.id, tactica: jugada.tactica });

    let acumulado = 0;
    if (caso.nivel0.senales.length === 0) await m.decir("Las REGLAS no vieron ninguna señal de riesgo.");
    for (const s of caso.nivel0.senales) {
      const pts = puntosDe(s);
      acumulado += pts ?? 0;
      b.rivalBarra = Math.min(1, acumulado / 8);
      m.audio.mover();
      if (pts !== null) m.flotante(`+${pts}`, 100, 70, PAL.ambar);
      await m.decir(`Las REGLAS detectaron: ${SENALES[s] ?? s}${pts !== null ? ` (+${pts})` : ""}.`);
    }
    if (huboPausaPreventiva(caso)) {
      m.destello = 10;
      await m.sellar("RETENIDO", PAL.ambarOscuro, `Riesgo ${caso.nivel0.score}, sin IA aún`);
    }
    for (const actor of actoresDe(caso)) {
      const ag = AGENTES[actor];
      if (!ag) continue;
      b.agentes.push({ inicial: ag.inicial, color: ag.color, nace: m.t });
      m.audio.confirmar();
      await m.decir(ag.texto);
    }

    const d = caso.decision!;
    if (retiene(d.accion)) {
      b.rivalBarra = 1;
      b.aliadoGolpe = 30;
      m.musica("triste");
      m.audio.alarma();
      await m.sellar("FRENADO", PAL.rojo, explicar(d.regla).titulo.slice(0, 20));
      await m.decir(explicar(d.regla).detalle);
      if (caso.ia.llamadas === 0) await m.decir("Gasto de IA para frenarte: 0 llamadas.");
    } else {
      huecos++;
      b.aliadoLinea = `HUECOS ${huecos}`;
      m.musica("guardian");
      m.confeti();
      await m.sellar("HUECO", PAL.ambar, "+1 descubrimiento");
      await m.decir(explicar(d.regla).detalle);
      await m.decir("Pero cada robo deja rastro: si un analista confirma la cuenta, el próximo golpe a ella cae al instante.");
    }

    await m.barras(true);
    m.descubrirYa();
    m.escena = fondoCabina;
    m.barraSuperior = { texto: `GOLPE ${n}/${MAX_INTENTOS} HUECOS ${huecos}`, color: PAL.rojoOscuro };
    m.musica("noche");
    await m.iris(false);
    if (n < MAX_INTENTOS) {
      const seguir = await m.pregunta(`Huecos encontrados: ${huecos}. ¿Otro golpe?`, [{ texto: "OTRO GOLPE", color: "#f4c7c3" }, { texto: "TERMINAR" }]);
      if (seguir === 1) break;
    }
  }

  await m.fundirA(true);
  m.musica("barrio");
  await vega(m, `Terminaste: ${intentos.length} ${intentos.length === 1 ? "intento" : "intentos"}, ${huecos} ${huecos === 1 ? "hueco" : "huecos"}.`);
  const ideas = ["Montos más chicos", "Otra cuenta nueva", "Otra táctica", "Otro horario", "Nada más"];
  const idea = await m.pregunta("Para el equipo de seguridad: ¿qué intentarías después?", ideas.map((x) => ({ texto: x.toUpperCase() })), VEGA);
  let guardada = false;
  try {
    await registrarPartida({ rol: "atacante", alias, intentos, ...(idea >= 0 && idea < ideas.length - 1 ? { idea: ideas[idea] } : {}) });
    guardada = true;
  } catch {
    // la partida sigue aunque no se guarde
  }
  await m.decir(
    guardada ? "Tus intentos ya aparecen en el MONITOR del evento. ¡Gracias por ayudarnos a encontrar huecos!" : "No pude guardar tu partida, pero gracias por ayudarnos a encontrar huecos.",
    VEGA,
  );
  await m.fundirA(true);
  return { texto: `${huecos}H`, color: huecos > 0 ? PAL.ambarOscuro : PAL.verdeOscuro };
}
