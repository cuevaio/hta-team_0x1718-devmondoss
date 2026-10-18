"use client";

import { useState } from "react";
import type { Caso } from "@/lib/contracts";
import s from "./juego.module.css";
import { registrarPartida, transferir } from "./api";
import {
  DESTINOS,
  MAX_INTENTOS,
  MONTOS,
  NOMBRES_ACTOR,
  SENALES,
  TACTICAS,
  VICTIMAS,
  actoresDe,
  armarTransferencia,
  explicar,
  huboPausaPreventiva,
  puntosDe,
  retiene,
  soles,
  type Jugada,
  type TacticaId,
} from "./datos";

/**
 * Rol atacante (DEMO_JUEGO §4): red-teaming, no entrenamiento para robar.
 * Se gana un «descubrimiento» cuando una operación de la banda PASA el motor.
 * Las tácticas son categorías públicas (campañas SBS/ASBANC), sin guiones.
 */

type Intento = { jugada: Jugada; caso: Caso };

const JUGADA_INICIAL: Jugada = {
  victima: "rosa",
  tactica: "falso_banco",
  destino: "M-01",
  monto: 4800,
  madrugada: false,
};

function Opcion({
  activa,
  onClick,
  titulo,
  meta,
  dificil,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  meta?: string;
  dificil?: boolean;
}) {
  return (
    <button className={s.carta} aria-pressed={activa} onClick={onClick}>
      <span className={s.cartaNombre}>{titulo}</span>
      {meta && <span className={`${s.cartaMeta} ${dificil ? s.cartaDificil : ""}`}>{meta}</span>}
    </button>
  );
}

function Revelacion({ intento }: { intento: Intento }) {
  const { caso } = intento;
  const decision = caso.decision;
  const senales = caso.nivel0.senales;
  const actores = actoresDe(caso);
  const base = senales.length * 350;
  const paso = decision ? !retiene(decision.accion) : false;

  return (
    <div className={s.grupo}>
      <h3>1 · Lo que vio el banco (reglas, sin IA)</h3>
      {senales.length === 0 ? (
        <p className={s.suave}>Ninguna señal de riesgo.</p>
      ) : (
        senales.map((senal, i) => (
          <div key={senal} className={s.senal} style={{ animationDelay: `${i * 350}ms` }}>
            <span>{SENALES[senal] ?? senal}</span>
            {puntosDe(senal) !== null && <span className={s.puntos}>+{puntosDe(senal)}</span>}
          </div>
        ))
      )}
      <p className={s.suave}>
        Riesgo inicial: <strong>{caso.nivel0.score}</strong>
        {huboPausaPreventiva(caso) ? " → dinero retenido antes de llamar a ningún agente" : ""}
      </p>

      <h3>2 · Quién actuó</h3>
      <div className={s.cadena}>
        {actores.length === 0 ? (
          <span className={s.nodo} style={{ animationDelay: `${base}ms` }}>
            Solo reglas: ningún agente hizo falta
          </span>
        ) : (
          actores.map((a, i) => (
            <span key={a} className={s.nodo} style={{ animationDelay: `${base + i * 300}ms` }}>
              {NOMBRES_ACTOR[a] ?? a}
            </span>
          ))
        )}
      </div>

      {decision && (
        <div
          className={`${s.veredicto} ${paso ? s.veredictoPaso : s.veredictoFrenado}`}
          style={{ animationDelay: `${base + actores.length * 300 + 300}ms` }}
        >
          <strong>{paso ? "🔓 Descubrimiento: encontraste un hueco" : `🛑 ${explicar(decision.regla).titulo}`}</strong>
          <span>{explicar(decision.regla).detalle}</span>
          <span style={{ fontSize: "0.8rem" }}>
            {caso.ia.llamadas === 0 ? "0 llamadas de IA" : `${caso.ia.llamadas} llamada(s) de IA`} ·{" "}
            {paso
              ? "En la vida real cada robo deja rastro en la cuenta: si un analista la confirma, el siguiente golpe cae al instante."
              : "El dinero nunca salió."}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Atacante({ alias, onTerminar }: { alias: string; onTerminar: () => void }) {
  const [fase, setFase] = useState<"mision" | "armar" | "resultado" | "cierre" | "fin">("mision");
  const [jugada, setJugada] = useState<Jugada>(JUGADA_INICIAL);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [idea, setIdea] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = <K extends keyof Jugada>(k: K, v: Jugada[K]) => setJugada((j) => ({ ...j, [k]: v }));
  const ultimo = intentos[intentos.length - 1];
  const descubrimientos = intentos.filter((i) => i.caso.decision && !retiene(i.caso.decision.accion)).length;

  async function ejecutar() {
    setCargando(true);
    setError(null);
    try {
      const caso = await transferir(armarTransferencia(jugada, alias));
      setIntentos((xs) => [...xs, { jugada, caso }]);
      setFase("resultado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "El sistema no respondió.");
    } finally {
      setCargando(false);
    }
  }

  async function cerrar() {
    setCargando(true);
    setError(null);
    try {
      await registrarPartida({
        rol: "atacante",
        alias,
        intentos: intentos.map((i) => ({ caso: i.caso.id, tactica: i.jugada.tactica })),
        ...(idea.trim() ? { idea: idea.trim() } : {}),
      });
      setFase("fin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tu partida.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {fase === "mision" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Rol: atacante</p>
          <p className={s.texto}>
            Eres parte de una banda (ficticia). Tienes lo que tienen las bandas reales: datos filtrados, cuentas
            «alquiladas» y un teléfono.
          </p>
          <p className={s.texto}>
            <strong>Tu misión no es robar: es encontrar huecos.</strong> Ganas un descubrimiento cada vez que una
            operación de la banda pasa el sistema. Tienes {MAX_INTENTOS} intentos.
          </p>
          <p className={s.suave}>Las tácticas son las que difunden las campañas de la SBS y ASBANC, sin guiones.</p>
          <button className={s.boton} onClick={() => setFase("armar")}>
            Armar el primer golpe
          </button>
        </section>
      )}

      {fase === "armar" && (
        <section className={s.tarjeta}>
          <div className={s.franja}>
            <span className={s.contador}>
              Intento {intentos.length + 1}/{MAX_INTENTOS}
            </span>
            <span className={s.contador}>🔓 {descubrimientos}</span>
          </div>

          <div className={s.grupo}>
            <h3>1 · Víctima</h3>
            <div className={s.cartas}>
              {VICTIMAS.map((v) => (
                <Opcion
                  key={v.id}
                  activa={jugada.victima === v.id}
                  onClick={() => cambiar("victima", v.id)}
                  titulo={v.nombre}
                  meta={v.situacion}
                />
              ))}
            </div>
          </div>

          <div className={s.grupo}>
            <h3>2 · Táctica</h3>
            <div className={s.cartas}>
              {TACTICAS.map((t) => (
                <Opcion
                  key={t.id}
                  activa={jugada.tactica === t.id}
                  onClick={() => cambiar("tactica", t.id as TacticaId)}
                  titulo={`${t.icono} ${t.nombre}`}
                  meta={`${t.gancho} · ${t.comun}`}
                  dificil={t.dificil}
                />
              ))}
            </div>
          </div>

          <div className={s.grupo}>
            <h3>3 · Cuenta destino</h3>
            <div className={s.cartas}>
              {DESTINOS.map((d) => (
                <Opcion
                  key={d.id}
                  activa={jugada.destino === d.id}
                  onClick={() => cambiar("destino", d.id)}
                  titulo={d.nombre}
                  meta={d.detalle}
                />
              ))}
            </div>
          </div>

          <div className={s.grupo}>
            <h3>4 · Monto y momento</h3>
            <div className={s.cartas}>
              {MONTOS.map((m) => (
                <Opcion
                  key={m.id}
                  activa={jugada.monto === m.monto}
                  onClick={() => cambiar("monto", m.monto)}
                  titulo={m.nombre}
                  meta={soles(m.monto)}
                />
              ))}
              <Opcion
                activa={jugada.madrugada}
                onClick={() => cambiar("madrugada", !jugada.madrugada)}
                titulo="🌙 De madrugada"
                meta={jugada.madrugada ? "Activado" : "De día"}
              />
            </div>
          </div>

          <button className={`${s.boton} ${s.botonPeligro}`} disabled={cargando} onClick={() => void ejecutar()}>
            {cargando ? "Ejecutando…" : "▶ Ejecutar el golpe"}
          </button>
        </section>
      )}

      {fase === "resultado" && ultimo && (
        <section className={s.tarjeta}>
          <div className={s.franja}>
            <span className={s.contador}>
              Intento {intentos.length}/{MAX_INTENTOS}
            </span>
            <span className={s.contador}>🔓 {descubrimientos}</span>
          </div>
          <Revelacion key={ultimo.caso.id} intento={ultimo} />
          <div className={s.botones}>
            {intentos.length < MAX_INTENTOS && (
              <button className={s.boton} onClick={() => setFase("armar")}>
                Probar otra combinación
              </button>
            )}
            <button className={`${s.boton} ${s.botonSecundario}`} onClick={() => setFase("cierre")}>
              Terminar la partida
            </button>
          </div>
        </section>
      )}

      {fase === "cierre" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Tu partida</p>
          <ul className={s.historial}>
            {intentos.map((i) => {
              const t = TACTICAS.find((x) => x.id === i.jugada.tactica);
              const paso = i.caso.decision && !retiene(i.caso.decision.accion);
              return (
                <li key={i.caso.id}>
                  <span>
                    {t?.icono} {t?.nombre} → {i.jugada.destino} · {soles(i.jugada.monto)}
                  </span>
                  <strong>{paso ? "🔓 pasó" : "🛑 frenado"}</strong>
                </li>
              );
            })}
          </ul>
          <p className={s.texto}>
            {descubrimientos === 0
              ? "El sistema frenó todos tus intentos."
              : `Encontraste ${descubrimientos} ${descubrimientos === 1 ? "hueco" : "huecos"}. Los usaremos para mejorar el sistema.`}
          </p>
          <label className={s.campo}>
            <span>¿Qué intentarías después? (opcional, anónimo)</span>
            <textarea rows={3} maxLength={280} value={idea} onChange={(e) => setIdea(e.target.value)} />
          </label>
          <button className={s.boton} disabled={cargando} onClick={() => void cerrar()}>
            Guardar y terminar
          </button>
        </section>
      )}

      {fase === "fin" && (
        <section className={s.tarjeta}>
          <p className={s.subtitulo}>Gracias, {alias}</p>
          <p className={s.texto}>Tus intentos ya aparecen en el monitor del evento.</p>
          <button className={s.boton} onClick={onTerminar}>
            Jugar otra vez (prueba el rol de víctima)
          </button>
        </section>
      )}
    </>
  );
}
