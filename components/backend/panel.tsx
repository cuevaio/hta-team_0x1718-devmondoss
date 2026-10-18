"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Caso, EventoTimeline } from "@/lib/contracts";
import type { ResultadoPrueba } from "@/lib/demo/suite";
import s from "./panel.module.css";

/**
 * Panel del backend para presentar (`/demo`): corre la suite en vivo
 * (lib/demo/suite.ts) contra el pipeline real y la dibuja como un flujo: qué
 * agentes actuaron, dónde quedó retenido el dinero y qué se verificó. La traza
 * completa queda plegada debajo.
 */

type Prueba = { id: string; titulo: string; demuestra: string };
type Agentes = { modo: "claude" | "ollama" | "simulado"; modelo: string | null };
type Estado = "espera" | "corriendo" | "ok" | "falla";
type Detalle = Record<string, unknown>;

const CLAVE_TOKEN = "afs-demo-token";
const PASO_MS = 140;

/** Token del operador: llega como `?token=`, se quita de la URL y queda en la pestaña. */
function tokenOperador(): string | null {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");
    if (t) {
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.toString());
      try {
        sessionStorage.setItem(CLAVE_TOKEN, t);
      } catch {
        // sin almacenamiento: vale solo para esta carga
      }
      return t;
    }
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

const ESTADO_CLIENTE: Record<string, string> = {
  manipulacion_probable: "manipulado",
  canal_comprometido: "canal comprometido",
  confirmado_seguro: "seguro",
  sin_respuesta: "sin respuesta",
};

/**
 * Las etapas del pipeline (doc 19), en orden. `de` dice qué evento del
 * timeline la enciende y `dato` resume en dos palabras lo que encontró.
 * `retiene`: si se enciende, el dinero se queda ahí.
 */
const NODOS: Array<{
  id: string;
  nombre: string;
  de: (e: EventoTimeline) => boolean;
  dato: (d: Detalle, e: EventoTimeline) => string;
  retiene?: boolean;
}> = [
  { id: "reglas", nombre: "Reglas", de: (e) => e.evento === "nivel0_evaluado", dato: (d) => `score ${d.score}` },
  { id: "pausa", nombre: "Pausa", de: (e) => e.evento === "pausa_preventiva", dato: () => "antes de la IA", retiene: true },
  { id: "memoria", nombre: "Memoria", de: (e) => e.actor === "memoria", dato: () => "mula conocida", retiene: true },
  {
    id: "red",
    nombre: "Red",
    de: (e) => e.actor === "red_regional",
    dato: (d) => `banco ${String((d.emisor as { pais?: string } | undefined)?.pais ?? "").toUpperCase()}`,
    retiene: true,
  },
  {
    id: "coordinador",
    nombre: "Coordinador",
    de: (e) => e.actor === "coordinador",
    dato: (d) => (Array.isArray(d.invocar) ? `${d.invocar.length} agente${d.invocar.length === 1 ? "" : "s"}` : ""),
  },
  { id: "detective", nombre: "Detective", de: (e) => e.actor === "detective", dato: (d) => (d.riesgo_destino ? `riesgo ${d.riesgo_destino}` : "") },
  {
    id: "guardian",
    nombre: "Guardián",
    de: (e) => e.actor === "guardian",
    dato: (d, e) => (e.evento === "estado_usuario" ? (ESTADO_CLIENTE[String(d.estado_usuario)] ?? String(d.estado_usuario)) : e.evento === "turno_pendiente" ? "sin respuesta" : "pregunta"),
  },
  { id: "policy", nombre: "Policy", de: (e) => e.actor === "policy", dato: (d) => String(d.regla ?? "") },
  { id: "auditor", nombre: "Auditor", de: (e) => e.evento === "expediente", dato: (d) => `${d.afirmaciones} citas` },
];

/** Una línea de log por evento (la traza plegada). */
function linea(e: EventoTimeline): string {
  const d = (e.detalle ?? {}) as Detalle;
  const l = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
  switch (e.evento) {
    case "nivel0_evaluado":
      return `score ${d.score} · ${l(d.senales) || "sin señales"}`;
    case "plan":
      return `invoca ${l(d.invocar) || "—"} · ${d.motivo}`;
    case "riesgo_destino":
      return `riesgo ${d.riesgo_destino} · ${l(d.tipologias)}`;
    case "pregunta":
    case "turno_pendiente":
      return `«${d.mensaje}»`;
    case "respuesta_guardian":
      return `«${d.texto || "(sin respuesta)"}»`;
    case "estado_usuario":
      return `${d.estado_usuario} · canal ${d.canal_usado ?? "—"}`;
    case "decision":
    case "atajo_determinista":
      return `${d.accion} · ${d.regla} · ${d.motivo}`;
    case "error_agentes":
      return `${d.agente}: ${d.mensaje}`;
    default: {
      const j = e.detalle === undefined ? "" : JSON.stringify(e.detalle);
      return j.length > 80 ? `${j.slice(0, 80)}…` : j;
    }
  }
}

const ms = (a: string, b: string) => Math.max(0, new Date(b).getTime() - new Date(a).getTime());
const color = (accion?: string) =>
  accion === "PERMITIR" ? s.permitir : accion === "ESCALAR" ? s.escalar : accion === "VERIFICAR" ? s.verificar : accion ? s.pausar : "";

export default function PanelBackend() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [agentes, setAgentes] = useState<Agentes | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoPrueba>>({});
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);

  useEffect(() => {
    token.current = tokenOperador();
    fetch("/api/demo/suite")
      .then((r) => r.json())
      .then((d: { pruebas: Prueba[]; agentes: Agentes }) => {
        setPruebas(d.pruebas);
        setAgentes(d.agentes);
        setElegida(d.pruebas[0]?.id ?? null);
      })
      .catch(() => setError("Sin conexión con el servidor."));
  }, []);

  const correr = useCallback(async () => {
    if (corriendo || !pruebas.length) return;
    setError(null);
    setResultados({});
    setCorriendo(pruebas[0].id);
    setElegida(pruebas[0].id);
    try {
      const res = await fetch("/api/demo/suite", {
        method: "POST",
        headers: token.current ? { "x-demo-token": token.current } : {},
      });
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(res.status === 401 || res.status === 403 ? "Falta el token: /demo?token=…" : (b?.error ?? `error ${res.status}`));
      }
      const lector = res.body.getReader();
      const dec = new TextDecoder();
      let resto = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";
        for (const l of lineas.filter(Boolean)) {
          const r = JSON.parse(l) as ResultadoPrueba;
          setResultados((prev) => ({ ...prev, [r.id]: r }));
          setElegida(r.id);
          // Que se vea el flujo completo antes de pasar a la siguiente.
          await new Promise((ok) => setTimeout(ok, 900 + (r.casos[0]?.timeline.length ?? 10) * PASO_MS));
          const i = pruebas.findIndex((p) => p.id === r.id);
          const siguiente = pruebas[i + 1]?.id ?? null;
          setCorriendo(siguiente);
          if (siguiente) setElegida(siguiente);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCorriendo(null);
    }
  }, [corriendo, pruebas]);

  const hechas = Object.values(resultados);
  const ok = hechas.filter((r) => r.ok).length;
  const elegido = elegida ? resultados[elegida] : undefined;
  const prueba = pruebas.find((p) => p.id === elegida);

  return (
    <main className={s.panel}>
      <header className={s.barra}>
        <div className={s.marca}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          Mule Zero
        </div>
        {agentes && <span className={s.modo}>{agentes.modelo ?? agentes.modo}</span>}
        {hechas.length > 0 && (
          <span className={`${s.marcador} ${ok === hechas.length ? s.permitir : s.escalar}`} aria-live="polite">
            {ok}/{pruebas.length}
          </span>
        )}
        <button className={s.correr} onClick={correr} disabled={Boolean(corriendo) || !pruebas.length}>
          {corriendo ? "corriendo" : "▶ correr"}
        </button>
      </header>
      {error && <p className={s.error}>{error}</p>}

      <div className={s.cuerpo}>
        <ol className={s.lista}>
          {pruebas.map((p, i) => {
            const r = resultados[p.id];
            const estado: Estado = r ? (r.ok ? "ok" : "falla") : corriendo === p.id ? "corriendo" : "espera";
            return (
              <li key={p.id}>
                <button className={`${s.fila} ${elegida === p.id ? s.elegida : ""}`} onClick={() => setElegida(p.id)} data-estado={estado}>
                  <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                  {p.titulo}
                  <span className={s.punto} aria-label={estado} />
                </button>
              </li>
            );
          })}
        </ol>

        <section className={s.detalle}>
          {prueba && (
            <header className={s.cabeza}>
              <div>
                <h2>{prueba.titulo}</h2>
                <p>{prueba.demuestra}</p>
              </div>
              {elegido?.casos.at(-1)?.decision && <Decision caso={elegido.casos.at(-1)!} ms={elegido.ms} />}
              {elegido?.matriz && (
                <div className={`${s.decision} ${elegido.ok ? s.permitir : s.escalar}`}>
                  <b>{elegido.matriz.invariantes.reduce((n, v) => n + v.violaciones, 0)} huecos</b>
                  <span>{elegido.matriz.combinaciones} ataques · {elegido.ms} ms</span>
                </div>
              )}
            </header>
          )}
          {elegido?.error && <p className={s.error}>{elegido.error}</p>}
          {elegido?.matriz ? (
            <Matriz r={elegido} />
          ) : elegido?.casos[0] ? (
            <Flujo key={elegido.id} caso={elegido.casos[0]} chequeos={elegido} />
          ) : (
            <Flujo key={`vacio-${elegida}`} esperando={corriendo === elegida} />
          )}
        </section>
      </div>
    </main>
  );
}

function Decision({ caso, ms: t }: { caso: Caso; ms: number }) {
  return (
    // Aparece cuando el flujo terminó de dibujarse.
    <div className={`${s.decision} ${color(caso.decision!.accion)}`} style={{ animationDelay: `${caso.timeline.length * PASO_MS}ms` }}>
      <b>{caso.decision!.accion}</b>
      <span>
        {caso.decision!.regla} · {caso.ia.llamadas} IA · {t < 1000 ? `${t} ms` : `${(t / 1000).toFixed(1)} s`}
      </span>
    </div>
  );
}

/** Revela los eventos de a uno, como si el caso corriera en ese momento. */
function useRevelar(n: number) {
  const [visibles, setVisibles] = useState(0);
  useEffect(() => {
    setVisibles(0);
    if (!n) return;
    let i = 0;
    const t = setInterval(() => {
      setVisibles(++i);
      if (i >= n) clearInterval(t);
    }, PASO_MS);
    return () => clearInterval(t);
  }, [n]);
  return visibles;
}

function Flujo({ caso, chequeos, esperando }: { caso?: Caso; chequeos?: ResultadoPrueba; esperando?: boolean }) {
  const total = caso?.timeline.length ?? 0;
  const visibles = useRevelar(total);
  const vistos = caso?.timeline.slice(0, visibles) ?? [];
  const terminado = caso !== undefined && visibles >= total;

  const fallidos = new Set(vistos.filter((e) => e.evento === "error_agentes").map((e) => String((e.detalle as Detalle)?.agente)));
  const nodos = NODOS.map((n) => {
    const ev = [...vistos].reverse().find(n.de);
    const falla = fallidos.has(n.id) || (n.id === "coordinador" && fallidos.has("orquestador"));
    return { ...n, activo: Boolean(ev) || falla, falla, texto: falla ? "falla" : ev ? n.dato((ev.detalle ?? {}) as Detalle, ev) : "" };
  });
  const ultimo = nodos.reduce((m, n, i) => (n.activo ? i : m), -1);

  // Dónde queda el dinero: en la primera etapa que lo retiene; si se permite, llega al final.
  const accion = terminado ? caso?.decision?.accion : undefined;
  const conDinero = caso?.puerta === "transferencia";
  const retenidoEn = nodos.findIndex((n) => n.retiene && n.activo);
  const policy = nodos.findIndex((n) => n.id === "policy");
  const posDinero =
    accion === "PERMITIR" ? NODOS.length : retenidoEn >= 0 ? retenidoEn : accion ? policy : Math.max(0, ultimo);
  const estadoDinero = accion === "PERMITIR" ? s.permitir : retenidoEn >= 0 || accion ? s.pausar : "";

  return (
    <div className={s.flujo}>
      <div className={`${s.pista} ${esperando ? s.esperando : ""}`}>
        <div className={s.linea} />
        <div className={s.lineaLlena} style={{ width: `${(Math.max(0, ultimo) / NODOS.length) * 100}%` }} />
        {conDinero && (
          <div className={`${s.dinero} ${estadoDinero}`} style={{ left: `${((Math.min(posDinero, NODOS.length - 1) + 0.5) / NODOS.length) * 100}%` }}>
            S/ {caso!.transaccion.monto.toLocaleString("es-PE")}
            {accion && <small>{accion === "PERMITIR" ? "pagado" : "retenido"}</small>}
          </div>
        )}
        {nodos.map((n) => (
          <div key={n.id} className={`${s.nodo} ${n.activo ? s.activo : ""} ${n.falla ? s.fallo : ""}`}>
            <i />
            <b>{n.nombre}</b>
            <span>{n.texto}</span>
          </div>
        ))}
      </div>

      {caso && (
        <p className={s.ruta}>
          {caso.puerta === "alerta_aml" ? `alerta sobre ${caso.transaccion.destino}` : `${caso.transaccion.origen} → ${caso.transaccion.destino}`}
        </p>
      )}

      {terminado && chequeos && chequeos.chequeos.length > 0 && (
        <ul className={s.chequeos}>
          {chequeos.chequeos.map((c, i) => (
            <li key={i} className={c.ok ? "" : s.malo} title={c.valor} style={{ animationDelay: `${i * 70}ms` }}>
              {c.ok ? "✓" : "✗"} {c.texto}
            </li>
          ))}
        </ul>
      )}

      {terminado && caso && (
        <div className={s.pliegues}>
          <details>
            <summary>traza · {caso.timeline.length}</summary>
            <ol className={s.log}>
              {caso.timeline.map((e, i) => (
                <li key={i}>
                  <span>+{ms(caso.timeline[0].t, e.t)}ms</span>
                  <span className={s.actor}>{e.actor}</span>
                  <span>{linea(e)}</span>
                </li>
              ))}
            </ol>
          </details>
          {caso.evidencia.length > 0 && (
            <details>
              <summary>evidencia · {caso.evidencia.length}</summary>
              <ol className={s.log}>
                {caso.evidencia.map((e) => (
                  <li key={e.id}>
                    <span>{e.id}</span>
                    <span className={s.actor}>{e.fuente}</span>
                    <span>{JSON.stringify(e.dato).slice(0, 110)}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {caso.salidas.auditor && (
            <details>
              <summary>expediente · {caso.salidas.auditor.afirmaciones.length}</summary>
              <ol className={s.log}>
                {caso.salidas.auditor.afirmaciones.map((a, i) => (
                  <li key={i}>
                    <span className={s.actor}>{a.evidencia.join(" ")}</span>
                    <span>{a.texto}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Matriz({ r }: { r: ResultadoPrueba }) {
  const m = r.matriz!;
  const filas = Math.ceil(m.celdas.length / 50);
  const visibles = useRevelar(filas);
  const terminado = visibles >= filas;
  return (
    <div className={s.matriz}>
      <div className={s.grilla} aria-label={`${m.combinaciones} ataques`}>
        {m.celdas.slice(0, visibles * 50).map((d, i) => (
          <i key={i} className={color(d)} />
        ))}
      </div>
      <p className={s.leyenda}>
        {Object.entries(m.por_decision).map(([d, n]) => (
          <span key={d} className={color(d)}>
            <i /> {d.toLowerCase()} {n}
          </span>
        ))}
      </p>
      {terminado && (
        <ul className={s.chequeos}>
          {m.invariantes.map((v, i) => (
            <li key={v.id} className={v.violaciones === 0 ? "" : s.malo} style={{ animationDelay: `${i * 70}ms` }}>
              {v.violaciones === 0 ? "✓" : "✗"} {v.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
