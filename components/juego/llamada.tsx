"use client";

import { useEffect, useRef, useState } from "react";
import s from "./juego.module.css";
import { SEGUNDOS_LLAMADA } from "./datos";

/**
 * La llamada del «falso banco» (DEMO_JUEGO §3, mecánicas de presión).
 *
 * Las frases son genéricas, como en las campañas de la SBS: muestran la
 * presión sin dar un guion reutilizable (§8). El banco es ficticio.
 */

const GUION = [
  "Buenas tardes, señora Rosa. Le hablamos del área de seguridad de Banco Andino.",
  "Ya validamos sus datos: su DNI termina en 47. Detectamos un consumo de S/ 1,299 que usted no hizo.",
  "Sus ahorros están en riesgo. Para protegerlos, muévalos ahora a una cuenta de resguardo.",
  "Si no lo hace en los próximos minutos, su cuenta quedará bloqueada.",
  "Señora, no tenemos mucho tiempo. Es por su seguridad.",
];

export type Recuento = { colgo: number; esperoBanco: number; bloqueoTarjeta: boolean };

type Modo = "sms" | "llamada" | "colgado" | "espera_banco";

export default function Llamada({
  pausada,
  detenida,
  onTransferir,
  onFinTiempo,
  onCliente,
}: {
  /** El reloj no corre mientras el jugador está en la pantalla de transferencia. */
  pausada: boolean;
  /** Ronda B: la pausa preventiva vuelve irrelevante el reloj del estafador. */
  detenida?: boolean;
  onTransferir: (recuento: Recuento) => void;
  onFinTiempo: (recuento: Recuento) => void;
  onCliente: (visible: boolean) => void;
}) {
  const [modo, setModo] = useState<Modo>("sms");
  const [restante, setRestante] = useState(SEGUNDOS_LLAMADA);
  const [linea, setLinea] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cliente, setCliente] = useState(false);
  const recuento = useRef<Recuento>({ colgo: 0, esperoBanco: 0, bloqueoTarjeta: false });
  const fin = useRef(onFinTiempo);
  fin.current = onFinTiempo;
  const avisarCliente = useRef(onCliente);
  avisarCliente.current = onCliente;

  // Reloj del estafador
  useEffect(() => {
    if (pausada || detenida || modo === "sms") return;
    if (restante <= 0) {
      fin.current({ ...recuento.current });
      return;
    }
    const id = window.setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [restante, pausada, detenida, modo]);

  // El asesor avanza en su guion
  useEffect(() => {
    if (modo !== "llamada" || pausada || detenida) return;
    const id = window.setInterval(() => setLinea((l) => Math.min(l + 1, GUION.length - 1)), 5000);
    return () => window.clearInterval(id);
  }, [modo, pausada, detenida]);

  // Si cuelga, vuelve a llamar
  useEffect(() => {
    if (modo !== "colgado") return;
    const id = window.setTimeout(() => {
      setAviso("¿Señora? Se cortó la llamada. No cuelgue, es por su seguridad.");
      setModo("llamada");
    }, 2500);
    return () => window.clearTimeout(id);
  }, [modo]);

  // En espera con el banco oficial: el estafador vuelve a entrar
  useEffect(() => {
    if (modo !== "espera_banco") return;
    const id = window.setTimeout(() => {
      setAviso("Mientras esperabas, el «asesor» volvió a llamar: «Señora, no cuelgue».");
      setModo("llamada");
    }, 6000);
    return () => window.clearTimeout(id);
  }, [modo]);

  // Distracción: un cliente de la bodega pide su vuelto
  useEffect(() => {
    if (modo === "sms" || pausada || detenida) return;
    const id = window.setInterval(() => setCliente(true), 11000);
    return () => window.clearInterval(id);
  }, [modo, pausada, detenida]);

  useEffect(() => {
    avisarCliente.current(cliente);
  }, [cliente]);

  useEffect(() => {
    if (modo === "llamada") {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // vibración no disponible
      }
    }
  }, [modo]);

  const mm = Math.floor(Math.max(restante, 0) / 60);
  const ss = String(Math.max(restante, 0) % 60).padStart(2, "0");

  if (modo === "sms") {
    return (
      <div className={s.celular}>
        <div className={s.pantalla}>
          <strong>📩 SMS · Banco Andino</strong>
          <p className={s.burbuja}>
            Se registró un consumo de S/ 1,299 en tu tarjeta. Si no lo reconoces, nuestro equipo de
            seguridad te llamará.
          </p>
          <button className={s.boton} onClick={() => setModo("llamada")}>
            Seguir atendiendo la bodega
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.celular}>
      <div className={s.pantalla} aria-live="polite">
        <div className={s.llamante}>
          <span>📞 «Seguridad Banco Andino»</span>
          <span className={`${s.reloj} ${detenida ? s.relojDetenido : ""}`}>
            {mm}:{ss}
          </span>
        </div>
        <p className={s.suave} style={{ color: "#4a5a6e" }}>
          {detenida
            ? "Tu dinero ya está retenido: el reloj del estafador ya no importa."
            : `«Tu cuenta se bloquea en ${mm}:${ss}»`}
        </p>

        {modo === "espera_banco" ? (
          <div className={s.burbuja}>
            <strong>Banco Andino (línea oficial)</strong>
            <p className={s.texto}>Su llamada es importante para nosotros. Tiempo de espera estimado: 14 minutos.</p>
            <div className={s.musica} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : modo === "colgado" ? (
          <p className={s.burbuja}>Colgaste. … El mismo número está volviendo a llamar.</p>
        ) : (
          <>
            {aviso && <p className={`${s.burbuja} ${s.susurro}`}>{aviso}</p>}
            <p className={s.burbuja} key={linea}>
              {GUION[linea]}
            </p>
          </>
        )}

        {cliente && !detenida && (
          <button className={`${s.boton} ${s.botonSecundario}`} onClick={() => setCliente(false)}>
            🧾 Darle su vuelto al cliente
          </button>
        )}
      </div>

      {!pausada && !detenida && modo === "llamada" && (
        <div className={s.botones}>
          <button className={`${s.boton} ${s.botonPeligro}`} onClick={() => onTransferir({ ...recuento.current })}>
            💸 Mover mis ahorros a la cuenta de resguardo
          </button>
          <button
            className={`${s.boton} ${s.botonSecundario}`}
            onClick={() => {
              recuento.current.colgo++;
              setAviso(null);
              setModo("colgado");
            }}
          >
            📵 Colgar
          </button>
          <button
            className={`${s.boton} ${s.botonSecundario}`}
            onClick={() => {
              recuento.current.esperoBanco++;
              setAviso(null);
              setModo("espera_banco");
            }}
          >
            ☎️ Llamar a la línea oficial del banco
          </button>
          <button
            className={`${s.boton} ${s.botonSecundario}`}
            disabled={recuento.current.bloqueoTarjeta}
            onClick={() => {
              recuento.current.bloqueoTarjeta = true;
              setAviso("Tarjeta bloqueada ✔. El asesor: «Bloquear la tarjeta no protege sus ahorros, señora».");
            }}
          >
            {recuento.current.bloqueoTarjeta ? "💳 Tarjeta bloqueada ✔" : "💳 Bloquear mi tarjeta en la app"}
          </button>
        </div>
      )}
    </div>
  );
}
