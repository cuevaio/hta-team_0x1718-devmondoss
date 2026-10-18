"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Database,
  FileText,
  Globe,
  Grid3x3,
  Lock,
  MessageCircle,
  Pause,
  Play,
  Scale,
  Search,
  TriangleAlert,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ClaveNota, Nota } from "./narrador";

/**
 * El diálogo que detiene el flujo para explicar un momento clave con los datos
 * reales del caso: los documentos que juntó el Detective, el chat del
 * Guardián, el expediente del Auditor o la decisión. Se cierra solo (con una
 * barra que se vacía) salvo que el presentador lo mantenga abierto.
 */

const ICONO: Partial<Record<ClaveNota, LucideIcon>> = {
  pausa: Lock,
  memoria: Database,
  red: Globe,
  detective: Search,
  chat: MessageCircle,
  expediente: FileText,
  error: TriangleAlert,
  decision: Scale,
  veredicto: UserCheck,
  matriz: Grid3x3,
};

export const COLOR_ACCION: Record<string, string> = {
  PERMITIR: "text-emerald-400",
  PAUSAR: "text-amber-400",
  VERIFICAR: "text-sky-400",
  ESCALAR: "text-rose-400",
};

export function Explicacion({ nota, velocidad, onContinuar }: { nota: Nota | null; velocidad: number; onContinuar: () => void }) {
  const [mantener, setMantener] = useState(false);
  const dura = nota ? nota.dura / velocidad : 0;

  useEffect(() => {
    setMantener(false);
  }, [nota]);

  useEffect(() => {
    if (!nota || mantener) return;
    const t = setTimeout(onContinuar, dura);
    return () => clearTimeout(t);
  }, [nota, mantener, dura, onContinuar]);

  const Icono = nota ? (ICONO[nota.clave] ?? FileText) : FileText;
  const rojo = nota?.clave === "error";

  return (
    <Dialog open={nota !== null} onOpenChange={(abierto) => !abierto && onContinuar()}>
      {nota && (
        <DialogContent className="ui-oscuro dark text-foreground gap-5 overflow-hidden sm:max-w-xl" showCloseButton={false}>
          <DialogHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full ring-4",
                  rojo ? "bg-rose-400/15 text-rose-300 ring-rose-400/10" : "bg-sky-400/15 text-sky-300 ring-sky-400/10",
                )}
              >
                <Icono className="size-5" />
              </span>
              <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">{nota.quien}</span>
            </div>
            <DialogTitle className="text-2xl tracking-tight">{nota.titulo}</DialogTitle>
            {/* Radix pide una descripción; vacía, solo para lectores de pantalla. */}
            <DialogDescription className={cn("text-base leading-relaxed", !nota.texto && "sr-only")}>{nota.texto || nota.titulo}</DialogDescription>
          </DialogHeader>

          {nota.docs && nota.docs.length > 0 && (
            <div className="grid max-h-[46vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {nota.docs.map((d, i) => (
                <div
                  key={d.id}
                  className={cn("animate-entra flex gap-3 rounded-md border p-3", d.marcado && "border-amber-400/40 bg-amber-400/5")}
                  style={{ animationDelay: `${300 + i * 260}ms` }}
                >
                  <FileText className={cn("mt-0.5 size-4 shrink-0", d.marcado ? "text-amber-300" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {d.id}
                      </Badge>
                      <span className="truncate text-sm font-medium">{d.titulo}</span>
                    </div>
                    <p className={cn("mt-1 text-sm", d.marcado ? "text-amber-200" : "text-muted-foreground")}>{d.hecho}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {nota.chat && (
            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <div className="text-muted-foreground flex items-center justify-between font-mono text-[11px]">
                <span>Guardián → {nota.chat.cliente}</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  por {nota.chat.canal}
                </Badge>
              </div>
              <p className="bg-secondary animate-entra max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ animationDelay: "250ms" }}>
                {nota.chat.pregunta}
              </p>
              {nota.chat.respuesta ? (
                <p
                  className="animate-entra max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-sky-400/15 px-4 py-2.5 text-sm text-sky-100"
                  style={{ animationDelay: "1400ms" }}
                >
                  {nota.chat.respuesta}
                </p>
              ) : (
                <p className="text-muted-foreground animate-entra self-end text-sm italic" style={{ animationDelay: "1400ms" }}>
                  {nota.chat.cliente} no responde…
                </p>
              )}
            </div>
          )}

          {nota.afirmaciones && nota.afirmaciones.length > 0 && (
            <div className="bg-card max-h-[46vh] overflow-y-auto rounded-xl border">
              <div className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 font-mono text-[11px]">
                <FileText className="size-3.5" /> expediente
              </div>
              <ol className="divide-border divide-y">
                {nota.afirmaciones.map((a, i) => (
                  <li key={i} className="animate-entra flex items-start justify-between gap-3 px-4 py-2.5 text-sm" style={{ animationDelay: `${250 + i * 220}ms` }}>
                    <span>{a.texto}</span>
                    <span className="flex shrink-0 gap-1">
                      {a.evidencia.map((e) => (
                        <Badge key={e} variant="secondary" className="font-mono text-[10px] text-amber-300">
                          {e}
                        </Badge>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {nota.decision && (
            <div className="bg-card flex flex-col items-center gap-2 rounded-xl border p-6 text-center">
              <span className={cn("animate-entra font-mono text-4xl font-semibold tracking-tight", COLOR_ACCION[nota.decision.accion])} style={{ animationDelay: "200ms" }}>
                {nota.decision.accion}
              </span>
              <Badge variant="outline" className="font-mono">
                regla {nota.decision.regla}
              </Badge>
              <p className="text-muted-foreground mt-1 text-sm">{nota.decision.motivo}</p>
            </div>
          )}

          {nota.invariantes && (
            <ul className="grid gap-2">
              {nota.invariantes.map((v, i) => (
                <li key={i} className="animate-entra flex items-center gap-2 text-sm" style={{ animationDelay: `${200 + i * 200}ms` }}>
                  {v.ok ? <Check className="size-4 text-emerald-400" /> : <X className="size-4 text-rose-400" />}
                  {v.texto}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setMantener((m) => !m)}>
              {mantener ? <Play /> : <Pause />}
              {mantener ? "Seguir solo" : "Mantener"}
            </Button>
            <Button onClick={onContinuar} autoFocus>
              Continuar <ArrowRight />
            </Button>
          </DialogFooter>
          {!mantener && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-400/10">
              <div key={nota.titulo} className="animate-vaciar h-full bg-sky-400/70" style={{ "--dura": `${dura}ms` } as React.CSSProperties} />
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
