"use client";

import { useEffect, useRef, useState } from "react";
import { H, W } from "./pincel";
import { Motor, type Boton } from "./motor";
import { jugar } from "./guion";
import s from "./consola.module.css";

/**
 * La consola: la pantalla del juego y sus controles (cruceta, A, B, START).
 * Funciona con toques y con teclado (flechas, Z/Enter = A, X/Esc = B).
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
  Backspace: "b",
};
const DIRECCIONES: Boton[] = ["arriba", "abajo", "izq", "der"];

function BotonConsola({
  motor,
  boton,
  className,
  etiqueta,
  children,
}: {
  motor: React.RefObject<Motor | null>;
  boton: Boton;
  className: string;
  etiqueta: string;
  children?: React.ReactNode;
}) {
  const soltar = () => motor.current?.sostener(boton, false);
  return (
    <button
      type="button"
      aria-label={etiqueta}
      className={className}
      onPointerDown={(e) => {
        e.preventDefault();
        motor.current?.pulsar(boton);
        if (DIRECCIONES.includes(boton)) motor.current?.sostener(boton, true);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function Consola({ fuente }: { fuente: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const [silencio, setSilencio] = useState(false);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let vivo = true;

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
      m.iniciar();
      void jugar(m);
    })();

    const abajo = (e: KeyboardEvent) => {
      const b = TECLAS[e.key];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) motor.current?.pulsar(b);
      if (DIRECCIONES.includes(b)) motor.current?.sostener(b, true);
    };
    const arriba = (e: KeyboardEvent) => {
      const b = TECLAS[e.key];
      if (b) motor.current?.sostener(b, false);
    };
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    return () => {
      vivo = false;
      motor.current?.detener();
      motor.current = null;
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
    };
  }, [fuente]);

  return (
    <main className={s.pagina}>
      <div className={s.consola}>
        <div className={s.marco}>
          <div className={s.franja}>
            <span className={s.led} aria-hidden="true" />
            <span>TE ESTAN ROBANDO</span>
          </div>
          <canvas
            ref={lienzo}
            className={s.pantalla}
            aria-label="Pantalla del juego Te están robando"
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              motor.current?.tocar(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
            }}
          />
        </div>

        <div className={s.controles}>
          <div className={s.cruceta}>
            <BotonConsola motor={motor} boton="arriba" etiqueta="Arriba" className={`${s.dir} ${s.arriba}`} />
            <BotonConsola motor={motor} boton="izq" etiqueta="Izquierda" className={`${s.dir} ${s.izq}`} />
            <span className={s.centro} aria-hidden="true" />
            <BotonConsola motor={motor} boton="der" etiqueta="Derecha" className={`${s.dir} ${s.der}`} />
            <BotonConsola motor={motor} boton="abajo" etiqueta="Abajo" className={`${s.dir} ${s.abajo}`} />
          </div>

          <div className={s.centrales}>
            <BotonConsola motor={motor} boton="start" etiqueta="Start" className={s.start}>
              START
            </BotonConsola>
            <button
              type="button"
              className={s.start}
              onClick={() => {
                const nuevo = !silencio;
                setSilencio(nuevo);
                if (motor.current) motor.current.sonido.silencio = nuevo;
              }}
            >
              {silencio ? "SON: NO" : "SON: SI"}
            </button>
          </div>

          <div className={s.accion}>
            <BotonConsola motor={motor} boton="b" etiqueta="Botón B" className={`${s.redondo} ${s.b}`}>
              B
            </BotonConsola>
            <BotonConsola motor={motor} boton="a" etiqueta="Botón A" className={s.redondo}>
              A
            </BotonConsola>
          </div>
        </div>
        <p className={s.ayuda}>Teclado: flechas · Z o Enter = A · X o Esc = B</p>
      </div>
    </main>
  );
}
