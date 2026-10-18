import type { Caso } from "@/lib/contracts";
import { motivoAliasInvalido } from "@/lib/juego/alias";
import { registrarPartida, responderGuardian, transferir } from "@/components/juego/api";
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
  soles,
  type Jugada,
} from "@/components/juego/datos";
import { batalla, bodega, laboratorio, nuevaBatalla, titulo, type EstadoBatalla, type EstadoBodega } from "./escenas";
import type { Motor } from "./motor";
import type { ConfigMundo, Npc } from "./mundo";
import { PAL } from "./pincel";
import type { Direccion } from "./sprites";

/**
 * Guion del juego (docs/DEMO_JUEGO.md §3–4). Cada escena es una función
 * `async` que espera al jugador. Las decisiones del sistema salen siempre de
 * la API real; el juego solo las pone en escena.
 */

const VEGA = "ANALISTA VEGA";
const APP = "APP BANCO ANDINO";

type Siguiente = "victima" | "atacante" | null;

export async function jugar(m: Motor) {
  let alias: string | null = null;
  let siguiente: Siguiente = null;
  for (;;) {
    if (!siguiente) {
      m.escena = titulo;
      await m.fundirA(false);
      await m.esperarA();
      await m.fundirA(true);
      if (!alias) alias = await intro(m);
    }
    const rol: "victima" | "atacante" = siguiente ?? (await elegirRol(m));
    try {
      siguiente = rol === "victima" ? await partidaVictima(m, alias!) : await partidaAtacante(m, alias!);
    } catch {
      m.escena = laboratorio;
      await m.fundirA(false);
      await m.decir("Se perdió la conexión con el sistema. Volvamos al inicio.", VEGA);
      await m.fundirA(true);
      siguiente = null;
    }
  }
}

// ── Intro ─────────────────────────────────────────────────────

function validarAlias(alias: string): string | null {
  const motivo = motivoAliasInvalido(alias);
  if (!motivo) return null;
  return motivo.replace(/^el alias/, "El apodo").replace("no puede contener un número de teléfono", "no puede ser un teléfono");
}

async function intro(m: Motor): Promise<string> {
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir("¡Hola! Soy la ANALISTA VEGA. Estudio cómo le roban a la gente del barrio... y cómo evitarlo.", VEGA);
  await m.decir("Esto es una SIMULACIÓN: el dinero, el banco y las personas son ficticios.", VEGA);
  await m.decir("Guardamos tus elecciones de forma anónima. Nunca te pediremos tu nombre real, DNI ni datos bancarios.", VEGA);
  await m.decir("Puede generar tensión. Y si alguna vez te pasó de verdad: no fue tu culpa.", VEGA);
  await m.decir("Primero, ¿cómo te llamo? Usa un apodo.", VEGA);
  await m.fundirA(true);
  const pidiendo = m.nombre(validarAlias);
  await m.fundirA(false);
  const nombre = await pidiendo;
  await m.fundirA(true);
  await m.fundirA(false);
  await m.decir(`¡Mucho gusto, ${nombre}!`, VEGA);
  return nombre;
}

async function elegirRol(m: Motor): Promise<"victima" | "atacante"> {
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir("En el barrio pasan dos cosas: a la gente la estafan... y alguien está detrás.", VEGA);
  const i = await m.pregunta("¿Qué lado quieres vivir?", [{ texto: "VÍCTIMA" }, { texto: "ATACANTE" }], VEGA);
  await m.fundirA(true);
  return i === 1 ? "atacante" : "victima";
}

// ── El barrio ─────────────────────────────────────────────────

const NPCS = (atacante: boolean): Npc[] => [
  {
    id: "pepe",
    x: 2,
    y: 8,
    dir: "abajo",
    paleta: "pepe",
    nombre: "DON PEPE",
    lineas: atacante
      ? ["DON PEPE: Ya cerré, joven. Vuelve mañana."]
      : ["DON PEPE: ¡Buenas, Rosa! Hoy llegó mercadería fresca."],
  },
  {
    id: "vecina",
    x: 11,
    y: 8,
    dir: "izq",
    paleta: "vecina",
    nombre: "VECINA",
    lineas: atacante
      ? ["VECINA: ...¿y tú qué miras? Ya es tarde."]
      : [
          "VECINA: ¿Supiste? A la señora de la esquina la llamaron haciéndose pasar por el banco.",
          "VECINA: Dicen que casi la mitad de los usuarios digitales del Perú estuvo expuesta a estafas este año.",
        ],
  },
];

function mundo(
  atacante: boolean,
  objetivo: string,
  inicio: { x: number; y: number; dir: Direccion },
): ConfigMundo {
  return {
    jugador: atacante ? "atacante" : "rosa",
    inicio,
    noche: atacante,
    objetivo,
    npcs: NPCS(atacante),
    puertas: {
      bodega: atacante ? ["La bodega de Rosa. Está cerrada."] : ["Tu bodega. Ahora no es momento de entrar."],
      banco: ["BANCO ANDINO (ficticio). La agencia está cerrada: hoy todo se hace por la app."],
      hotel: ["HOTEL SOL ANDINO. Una huésped, Lucía, está de viaje y sin señal."],
      cabina: atacante ? [] : ["Una cabina telefónica. Casi nadie la usa... casi."],
    },
  };
}

async function caminar(m: Motor, cfg: ConfigMundo, aviso: string) {
  const llegada = m.explorar(cfg);
  await m.fundirA(false);
  await m.decir(aviso, "OBJETIVO");
  await llegada;
  await m.fundirA(true);
}

// ── Transiciones ──────────────────────────────────────────────

async function transicionCombate(m: Motor) {
  for (let i = 0; i < 3; i++) {
    m.fundido = 1;
    await m.esperar(70);
    m.fundido = 0;
    await m.esperar(70);
  }
  await m.fundirA(true, 12);
}

async function cambiarAliado(m: Motor, b: EstadoBatalla, nuevo: EstadoBatalla["aliado"]) {
  await m.animar(14, (k) => {
    b.aliadoX = -120 * k;
  });
  b.aliado = nuevo;
  await m.animar(14, (k) => {
    b.aliadoX = -120 * (1 - k);
  });
}

// ══ VÍCTIMA ═══════════════════════════════════════════════════

type Recuento = { colgo: number; esperoBanco: number; bloqueo: boolean };
type ResultadoLlamada =
  | { tipo: "tiempo"; rec: Recuento; b: EstadoBatalla }
  | { tipo: "cayo"; rec: Recuento; b: EstadoBatalla }
  | { tipo: "motor"; caso: Caso; rec: Recuento; b: EstadoBatalla };

const MOVIMIENTOS: Array<[string, string]> = [
  ["SALUDO OFICIAL", "Buenas tardes, señora Rosa. Le hablamos del área de seguridad de Banco Andino."],
  ["DATOS FILTRADOS", "Ya validamos sus datos: su DNI termina en 47."],
  ["MIEDO", "Detectamos un consumo que usted no hizo. Sus ahorros están en riesgo."],
  ["URGENCIA", "Muévalos YA a una cuenta de resguardo o su cuenta se bloquea."],
  ["INSISTENCIA", "Señora, no cuelgue. Es por su seguridad."],
];

async function llamada(m: Motor, ronda: "a" | "b", alias: string): Promise<ResultadoLlamada> {
  const estado: EstadoBodega = { telefono: "normal", cliente: false };
  m.escena = bodega(estado);
  await m.fundirA(false);
  await m.decir("Son las seis. La bodega está llena y tu proveedor espera su pago.");
  await m.decir("Se registró un consumo de S/ 1,299 en tu tarjeta. Si no lo reconoces, te llamaremos.", "SMS");
  estado.telefono = "llamada";
  m.sonido.ring();
  m.sacudir(30);
  await m.decir("¡RIIING! ¡RIIING!");
  await m.decir("En la pantalla: «Seguridad Banco Andino».");
  await transicionCombate(m);

  const total = SEGUNDOS_LLAMADA * 60;
  const b = nuevaBatalla({ tiempoTotal: total, tiempoRestante: total });
  m.escena = batalla(b, m);
  await m.fundirA(false);
  await m.decir("¡El ESTAFADOR te está llamando!");

  const rec: Recuento = { colgo: 0, esperoBanco: 0, bloqueo: false };
  for (let turno = 0; ; turno++) {
    const [nombre, frase] = MOVIMIENTOS[Math.min(turno, MOVIMIENTOS.length - 1)];
    await m.decir(`¡ESTAFADOR usó ${nombre}!`);
    m.sonido.golpe();
    m.sacudir(10);
    b.rivalBarra = Math.min(1, b.rivalBarra + 0.17);
    await m.decir(`«${frase}»`, "ESTAFADOR");

    if (turno % 3 === 2) {
      await m.decir("¡Un cliente te pide su vuelto! Le atiendes y pierdes unos segundos.");
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 4 * 60);
    }
    if (b.tiempoRestante <= 0) return { tipo: "tiempo", rec, b };

    const inicio = m.t;
    const i = await m.menu(
      [{ texto: "TRANSFERIR" }, { texto: "COLGAR" }, { texto: "LLAMAR BANCO" }, { texto: "BLOQUEAR" }],
      { cols: 2, caja: { x: 2, y: 108, w: 236, h: 50 }, titulo: "¿Qué hará ROSA?", limiteFrames: b.tiempoRestante },
    );
    b.tiempoRestante = Math.max(0, b.tiempoRestante - (m.t - inicio));
    if (i === -2) return { tipo: "tiempo", rec, b };

    if (i === 1) {
      rec.colgo++;
      await m.decir("Colgaste.");
      m.sonido.ring();
      m.sacudir(16);
      await m.decir("¡El ESTAFADOR volvió a llamar!");
    } else if (i === 2) {
      rec.esperoBanco++;
      await m.decir("Llamas a la línea oficial de BANCO ANDINO...");
      await m.decir("«Su llamada es importante para nosotros. Tiempo de espera: 14 minutos.»", "BANCO ANDINO");
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 10 * 60);
      await m.decir("Mientras esperabas, ¡el ESTAFADOR volvió a entrar a la línea!");
    } else if (i === 3) {
      if (!rec.bloqueo) {
        rec.bloqueo = true;
        await m.decir("Bloqueaste tu tarjeta en la app. OK.");
        await m.decir("«Bloquear la tarjeta no protege sus ahorros, señora.»", "ESTAFADOR");
      } else {
        await m.decir("Tu tarjeta ya está bloqueada.");
      }
    } else {
      await m.decir(`TRANSFERIR ${soles(ESTAFA_ROSA.monto)} a: CUENTA DE RESGUARDO (beneficiario nuevo).`, APP);
      await m.decir("FaceID... OK. Eres tú.", APP);
      await m.decir("Token digital... OK.", APP);
      if (ronda === "a") {
        const ok = await m.pregunta("AVISO: ¿Seguro que deseas continuar con esta operación?", [{ texto: "CONTINUAR" }, { texto: "CANCELAR" }], APP);
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
          await m.decir("No hubo conexión con el banco. Intenta otra vez.", APP);
        }
      }
    }
    if (b.tiempoRestante <= 0) return { tipo: "tiempo", rec, b };
  }
}

async function partidaVictima(m: Motor, alias: string): Promise<Siguiente> {
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir("Serás ROSA. Tiene una bodega en el barrio y hoy le toca pagarle a su proveedor, DON PEPE.", VEGA);
  await m.decir("RONDA 1 de 2: el banco solo tiene FaceID, token y un aviso genérico. Es nuestra línea base SIMULADA, no un banco real.", VEGA);
  await m.fundirA(true);

  await caminar(m, mundo(false, "bodega", { x: 8, y: 5, dir: "izq" }), "Ve a tu BODEGA. Camina con la cruceta.");

  // ── Ronda A: aviso genérico ──
  const a = await llamada(m, "a", alias);
  const cayo = a.tipo === "cayo";
  if (cayo) {
    m.sonido.fallo();
    a.b.aliadoLinea = "S/ 0";
    await m.decir(`¡Salieron ${soles(ESTAFA_ROSA.monto)} de tu cuenta!`);
    await m.animar(20, (k) => {
      a.b.rivalVisible = 1 - k;
    });
    await m.decir("El ESTAFADOR colgó. El número ya no existe.");
    await m.fundirA(true);
    m.escena = bodega({ telefono: "perdio", cliente: false });
    await m.fundirA(false);
    await m.decir("Bloqueas tu tarjeta: OK. Pero la transferencia ya salió. Bloquear la tarjeta no la regresa.");
    await m.decir("Presentas un reclamo. El banco tiene hasta 15 días hábiles para responder.");
    await m.decir("... 15 días hábiles después ...");
    await m.decir("«La operación fue validada con su token digital.»", "BANCO ANDINO");
  } else {
    await m.decir("El ESTAFADOR colgó... por ahora.");
    const r = a.rec;
    await m.decir(
      `No perdiste dinero. Pero fuiste tu propio equipo de seguridad: colgaste ${r.colgo} ${r.colgo === 1 ? "vez" : "veces"} y esperaste en la línea oficial ${r.esperoBanco} ${r.esperoBanco === 1 ? "vez" : "veces"}${r.bloqueo ? ", y bloqueaste tu tarjeta" : ""}. Y la bodega siguió llena.`,
    );
  }
  await m.fundirA(true);
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir("No fue tu culpa. Te autenticaste bien: el sistema esperaba que TÚ te dieras cuenta, bajo presión.", VEGA);
  await m.decir("En Perú, el 47% de usuarios de finanzas digitales estuvo expuesto a fraude o estafas en un año. El 21% de ellos perdió dinero. (SBS y CGAP, 2025)", VEGA);
  await m.decir("En 2026, Indecopi sancionó a un banco por una transferencia inusual de S/ 10,000: autenticar no lo eximía de monitorear.", VEGA);
  const caras = [{ texto: "1" }, { texto: "2" }, { texto: "3" }, { texto: "4" }, { texto: "5" }];
  const frustracion = (await m.pregunta("¿Cuánta frustración sentiste?", caras, VEGA, { estilo: "caras", inicial: 2 })) + 1;

  // ── Ronda B: con nuestra capa ──
  await m.decir("RONDA 2 de 2: el mismo día, la misma llamada... pero tu banco tiene NUESTRA CAPA de agentes.", VEGA);
  await m.decir("Juega como quieras. Esta vez la operación pasa por el sistema real.", VEGA);
  await m.fundirA(true);
  await caminar(m, mundo(false, "bodega", { x: 2, y: 5, dir: "arriba" }), "Vuelve a tu BODEGA.");

  const r = await llamada(m, "b", alias);
  let casoEstafa: Caso | null = null;
  if (r.tipo === "motor") {
    const b = r.b;
    casoEstafa = r.caso;
    if (huboPausaPreventiva(r.caso)) {
      m.sonido.exito();
      b.destello = 14;
      await m.decir("¡ALTO! La operación quedó RETENIDA antes de ejecutarse.");
    }
    b.congelado = true;
    await m.decir("Nadie puede mover tu dinero ahora. El reloj del ESTAFADOR ya no sirve.");
    await m.decir("¡Adelante, GUARDIÁN!");
    await cambiarAliado(m, b, "guardian");
    b.aliadoNombre = "GUARDIÁN";
    b.aliadoLinea = "S/ 4,800 a salvo";
    await m.decir("¡GUARDIÁN entró al combate!");

    let actual = r.caso;
    for (let n = 0; n < 3 && preguntaPendiente(actual); n++) {
      await m.decir("«¡Dile que no! Dile que lo haces tú.»", "ESTAFADOR");
      const opciones = [{ texto: "SÍ, ME GUÍAN" }, { texto: "NO, LO HAGO YO" }, { texto: "NO RESPONDER" }];
      const i = await m.pregunta(preguntaPendiente(actual)!, opciones, "GUARDIÁN", { corta: "¿Qué le respondes al GUARDIÁN?" });
      actual = await responderGuardian(r.caso.id, RESPUESTAS_GUARDIAN[Math.max(0, i)].texto);
    }
    const d = actual.decision!;
    if (retiene(d.accion)) {
      m.sonido.exito();
      b.rivalBarra = 0;
      await m.animar(24, (k) => {
        b.rivalVisible = 1 - k;
      });
      await m.decir("¡El ESTAFADOR huyó!");
      await m.decir(`Tus ${soles(ESTAFA_ROSA.monto)} siguen en tu cuenta. La transferencia nunca se ejecutó.`);
      await m.decir(explicar(d.regla).detalle, "GUARDIÁN");
      await m.decir("Mentir no servía: la cuenta destino te delataba. Y nunca te pedí tu clave, tu token ni tu tarjeta.", "GUARDIÁN");
    } else {
      m.sonido.fallo();
      await m.decir("La operación pasó. Es un fallo del sistema, no tuyo: lo registramos.");
    }
  } else {
    await m.decir("El ESTAFADOR colgó. No transferiste nada en esta ronda.");
  }

  // ── Pago legítimo a Don Pepe ──
  await m.fundirA(true);
  await caminar(m, mundo(false, "pepe", { x: 2, y: 4, dir: "abajo" }), "Ahora págale a DON PEPE en el MERCADO.");
  await m.fundirA(false);
  await m.decir("¡Hola, Rosa! Son S/ 380 de la mercadería de hoy.", "DON PEPE");
  await m.pregunta("¿Pagarle a DON PEPE?", [{ texto: "PAGAR S/ 380" }]);
  const pago = await transferir({ transaccion: { ...PAGO_PROVEEDOR, moneda: "PEN" }, alias });
  if (pago.decision && !retiene(pago.decision.accion)) {
    m.sonido.exito();
    await m.decir("¡Pago exitoso al instante! Sin preguntas: es tu proveedor de siempre.", APP);
    await m.decir("¡Gracias, casera!", "DON PEPE");
  } else {
    await m.decir("El pago quedó retenido: es un falso positivo y lo registramos como tal.", APP);
  }

  // ── Encuesta (dentro del juego) ──
  await m.fundirA(true);
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir(`¡Bien jugado, ${alias}! Dos preguntas rápidas.`, VEGA);
  const molesto = await m.pregunta("¿La pausa de seguridad te molestó?", [{ texto: "NO" }, { texto: "UN POCO" }, { texto: "MUCHO" }], VEGA);
  const activaria = await m.pregunta(
    "¿Activarías esta protección en tu banco, aunque a veces retrase un pago?",
    [{ texto: "SÍ" }, { texto: "NO" }, { texto: "NO SÉ" }],
    VEGA,
  );
  try {
    await registrarPartida({
      rol: "victima",
      alias,
      ronda_a: { cayo, frustracion },
      // Solo la estafa: un PERMITIR aquí cuenta como «perdió dinero».
      ronda_b: { casos: casoEstafa ? [casoEstafa.id] : [], pausa_molesto: (["no", "un_poco", "mucho"] as const)[molesto] },
      activaria: (["si", "no", "no_se"] as const)[activaria],
    });
  } catch {
    await m.decir("No pude guardar tu partida, pero gracias por jugar.", VEGA);
  }
  const protegido = casoEstafa?.decision && retiene(casoEstafa.decision.accion);
  await m.decir(
    `${cayo ? "Con el aviso genérico perdiste el dinero." : "Con el aviso genérico resististe, a puro esfuerzo."} ${protegido ? "Con nuestra capa, el dinero no salió aunque la presión fue la misma." : ""}`,
    VEGA,
  );
  await m.decir("Tu partida ya aparece, anónima, en el MONITOR del evento.", VEGA);
  return finDePartida(m, "atacante");
}

async function finDePartida(m: Motor, otro: "victima" | "atacante"): Promise<Siguiente> {
  const i = await m.pregunta(
    "¿Y ahora?",
    [{ texto: otro === "atacante" ? "SER ATACANTE" : "SER VÍCTIMA" }, { texto: "IR AL TÍTULO" }],
    VEGA,
  );
  await m.fundirA(true);
  return i === 0 ? otro : null;
}

// ══ ATACANTE ══════════════════════════════════════════════════

async function planear(m: Motor): Promise<Jugada> {
  const v = await m.menu(
    VICTIMAS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${x.situacion}.` })),
    { titulo: "¿A quién apuntas?" },
  );
  const t = await m.menu(
    TACTICAS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.gancho} ${x.comun}.` })),
    { titulo: "¿Qué táctica?" },
  );
  const d = await m.menu(
    DESTINOS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${x.detalle}.` })),
    { titulo: "¿A qué cuenta va el dinero?" },
  );
  const mo = await m.menu(
    MONTOS.map((x) => ({ texto: `${x.nombre.toUpperCase()}`, info: `${x.nombre}: ${soles(x.monto)}.` })),
    { titulo: "¿Cuánto?" },
  );
  const h = await m.menu(
    [
      { texto: "DE DÍA", info: "A plena luz, cuando la víctima está ocupada." },
      { texto: "DE MADRUGADA", info: "Cuando nadie mira. Un horario raro también es una señal." },
    ],
    { titulo: "¿Cuándo?" },
  );
  return {
    victima: VICTIMAS[v].id,
    tactica: TACTICAS[t].id,
    destino: DESTINOS[d].id,
    monto: MONTOS[mo].monto,
    madrugada: h === 1,
  };
}

const AGENTES: Record<string, { inicial: string; color: string; texto: string }> = {
  memoria: { inicial: "M", color: PAL.ambar, texto: "¡MEMORIA reconoció la cuenta: un analista ya la confirmó como mula!" },
  coordinador: { inicial: "C", color: PAL.celeste, texto: "¡COORDINADOR entró: decide qué agentes hacen falta!" },
  guardian: { inicial: "G", color: PAL.verde, texto: "¡GUARDIÁN entró: le pregunta a la víctima por un canal seguro!" },
  detective: { inicial: "D", color: "#9ab8ff", texto: "¡DETECTIVE entró: investiga la cuenta que recibe el dinero!" },
  auditor: { inicial: "A", color: PAL.crema, texto: "¡AUDITOR entró: arma el expediente con evidencia!" },
};

async function partidaAtacante(m: Motor, alias: string): Promise<Siguiente> {
  m.escena = laboratorio;
  await m.fundirA(false);
  await m.decir("Ahora estás del otro lado: eres parte de una BANDA (ficticia).", VEGA);
  await m.decir("Tienes lo que tienen las bandas reales: datos filtrados, cuentas «alquiladas» y un teléfono.", VEGA);
  await m.decir(`Tu misión NO es robar: es encontrar HUECOS en el sistema. Tienes ${MAX_INTENTOS} intentos.`, VEGA);
  await m.decir("Las tácticas son las que difunden las campañas de la SBS y ASBANC. Sin guiones reales.", VEGA);
  await m.fundirA(true);
  await caminar(m, mundo(true, "cabina", { x: 8, y: 5, dir: "izq" }), "De noche. Ve a la CABINA telefónica para armar tu golpe.");
  const fondoCabina = m.escena;
  m.escena = fondoCabina;
  await m.fundirA(false);

  const intentos: Array<{ caso: string; tactica: string }> = [];
  let huecos = 0;
  for (let n = 1; n <= MAX_INTENTOS; n++) {
    m.escena = fondoCabina;
    await m.decir(`Intento ${n} de ${MAX_INTENTOS}. Arma el golpe.`);
    const jugada = await planear(m);
    const tactica = TACTICAS.find((x) => x.id === jugada.tactica)!;
    const victima = VICTIMAS.find((x) => x.id === jugada.victima)!;
    const ok = await m.pregunta(
      `${tactica.nombre} contra ${victima.nombre}, ${soles(jugada.monto)} a la ${DESTINOS.find((x) => x.id === jugada.destino)!.nombre}${jugada.madrugada ? ", de madrugada" : ""}. ¿Ejecutar?`,
      [{ texto: "EJECUTAR" }, { texto: "CAMBIAR" }],
    );
    if (ok !== 0) {
      n--;
      continue;
    }

    await transicionCombate(m);
    const b = nuevaBatalla({
      fondo: "sistema",
      rival: "banco",
      rivalNombre: "SISTEMA",
      rivalEtiqueta: "RIESGO",
      rivalBarra: 0,
      rivalColor: PAL.ambar,
      aliado: "atacante",
      aliadoNombre: alias.toUpperCase(),
      aliadoEtiqueta: `INTENTO ${n}/${MAX_INTENTOS}`,
      aliadoLinea: `HUECOS: ${huecos}`,
    });
    m.escena = batalla(b, m);
    await m.fundirA(false);
    await m.decir(`¡Lanzaste ${tactica.nombre.toUpperCase()} contra ${victima.nombre.toUpperCase()}!`);
    m.sonido.golpe();
    m.sacudir(12);

    const caso = await transferir(armarTransferencia(jugada, alias));
    intentos.push({ caso: caso.id, tactica: jugada.tactica });

    let acumulado = 0;
    if (caso.nivel0.senales.length === 0) await m.decir("Las REGLAS no vieron ninguna señal de riesgo.");
    for (const s of caso.nivel0.senales) {
      const pts = puntosDe(s);
      acumulado += pts ?? 0;
      b.rivalBarra = Math.min(1, acumulado / 8);
      m.sonido.mover();
      await m.decir(`Las REGLAS detectaron: ${SENALES[s] ?? s}${pts !== null ? ` (+${pts})` : ""}.`);
    }
    if (huboPausaPreventiva(caso)) {
      b.destello = 12;
      m.sonido.confirmar();
      await m.decir(`¡RIESGO ${caso.nivel0.score}! El dinero quedó RETENIDO antes de llamar a ninguna IA.`);
    }
    for (const actor of actoresDe(caso)) {
      const ag = AGENTES[actor];
      if (!ag) continue;
      b.agentes.push({ inicial: ag.inicial, color: ag.color });
      m.sonido.mover();
      await m.decir(ag.texto);
    }

    const d = caso.decision!;
    if (retiene(d.accion)) {
      b.rivalBarra = 1;
      m.sonido.fallo();
      await m.decir(`¡El SISTEMA frenó tu golpe! ${explicar(d.regla).titulo}.`);
      await m.decir(explicar(d.regla).detalle);
      if (caso.ia.llamadas === 0) await m.decir("Gasto de IA para frenarte: 0 llamadas.");
    } else {
      huecos++;
      b.aliadoLinea = `HUECOS: ${huecos}`;
      m.sonido.exito();
      await m.decir("¡Encontraste un HUECO! +1 DESCUBRIMIENTO.");
      await m.decir(explicar(d.regla).detalle);
      await m.decir("Pero cada robo deja rastro: si un analista confirma la cuenta, el próximo golpe a ella cae al instante.");
    }

    await m.fundirA(true);
    m.escena = fondoCabina;
    await m.fundirA(false);
    if (n < MAX_INTENTOS) {
      const seguir = await m.pregunta(`Huecos encontrados: ${huecos}. ¿Otro golpe?`, [{ texto: "OTRO GOLPE" }, { texto: "TERMINAR" }]);
      if (seguir === 1) break;
    }
  }

  m.escena = laboratorio;
  await m.decir(`Terminaste: ${intentos.length} ${intentos.length === 1 ? "intento" : "intentos"}, ${huecos} ${huecos === 1 ? "hueco" : "huecos"}.`, VEGA);
  const ideas = ["Montos más chicos", "Otra cuenta nueva", "Otra táctica", "Otro horario", "Nada más"];
  const idea = await m.pregunta(
    "Para el equipo de seguridad: ¿qué intentarías después?",
    ideas.map((x) => ({ texto: x.toUpperCase() })),
    VEGA,
  );
  try {
    await registrarPartida({
      rol: "atacante",
      alias,
      intentos,
      ...(idea >= 0 && idea < ideas.length - 1 ? { idea: ideas[idea] } : {}),
    });
  } catch {
    await m.decir("No pude guardar tu partida, pero gracias por jugar.", VEGA);
  }
  await m.decir("Tus intentos ya aparecen en el MONITOR del evento. ¡Gracias por ayudarnos a encontrar huecos!", VEGA);
  return finDePartida(m, "victima");
}
