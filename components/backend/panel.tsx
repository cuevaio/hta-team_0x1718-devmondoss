"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, CircleCheck, CircleX, Gauge, Loader2, MessageSquareText, Play, X } from "lucide-react";
import type { ResultadoPrueba } from "@/lib/demo/suite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { COLOR_ACCION, Explicacion } from "./explicacion";
import { Flujo } from "./flujo";
import { duracion, lineasDe, type Linea, type Nota } from "./narrador";

/**
 * Panel del backend para presentar (`/demo`), con shadcn/ui. Corre la suite en
 * vivo (lib/demo/suite.ts) contra el pipeline real y la reproduce paso a paso:
 * el flujo de agentes, la terminal del backend y un narrador que, en los
 * momentos clave, detiene todo con un diálogo hecho de los datos del caso
 * (lib: ./narrador.ts). El servidor ya resolvió todo; la reproducción es para
 * que se pueda seguir y contar en voz alta.
 */

type Prueba = { id: string; titulo: string; demuestra: string };
type Agentes = { modo: "claude" | "ollama" | "simulado"; modelo: string | null };

/** Lo que se espera en pantalla con el resultado completo antes de pasar a la prueba siguiente. */
const RESPIRO_MS = 800;
/** Modo 90 s: la demo completa dura 1:30 (de 3 min de exposición, la mitad es esta). */
const META_MS = 90_000;
const RESPIRO_90_MS = 150;
/** Cuenta regresiva antes de empezar: 3, 2, 1 y «YA». */
const CUENTA = [3, 2, 1, 0];

const reloj = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function PanelBackend() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [agentes, setAgentes] = useState<Agentes | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoPrueba>>({});
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [velocidad, setVelocidad] = useState(1);
  const [explicar, setExplicar] = useState(true);
  const [meta90, setMeta90] = useState(true);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [inicio, setInicio] = useState<number | null>(null);
  const [transcurrido, setTranscurrido] = useState(0);
  /** Pruebas que ya se terminaron de reproducir (para el contador de dinero protegido). */
  const [vistas, setVistas] = useState<string[]>([]);
  const vel = useRef(1);
  vel.current = velocidad;
  const meta = useRef(true);
  meta.current = meta90;
  const explica = useRef(true);
  explica.current = explicar;
  /** Lo resuelve la vista cuando terminó de reproducir la prueba en curso. */
  const fin = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch("/api/demo/suite")
      .then((r) => r.json())
      .then((d: { pruebas: Prueba[]; agentes: Agentes }) => {
        setPruebas(d.pruebas);
        setAgentes(d.agentes);
        setElegida(d.pruebas[0]?.id ?? null);
      })
      .catch(() => setError("Sin conexión con el servidor."));
  }, []);

  // Reloj de la demo: corre desde el «YA» hasta que termina la última prueba.
  useEffect(() => {
    if (inicio === null || !corriendo) return;
    const id = setInterval(() => setTranscurrido(Date.now() - inicio), 200);
    return () => clearInterval(id);
  }, [inicio, corriendo]);

  const correr = useCallback(async () => {
    if (corriendo || !pruebas.length) return;
    setError(null);
    setResultados({});
    setVistas([]);
    setInicio(null);
    setTranscurrido(0);
    setCorriendo(pruebas[0].id);
    setElegida(pruebas[0].id);
    // Cuenta regresiva: así se sabe a qué hora empieza todo.
    for (const n of CUENTA) {
      setCuenta(n);
      await new Promise((ok) => setTimeout(ok, n === 0 ? 600 : 900));
    }
    setCuenta(null);
    const t0 = Date.now();
    setInicio(t0);
    try {
      const res = await fetch("/api/demo/suite", { method: "POST" });
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(res.status === 409 ? "La suite ya está corriendo en otra pestaña." : (b?.error ?? `error ${res.status}`));
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
          if (meta.current) {
            // Modo 90 s: a cada prueba le toca su parte del tiempo que queda,
            // y la reproducción se acelera lo necesario para caber en ella.
            const natural = lineasDe(r).reduce((t, x) => t + x.espera + (explica.current && x.nota?.modo === "dialogo" ? x.nota.dura : 0), 0);
            const restantes = pruebas.length - pruebas.findIndex((p) => p.id === r.id);
            const libre = META_MS - (Date.now() - t0) - restantes * RESPIRO_90_MS;
            // También desacelera (hasta 0,4×): si sobra tiempo, se llena; la demo dura 1:30, no menos.
            setVelocidad(Math.min(12, Math.max(0.4, natural / Math.max(1500, libre / restantes))));
          }
          setResultados((prev) => ({ ...prev, [r.id]: r }));
          setElegida(r.id);
          // Se reproduce entera (con sus diálogos) antes de pasar a la siguiente.
          await new Promise<void>((ok) => {
            fin.current = ok;
            setTimeout(ok, 5 * 60_000);
          });
          fin.current = null;
          setVistas((v) => [...v, r.id]);
          await new Promise((ok) => setTimeout(ok, meta.current ? RESPIRO_90_MS : RESPIRO_MS / vel.current));
          const i = pruebas.findIndex((p) => p.id === r.id);
          const siguiente = pruebas[i + 1]?.id ?? null;
          setCorriendo(siguiente);
          if (siguiente) setElegida(siguiente);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranscurrido(Date.now() - t0);
      setCorriendo(null);
    }
  }, [corriendo, pruebas]);

  const hechas = Object.values(resultados);
  const ok = hechas.filter((r) => r.ok).length;
  const elegido = elegida ? resultados[elegida] : undefined;
  const prueba = pruebas.find((p) => p.id === elegida);
  const alTerminar = useCallback(() => fin.current?.(), []);
  const protegido = vistas.reduce((n, id) => {
    const c = resultados[id]?.casos[0];
    return c?.puerta === "transferencia" && c.decision && c.decision.accion !== "PERMITIR" ? n + c.transaccion.monto : n;
  }, 0);

  return (
    <div className="ui-oscuro dark bg-background text-foreground min-h-dvh font-sans antialiased">
      {cuenta !== null && (
        <div className="bg-background/90 fixed inset-0 z-50 grid place-items-center backdrop-blur-sm" role="status" aria-live="assertive">
          <div className="text-center">
            <div key={cuenta} className="animate-entra font-mono text-[14rem] leading-none font-semibold tracking-tighter text-amber-400 max-sm:text-[9rem]">
              {cuenta === 0 ? "YA" : cuenta}
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-sm">{meta90 ? "la demo dura 1:30" : "empieza la demo"}</p>
          </div>
        </div>
      )}
      <div className="mx-auto flex h-dvh max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-8">
        <header className="flex shrink-0 flex-wrap items-center gap-4">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 text-amber-400">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          <span className="text-2xl font-semibold tracking-tight">Mule Zero</span>
          {agentes && (
            <Badge variant="outline" className="text-muted-foreground font-mono text-sm max-sm:hidden">
              {agentes.modelo ?? agentes.modo}
            </Badge>
          )}

          {/* El contador de la simulación: reloj, pruebas y dinero protegido. */}
          <div className="ml-auto flex items-center gap-6 font-mono tabular-nums">
            <div className="text-right" title="Dinero que la simulación dejó retenido">
              <div className="text-2xl font-semibold text-amber-400">S/ {protegido.toLocaleString("es-PE")}</div>
              <div className="text-muted-foreground text-xs">protegidos</div>
            </div>
            <div className="text-right">
              <div className={cn("text-2xl font-semibold", hechas.length && ok === hechas.length ? "text-emerald-400" : hechas.length ? "text-rose-400" : "text-muted-foreground")}>
                {ok}/{pruebas.length || 11}
              </div>
              <div className="text-muted-foreground text-xs">pruebas</div>
            </div>
            <div className="text-right" title="Tiempo de la demo (meta 1:30)">
              <div className={cn("text-4xl font-semibold", transcurrido > META_MS + 999 ? "text-rose-400" : corriendo ? "text-foreground" : inicio !== null ? "text-emerald-400" : "text-muted-foreground")}>
                {reloj(transcurrido)}
              </div>
              <div className="text-muted-foreground text-xs">de {reloj(META_MS)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className={cn("font-mono", explicar ? "text-sky-300" : "text-muted-foreground")}
              onClick={() => setExplicar((v) => !v)}
              title="Detener el flujo para explicar los momentos clave"
            >
              <MessageSquareText />
              {explicar ? "explicar" : "sin pausas"}
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground font-mono"
              onClick={() => {
                // 90 s → 1× → 2× → 90 s
                if (meta90) {
                  setMeta90(false);
                  setVelocidad(1);
                } else if (velocidad === 1) setVelocidad(2);
                else setMeta90(true);
              }}
              title="Velocidad: 90 s ajusta todo para durar 1:30"
            >
              <Gauge />
              {meta90 ? "90 s" : `${velocidad}×`}
            </Button>
            <Button size="lg" onClick={correr} disabled={Boolean(corriendo) || !pruebas.length} className="ml-1 text-base">
              {corriendo ? <Loader2 className="animate-spin" /> : <Play />}
              {corriendo ? "Corriendo" : "Correr suite"}
            </Button>
          </div>
        </header>

        <p className="text-muted-foreground -mt-2 shrink-0 truncate text-sm">
          Corre dentro del banco, entre el motor de riesgo y la ejecución del pago: <strong className="text-foreground font-medium">infraestructura, no una app</strong>.
          Ejemplo para Perú: un banco como el BCP. Datos 100% sintéticos; sin relación con el banco.
        </p>

        <Progress value={meta90 && corriendo ? Math.min(100, (transcurrido / META_MS) * 100) : pruebas.length ? (hechas.length / pruebas.length) * 100 : 0} className="h-1.5 shrink-0" />
        {error && <p className="text-destructive text-base">{error}</p>}

        {/* Las pruebas, en una fila: así la tarjeta usa todo el ancho de la pantalla. */}
        <nav className="flex shrink-0 flex-wrap gap-1.5" aria-label="Pruebas">
          {pruebas.map((p, i) => {
            const r = resultados[p.id];
            // Mientras se reproduce, sigue «corriendo» aunque el servidor ya respondió.
            const Icono = corriendo === p.id ? Loader2 : r ? (r.ok ? CircleCheck : CircleX) : Circle;
            const activa = elegida === p.id;
            return (
              <Button
                key={p.id}
                variant="ghost"
                disabled={Boolean(corriendo)}
                onClick={() => setElegida(p.id)}
                title={p.titulo}
                className={cn("text-muted-foreground h-10 gap-2 px-3 font-mono text-sm disabled:opacity-100", activa && "bg-accent text-foreground")}
              >
                <Icono
                  className={cn(
                    "size-4",
                    corriendo === p.id ? "animate-spin text-amber-400" : r ? (r.ok ? "text-emerald-400" : "text-rose-400") : "text-muted-foreground/30",
                  )}
                />
                {i + 1}
                {activa && <span className="font-sans">{p.titulo}</span>}
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
              explicar={explicar}
              alTerminar={alTerminar}
            />
          )}
      </div>
    </div>
  );
}

/**
 * Reproduce las líneas de a una, cada una con su pausa. Si una línea trae una
 * nota de diálogo, el flujo espera a que se cierre. Las demás notas no se
 * muestran: la terminal y el flujo ya cuentan esos pasos.
 */
function useReproducir(lineas: Linea[], velocidad: number, explicar: boolean) {
  const [visibles, setVisibles] = useState(0);
  const [nota, setNota] = useState<Nota | null>(null);
  const vel = useRef(velocidad);
  vel.current = velocidad;
  const exp = useRef(explicar);
  exp.current = explicar;

  useEffect(() => {
    if (nota || visibles >= lineas.length) return;
    const l = lineas[visibles];
    const t = setTimeout(() => {
      setVisibles((v) => v + 1);
      const n = l.nota;
      if (!n) return;
      if (n.modo === "dialogo" && exp.current) setNota(n);
    }, l.espera / vel.current);
    return () => clearTimeout(t);
  }, [lineas, visibles, nota]);

  const continuar = useCallback(() => setNota(null), []);
  return { visibles, nota, continuar };
}

function Vista({
  prueba,
  r,
  esperando,
  velocidad,
  explicar,
  alTerminar,
}: {
  prueba: Prueba;
  r?: ResultadoPrueba;
  esperando: boolean;
  velocidad: number;
  explicar: boolean;
  alTerminar: () => void;
}) {
  const lineas = useMemo(() => (r ? lineasDe(r) : []), [r]);
  const { visibles, nota, continuar } = useReproducir(lineas, velocidad, explicar);
  const terminado = Boolean(r) && visibles >= lineas.length && !nota;
  const ev = lineas[visibles - 1]?.ev ?? 0;
  const caso = r?.casos[0];
  const m = r?.matriz;
  const huecos = m ? m.invariantes.reduce((n, v) => n + v.violaciones, 0) : 0;

  useEffect(() => {
    if (terminado) alTerminar();
  }, [terminado, alTerminar]);

  return (
    <Card className="min-h-0 min-w-0 flex-1 gap-4 py-5">
      <Explicacion nota={nota} velocidad={velocidad} onContinuar={continuar} />
      <CardHeader className="px-8">
        <CardTitle className="text-4xl tracking-tight">{prueba.titulo}</CardTitle>
        <CardDescription className="text-lg">{prueba.demuestra}</CardDescription>
        {terminado && (caso?.decision || m) && (
          <CardAction className="animate-entra text-right">
            <div className={cn("font-mono text-5xl font-semibold tracking-tight", caso?.decision ? COLOR_ACCION[caso.decision.accion] : huecos ? "text-rose-400" : "text-emerald-400")}>
              {caso?.decision ? caso.decision.accion : `${huecos} huecos`}
            </div>
            <div className="text-muted-foreground mt-1 font-mono text-base">
              {caso?.decision ? `${caso.decision.regla} · ${caso.ia.llamadas} IA` : `${m!.combinaciones} ataques`} · {duracion(r!.ms)}
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-8">
        {r?.error && <p className="text-destructive text-base">{r.error}</p>}
        {m ? <Matriz r={r!} lotes={ev} terminado={terminado} /> : <Flujo caso={caso} eventos={ev} terminado={terminado} esperando={esperando} />}
        <Terminal lineas={lineas.slice(0, visibles)} esperando={esperando} activo={Boolean(r) && !terminado} />
        {/* Debajo de la terminal, para que no la empujen al aparecer. */}
        {!m && terminado && r && <Chequeos items={r.chequeos} />}
        {/* En la matriz, los invariantes ya salen en su diálogo y en «0 huecos»: así entra en pantallas chicas. */}
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
    <div className="flex min-h-24 flex-1 flex-col overflow-hidden rounded-lg border bg-black/40">
      <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 border-b px-4 py-2 font-mono text-sm">
        <i className="size-2.5 rounded-full bg-rose-400/70" />
        <i className="size-2.5 rounded-full bg-amber-400/70" />
        <i className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2">backend · pipeline</span>
        {(esperando || activo) && <Loader2 className="ml-auto size-3 animate-spin" />}
      </div>
      <div ref={caja} className="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-[15px] leading-8">
        {esperando && (
          <div className="text-muted-foreground animate-entra">
            <span className="text-amber-300">$</span> esperando al pipeline…
          </div>
        )}
        {lineas.map((l, i) => (
          <div key={i} className={cn("animate-entra grid grid-cols-[80px_140px_minmax(0,1fr)] gap-4 max-md:grid-cols-[56px_minmax(0,1fr)]", l.tipo === "tool" && "text-muted-foreground")}>
            <span className="text-muted-foreground/60 text-right max-md:hidden">{l.t ?? ""}</span>
            <span className={cn("truncate", COLOR_TAG[l.tipo])}>{l.tag}</span>
            <span className={cn("break-words", l.tipo === "decision" && "text-amber-200", l.tipo === "ok" && "text-emerald-300", l.tipo === "error" && "text-rose-300")}>{l.texto}</span>
          </div>
        ))}
        {(activo || esperando) && <span className="bg-foreground/70 inline-block h-4 w-2 animate-pulse align-middle" />}
      </div>
    </div>
  );
}

function Chequeos({ items }: { items: Array<{ texto: string; ok: boolean; valor?: string }> }) {
  return (
    <div className="flex shrink-0 flex-wrap justify-center gap-2">
      {items.map((c, i) => (
        <Badge
          key={i}
          variant="secondary"
          title={c.valor}
          className={cn("animate-entra h-9 gap-2 px-4 text-base font-normal [&>svg]:size-4", c.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300")}
          style={{ animationDelay: `${i * 90}ms` }}
        >
          {c.ok ? <Check /> : <X />}
          {c.texto}
        </Badge>
      ))}
    </div>
  );
}

function Matriz({ r, lotes, terminado }: { r: ResultadoPrueba; lotes: number; terminado: boolean }) {
  const m = r.matriz!;
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <div className="mx-auto grid w-full max-w-[min(100%,calc((100dvh-540px)*50/15))] grid-cols-[repeat(50,minmax(0,1fr))] gap-[3px]" aria-label={`${m.combinaciones} ataques`}>
        {m.celdas.map((d, i) => (
          <i
            key={i}
            className={cn("aspect-square rounded-[2px] transition-colors duration-300", i < lotes * 50 ? cn("bg-current", COLOR_ACCION[d]) : "bg-muted/40")}
          />
        ))}
      </div>
      {terminado && (
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(m.por_decision).map(([d, n]) => (
            <Badge key={d} variant="outline" className={cn("animate-entra h-8 gap-2 px-3 font-mono text-sm", COLOR_ACCION[d])}>
              <i className="size-2.5 rounded-[2px] bg-current" /> {d.toLowerCase()} {n}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
