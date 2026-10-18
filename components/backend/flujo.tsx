"use client";

import { useEffect, useRef, useState } from "react";
import { Database, FileText, Globe, ListChecks, Lock, MessageCircle, Network, Scale, Search, type LucideIcon } from "lucide-react";
import type { Caso, EventoTimeline } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ESTADO_CLIENTE, type Detalle } from "./narrador";

/**
 * El flujo del pipeline (doc 19): las etapas como agentes sobre una línea. El
 * que está trabajando gira; cuando le pasa algo al siguiente, un documento
 * viaja de uno a otro con lo que encontró; y el dinero se detiene donde lo
 * retienen.
 */

const NODOS: Array<{
  id: string;
  nombre: string;
  icono: LucideIcon;
  de: (e: EventoTimeline) => boolean;
  dato: (d: Detalle, e: EventoTimeline) => string;
  /** Si se enciende, el dinero se queda ahí. */
  retiene?: boolean;
}> = [
  { id: "reglas", nombre: "Reglas", icono: ListChecks, de: (e) => e.evento === "nivel0_evaluado", dato: (d) => `score ${d.score}` },
  { id: "pausa", nombre: "Pausa", icono: Lock, de: (e) => e.evento === "pausa_preventiva", dato: () => "antes de la IA", retiene: true },
  { id: "memoria", nombre: "Memoria", icono: Database, de: (e) => e.actor === "memoria", dato: () => "mula conocida", retiene: true },
  {
    id: "red",
    nombre: "Red",
    icono: Globe,
    de: (e) => e.actor === "red_regional",
    dato: (d) => `banco ${String((d.emisor as { pais?: string } | undefined)?.pais ?? "").toUpperCase()}`,
    retiene: true,
  },
  {
    id: "coordinador",
    nombre: "Coordinador",
    icono: Network,
    de: (e) => e.actor === "coordinador",
    dato: (d) => (Array.isArray(d.invocar) ? `${d.invocar.length} agente${d.invocar.length === 1 ? "" : "s"}` : ""),
  },
  { id: "detective", nombre: "Detective", icono: Search, de: (e) => e.actor === "detective", dato: (d) => (d.riesgo_destino ? `riesgo ${d.riesgo_destino}` : "") },
  {
    id: "guardian",
    nombre: "Guardián",
    icono: MessageCircle,
    de: (e) => e.actor === "guardian",
    dato: (d, e) =>
      e.evento === "estado_usuario" ? (ESTADO_CLIENTE[String(d.estado_usuario)] ?? String(d.estado_usuario)) : e.evento === "turno_pendiente" ? "sin respuesta" : "pregunta",
  },
  { id: "policy", nombre: "Policy", icono: Scale, de: (e) => e.actor === "policy", dato: (d) => String(d.regla ?? "") },
  { id: "auditor", nombre: "Auditor", icono: FileText, de: (e) => e.evento === "expediente", dato: (d) => `${d.afirmaciones} citas` },
];

const centro = (i: number) => `${((i + 0.5) / NODOS.length) * 100}%`;
/** Altura del centro de los círculos (pt-20 + la mitad de size-16). */
const Y_LINEA = "top-[111px]";

export function Flujo({ caso, eventos, terminado, esperando }: { caso?: Caso; eventos: number; terminado: boolean; esperando: boolean }) {
  const vistos = caso?.timeline.slice(0, eventos) ?? [];

  const fallidos = new Set(vistos.filter((e) => e.evento === "error_agentes").map((e) => String((e.detalle as Detalle)?.agente)));
  const nodos = NODOS.map((n) => {
    const ev = [...vistos].reverse().find(n.de);
    const falla = fallidos.has(n.id) || (n.id === "coordinador" && fallidos.has("orquestador"));
    return { ...n, activo: Boolean(ev) || falla, falla, texto: falla ? "falla" : ev ? n.dato((ev.detalle ?? {}) as Detalle, ev) : "" };
  });
  const ultimo = nodos.reduce((m, n, i) => (n.activo ? i : m), -1);
  // Quién está trabajando ahora: la etapa del último evento visto.
  const ultimoEvento = vistos.at(-1);
  const actual = ultimoEvento ? NODOS.findIndex((n) => n.de(ultimoEvento)) : -1;

  // Un documento viaja del agente anterior al actual con lo que encontró.
  const previo = useRef(-1);
  const [viaje, setViaje] = useState<{ desde: number; hasta: number; texto: string; k: number } | null>(null);
  useEffect(() => {
    if (actual < 0) return;
    const p = previo.current;
    previo.current = actual;
    if (p >= 0 && p !== actual) setViaje({ desde: p, hasta: actual, texto: nodos[p].texto || "caso", k: eventos });
    // `nodos` se deriva de `eventos`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, eventos]);

  // Dónde queda el dinero: en la primera etapa que lo retiene; si se permite, llega al final.
  const accion = terminado ? caso?.decision?.accion : undefined;
  const retenidoEn = nodos.findIndex((n) => n.retiene && n.activo);
  const policy = nodos.findIndex((n) => n.id === "policy");
  const pos = accion === "PERMITIR" ? NODOS.length - 1 : retenidoEn >= 0 ? retenidoEn : accion ? policy : Math.max(0, ultimo);
  const colorDinero = accion === "PERMITIR" ? "text-emerald-400" : retenidoEn >= 0 || accion ? "text-amber-400" : "text-foreground";
  const mitad = 100 / NODOS.length / 2;

  return (
    <div className="relative grid shrink-0 grid-cols-9 pt-20 max-md:grid-cols-3 max-md:gap-y-6 max-md:pt-0">
      <div
        className={cn("bg-border absolute h-0.5 rounded-full max-md:hidden", Y_LINEA, esperando && "bg-muted-foreground/40 animate-pulse")}
        style={{ left: `${mitad}%`, right: `${mitad}%` }}
      />
      <div
        className={cn("to-foreground absolute h-0.5 rounded-full bg-gradient-to-r from-sky-400 transition-[width] duration-500 max-md:hidden", Y_LINEA)}
        style={{ left: `${mitad}%`, width: `${(Math.max(0, ultimo) / NODOS.length) * 100}%` }}
      />

      {viaje && !terminado && (
        <div
          key={viaje.k}
          className="animate-viaje pointer-events-none absolute top-[98px] z-20 -translate-x-1/2 max-md:hidden"
          style={{ "--desde": centro(viaje.desde), "--hasta": centro(viaje.hasta) } as React.CSSProperties}
        >
          <Badge className="h-7 gap-1.5 bg-sky-400 px-2.5 font-mono text-sm text-sky-950 shadow-lg shadow-sky-400/20 [&>svg]:size-4">
            <FileText />
            {viaje.texto}
          </Badge>
        </div>
      )}

      {caso?.puerta === "transferencia" && (
        <div
          className={cn("absolute top-0 flex -translate-x-1/2 flex-col items-center transition-[left,color] duration-700 max-md:hidden", colorDinero)}
          style={{ left: centro(pos) }}
        >
          <Badge variant="outline" className="bg-background h-8 border-current px-3 font-mono text-base text-current">
            S/ {caso.transaccion.monto.toLocaleString("es-PE")}
            {(accion || retenidoEn >= 0) && <span className="opacity-70">· {accion === "PERMITIR" ? "pagado" : "retenido"}</span>}
          </Badge>
          <span className="mt-1 h-5 w-px bg-current opacity-50" />
        </div>
      )}

      {nodos.map((n, i) => {
        const Icono = n.icono;
        const trabajando = i === actual && !terminado;
        return (
          <div key={n.id} className="flex flex-col items-center gap-1.5 text-center">
            <span className="relative z-10">
              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-full border-2 transition-all duration-500",
                  n.falla
                    ? "border-rose-400 bg-rose-400/15 text-rose-300 ring-4 ring-rose-400/10"
                    : n.activo
                      ? "border-foreground bg-foreground text-background ring-foreground/10 ring-4"
                      : "border-muted bg-background text-muted-foreground/40",
                  trabajando && !n.falla && "scale-110",
                )}
              >
                <Icono className="size-7" />
              </span>
              {trabajando && <span className="absolute -inset-2 animate-spin rounded-full border-[3px] border-transparent border-t-sky-400" />}
            </span>
            <span className={cn("mt-3 text-lg transition-colors duration-500", n.activo ? "text-foreground font-medium" : "text-muted-foreground/40")}>{n.nombre}</span>
            <span className={cn("min-h-5 font-mono text-sm", n.falla ? "text-rose-400" : trabajando ? "text-sky-300" : "text-muted-foreground")}>
              {trabajando && !n.texto ? "trabajando…" : n.texto}
            </span>
          </div>
        );
      })}
    </div>
  );
}
