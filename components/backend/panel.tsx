"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, CircleCheck, CircleX, Gauge, Loader2, Play, X } from "lucide-react";
import type { Caso, EventoTimeline } from "@/lib/contracts";
import type { ResultadoPrueba } from "@/lib/demo/suite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Panel del backend para presentar (`/demo`), con shadcn/ui: corre la suite en
 * vivo (lib/demo/suite.ts) contra el pipeline real y la dibuja como un flujo
 * (qué agentes actuaron, dónde quedó retenido el dinero) junto a la terminal
 * del backend, línea por línea. Las dos avanzan juntas y con pausas, para que
 * se pueda seguir y contar en voz alta; el servidor ya resolvió todo antes.
 */

type Prueba = { id: string; titulo: string; demuestra: string };
type Agentes = { modo: "claude" | "ollama" | "simulado"; modelo: string | null };
type Detalle = Record<string, unknown>;

const CLAVE_TOKEN = "afs-demo-token";

/** Pausas de la reproducción (ms, a velocidad 1×). */
const PAUSA = { comando: 500, evento: 750, tool: 320, decision: 1100, cierre: 700, lote: 320 };
/** Lo que se espera en pantalla con el resultado completo antes de pasar a la prueba siguiente. */
const RESPIRO_MS = 1800;

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

const COLOR: Record<string, string> = {
  PERMITIR: "text-emerald-400",
  PAUSAR: "text-amber-400",
  VERIFICAR: "text-sky-400",
  ESCALAR: "text-rose-400",
};

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
    dato: (d, e) =>
      e.evento === "estado_usuario" ? (ESTADO_CLIENTE[String(d.estado_usuario)] ?? String(d.estado_usuario)) : e.evento === "turno_pendiente" ? "sin respuesta" : "pregunta",
  },
  { id: "policy", nombre: "Policy", de: (e) => e.actor === "policy", dato: (d) => String(d.regla ?? "") },
  { id: "auditor", nombre: "Auditor", de: (e) => e.evento === "expediente", dato: (d) => `${d.afirmaciones} citas` },
];

/** Una línea de log por evento (pestaña Traza). */
function linea(e: EventoTimeline): string {
  const d = (e.detalle ?? {}) as Detalle;
  const l = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
  switch (e.evento) {
    case "caso_creado":
      return String(d.puerta ?? "");
    case "nivel0_evaluado":
      return `score ${d.score} · ${l(d.senales) || "sin señales"}`;
    case "pausa_preventiva":
      return `dinero retenido antes de consultar a ningún agente (score ${d.score})`;
    case "expediente":
      return `recomienda ${d.recomendacion} · ${d.afirmaciones} afirmaciones citadas`;
    case "mula_confirmada":
      return `${d.cuenta} ya confirmada por un analista`;
    case "mula_confirmada_en_red":
      return `${d.cuenta} confirmada por ${(d.emisor as { banco?: string } | undefined)?.banco ?? "otro banco"}`;
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
      return j.length > 90 ? `${j.slice(0, 90)}…` : j;
    }
  }
}

type Linea = {
  t?: string;
  tag: string;
  texto: string;
  tipo: "cmd" | "evento" | "tool" | "decision" | "error" | "ok";
  /** Cuántos eventos del timeline quedan revelados cuando aparece esta línea. */
  ev: number;
  espera: number;
};

/** Un dato de tool en una línea: `remitentes_nuevos=14 ventana_horas=48`. */
function datoCorto(v: unknown): string {
  if (!v || typeof v !== "object") return String(v ?? "");
  return Object.entries(v as Detalle)
    .filter(([k]) => !["cuenta", "pregunta", "texto", "id"].includes(k))
    .map(([k, x]) => `${k}=${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" ")
    .slice(0, 110);
}

/**
 * La terminal del caso: cada evento del timeline y, antes del agente que las
 * usó, las tools que corrió (con el id de evidencia que emitieron).
 */
function terminal(r: ResultadoPrueba, caso: Caso): Linea[] {
  const t0 = caso.timeline[0]?.t ?? "";
  const usadas = new Set<string>();
  const cuenta = caso.transaccion.destino;
  const tools = (ids: string[], ev: number): Linea[] =>
    ids.flatMap((id) => {
      const e = caso.evidencia.find((x) => x.id === id);
      if (!e || usadas.has(id)) return [];
      usadas.add(id);
      return [{ tag: "tool", texto: `${e.fuente}(${cuenta}) → ${e.id}  ${datoCorto(e.dato)}`, tipo: "tool" as const, ev, espera: PAUSA.tool }];
    });
  const porFuente = (fuente: string) => caso.evidencia.filter((e) => e.fuente === fuente).map((e) => e.id);
  const citas = (d: Detalle) => (Array.isArray(d.evidencia) ? (d.evidencia as string[]) : []);

  const lineas: Linea[] = [
    {
      tag: "$",
      texto:
        caso.puerta === "alerta_aml"
          ? `POST /api/alerts  cuenta=${cuenta}`
          : `POST /api/transfers  ${caso.transaccion.origen} → ${cuenta}  S/ ${caso.transaccion.monto.toLocaleString("es-PE")}`,
      tipo: "cmd",
      ev: 0,
      espera: PAUSA.comando,
    },
  ];
  caso.timeline.forEach((e, i) => {
    const d = (e.detalle ?? {}) as Detalle;
    if (e.evento === "riesgo_destino" || e.evento === "estado_usuario") lineas.push(...tools(citas(d), i));
    if (e.evento === "pregunta") lineas.push(...tools(porFuente("guardian_pregunta"), i));
    if (e.evento === "expediente") lineas.push(...tools(caso.evidencia.map((x) => x.id), i));
    const tipo = e.evento === "decision" ? "decision" : e.evento === "error_agentes" ? "error" : "evento";
    lineas.push({ t: `+${ms(t0, e.t)}ms`, tag: e.actor, texto: `${e.evento}  ${linea(e)}`, tipo, ev: i + 1, espera: tipo === "decision" ? PAUSA.decision : PAUSA.evento });
  });
  const ok = r.chequeos.filter((c) => c.ok).length;
  lineas.push({
    tag: r.ok ? "✓" : "✗",
    texto: `${ok}/${r.chequeos.length} chequeos · ${caso.ia.llamadas} llamadas de IA · ${duracion(r.ms)} en el servidor`,
    tipo: r.ok ? "ok" : "error",
    ev: caso.timeline.length,
    espera: PAUSA.cierre,
  });
  return lineas;
}

/** La terminal de la matriz: un lote de 50 ataques por línea. */
function terminalMatriz(r: ResultadoPrueba): Linea[] {
  const m = r.matriz!;
  const porTactica = m.celdas.length / m.tacticas.length;
  const lotes = Math.ceil(m.celdas.length / 50);
  const lineas: Linea[] = [{ tag: "$", texto: `matriz  ${m.combinaciones} ataques · agentes ${r.agentes}`, tipo: "cmd", ev: 0, espera: PAUSA.comando }];
  for (let i = 0; i < lotes; i++) {
    const lote = m.celdas.slice(i * 50, i * 50 + 50);
    const cuenta = (a: string) => lote.filter((x) => x === a).length;
    lineas.push({
      tag: m.tacticas[Math.floor((i * 50) / porTactica)] ?? "",
      texto: `lote ${String(i + 1).padStart(2, "0")}/${lotes}  escalar=${cuenta("ESCALAR")} pausar=${cuenta("PAUSAR")} verificar=${cuenta("VERIFICAR")} permitir=${cuenta("PERMITIR")}`,
      tipo: "evento",
      ev: i + 1,
      espera: PAUSA.lote,
    });
  }
  const huecos = m.invariantes.reduce((n, v) => n + v.violaciones, 0);
  lineas.push({ tag: huecos ? "✗" : "✓", texto: `${m.invariantes.length} invariantes · ${huecos} violaciones · ${duracion(r.ms)} en el servidor`, tipo: huecos ? "error" : "ok", ev: lotes, espera: PAUSA.cierre });
  return lineas;
}

const lineasDe = (r: ResultadoPrueba) => (r.matriz ? terminalMatriz(r) : r.casos[0] ? terminal(r, r.casos[0]) : []);
const total = (lineas: Linea[], velocidad: number) => lineas.reduce((n, l) => n + l.espera, 0) / velocidad;

const ms = (a: string, b: string) => Math.max(0, new Date(b).getTime() - new Date(a).getTime());
const duracion = (t: number) => (t < 1000 ? `${t} ms` : `${(t / 1000).toFixed(1)} s`);

export default function PanelBackend() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [agentes, setAgentes] = useState<Agentes | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoPrueba>>({});
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [velocidad, setVelocidad] = useState(1);
  const token = useRef<string | null>(null);
  const vel = useRef(1);
  vel.current = velocidad;

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
        throw new Error(res.status === 401 || res.status === 403 ? "Falta el token: abre /demo?token=…" : (b?.error ?? `error ${res.status}`));
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
          // Se reproduce entera (terminal + flujo) antes de pasar a la siguiente.
          await new Promise((ok) => setTimeout(ok, total(lineasDe(r), vel.current) + RESPIRO_MS / vel.current));
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
    <div className="ui-oscuro dark bg-background text-foreground min-h-dvh font-sans antialiased">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8">
        <header className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-amber-400">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">Mule Zero</span>
          <div className="ml-auto flex items-center gap-2">
            {agentes && (
              <Badge variant="outline" className="text-muted-foreground font-mono max-sm:hidden">
                {agentes.modelo ?? agentes.modo}
              </Badge>
            )}
            {hechas.length > 0 && (
              <Badge variant="secondary" className={cn("font-mono", ok === hechas.length ? "text-emerald-400" : "text-rose-400")}>
                {ok}/{pruebas.length}
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground font-mono" onClick={() => setVelocidad((v) => (v === 1 ? 2 : 1))} title="Velocidad de la reproducción">
              <Gauge />
              {velocidad}×
            </Button>
            <Button onClick={correr} disabled={Boolean(corriendo) || !pruebas.length}>
              {corriendo ? <Loader2 className="animate-spin" /> : <Play />}
              {corriendo ? "Corriendo" : "Correr suite"}
            </Button>
          </div>
        </header>

        <Progress value={pruebas.length ? (hechas.length / pruebas.length) * 100 : 0} className="h-1" />
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav className="grid content-start gap-0.5 self-start max-lg:grid-cols-2" aria-label="Pruebas">
            {pruebas.map((p, i) => {
              const r = resultados[p.id];
              // Mientras se reproduce, sigue «corriendo» aunque el servidor ya respondió.
              const Icono = corriendo === p.id ? Loader2 : r ? (r.ok ? CircleCheck : CircleX) : Circle;
              return (
                <Button
                  key={p.id}
                  variant="ghost"
                  onClick={() => setElegida(p.id)}
                  className={cn("text-muted-foreground justify-start gap-3 px-3 font-normal", elegida === p.id && "bg-accent text-foreground")}
                >
                  <span className="text-muted-foreground/60 w-5 font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 truncate text-left">{p.titulo}</span>
                  <Icono
                    className={cn(
                      corriendo === p.id ? "animate-spin text-amber-400" : r ? (r.ok ? "text-emerald-400" : "text-rose-400") : "text-muted-foreground/30",
                    )}
                  />
                </Button>
              );
            })}
          </nav>

          {prueba && (
            <Vista
              key={`${prueba.id}-${elegido ? "listo" : corriendo === prueba.id ? "corriendo" : "vacio"}`}
              prueba={prueba}
              r={elegido}
              esperando={corriendo === prueba.id && !elegido}
              velocidad={velocidad}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Revela las líneas de a una, cada una con su pausa. */
function useReproducir(esperas: number[], velocidad: number) {
  const [visibles, setVisibles] = useState(0);
  const clave = esperas.join(",");
  useEffect(() => {
    setVisibles(0);
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const siguiente = () => {
      if (i >= esperas.length) return;
      t = setTimeout(() => {
        setVisibles(++i);
        siguiente();
      }, esperas[i] / velocidad);
    };
    siguiente();
    return () => clearTimeout(t);
    // `clave` resume `esperas`; la velocidad nueva aplica desde la próxima prueba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return visibles;
}

function Vista({ prueba, r, esperando, velocidad }: { prueba: Prueba; r?: ResultadoPrueba; esperando: boolean; velocidad: number }) {
  const lineas = useMemo(() => (r ? lineasDe(r) : []), [r]);
  const visibles = useReproducir(
    lineas.map((l) => l.espera),
    velocidad,
  );
  const terminado = Boolean(r) && visibles >= lineas.length;
  const ev = lineas[visibles - 1]?.ev ?? 0;
  const caso = r?.casos[0];
  const m = r?.matriz;
  const huecos = m ? m.invariantes.reduce((n, v) => n + v.violaciones, 0) : 0;

  return (
    <Card className="min-w-0 gap-6">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">{prueba.titulo}</CardTitle>
        <CardDescription className="text-base">{prueba.demuestra}</CardDescription>
        {terminado && (caso?.decision || m) && (
          <CardAction className="animate-entra text-right">
            <div className={cn("font-mono text-2xl font-semibold tracking-tight", caso?.decision ? COLOR[caso.decision.accion] : huecos ? "text-rose-400" : "text-emerald-400")}>
              {caso?.decision ? caso.decision.accion : `${huecos} huecos`}
            </div>
            <div className="text-muted-foreground font-mono text-xs">
              {caso?.decision ? `${caso.decision.regla} · ${caso.ia.llamadas} IA` : `${m!.combinaciones} ataques`} · {duracion(r!.ms)}
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {r?.error && <p className="text-destructive text-sm">{r.error}</p>}
        {m ? (
          <Matriz r={r!} lotes={ev} terminado={terminado} />
        ) : (
          <Tabs defaultValue="flujo" className="gap-6">
            <TabsList className="self-center">
              <TabsTrigger value="flujo">Flujo</TabsTrigger>
              <TabsTrigger value="evidencia" disabled={!terminado || !caso?.evidencia.length}>
                Evidencia
              </TabsTrigger>
              <TabsTrigger value="expediente" disabled={!terminado || !caso?.salidas.auditor}>
                Expediente
              </TabsTrigger>
            </TabsList>
            <TabsContent value="flujo" className="flex flex-col gap-6">
              <Flujo caso={caso} eventos={ev} terminado={terminado} esperando={esperando} />
            </TabsContent>
            <TabsContent value="evidencia">
              <Tabla filas={(caso?.evidencia ?? []).map((e) => [e.id, e.fuente, datoCorto(e.dato)])} />
            </TabsContent>
            <TabsContent value="expediente">
              <Tabla filas={(caso?.salidas.auditor?.afirmaciones ?? []).map((a) => [a.evidencia.join(" "), "", a.texto])} />
            </TabsContent>
          </Tabs>
        )}
        <Terminal lineas={lineas.slice(0, visibles)} esperando={esperando} activo={Boolean(r) && !terminado} />
        {/* Debajo de la terminal, para que no la empujen al aparecer. */}
        {!m && terminado && r && <Chequeos items={r.chequeos} />}
        {m && terminado && (
          <Chequeos items={m.invariantes.map((v) => ({ texto: v.texto, ok: v.violaciones === 0, valor: `${v.violaciones} violaciones` }))} />
        )}
      </CardContent>
    </Card>
  );
}

const COLOR_TAG: Record<Linea["tipo"], string> = {
  cmd: "text-amber-300",
  evento: "text-sky-400",
  tool: "text-violet-300/80",
  decision: "text-amber-300",
  error: "text-rose-400",
  ok: "text-emerald-400",
};

/** La terminal del backend: lo que el servidor fue haciendo, en orden. */
function Terminal({ lineas, esperando, activo }: { lineas: Linea[]; esperando: boolean; activo: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lineas.length]);
  return (
    <div className="overflow-hidden rounded-lg border bg-black/40">
      <div className="text-muted-foreground flex items-center gap-1.5 border-b px-3 py-2 font-mono text-[11px]">
        <i className="size-2.5 rounded-full bg-rose-400/70" />
        <i className="size-2.5 rounded-full bg-amber-400/70" />
        <i className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2">backend · pipeline</span>
        {(esperando || activo) && <Loader2 className="ml-auto size-3 animate-spin" />}
      </div>
      <div ref={caja} className="h-56 overflow-y-auto px-3 py-2 font-mono text-xs leading-6">
        {esperando && (
          <div className="text-muted-foreground animate-entra">
            <span className="text-amber-300">$</span> esperando al pipeline…
          </div>
        )}
        {lineas.map((l, i) => (
          <div key={i} className={cn("animate-entra grid grid-cols-[64px_116px_minmax(0,1fr)] gap-3 max-md:grid-cols-[48px_minmax(0,1fr)]", l.tipo === "tool" && "text-muted-foreground")}>
            <span className="text-muted-foreground/60 text-right max-md:hidden">{l.t ?? ""}</span>
            <span className={cn("truncate", COLOR_TAG[l.tipo])}>{l.tag}</span>
            <span className={cn("break-words", l.tipo === "decision" && "text-amber-200", l.tipo === "ok" && "text-emerald-300", l.tipo === "error" && "text-rose-300")}>{l.texto}</span>
          </div>
        ))}
        {(activo || esperando) && <span className="bg-foreground/70 inline-block h-3.5 w-1.5 animate-pulse align-middle" />}
      </div>
    </div>
  );
}

function Chequeos({ items }: { items: Array<{ texto: string; ok: boolean; valor?: string }> }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((c, i) => (
        <Badge
          key={i}
          variant="secondary"
          title={c.valor}
          className={cn("animate-entra h-7 gap-1.5 px-3 text-[13px] font-normal", c.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300")}
          style={{ animationDelay: `${i * 90}ms` }}
        >
          {c.ok ? <Check /> : <X />}
          {c.texto}
        </Badge>
      ))}
    </div>
  );
}

function Tabla({ filas }: { filas: string[][] }) {
  return (
    <div className="divide-border divide-y font-mono text-xs">
      {filas.map(([a, b, c], i) => (
        <div key={i} className="grid grid-cols-[80px_130px_minmax(0,1fr)] gap-3 py-2 first:pt-0 max-md:grid-cols-[70px_minmax(0,1fr)]">
          <span className="text-muted-foreground">{a}</span>
          <span className="text-sky-400 max-md:hidden">{b}</span>
          <span className="break-words">{c}</span>
        </div>
      ))}
    </div>
  );
}

function Flujo({ caso, eventos, terminado, esperando }: { caso?: Caso; eventos: number; terminado: boolean; esperando: boolean }) {
  const vistos = caso?.timeline.slice(0, eventos) ?? [];

  const fallidos = new Set(vistos.filter((e) => e.evento === "error_agentes").map((e) => String((e.detalle as Detalle)?.agente)));
  const nodos = NODOS.map((n) => {
    const ev = [...vistos].reverse().find(n.de);
    const falla = fallidos.has(n.id) || (n.id === "coordinador" && fallidos.has("orquestador"));
    return { ...n, activo: Boolean(ev) || falla, falla, texto: falla ? "falla" : ev ? n.dato((ev.detalle ?? {}) as Detalle, ev) : "" };
  });
  const ultimo = nodos.reduce((m, n, i) => (n.activo ? i : m), -1);

  // Dónde queda el dinero: en la primera etapa que lo retiene; si se permite, llega al final.
  const accion = terminado ? caso?.decision?.accion : undefined;
  const retenidoEn = nodos.findIndex((n) => n.retiene && n.activo);
  const policy = nodos.findIndex((n) => n.id === "policy");
  const pos = accion === "PERMITIR" ? NODOS.length - 1 : retenidoEn >= 0 ? retenidoEn : accion ? policy : Math.max(0, ultimo);
  const colorDinero = accion === "PERMITIR" ? "text-emerald-400" : retenidoEn >= 0 || accion ? "text-amber-400" : "text-foreground";
  const mitad = 100 / NODOS.length / 2;

  return (
    <div className="relative grid grid-cols-9 pt-14 max-md:grid-cols-3 max-md:gap-y-6 max-md:pt-0">
      <div
        className={cn("bg-border absolute top-[63px] h-0.5 rounded-full max-md:hidden", esperando && "bg-muted-foreground/40 animate-pulse")}
        style={{ left: `${mitad}%`, right: `${mitad}%` }}
      />
      <div
        className="to-foreground absolute top-[63px] h-0.5 rounded-full bg-gradient-to-r from-sky-400 transition-[width] duration-500 max-md:hidden"
        style={{ left: `${mitad}%`, width: `${(Math.max(0, ultimo) / NODOS.length) * 100}%` }}
      />
      {caso?.puerta === "transferencia" && (
        <div
          className={cn("absolute top-0 flex -translate-x-1/2 flex-col items-center transition-[left,color] duration-700 max-md:hidden", colorDinero)}
          style={{ left: `${((pos + 0.5) / NODOS.length) * 100}%` }}
        >
          <Badge variant="outline" className="bg-background border-current font-mono text-current">
            S/ {caso.transaccion.monto.toLocaleString("es-PE")}
            {(accion || retenidoEn >= 0) && <span className="opacity-70">· {accion === "PERMITIR" ? "pagado" : "retenido"}</span>}
          </Badge>
          <span className="mt-1 h-3 w-px bg-current opacity-50" />
        </div>
      )}
      {nodos.map((n) => (
        <div key={n.id} className="flex flex-col items-center gap-1.5 text-center">
          <span
            className={cn(
              "z-10 size-4 rounded-full border-2 transition-all duration-500",
              n.falla
                ? "border-rose-400 bg-rose-400 ring-4 ring-rose-400/15"
                : n.activo
                  ? "border-foreground bg-foreground ring-foreground/10 ring-4"
                  : "border-muted bg-background",
            )}
          />
          <span className={cn("mt-2 text-sm transition-colors duration-500", n.activo ? "text-foreground font-medium" : "text-muted-foreground/40")}>{n.nombre}</span>
          <span className={cn("min-h-4 font-mono text-[11px]", n.falla ? "text-rose-400" : "text-muted-foreground")}>{n.texto}</span>
        </div>
      ))}
    </div>
  );
}

function Matriz({ r, lotes, terminado }: { r: ResultadoPrueba; lotes: number; terminado: boolean }) {
  const m = r.matriz!;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(50,minmax(0,1fr))] gap-[3px]" aria-label={`${m.combinaciones} ataques`}>
        {m.celdas.map((d, i) => (
          <i
            key={i}
            className={cn("aspect-square rounded-[2px] transition-colors duration-300", i < lotes * 50 ? cn("bg-current", COLOR[d]) : "bg-muted/40")}
          />
        ))}
      </div>
      {terminado && (
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(m.por_decision).map(([d, n]) => (
            <Badge key={d} variant="outline" className={cn("animate-entra gap-1.5 font-mono", COLOR[d])}>
              <i className="size-2 rounded-[2px] bg-current" /> {d.toLowerCase()} {n}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
