"use client";

import { useEffect, useRef } from "react";

/**
 * Bodega de Rosa en pixel art (DEMO_JUEGO §7; dirección de arte en
 * docs/Te_Estan_Robando/docs/06 y 26). Arte propio dibujado en canvas, sin
 * assets externos ni marcas reales. 192×128 px lógicos, escalados sin suavizado.
 */

const W = 192;
const H = 128;

const C = {
  navy: "#10243D",
  blue: "#285EA8",
  sky: "#79C7E8",
  cream: "#F6EBD7",
  green: "#65BE83",
  greenDark: "#3F8F5C",
  amber: "#F1B35B",
  red: "#E66565",
  ink: "#19283B",
  wall: "#EAD9B8",
  wallDark: "#D8C29C",
  floorA: "#E8C79F",
  floorB: "#DDB68A",
  wood: "#8A5A36",
  woodDark: "#5E3B22",
  woodLight: "#A87249",
  skin: "#C98C5E",
  hair: "#2E1D14",
  grey: "#8C97A3",
};

const ROSA = [
  "......hhhh......",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "....hssssssh....",
  "....hsessesh....",
  "....hssssssh....",
  "....hssmmssh....",
  ".....ssssss.....",
  "......ssss......",
  "...bbbaaaabbb...",
  "..bbbbaaaabbbb..",
  "..bbbaaaaaabbb..",
  "..sbbaaaaaabbs..",
  "..s.baaaaaab.s..",
  "....aaaaaaaa....",
  "....aaaaaaaa....",
  "....kkkkkkkk....",
  "....kkkkkkkk....",
  "....kkk..kkk....",
  ".....ss..ss.....",
  ".....ss..ss.....",
  "....ddd..ddd....",
];

const CLIENTE = [
  ".....cccccc.....",
  "....cccccccc....",
  "....cccccccccc..",
  ".....ssssss.....",
  ".....sesses.....",
  ".....ssssss.....",
  ".....ssmmss.....",
  "......ssss......",
  "....tttttttt....",
  "...tttttttttt...",
  "..sttttttttts...",
  "..s.tttttttt.s..",
  "....tttttttt....",
  "....jjjjjjjj....",
  "....jjjjjjjj....",
  "....jjj..jjj....",
  "....jjj..jjj....",
  "....jjj..jjj....",
  "....ddd..ddd....",
];

const COLORES_ROSA: Record<string, string> = {
  h: C.hair,
  s: C.skin,
  e: C.ink,
  m: C.red,
  b: C.sky,
  a: C.green,
  k: C.navy,
  d: C.woodDark,
};

const COLORES_CLIENTE: Record<string, string> = {
  c: C.red,
  s: C.skin,
  e: C.ink,
  m: "#9E4E2E",
  t: C.amber,
  j: C.blue,
  d: C.ink,
};

function sprite(
  ctx: CanvasRenderingContext2D,
  grilla: string[],
  colores: Record<string, string>,
  x: number,
  y: number,
  escala = 2,
) {
  grilla.forEach((fila, j) => {
    for (let i = 0; i < fila.length; i++) {
      const color = colores[fila[i]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i * escala, y + j * escala, escala, escala);
    }
  });
}

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const PRODUCTOS = [C.red, C.amber, C.blue, C.green, C.cream, C.sky];

function estante(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, semilla: number) {
  rect(ctx, C.woodDark, x, y, w, 38);
  rect(ctx, C.wood, x + 2, y + 2, w - 4, 34);
  for (let nivel = 0; nivel < 3; nivel++) {
    const base = y + 12 + nivel * 12;
    rect(ctx, C.woodLight, x + 2, base, w - 4, 2);
    for (let p = 0; p * 6 + 4 < w - 4; p++) {
      const color = PRODUCTOS[(p + nivel + semilla) % PRODUCTOS.length];
      const alto = 5 + ((p * 7 + nivel * 3 + semilla) % 4);
      rect(ctx, color, x + 4 + p * 6, base - alto, 4, alto);
      rect(ctx, "rgba(255,255,255,0.35)", x + 4 + p * 6, base - alto, 1, alto);
    }
  }
}

export type EstadoEscena = "normal" | "llamada" | "perdio" | "protegido";

export default function EscenaBodega({
  estado,
  cliente = false,
}: {
  estado: EstadoEscena;
  cliente?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ estado, cliente });
  props.current = { estado, cliente };

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let cuadro = 0;
    let animacion = 0;

    const dibujar = () => {
      const { estado: e, cliente: hayCliente } = props.current;
      const t = reducir ? 0 : cuadro;
      ctx.clearRect(0, 0, W, H);

      // Pared y letrero
      rect(ctx, C.wall, 0, 0, W, 60);
      for (let x = 0; x < W; x += 16) rect(ctx, C.wallDark, x, 0, 1, 60);
      rect(ctx, C.greenDark, 64, 3, 64, 11);
      rect(ctx, C.green, 65, 4, 62, 9);

      estante(ctx, 6, 18, 52, 0);
      estante(ctx, 134, 18, 52, 3);

      // Piso
      for (let y = 60; y < H; y += 8) {
        for (let x = 0; x < W; x += 8) {
          rect(ctx, ((x + y) / 8) % 2 === 0 ? C.floorA : C.floorB, x, y, 8, 8);
        }
      }
      rect(ctx, C.wallDark, 0, 58, W, 2);

      // Rosa detrás del mostrador
      const respira = Math.floor(t / 40) % 2;
      const nerviosa = e === "llamada" ? Math.floor(t / 6) % 2 : 0;
      sprite(ctx, ROSA, COLORES_ROSA, 82 + nerviosa, 28 + respira);
      if (e === "llamada" && Math.floor(t / 20) % 3 !== 0) {
        rect(ctx, C.sky, 110, 32, 2, 4); // gota de sudor
      }

      // Mostrador
      rect(ctx, C.woodDark, 52, 72, 92, 22);
      rect(ctx, C.wood, 54, 74, 88, 18);
      rect(ctx, C.woodLight, 52, 70, 92, 4);
      for (let x = 60; x < 140; x += 12) rect(ctx, C.woodDark, x, 76, 1, 14);

      // Caja registradora
      rect(ctx, C.grey, 120, 60, 16, 10);
      rect(ctx, C.navy, 122, 62, 12, 4);
      rect(ctx, C.green, 123, 63, 4, 2);

      // Celular sobre el mostrador
      const vibra = e === "llamada" ? (Math.floor(t / 3) % 2) * 2 - 1 : 0;
      const px = 70 + vibra;
      rect(ctx, C.navy, px, 60, 9, 11);
      const pantalla =
        e === "llamada"
          ? Math.floor(t / 10) % 2
            ? C.amber
            : C.cream
          : e === "perdio"
            ? C.red
            : e === "protegido"
              ? C.green
              : C.sky;
      rect(ctx, pantalla, px + 1, 61, 7, 8);
      if (e === "llamada") {
        const onda = Math.floor(t / 8) % 3;
        for (let k = 0; k <= onda; k++) {
          rect(ctx, C.amber, px - 3 - k * 3, 62 + k, 1, 6 - k * 2);
          rect(ctx, C.amber, px + 11 + k * 3, 62 + k, 1, 6 - k * 2);
        }
      }
      if (e === "protegido") {
        // candado
        rect(ctx, C.green, px + 2, 50, 5, 1);
        rect(ctx, C.green, px + 2, 50, 1, 4);
        rect(ctx, C.green, px + 6, 50, 1, 4);
        rect(ctx, C.greenDark, px, 54, 9, 5);
      }

      // Cliente esperando vuelto
      if (hayCliente) {
        const paso = Math.floor(t / 30) % 2;
        sprite(ctx, CLIENTE, COLORES_CLIENTE, 150, 84 + paso);
      }

      // Puerta a la calle
      rect(ctx, C.ink, 0, 76, 6, 52);
      rect(ctx, C.sky, 1, 78, 4, 48);

      cuadro++;
      if (!reducir) animacion = requestAnimationFrame(dibujar);
    };

    dibujar();
    const repintar = reducir ? window.setInterval(dibujar, 500) : 0;
    return () => {
      cancelAnimationFrame(animacion);
      window.clearInterval(repintar);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      width={W}
      height={H}
      role="img"
      aria-label={
        estado === "llamada"
          ? "Rosa en su bodega, con el celular sonando"
          : estado === "protegido"
            ? "Rosa en su bodega; el celular muestra un candado: la operación está retenida"
            : estado === "perdio"
              ? "Rosa en su bodega; el celular en rojo: el dinero salió"
              : "Rosa atiende su bodega"
      }
      style={{ width: "100%", height: "auto", imageRendering: "pixelated", display: "block" }}
    />
  );
}
