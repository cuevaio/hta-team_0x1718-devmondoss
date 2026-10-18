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
import {
  batalla,
  bodega,
  capitulo,
  laboratorio,
  nuevaBatalla,
  puntosBatalla,
  titulo,
  type EstadoBatalla,
  type EstadoBodega,
} from "./escenas";
import type { Motor } from "./motor";
import { TILE, posicionObjetivo, type ConfigMundo, type Npc } from "./mundo";
import { PAL, W, facil } from "./pincel";
import type { Direccion } from "./sprites";

/**
 * Guion del juego (docs/DEMO_JUEGO.md §3–4). Cada escena es una función
 * `async` que espera al jugador. Las decisiones del sistema salen siempre de
 * la API real; el juego solo las pone en escena.
 */

const VEGA = "ANALISTA VEGA";
const APP = "BANCO ANDINO";

type Siguiente = "victima" | "atacante" | null;

export async function jugar(m: Motor) {
  let alias: string | null = null;
  let siguiente: Siguiente = null;
  for (;;) {
    if (!siguiente) {
      m.barraSuperior = null;
      m.escena = titulo(m.t);
      m.musica("titulo");
      await m.fundirA(false);
      await m.esperarToque();
      await m.iris(true);
      m.descubrirYa();
      m.fundido = 1;
      if (!alias) alias = await intro(m);
    }
    const rol: "victima" | "atacante" = siguiente ?? (await elegirRol(m));
    try {
      siguiente = rol === "victima" ? await partidaVictima(m, alias!) : await partidaAtacante(m, alias!);
    } catch {
      m.barraSuperior = null;
      m.escena = laboratorio;
      m.musica("triste");
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
  m.musica("barrio");
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
  m.barraSuperior = null;
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  await m.decir("En el barrio pasan dos cosas: a la gente la estafan... y alguien está detrás.", VEGA);
  const i = await m.pregunta(
    "¿Qué lado quieres vivir?",
    [
      { texto: "VÍCTIMA", color: "#bfe8c9" },
      { texto: "ATACANTE", color: "#f4c7c3" },
    ],
    VEGA,
  );
  await m.fundirA(true);
  return i === 1 ? "atacante" : "victima";
}

async function tarjeta(m: Motor, etiqueta: string, titulo1: string, sub: string, color: string) {
  m.barraSuperior = null;
  m.escena = capitulo(m.t, etiqueta, titulo1, sub, color);
  await m.fundirA(false, 10);
  m.audio.sello();
  await m.esperarToque(3200);
  await m.fundirA(true, 12);
}

// ── El barrio ─────────────────────────────────────────────────

const NPCS = (atacante: boolean): Npc[] => [
  {
    id: "pepe",
    x: 2,
    y: 14,
    dir: "abajo",
    paleta: "pepe",
    nombre: "DON PEPE",
    lineas: atacante ? ["DON PEPE: Ya cerré, joven. Vuelve mañana."] : ["DON PEPE: ¡Buenas, Rosa! Hoy llegó mercadería fresca."],
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
          "VECINA: Dicen que casi la mitad de los usuarios digitales del Perú estuvo expuesta a estafas este año.",
        ],
  },
];

function mundo(atacante: boolean, objetivo: string, inicio: { x: number; y: number; dir: Direccion }): ConfigMundo {
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

let yaExplico = false;

/**
 * Lleva al jugador por el barrio hasta el objetivo. Se llama con la pantalla
 * en negro: el iris se abre desde ahí. Con `cerrar`, al llegar se cierra el
 * iris sobre la puerta (entrar a un edificio).
 */
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
  const estado: EstadoBodega = { telefono: "normal", cliente: 0 };
  m.escena = bodega(estado);
  m.musica("barrio");
  await m.iris(false, 96, 120);
  const entra = m.animar(40, (k) => {
    estado.cliente = k;
  });
  await m.decir("Son las seis. La bodega está llena y tu proveedor espera su pago.");
  await entra;
  await m.decir("Se registró un consumo de S/ 1,299 en tu tarjeta. Si no lo reconoces, te llamaremos.", "SMS");
  estado.cliente = 0;
  estado.telefono = "llamada";
  m.musica(null);
  m.audio.ring();
  m.vibrar([200, 100, 200, 100, 200]);
  m.sacudir(30);
  await m.decir("¡RIIING! ¡RIIING!");
  await m.decir("En la pantalla: «Seguridad Banco Andino».");

  await m.barras(true);
  const total = SEGUNDOS_LLAMADA * 60;
  const b = nuevaBatalla({ tiempoTotal: total, tiempoRestante: total });
  m.escena = batalla(b, m);
  m.musica("llamada");
  await entradaCombate(m, b);
  await m.decir("¡El ESTAFADOR te está llamando!");

  const rec: Recuento = { colgo: 0, esperoBanco: 0, bloqueo: false };
  for (let turno = 0; ; turno++) {
    const [nombre, frase] = MOVIMIENTOS[Math.min(turno, MOVIMIENTOS.length - 1)];
    await m.decir(`¡ESTAFADOR usó ${nombre}!`);
    await embestida(m, b);
    b.rivalBarra = Math.min(1, b.rivalBarra + 0.17);
    m.flotante("+PRESIÓN", 40, 60, PAL.rojo);
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
      { estilo: "combate", titulo: "¿Qué hará ROSA?", limiteCuadros: b.tiempoRestante },
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
      await m.decir("Llamas a la línea oficial de BANCO ANDINO...");
      await m.decir("«Su llamada es importante para nosotros. Tiempo de espera: 14 minutos.»", APP);
      b.tiempoRestante = Math.max(0, b.tiempoRestante - 10 * 60);
      m.flotante("-10s", 150, puntosBatalla(m.h).aliado.y - 30, PAL.rojo);
      m.musica("llamada");
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
        const ok = await m.pregunta(
          "AVISO: ¿Seguro que deseas continuar con esta operación?",
          [{ texto: "CONTINUAR", color: "#f4c7c3" }, { texto: "CANCELAR" }],
          APP,
        );
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
  await tarjeta(m, "RONDA 1 DE 2", "AVISO", "Genérico y simulado:\nFaceID, token y un\n«¿desea continuar?»", PAL.ambar);
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  await m.decir("Serás ROSA. Tiene una bodega en el barrio y hoy le toca pagarle a su proveedor, DON PEPE.", VEGA);
  await m.decir("En esta ronda el banco solo tiene FaceID, token y un aviso genérico. Es nuestra línea base SIMULADA, no un banco real.", VEGA);
  await m.fundirA(true);
  await caminar(m, mundo(false, "bodega", { x: 6, y: 5, dir: "izq" }), "tu bodega", "Ve a tu BODEGA.");

  // ── Ronda A: aviso genérico ──
  m.barraSuperior = { texto: "RONDA 1/2", color: PAL.ambarOscuro };
  const a = await llamada(m, "a", alias);
  const cayo = a.tipo === "cayo";
  const pts = puntosBatalla(m.h);
  if (cayo) {
    m.musica("triste");
    m.audio.monedas();
    m.vibrar([80, 50, 80, 50, 200]);
    m.particulas_(pts.aliado.x, pts.aliado.y, 36, { colores: [PAL.ambar, "#ffe08a", PAL.ambarOscuro], vel: 1, g: 0.02, vida: 50, tam: 3, haciaX: pts.rival.x, haciaY: pts.rival.y });
    a.b.aliadoLinea = "S/ 0";
    await m.sellar("ROBADO", PAL.rojo, `-${soles(ESTAFA_ROSA.monto)}`);
    await m.decir(`¡Salieron ${soles(ESTAFA_ROSA.monto)} de tu cuenta!`);
    await huida(m, a.b);
    await m.decir("El ESTAFADOR colgó. El número ya no existe.");
    await m.fundirA(true);
    m.escena = bodega({ telefono: "perdio", cliente: 0 });
    await m.fundirA(false);
    await m.decir("Bloqueas tu tarjeta: OK. Pero la transferencia ya salió. Bloquearla no la regresa.");
    await m.decir("Presentas un reclamo. El banco tiene hasta 15 días hábiles para responder.");
    await m.decir("... 15 días hábiles después ...");
    await m.decir("«La operación fue validada con su token digital.»", APP);
  } else {
    m.musica("barrio");
    await huida(m, a.b);
    await m.decir("El ESTAFADOR colgó... por ahora.");
    const r = a.rec;
    await m.decir(
      `No perdiste dinero. Pero fuiste tu propio equipo de seguridad: colgaste ${r.colgo} ${r.colgo === 1 ? "vez" : "veces"} y esperaste al banco ${r.esperoBanco} ${r.esperoBanco === 1 ? "vez" : "veces"}${r.bloqueo ? ", y bloqueaste tu tarjeta" : ""}. Y la bodega siguió llena.`,
    );
  }
  await m.fundirA(true);
  m.barraSuperior = null;
  m.escena = laboratorio;
  m.musica("triste");
  await m.fundirA(false);
  await m.decir("No fue tu culpa. Te autenticaste bien: el sistema esperaba que TÚ te dieras cuenta, bajo presión.", VEGA);
  await m.decir("En Perú, el 47% de usuarios de finanzas digitales estuvo expuesto a fraude o estafas en un año. El 21% de ellos perdió dinero. (SBS y CGAP, 2025)", VEGA);
  await m.decir("En 2026, Indecopi sancionó a un banco por una transferencia inusual de S/ 10,000: autenticar no lo eximía de monitorear.", VEGA);
  const caras = [1, 2, 3, 4, 5].map((n) => ({ texto: String(n) }));
  const frustracion = (await m.pregunta("¿Cuánta frustración sentiste?", caras, VEGA, { estilo: "caras", inicial: 2 })) + 1;
  await m.fundirA(true);

  // ── Ronda B: con nuestra capa ──
  await tarjeta(m, "RONDA 2 DE 2", "LA CAPA", "Mismo día, misma\nllamada... ahora con\nnuestros agentes.", PAL.verde);
  await caminar(m, mundo(false, "bodega", { x: 2, y: 5, dir: "arriba" }), "tu bodega", "Vuelve a tu BODEGA. Juega como quieras.");
  m.barraSuperior = { texto: "RONDA 2/2", color: PAL.verdeOscuro };

  const r = await llamada(m, "b", alias);
  let casoEstafa: Caso | null = null;
  if (r.tipo === "motor") {
    const b = r.b;
    casoEstafa = r.caso;
    b.congelado = true;
    m.musica(null);
    if (huboPausaPreventiva(r.caso)) {
      m.destello = 12;
      await m.sellar("RETENIDO", PAL.verde, "Antes de cualquier IA");
    }
    await m.decir("Nadie puede mover tu dinero ahora. El reloj del ESTAFADOR ya no sirve.");
    m.musica("guardian");
    await m.decir("¡Adelante, GUARDIÁN!");
    await cambiarAliado(m, b, "guardian");
    b.aliadoNombre = "GUARDIÁN";
    b.aliadoLinea = "A SALVO";
    await m.decir("¡GUARDIÁN entró al combate!");

    let actual = r.caso;
    for (let n = 0; n < 3 && preguntaPendiente(actual); n++) {
      await m.decir("«¡Dile que no! Dile que lo haces tú.»", "ESTAFADOR");
      const opciones = [{ texto: "SÍ, ME GUÍAN" }, { texto: "NO, LO HAGO YO" }, { texto: "NO RESPONDER" }];
      const i = await m.pregunta(preguntaPendiente(actual)!, opciones, "GUARDIÁN", { corta: "¿Qué le respondes al GUARDIÁN?" });
      actual = await responderGuardian(r.caso.id, RESPUESTAS_GUARDIAN[Math.max(0, i)].texto);
      if (actual.salidas.guardian) {
        b.rivalBarra = Math.max(0, b.rivalBarra - 0.4);
        m.flotante("-PRESIÓN", 40, 60, PAL.verde);
      }
    }
    const d = actual.decision!;
    if (retiene(d.accion)) {
      b.rivalBarra = 0;
      b.rivalGolpe = 20;
      m.audio.golpe();
      await huida(m, b);
      m.audio.exito();
      m.confeti();
      await m.decir("¡El ESTAFADOR huyó!");
      await m.decir(`Tus ${soles(ESTAFA_ROSA.monto)} siguen en tu cuenta. La transferencia nunca se ejecutó.`);
      await m.decir(explicar(d.regla).detalle, "GUARDIÁN");
      await m.decir("Mentir no servía: la cuenta destino te delataba. Y nunca te pedí tu clave, tu token ni tu tarjeta.", "GUARDIÁN");
    } else {
      m.audio.fallo();
      await m.decir("La operación pasó. Es un fallo del sistema, no tuyo: lo registramos.");
    }
  } else {
    await huida(m, r.b);
    await m.decir("El ESTAFADOR colgó. No transferiste nada en esta ronda.");
  }

  // ── Pago legítimo a Don Pepe ──
  await m.barras(true);
  m.descubrirYa();
  m.fundido = 1;
  await caminar(m, mundo(false, "pepe", { x: 2, y: 5, dir: "abajo" }), "Don Pepe", "Ahora págale a DON PEPE en el MERCADO.", false);
  await m.decir("¡Hola, Rosa! Son S/ 380 de la mercadería de hoy.", "DON PEPE");
  await m.pregunta("¿Pagarle a DON PEPE?", [{ texto: "PAGAR S/ 380", color: "#bfe8c9" }]);
  const pago = await transferir({ transaccion: { ...PAGO_PROVEEDOR, moneda: "PEN" }, alias });
  if (pago.decision && !retiene(pago.decision.accion)) {
    m.audio.exito();
    await m.sellar("PAGADO", PAL.verde, "Al instante, sin preguntas", 1100);
    await m.decir("Es tu proveedor de siempre: el sistema no te molestó.", APP);
    await m.decir("¡Gracias, casera!", "DON PEPE");
  } else {
    await m.decir("El pago quedó retenido: es un falso positivo y lo registramos como tal.", APP);
  }

  // ── Encuesta (dentro del juego) ──
  await m.fundirA(true);
  m.barraSuperior = null;
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
  await m.decir(`¡Bien jugado, ${alias}! Dos preguntas rápidas.`, VEGA);
  const molesto = await m.pregunta("¿La pausa de seguridad te molestó?", [{ texto: "NO" }, { texto: "UN POCO" }, { texto: "MUCHO" }], VEGA);
  const activaria = await m.pregunta(
    "¿Activarías esta protección en tu banco, aunque a veces retrase un pago?",
    [{ texto: "SÍ", color: "#bfe8c9" }, { texto: "NO" }, { texto: "NO SÉ" }],
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
    [{ texto: otro === "atacante" ? "SER ATACANTE" : "SER VÍCTIMA", color: otro === "atacante" ? "#f4c7c3" : "#bfe8c9" }, { texto: "VOLVER AL TÍTULO" }],
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
    TACTICAS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.gancho} ${x.comun}.`, color: x.dificil ? "#f4dcc3" : undefined })),
    { titulo: "¿Qué táctica?" },
  );
  const d = await m.menu(
    DESTINOS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${x.detalle}.` })),
    { titulo: "¿A qué cuenta va?" },
  );
  const mo = await m.menu(
    MONTOS.map((x) => ({ texto: x.nombre.toUpperCase(), info: `${x.nombre}: ${soles(x.monto)}.` })),
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
  await tarjeta(m, "MODO ATACANTE", "LA BANDA", "Tu misión: encontrar\nhuecos. No robar.\nTienes 5 intentos.", PAL.rojo);
  m.escena = laboratorio;
  m.musica("noche");
  await m.fundirA(false);
  await m.decir("Ahora estás del otro lado: eres parte de una BANDA (ficticia).", VEGA);
  await m.decir("Tienes lo que tienen las bandas reales: datos filtrados, cuentas «alquiladas» y un teléfono.", VEGA);
  await m.decir("Las tácticas son las que difunden las campañas de la SBS y ASBANC. Sin guiones reales.", VEGA);
  await m.fundirA(true);
  await caminar(m, mundo(true, "cabina", { x: 6, y: 5, dir: "izq" }), "la cabina", "De noche. Ve a la CABINA telefónica para armar tu golpe.", false);
  const fondoCabina = m.escena;

  const intentos: Array<{ caso: string; tactica: string }> = [];
  let huecos = 0;
  for (let n = 1; n <= MAX_INTENTOS; n++) {
    m.escena = fondoCabina;
    m.musica("noche");
    m.barraSuperior = { texto: `GOLPE ${n}/${MAX_INTENTOS} HUECOS ${huecos}`, color: PAL.rojoOscuro };
    const jugada = await planear(m);
    const tactica = TACTICAS.find((x) => x.id === jugada.tactica)!;
    const victima = VICTIMAS.find((x) => x.id === jugada.victima)!;
    const ok = await m.pregunta(
      `${tactica.nombre} contra ${victima.nombre}, ${soles(jugada.monto)} a la ${DESTINOS.find((x) => x.id === jugada.destino)!.nombre}${jugada.madrugada ? ", de madrugada" : ""}.`,
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
    await m.decir(`¡Lanzaste ${tactica.nombre.toUpperCase()} contra ${victima.nombre.toUpperCase()}!`);
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
      if (pts !== null) m.flotante(`+${pts}`, 100, 46, PAL.ambar);
      await m.decir(`Las REGLAS detectaron: ${SENALES[s] ?? s}${pts !== null ? ` (+${pts})` : ""}.`);
    }
    if (huboPausaPreventiva(caso)) {
      m.destello = 10;
      await m.sellar("RETENIDO", PAL.ambarOscuro, `Riesgo ${caso.nivel0.score}, sin IA aún`);
      await m.decir("El dinero quedó RETENIDO antes de llamar a ninguna IA.");
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
  m.barraSuperior = null;
  m.escena = laboratorio;
  m.musica("barrio");
  await m.fundirA(false);
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
