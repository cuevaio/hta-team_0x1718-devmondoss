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
  const pagina = useRef<HTMLElement>(null);
  const motor = useRef<Motor | null>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let vivo = true;

    const ajustar = () => {
      const m = motor.current;
      if (!m) return;
      // El área útil descuenta los márgenes seguros (notch, barra de inicio).
      const el = pagina.current;
      const cs = el ? window.getComputedStyle(el) : null;
      const px = (v: string | undefined) => Number.parseFloat(v ?? "0") || 0;
      const anchoUtil = (el?.clientWidth ?? window.innerWidth) - px(cs?.paddingLeft) - px(cs?.paddingRight);
      const altoUtil = (el?.clientHeight ?? window.innerHeight) - px(cs?.paddingTop) - px(cs?.paddingBottom);
      const anchoDisp = Math.min(anchoUtil, ANCHO_MAX);
      const altoDisp = altoUtil;
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
      if ((e.key === "p" || e.key === "P") && !m.pidiendoNombre) {
        e.preventDefault();
        m.alternarPausa();
        return;
      }
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
    window.visualViewport?.addEventListener("resize", ajustar);
    return () => {
      vivo = false;
      motor.current?.detener();
      motor.current = null;
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
      window.removeEventListener("resize", ajustar);
      window.visualViewport?.removeEventListener("resize", ajustar);
    };
  }, [fuente]);

  return (
    <main className={s.pagina} ref={pagina}>
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
        onPointerUp={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const m = motor.current;
          if (!m) return;
          m.soltar(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * m.h);
        }}
        onPointerCancel={() => motor.current?.cancelarToque()}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className={s.girar} role="note">
        <span aria-hidden="true">📱</span>
        <p>Gira tu celular: el juego es en vertical.</p>
      </div>
    </main>
  );
}
