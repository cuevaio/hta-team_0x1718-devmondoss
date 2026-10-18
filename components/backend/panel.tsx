"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Caso, EventoTimeline } from "@/lib/contracts";
import type { ResultadoPrueba } from "@/lib/demo/suite";
import s from "./panel.module.css";

/**
 * Panel del backend para presentar (`/demo`): corre la suite en vivo
 * (lib/demo/suite.ts) contra el pipeline real y muestra, prueba por prueba,
 * qué agentes actuaron, en qué orden, con qué evidencia y qué se verificó.
 *
 * Minimalista a propósito: una lista de pruebas a la izquierda y la traza de
 * la prueba elegida a la derecha.
 */

type Prueba = { id: string; titulo: string; demuestra: string };
type Agentes = { modo: "claude" | "ollama" | "simulado"; modelo: string | null };
type Estado = "espera" | "corriendo" | "ok" | "falla";

const CLAVE_TOKEN = "afs-demo-token";

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

/** Las etapas del pipeline, en el orden del doc 19. `actor` es el del timeline. */
const ETAPAS = [
  { actor: "reglas", nombre: "Reglas" },
  { actor: "memoria", nombre: "Memoria" },
  { actor: "red_regional", nombre: "Red" },
  { actor: "coordinador", nombre: "Coordinador" },
  { actor: "detective", nombre: "Detective" },
  { actor: "guardian", nombre: "Guardián" },
  { actor: "policy", nombre: "Policy" },
  { actor: "auditor", nombre: "Auditor" },
] as const;

const PASO_MS = 120;

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");

/** Una línea legible por evento: lo que un ingeniero querría ver en el log. */
function resumen(e: EventoTimeline): string {
  const d = (e.detalle ?? {}) as Record<string, unknown>;
  switch (e.evento) {
    case "caso_creado":
      return texto(d.puerta);
    case "nivel0_evaluado":
      return `score ${d.score} · ${lista(d.senales) || "sin señales"}`;
    case "pausa_preventiva":
      return "dinero retenido antes de consultar a ningún agente";
    case "plan":
      return d.salida_temprana ? `salida temprana · ${texto(d.motivo)}` : `invoca ${lista(d.invocar)} · ${texto(d.motivo)}`;
    case "riesgo_destino":
      return `riesgo ${d.riesgo_destino} · ${lista(d.tipologias)} · cita ${lista(d.evidencia)}`;
    case "pregunta":
    case "turno_pendiente":
      return `«${texto(d.mensaje)}»`;
    case "respuesta_guardian":
      return `cliente: «${texto(d.texto) || "(sin respuesta)"}»`;
    case "estado_usuario":
      return `${d.estado_usuario} · canal ${d.canal_usado ?? "—"}${lista(d.senales_manipulacion) ? ` · ${lista(d.senales_manipulacion)}` : ""}`;
    case "mula_confirmada":
      return `${d.cuenta} ya confirmada por un analista · sin IA`;
    case "mula_confirmada_en_red": {
      const em = d.emisor as { banco?: string; pais?: string } | undefined;
      return `${d.cuenta} confirmada por ${em?.banco} (${em?.pais}) · ${texto(d.expediente)}`;
    }
    case "atajo_determinista":
    case "decision":
      return `${d.accion} · ${d.regla} · ${texto(d.motivo)}`;
    case "expediente":
      return `recomienda ${d.recomendacion} · ${d.afirmaciones} afirmaciones citadas`;
    case "error_agentes":
      return `${texto(d.agente)}: ${texto(d.mensaje)}`;
    case "alerta_recibida":
      return texto(d.motivo);
    default: {
      const j = JSON.stringify(e.detalle ?? "");
      return j.length > 90 ? `${j.slice(0, 90)}…` : j;
    }
  }
}

/** El dato crudo de una tool, en una línea (sin la cuenta, que ya se ve). */
function dato(v: unknown): string {
  if (!v || typeof v !== "object") return String(v ?? "");
  return Object.entries(v as Record<string, unknown>)
    .filter(([k]) => k !== "cuenta" && k !== "pregunta")
    .map(([k, x]) => `${k} ${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" · ")
    .slice(0, 120);
}

const ms = (a: string, b: string) => Math.max(0, new Date(b).getTime() - new Date(a).getTime());

const claseAccion = (accion?: string) =>
  accion === "PERMITIR" ? s.permitir : accion === "ESCALAR" ? s.escalar : accion === "VERIFICAR" ? s.verificar : s.pausar;

export default function PanelBackend() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [agentes, setAgentes] = useState<Agentes | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoPrueba>>({});
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<{ ms: number } | null>(null);
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
      .catch(() => setError("No se pudo leer la suite del servidor."));
  }, []);

  const correr = useCallback(async () => {
    if (corriendo || !pruebas.length) return;
    setError(null);
    setResultados({});
    setTotal(null);
    setCorriendo(pruebas[0].id);
    setElegida(pruebas[0].id);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/demo/suite", {
        method: "POST",
        headers: token.current ? { "x-demo-token": token.current } : {},
      });
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(res.status === 401 || res.status === 403 ? "Falta el token del operador: abre /demo?token=…" : (b?.error ?? `error ${res.status}`));
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
          const i = pruebas.findIndex((p) => p.id === r.id);
          setCorriendo(pruebas[i + 1]?.id ?? null);
          // Un respiro para que se vea la traza antes de pasar a la siguiente.
          await new Promise((ok) => setTimeout(ok, Math.min(2200, 500 + (r.casos[0]?.timeline.length ?? 6) * PASO_MS)));
        }
      }
      setTotal({ ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCorriendo(null);
    }
  }, [corriendo, pruebas]);

  const hechas = Object.values(resultados);
  const ok = hechas.filter((r) => r.ok).length;
  const chequeos = hechas.reduce((n, r) => n + r.chequeos.length, 0);
  const llamadas = hechas.reduce((n, r) => n + r.casos.reduce((m, c) => m + c.ia.llamadas, 0), 0);
  const elegido = elegida ? resultados[elegida] : undefined;
  const pruebaElegida = pruebas.find((p) => p.id === elegida);

  return (
    <main className={s.panel}>
      <header className={s.barra}>
        <div className={s.marca}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          Mule Zero <span>/ backend</span>
        </div>
        <div className={s.modo}>
          agentes <b>{agentes ? (agentes.modelo ? `${agentes.modo} · ${agentes.modelo}` : agentes.modo) : "…"}</b>
        </div>
        <button className={s.correr} onClick={correr} disabled={Boolean(corriendo) || !pruebas.length}>
          {corriendo ? "corriendo…" : hechas.length ? "volver a correr" : "▶ correr suite"}
        </button>
      </header>

      <p className={s.resumen} aria-live="polite">
        {hechas.length === 0 && !corriendo && `${pruebas.length} pruebas contra el pipeline real · datos sintéticos`}
        {(hechas.length > 0 || corriendo) && (
          <>
            <b className={ok === hechas.length ? s.verde : s.rojo}>
              {ok}/{pruebas.length}
            </b>{" "}
            pruebas · {chequeos} chequeos · {llamadas} llamadas de IA
            {resultados.matriz?.matriz && ` · ${resultados.matriz.matriz.combinaciones} ataques`}
            {total && ` · ${(total.ms / 1000).toFixed(1)} s`}
          </>
        )}
      </p>
      {error && <p className={s.error}>{error}</p>}

      <div className={s.cuerpo}>
        <ol className={s.lista}>
          {pruebas.map((p, i) => {
            const r = resultados[p.id];
            const estado: Estado = r ? (r.ok ? "ok" : "falla") : corriendo === p.id ? "corriendo" : "espera";
            const c = r?.casos.at(-1);
            return (
              <li key={p.id}>
                <button className={`${s.fila} ${elegida === p.id ? s.elegida : ""}`} onClick={() => setElegida(p.id)} data-estado={estado}>
                  <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.titulo}>{p.titulo}</span>
                  <span className={`${s.decision} ${claseAccion(c?.decision?.accion)}`}>
                    {c?.decision ? `${c.decision.accion} ${c.decision.regla}` : r?.matriz ? `${r.matriz.combinaciones}` : ""}
                  </span>
                  <span className={s.punto} aria-label={estado} />
                </button>
              </li>
            );
          })}
        </ol>

        <section className={s.detalle}>
          {pruebaElegida && (
            <>
              <h2>{pruebaElegida.titulo}</h2>
              <p className={s.demuestra}>{pruebaElegida.demuestra}</p>
            </>
          )}
          {!elegido && pruebaElegida && <p className={s.vacio}>{corriendo === elegida ? "corriendo…" : "Sin correr todavía."}</p>}
          {elegido?.error && <p className={s.error}>{elegido.error}</p>}
          {elegido?.matriz && <Matriz r={elegido} />}
          {elegido?.casos.map((c) => <Traza key={`${elegido.id}-${c.id}`} caso={c} agentes={elegido.agentes} />)}
          {elegido && elegido.chequeos.length > 0 && <Chequeos r={elegido} />}
        </section>
      </div>
    </main>
  );
}

/** Revela los eventos uno a uno, como si se leyera el log en vivo. */
function useRevelar(n: number) {
  const [visibles, setVisibles] = useState(0);
  useEffect(() => {
    setVisibles(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setVisibles(i);
      if (i >= n) clearInterval(t);
    }, PASO_MS);
    return () => clearInterval(t);
  }, [n]);
  return visibles;
}

function Traza({ caso, agentes }: { caso: Caso; agentes: string }) {
  const visibles = useRevelar(caso.timeline.length);
  const vistos = caso.timeline.slice(0, visibles);
  const actores = new Set(vistos.map((e) => e.actor));
  const t0 = caso.timeline[0]?.t ?? "";
  const terminado = visibles >= caso.timeline.length;
  const auditor = caso.salidas.auditor;

  return (
    <div className={s.traza}>
      <div className={s.meta}>
        <span>{caso.id}</span>
        <span>
          {caso.transaccion.origen} → {caso.transaccion.destino}
          {caso.puerta === "transferencia" ? ` · S/ ${caso.transaccion.monto.toLocaleString("es-PE")}` : " · alerta AML"}
        </span>
        <span>
          {caso.ia.llamadas} llamadas IA{caso.ia.tokens ? ` · ${caso.ia.tokens} tokens` : ""} · agentes {agentes}
        </span>
      </div>

      <div className={s.etapas} aria-label="Etapas del pipeline">
        {ETAPAS.map((e, i) => (
          <span key={e.actor} className={`${s.etapa} ${actores.has(e.actor) ? s.activa : ""}`}>
            {i > 0 && <i aria-hidden="true">→</i>}
            {e.nombre}
          </span>
        ))}
        {terminado && caso.decision && (
          <b className={`${s.final} ${claseAccion(caso.decision.accion)}`}>
            {caso.decision.accion} · {caso.decision.regla}
          </b>
        )}
      </div>

      <ol className={s.log}>
        {vistos.map((e, i) => (
          <li key={i} className={e.evento === "decision" ? s.lineaDecision : e.evento === "error_agentes" ? s.lineaError : ""}>
            <span className={s.t}>+{ms(t0, e.t)}ms</span>
            <span className={s.actor}>{e.actor}</span>
            <span className={s.evento}>{e.evento}</span>
            <span className={s.que}>{resumen(e)}</span>
          </li>
        ))}
      </ol>

      {terminado && caso.evidencia.length > 0 && (
        <details className={s.bloque}>
          <summary>evidencia · {caso.evidencia.length} hechos calculados por las tools</summary>
          <ul>
            {caso.evidencia.map((e) => (
              <li key={e.id}>
                <b>{e.id}</b> <span className={s.actor}>{e.fuente}</span> {dato(e.dato)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {terminado && auditor && (
        <details className={s.bloque}>
          <summary>expediente del auditor · {auditor.afirmaciones.length} afirmaciones</summary>
          <ul>
            {auditor.afirmaciones.map((a, i) => (
              <li key={i}>
                {a.texto} <b>[{a.evidencia.join(" ")}]</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chequeos({ r }: { r: ResultadoPrueba }) {
  return (
    <ul className={s.chequeos}>
      {r.chequeos.map((c, i) => (
        <li key={i} className={c.ok ? s.verde : s.rojo}>
          <span>{c.ok ? "✓" : "✗"}</span> {c.texto}
          {c.valor && <em>{c.valor}</em>}
        </li>
      ))}
      <li className={s.tiempo}>{r.ms} ms en el servidor</li>
    </ul>
  );
}

function Matriz({ r }: { r: ResultadoPrueba }) {
  const m = r.matriz!;
  const visibles = useRevelar(Math.ceil(m.celdas.length / 25));
  return (
    <div className={s.matriz}>
      <div className={s.grilla} aria-label={`${m.combinaciones} ataques`}>
        {m.celdas.slice(0, visibles * 25).map((d, i) => (
          <i key={i} className={claseAccion(d)} />
        ))}
      </div>
      <p className={s.leyenda}>
        {Object.entries(m.por_decision).map(([d, n]) => (
          <span key={d}>
            <i className={claseAccion(d)} /> {d} {n}
          </span>
        ))}
      </p>
      <ul className={s.chequeos}>
        {m.invariantes.map((v) => (
          <li key={v.id} className={v.violaciones === 0 ? s.verde : s.rojo}>
            <span>{v.violaciones === 0 ? "✓" : "✗"}</span> {v.id} · {v.texto}
            <em>{v.violaciones} violaciones</em>
          </li>
        ))}
        <li className={s.tiempo}>
          {r.ms} ms en el servidor · agentes {r.agentes}
        </li>
      </ul>
    </div>
  );
}
