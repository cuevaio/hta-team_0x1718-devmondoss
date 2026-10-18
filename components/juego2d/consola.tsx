"use client";

import { useEffect, useRef } from "react";
import { W } from "./pincel";
import { Motor, type Boton } from "./motor";
import { jugar } from "./guion";
import s from "./consola.module.css";

/**
 * Pantalla del juego a pantalla completa, pensada para celular en vertical.
 * Todo se maneja tocando; en escritorio también sirve el teclado
 * (flechas, Enter/Z = A, Esc/X = B).
 */

const TECLAS: Record<string, Boton> = {
  ArrowUp: "arriba",
  ArrowDown: "abajo",
  ArrowLeft: "izq",
  ArrowRight: "der",
  z: "a",
  Z: "a",
  Enter: "a",
  " ": "a",
  x: "b",
  X: "b",
  Escape: "b",
};
const DIRECCIONES: Boton[] = ["arriba", "abajo", "izq", "der"];
const ANCHO_MAX = 460;

export default function Consola({ fuente }: { fuente: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let vivo = true;

    const ajustar = () => {
      const m = motor.current;
      if (!m) return;
      const anchoDisp = Math.min(window.innerWidth, ANCHO_MAX);
      const altoDisp = window.innerHeight;
      m.ajustar(anchoDisp, altoDisp, window.devicePixelRatio || 1);
      // Mantener la proporción exacta de la resolución lógica (sin estirar).
      let ancho = anchoDisp;
      let alto = (anchoDisp * m.h) / W;
      if (alto > altoDisp) {
        alto = altoDisp;
        ancho = (altoDisp * W) / m.h;
      }
      canvas.style.width = `${Math.floor(ancho)}px`;
      canvas.style.height = `${Math.floor(alto)}px`;
    };

    void (async () => {
      try {
        await Promise.all([document.fonts.load(`8px ${fuente}`), document.fonts.load(`16px ${fuente}`)]);
      } catch {
        // si la fuente no carga, el canvas usa la de respaldo
      }
      if (!vivo) return;
      const m = new Motor(canvas, fuente);
      motor.current = m;
      if (new URLSearchParams(window.location.search).has("depurar")) {
        (window as unknown as { __motor: Motor }).__motor = m;
      }
      ajustar();
      m.iniciar();
      void jugar(m);
    })();

    const abajo = (e: KeyboardEvent) => {
      const m = motor.current;
      if (!m) return;
      if (m.pidiendoNombre && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) {
        e.preventDefault();
        m.letra(e.key);
        return;
      }
      const b = TECLAS[e.key];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) m.pulsar(b);
      if (DIRECCIONES.includes(b)) m.sostener(b, true);
    };
    const arriba = (e: KeyboardEvent) => {
      const b = TECLAS[e.key];
      if (b) motor.current?.sostener(b, false);
    };
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    window.addEventListener("resize", ajustar);
    return () => {
      vivo = false;
      motor.current?.detener();
      motor.current = null;
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
      window.removeEventListener("resize", ajustar);
    };
  }, [fuente]);

  return (
    <main className={s.pagina}>
      <canvas
        ref={lienzo}
        className={s.pantalla}
        aria-label="Juego Te están robando. Toca para avanzar y elegir."
        onPointerDown={(e) => {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          const m = motor.current;
          if (!m) return;
          m.tocar(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * m.h);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </main>
  );
}
