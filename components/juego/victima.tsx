"use client";

import { useState } from "react";
import type { Caso } from "@/lib/contracts";
import s from "./juego.module.css";
import EscenaBodega, { type EstadoEscena } from "./escena-bodega";
import Llamada, { type Recuento } from "./llamada";
import { registrarPartida, responderGuardian, transferir } from "./api";
import {
  ESTAFA_ROSA,
  FRUSTRACION,
  PAGO_PROVEEDOR,
  RESPUESTAS_GUARDIAN,
  SEGUNDOS_LLAMADA,
  explicar,
  huboPausaPreventiva,
  preguntaPendiente,
  retiene,
  soles,
} from "./datos";

/**
 * Rol víctima (DEMO_JUEGO §3): el mismo ataque dos veces.
 *
 *  - Ronda A, «aviso genérico (simulado)»: autenticación + un «¿desea
 *    continuar?». No llama al motor; es la línea base del experimento E3.
 *  - Ronda B, «con nuestra capa»: la transferencia va al pipeline real
 *    (`/api/transfers`) y el Guardián conversa por `/guardian/reply`.
 */

type Fase =
  | "a_intro"
  | "a_llamada"
  | "a_desenlace"
  | "a_frustracion"
  | "b_intro"
  | "b_llamada"
  | "b_guardian"
  | "b_resultado"
  | "b_proveedor"
  | "encuesta"
  | "fin";

type Auth = null | "pidiendo" | "faceid" | "token" | "aviso";

function Autenticacion({
  paso,
  onConfirmar,
  onCancelar,
  onContinuar,
}: {
  paso: Exclude<Auth, null>;
  onConfirmar: () => void;
  onCancelar: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className={s.celular}>
      <div className={s.pantalla}>
        <strong>Banco Andino · Transferir</strong>
        <p className={s.texto}>
          {soles(ESTAFA_ROSA.monto)} a <strong>Cuenta de resguardo</strong> (beneficiario nuevo)
        </p>
        {paso === "pidiendo" && (
          <div className={s.botones}>
            <button className={s.boton} onClick={onConfirmar}>
              🙂 Confirmar con FaceID
            </button>
            <button className={`${s.boton} ${s.botonSecundario}`} onClick={onCancelar}>
              Volver a la llamada
            </button>
          </div>
        )}
        {(paso === "faceid" || paso === "token" || paso === "aviso") && (
          <span className={s.check}>✔ FaceID correcto: eres tú</span>
        )}
        {(paso === "token" || paso === "aviso") && <span className={s.check}>✔ Token digital correcto</span>}
        {paso === "aviso" && (
          <div className={s.burbuja}>
            <strong>⚠️ Aviso de seguridad</strong>
            <p className={s.texto}>¿Seguro que deseas continuar con esta operación?</p>
            <div className={s.fila}>
              <button className={s.boton} onClick={onContinuar}>
                Continuar
              </button>
              <button className={`${s.boton} ${s.botonSecundario}`} onClick={onCancelar}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PASOS_RECLAMO = [
  { icono: "💸", texto: `${soles(ESTAFA_ROSA.monto)} salieron de tu cuenta. La llamada se corta; el número ya no contesta.` },
  { icono: "💳", texto: "Bloqueas tu tarjeta. ✔ Pero la transferencia ya salió: bloquear la tarjeta no la regresa." },
  { icono: "📝", texto: "Presentas un reclamo. El banco tiene hasta 15 días hábiles para responder." },
  { icono: "📄", texto: "Respuesta del banco: «La operación fue validada con su token digital»." },
];

function DatosReales() {
  return (
    <div className={`${s.tarjeta} ${s.tarjetaClara}`}>
      <strong>No fue tu culpa.</strong>
      <p className={s.texto}>
        Te autenticaste bien. El sistema esperaba que tú te dieras cuenta, bajo presión, en {SEGUNDOS_LLAMADA}{" "}
        segundos.
      </p>
      <p className={s.suave}>
        En Perú, el 47% de usuarios de finanzas digitales estuvo expuesto a fraude o estafas el último año, y el 21%
        de ellos perdió dinero (SBS y CGAP, 2025).
      </p>
      <p className={s.suave}>
        En julio de 2026, Indecopi sancionó a un banco por una transferencia inusual de S/ 10,000: autenticar no lo
        eximía de monitorear.
      </p>
    </div>
  );
}

export default function Victima({ alias, onTerminar }: { alias: string; onTerminar: () => void }) {
  const [fase, setFase] = useState<Fase>("a_intro");
  const [auth, setAuth] = useState<Auth>(null);
  const [cliente, setCliente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Ronda A
  const [cayo, setCayo] = useState(false);
  const [recuentoA, setRecuentoA] = useState<Recuento | null>(null);
  const [pasoReclamo, setPasoReclamo] = useState(0);
  const [frustracion, setFrustracion] = useState<number | null>(null);

  // Ronda B
  const [caso, setCaso] = useState<Caso | null>(null);
  const [respuestas, setRespuestas] = useState(0);
  const [pago, setPago] = useState<Caso | null>(null);
  const [pausaMolesto, setPausaMolesto] = useState<"no" | "un_poco" | "mucho" | null>(null);
  const [activaria, setActivaria] = useState<"si" | "no" | "no_se" | null>(null);

  const ronda = fase.startsWith("a_") ? "a" : "b";

  const autenticar = () => {
    setAuth("faceid");
    window.setTimeout(() => setAuth("token"), 700);
    window.setTimeout(() => {
      if (ronda === "a") setAuth("aviso");
      else void enviarAlMotor();
    }, 1400);
  };

  async function enviarAlMotor() {
    setCargando(true);
    setError(null);
    try {
      const nuevo = await transferir({
        transaccion: { ...ESTAFA_ROSA, moneda: "PEN" },
        // Señal SIMULADA: una web no puede saber si estás en una llamada (§4).
        contexto: { llamada_activa_o_acceso_remoto: true },
        alias,
      });
      setCaso(nuevo);
      setAuth(null);
      setFase(nuevo.salidas.guardian || !preguntaPendiente(nuevo) ? "b_resultado" : "b_guardian");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo contactar al sistema.");
      setAuth("pidiendo");
    } finally {
      setCargando(false);
    }
  }

  async function responder(texto: string) {
    if (!caso) return;
    setCargando(true);
    setError(null);
    try {
      const actualizado = await responderGuardian(caso.id, texto);
      setCaso(actualizado);
      const n = respuestas + 1;
      setRespuestas(n);
      if (actualizado.salidas.guardian || !preguntaPendiente(actualizado) || n >= 3) setFase("b_resultado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar tu respuesta.");
    } finally {
      setCargando(false);
    }
  }

  async function pagarProveedor() {
    setCargando(true);
    setError(null);
    try {
      setPago(await transferir({ transaccion: { ...PAGO_PROVEEDOR, moneda: "PEN" }, alias }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo hacer el pago.");
    } finally {
      setCargando(false);
    }
  }

  async function guardar(valor: "si" | "no" | "no_se") {
    setActivaria(valor);
    setCargando(true);
    setError(null);
    try {
      await registrarPartida({
        rol: "victima",
        alias,
        ronda_a: { cayo, frustracion: frustracion ?? 3 },
        ronda_b: {
          // Solo la transferencia de la estafa: el resumen cuenta un PERMITIR
          // aquí como «perdió dinero», y el pago a Don Pepe es legítimo.
          casos: caso ? [caso.id] : [],
          pausa_molesto: pausaMolesto ?? "no",
        },
        activaria: valor,
      });
      setFase("fin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tu partida.");
    } finally {
      setCargando(false);
    }
  }

  const estadoEscena: EstadoEscena =
    fase === "a_llamada" || fase === "b_llamada"
      ? "llamada"
      : fase === "a_desenlace" && cayo
        ? "perdio"
        : ronda === "b" && caso && caso.decision && retiene(caso.decision.accion)
          ? "protegido"
          : "normal";

  const decision = caso?.decision;

  return (
    <>
      <div className={s.escena}>
        <EscenaBodega estado={estadoEscena} cliente={cliente} />
        <span className={s.letrero} aria-hidden="true">
          BODEGA ROSA
        </span>
        {cliente && (fase === "a_llamada" || fase === "b_llamada") && (
          <span className={s.burbujaCliente}>¡Señito, mi vuelto!</span>
        )}
      </div>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {fase === "a_intro" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Ronda 1 de 2 · Aviso genérico (simulado)</p>
          <p className={s.texto}>
            Eres <strong>Rosa</strong>. Son las seis, la bodega está llena y tu proveedor espera su pago.
          </p>
          <p className={s.suave}>
            En esta ronda, el banco ficticio solo te pide FaceID, token y muestra un aviso genérico. No es la seguridad
            de ningún banco real: es nuestra línea base.
          </p>
          <button className={s.boton} onClick={() => setFase("a_llamada")}>
            Empezar
          </button>
        </section>
      )}

      {(fase === "a_llamada" || fase === "b_llamada") && (
        <>
          {auth ? (
            <Autenticacion
              paso={auth}
              onConfirmar={autenticar}
              onCancelar={() => setAuth(null)}
              onContinuar={() => {
                setCayo(true);
                setAuth(null);
                setFase("a_desenlace");
              }}
            />
          ) : null}
          {cargando && fase === "b_llamada" && <p className={s.suave}>Enviando la operación…</p>}
          <Llamada
            key={fase}
            pausada={auth !== null}
            onCliente={setCliente}
            onTransferir={(r) => {
              if (fase === "a_llamada") setRecuentoA(r);
              setAuth("pidiendo");
            }}
            onFinTiempo={(r) => {
              setAuth(null);
              if (fase === "a_llamada") {
                setRecuentoA(r);
                setCayo(false);
                setFase("a_desenlace");
              } else {
                setFase("b_proveedor");
              }
            }}
          />
        </>
      )}

      {fase === "a_desenlace" && (
        <section className={s.tarjeta}>
          {cayo ? (
            <>
              {PASOS_RECLAMO.slice(0, pasoReclamo + 1).map((p) => (
                <p key={p.texto} className={`${s.burbuja}`} style={{ color: "#19283b" }}>
                  {p.icono} {p.texto}
                </p>
              ))}
              {pasoReclamo < PASOS_RECLAMO.length - 1 ? (
                <button className={s.boton} onClick={() => setPasoReclamo((n) => n + 1)}>
                  ¿Y ahora qué hago?
                </button>
              ) : (
                <>
                  <DatosReales />
                  <button className={s.boton} onClick={() => setFase("a_frustracion")}>
                    Continuar
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className={s.texto}>
                <strong>No perdiste dinero.</strong> Pero durante {SEGUNDOS_LLAMADA} segundos fuiste tu propio equipo
                de seguridad
                {recuentoA
                  ? `: colgaste ${recuentoA.colgo} ${recuentoA.colgo === 1 ? "vez" : "veces"}, esperaste en la línea oficial ${recuentoA.esperoBanco} ${recuentoA.esperoBanco === 1 ? "vez" : "veces"}${recuentoA.bloqueoTarjeta ? " y bloqueaste tu tarjeta" : ""}`
                  : ""}
                . Y la bodega siguió llena.
              </p>
              <DatosReales />
              <button className={s.boton} onClick={() => setFase("a_frustracion")}>
                Continuar
              </button>
            </>
          )}
        </section>
      )}

      {fase === "a_frustracion" && (
        <section className={s.tarjeta}>
          <p className={s.texto}>
            <strong>¿Cuánta frustración sentiste?</strong>
          </p>
          <div className={s.emojis}>
            {FRUSTRACION.map((e, i) => (
              <button
                key={e}
                className={s.emoji}
                aria-label={`${i + 1} de 5`}
                onClick={() => {
                  setFrustracion(i + 1);
                  setFase("b_intro");
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </section>
      )}

      {fase === "b_intro" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Ronda 2 de 2 · Con nuestra capa</p>
          <p className={s.texto}>
            El mismo día. La misma llamada. La misma presión. Esta vez tu operación pasa por nuestro sistema real.
          </p>
          <button
            className={s.boton}
            onClick={() => {
              setCliente(false);
              setFase("b_llamada");
            }}
          >
            Empezar
          </button>
        </section>
      )}

      {fase === "b_guardian" && caso && (
        <div className={s.celular}>
          <div className={s.pantalla}>
            {huboPausaPreventiva(caso) && (
              <div className={s.estadoPausa}>
                <strong>⏸️ Tu dinero está retenido</strong>
                <span>Nadie puede moverlo ahora. La operación todavía no se ejecutó.</span>
              </div>
            )}
            <p className={`${s.burbuja} ${s.burbujaGuardian}`}>
              🛡️ <strong>Guardián:</strong> {preguntaPendiente(caso)}
            </p>
            <p className={s.susurro}>El «asesor», por el teléfono: «¡Dile que no! Dile que lo haces tú».</p>
            <div className={s.botones}>
              {RESPUESTAS_GUARDIAN.map((r) => (
                <button
                  key={r.id}
                  className={`${s.boton} ${r.id === "silencio" ? s.botonSecundario : ""}`}
                  disabled={cargando}
                  onClick={() => void responder(r.texto)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
            <p className={s.suave} style={{ color: "#4a5a6e" }}>
              El Guardián nunca te pedirá tu clave, tu token ni los datos de tu tarjeta.
            </p>
          </div>
        </div>
      )}

      {fase === "b_resultado" && caso && decision && (
        <section className={s.tarjeta}>
          {retiene(decision.accion) ? (
            <div className={s.estadoPausa} style={{ color: "#19283b" }}>
              <strong>✅ {soles(ESTAFA_ROSA.monto)} siguen en tu cuenta</strong>
              <span>La transferencia nunca se ejecutó. {explicar(decision.regla).detalle}</span>
            </div>
          ) : (
            <div className={s.estadoPerdida} style={{ color: "#19283b" }}>
              <strong>La operación pasó</strong>
              <span>{explicar(decision.regla).detalle} Lo registramos como un fallo del sistema, no tuyo.</span>
            </div>
          )}
          <p className={s.suave}>
            Mentir no funcionaba: aunque dijeras «lo hago yo», la cuenta destino te delataba. Y nunca te pidieron tu
            clave ni tu token.
          </p>
          <button className={s.boton} onClick={() => setFase("b_proveedor")}>
            Seguir con mi día
          </button>
        </section>
      )}

      {fase === "b_proveedor" && (
        <section className={s.tarjeta}>
          {!caso && <p className={s.suave}>No transferiste en esta ronda. Veamos ahora un pago normal.</p>}
          <p className={s.texto}>
            Ahora págale a <strong>Don Pepe</strong>, tu proveedor de siempre: {soles(PAGO_PROVEEDOR.monto)}.
          </p>
          {!pago ? (
            <button className={`${s.boton} ${s.botonVerde}`} disabled={cargando} onClick={() => void pagarProveedor()}>
              💳 Pagar a Don Pepe
            </button>
          ) : (
            <>
              {pago.decision && !retiene(pago.decision.accion) ? (
                <span className={s.check} style={{ color: "#65be83" }}>
                  ✔ Pagado al instante, sin preguntas
                </span>
              ) : (
                <p className={s.estadoPerdida} style={{ color: "#19283b" }}>
                  El pago quedó retenido: es un falso positivo y lo registramos como tal.
                </p>
              )}
              <button className={s.boton} onClick={() => setFase("encuesta")}>
                Terminar
              </button>
            </>
          )}
        </section>
      )}

      {fase === "encuesta" && (
        <section className={s.tarjeta}>
          {pausaMolesto === null ? (
            <>
              <p className={s.texto}>
                <strong>¿La pausa te molestó?</strong>
              </p>
              <div className={s.fila}>
                {(
                  [
                    ["no", "No"],
                    ["un_poco", "Un poco"],
                    ["mucho", "Mucho"],
                  ] as const
                ).map(([v, t]) => (
                  <button key={v} className={`${s.boton} ${s.botonSecundario}`} onClick={() => setPausaMolesto(v)}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className={s.texto}>
                <strong>¿Activarías esta protección en tu banco, aunque a veces retrase un pago?</strong>
              </p>
              <div className={s.fila}>
                {(
                  [
                    ["si", "Sí"],
                    ["no", "No"],
                    ["no_se", "No sé"],
                  ] as const
                ).map(([v, t]) => (
                  <button
                    key={v}
                    className={`${s.boton} ${s.botonSecundario}`}
                    disabled={cargando || activaria !== null}
                    onClick={() => void guardar(v)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {fase === "fin" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Gracias, {alias}</p>
          <p className={s.texto}>
            {cayo ? "Con el aviso genérico perdiste el dinero." : "Con el aviso genérico resististe, a puro esfuerzo."}{" "}
            {caso?.decision && retiene(caso.decision.accion)
              ? "Con nuestra capa, el dinero no salió aunque la presión fue la misma."
              : "Con nuestra capa, tu pago normal pasó sin fricción."}
          </p>
          <p className={s.suave}>Tu partida ya aparece, anónima, en el monitor del evento.</p>
          <button className={s.boton} onClick={onTerminar}>
            Jugar otra vez (prueba el rol de atacante)
          </button>
        </section>
      )}
    </>
  );
}
