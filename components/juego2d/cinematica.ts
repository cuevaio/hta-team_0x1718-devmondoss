import type { Motor } from "./motor";
import { PAL, W, envolver, facil, type Pincel } from "./pincel";
import { datosEpilogo, type Dato, type Pais } from "./paises";
import { COLORES_ESTAFADOR, ESTAFADOR } from "./sprites";

/**
 * Cinemáticas: el «video» de intro (esto pasa de verdad) y el epílogo con
 * los datos. Todo se dibuja en el motor; tocar adelanta cada plano.
 * Cifras y casos con fuente: docs/DEMO_JUEGO.md §2.
 */

type Plano =
  | { tipo: "texto"; lineas: string[]; color?: string }
  | { tipo: "llamada" }
  | { tipo: "voz"; texto: string }
  | { tipo: "app"; pasos: string[] }
  | { tipo: "titular"; titulo: string; detalle: string; fuente: string }
  | { tipo: "dato"; dato: Dato; n: number; total: number }
  | { tipo: "golpe"; lineas: string[]; sub?: string; color: string }
  | { tipo: "lema" };

type Estado = { plano: Plano; inicio: number };

function ciudadNoche(p: Pincel, t: number) {
  p.degradado(0, p.h, "#05081c", "#1a2560");
  for (let i = 0; i < 40; i++) if ((Math.floor(t / 30) + i) % 5 > 0) p.rect(PAL.crema, (i * 53) % W, (i * 31) % Math.round(p.h * 0.5), 1, 1);
  const base = p.h - 30;
  for (let x = 0, i = 0; x < W; i++) {
    const w = 20 + ((i * 37) % 22);
    const alto = 50 + ((i * 53) % 70);
    p.rect("#0f1638", x, base - alto, w, alto);
    for (let wy = base - alto + 6; wy < base - 6; wy += 9) for (let wx = x + 3; wx < x + w - 4; wx += 6) if (((wx + wy + i) >> 1) % 4 === 0) p.rect("#ffd77a", wx, wy, 2, 3);
    x += w + 2;
  }
  p.rect("#0a0f26", 0, base, W, 30);
}

function textoCentrado(p: Pincel, lineas: string[], y0: number, color: string, k: number) {
  const todas = lineas.flatMap((l) => envolver(l, 21));
  const total = todas.join("").length;
  let resto = Math.floor(total * k);
  todas.forEach((l, i) => {
    const visible = l.slice(0, Math.max(0, resto));
    resto -= l.length;
    const x = Math.round((W - l.length * 8) / 2);
    p.textoSombra(visible, x, y0 + i * 14, color, PAL.negro);
  });
}

/** "S/ 10,000" → { antes: "S/ ", n: 10000, despues: "" } */
function partes(cifra: string) {
  const m = /^(\D*)([\d.,]+)(.*)$/.exec(cifra);
  if (!m) return null;
  const sep = m[2].includes(",") ? "," : m[2].includes(".") ? "." : ",";
  return { antes: m[1], n: Number(m[2].replace(/[.,]/g, "")), despues: m[3], sep };
}

function dibujar(e: Estado): (p: Pincel, t: number) => void {
  return (p, t) => {
    const f = t - e.inicio;
    const pl = e.plano;
    const h = p.h;
    if (pl.tipo === "texto") {
      ciudadNoche(p, t);
      p.alfa(0.55, () => p.rect(PAL.negro, 0, 0, W, h));
      textoCentrado(p, pl.lineas, Math.round(h * 0.38), pl.color ?? PAL.crema, Math.min(1, f / 50));
    } else if (pl.tipo === "llamada") {
      ciudadNoche(p, t);
      p.alfa(0.4, () => p.rect(PAL.negro, 0, 0, W, h));
      const vib = Math.floor(f / 3) % 2 ? 2 : -2;
      const cy = Math.round(h * 0.32);
      p.escalado(96, cy + 40, 1 + Math.min(1, f / 20) * 0.1, () => {
        p.rect(PAL.tinta, 66 + vib, cy, 60, 100);
        p.rect("#2b3a55", 68 + vib, cy + 2, 56, 96);
        p.rect(Math.floor(f / 10) % 2 ? PAL.ambar : PAL.crema, 71 + vib, cy + 10, 50, 70);
        p.centrado("SEGURIDAD", cy + 26, PAL.tinta, 8, undefined, 66 + vib, 60);
        p.centrado("BANCO", cy + 40, PAL.tinta, 8, undefined, 66 + vib, 60);
        p.rect(PAL.verde, 76 + vib, cy + 62, 16, 12);
        p.rect(PAL.rojo, 100 + vib, cy + 62, 16, 12);
      });
      const onda = Math.floor(f / 8) % 3;
      for (let i = 0; i <= onda; i++) {
        p.rect(PAL.ambar, 50 - i * 8, cy + 30 + i * 4, 3, 40 - i * 8);
        p.rect(PAL.ambar, 140 + i * 8, cy + 30 + i * 4, 3, 40 - i * 8);
      }
      if (f % 40 < 30) p.centrado("¡RIIING!", cy - 22, PAL.ambar, 16, PAL.rojoOscuro);
      p.centrado("6:02 p.m.", h - 20, PAL.gris);
    } else if (pl.tipo === "voz") {
      p.rect("#1a0b14", 0, 0, W, h);
      for (let y = 0; y < h; y += 4) if ((y + f) % 12 < 2) p.alfa(0.15, () => p.rect(PAL.rojo, 0, y, W, 1));
      const glitch = f % 30 < 3 ? 3 : 0;
      p.sprite(ESTAFADOR, COLORES_ESTAFADOR, 60 + glitch, Math.round(h * 0.18), 3);
      p.caja(10, Math.round(h * 0.18) + 84, W - 20, 70, PAL.blanco, PAL.tinta, PAL.rojo);
      const lineas = envolver(pl.texto, 20);
      const total = lineas.join("").length;
      let resto = Math.floor(total * Math.min(1, f / 30));
      lineas.forEach((l, i) => {
        p.texto(l.slice(0, Math.max(0, resto)), 18, Math.round(h * 0.18) + 94 + i * 13, PAL.tinta);
        resto -= l.length;
      });
    } else if (pl.tipo === "app") {
      p.rect("#0e1730", 0, 0, W, h);
      const cy = 30;
      p.rect(PAL.tinta, 30, cy, 132, h - 70);
      p.rect(PAL.crema, 34, cy + 6, 124, h - 82);
      p.rect(PAL.navy, 34, cy + 6, 124, 18);
      p.texto("TRANSFERIR", 56, cy + 11, PAL.crema);
      pl.pasos.forEach((paso, i) => {
        const aparece = f - i * 14;
        if (aparece < 0) return;
        p.alfa(Math.min(1, aparece / 8), () => {
          const y = cy + 36 + i * 22;
          p.rect(i === pl.pasos.length - 1 ? "#f4c7c3" : "#bfe8c9", 40, y, 112, 18);
          p.texto(paso, 46, y + 5, PAL.tinta);
        });
      });
      const fin = f - pl.pasos.length * 14;
      if (fin > 0) {
        const saldo = Math.max(0, 4800 - Math.round(fin * 160));
        p.centrado(`S/ ${saldo.toLocaleString("en-US")}`, h - 70, saldo === 0 ? PAL.rojo : PAL.tinta, 16);
        if (saldo === 0 && f % 20 < 14) p.centrado("SALDO", h - 84, PAL.rojo);
      }
    } else if (pl.tipo === "titular") {
      p.rect("#efe8da", 0, 0, W, h);
      for (let y = 0; y < h; y += 3) p.rect("#e4dccb", 0, y, W, 1);
      const k = facil.salida(Math.min(1, f / 16));
      const x = Math.round((1 - k) * W);
      const y = Math.round(h * 0.26);
      p.rect(PAL.rojoOscuro, x, y - 22, W, 16);
      p.texto("ÚLTIMO MINUTO", x + 8, y - 18, PAL.blanco);
      envolver(pl.titulo, 21).forEach((l, i) => p.texto(l, x + 8, y + i * 13, PAL.tinta));
      const off = envolver(pl.titulo, 21).length * 13 + 10;
      p.rect(PAL.tinta, x + 8, y + off - 4, W - 16, 1);
      envolver(pl.detalle, 21).forEach((l, i) => p.texto(l, x + 8, y + off + 4 + i * 12, "#4a5a6e"));
      p.texto(pl.fuente, x + 8, h - 24, PAL.gris);
    } else if (pl.tipo === "golpe") {
      const parpadeo = f < 10 && f % 4 < 2;
      p.rect(parpadeo ? PAL.blanco : "#12040a", 0, 0, W, h);
      for (let y = 0; y < h; y += 3) p.alfa(0.12, () => p.rect(pl.color, 0, y, W, 1));
      const k = facil.salida(Math.min(1, f / 8));
      const cy = Math.round(h * 0.36);
      p.escalado(W / 2, cy + pl.lineas.length * 10, 1 + (1 - k) * 2.5, () =>
        pl.lineas.forEach((l, i) => p.centrado(l, cy + i * 22, pl.color, 16, PAL.negro)),
      );
      if (pl.sub) p.alfa(Math.min(1, (f - 14) / 10), () => p.centrado(pl.sub!, cy + pl.lineas.length * 22 + 14, PAL.crema, 8, PAL.negro));
    } else if (pl.tipo === "dato") {
      p.degradado(0, h, "#0b1640", "#1d2f73");
      p.texto(`${pl.n}/${pl.total}`, 8, 6, PAL.gris);
      const pr = partes(pl.dato.cifra);
      let cifra = pl.dato.cifra;
      if (pr) {
        const k = facil.salida(Math.min(1, f / 45));
        const n = Math.round(pr.n * k);
        cifra = `${pr.antes}${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, pr.sep)}${pr.despues}`;
      }
      const tam = cifra.length <= 6 ? 32 : 16;
      const cy = Math.round(h * 0.24);
      p.escalado(96, cy + 10, 1 + Math.max(0, 1 - f / 12) * 0.3, () => p.centrado(cifra, cy, PAL.ambar, tam, PAL.rojoOscuro));
      const lineas = envolver(pl.dato.texto, 21);
      lineas.forEach((l, i) =>
        p.alfa(Math.min(1, (f - 20 - i * 6) / 10), () => p.centrado(l, cy + tam + 22 + i * 14, PAL.crema)),
      );
      p.alfa(Math.min(1, (f - 50) / 10), () => p.centrado(`Fuente: ${pl.dato.fuente}`.slice(0, 23), h - 30, PAL.celeste));
      if (f > 70 && f % 50 < 34) p.centrado("toca para seguir", h - 14, PAL.gris);
    } else {
      p.degradado(0, h, "#071a14", "#14533a");
      const cy = Math.round(h * 0.22);
      ["PAUSA", "PREGUNTA", "INVESTIGA", "APRENDE"].forEach((pal, i) =>
        p.alfa(Math.min(1, (f - i * 14) / 10), () => p.centrado(pal, cy + i * 24, i === 0 ? PAL.ambar : PAL.crema, 16, PAL.negro)),
      );
      p.alfa(Math.min(1, (f - 70) / 20), () =>
        envolver("La seguridad no debería depender de que puedas contestar a tiempo.", 21).forEach((l, i) =>
          p.centrado(l, cy + 112 + i * 14, PAL.verde),
        ),
      );
    }
  };
}

async function mostrar(m: Motor, e: Estado, plano: Plano, ms: number) {
  e.plano = plano;
  e.inicio = m.t;
  await m.esperarToque(ms);
}

const INTRO_VISTA = "ter-intro-vista";

/** ¿Ya vio la intro en este celular? Entonces el juego arranca en el título. */
export function introVista(): boolean {
  try {
    return window.localStorage.getItem(INTRO_VISTA) === "1";
  } catch {
    return false;
  }
}

/** El «video» de intro (~13 s): esto pasa de verdad. Tocar salta cada plano. */
export async function videoIntro(m: Motor) {
  const e: Estado = { plano: { tipo: "texto", lineas: [] }, inicio: m.t };
  m.barraSuperior = null;
  m.escena = dibujar(e);
  m.musica("intro");
  await m.fundirA(false, 10);
  m.audio.ring();
  m.vibrar([200, 100, 200]);
  await mostrar(m, e, { tipo: "llamada" }, 1800);
  m.audio.glitch();
  m.sacudir(8);
  await mostrar(m, e, { tipo: "voz", texto: "«¡Sus ahorros están en riesgo! Muévalos YA a una cuenta segura.»" }, 2300);
  m.audio.tension();
  await mostrar(m, e, { tipo: "app", pasos: ["FaceID ... OK", "Token ... OK", "¿Continuar? SÍ", "ENVIADO"] }, 1400);
  m.audio.drenar();
  await m.esperar(1300);
  m.musica(null);
  m.audio.boom();
  m.sacudir(20);
  m.vibrar([100, 60, 300]);
  await mostrar(m, e, { tipo: "golpe", lineas: ["¡TE ROBARON!"], sub: "Y te autenticaste bien.", color: PAL.rojo }, 2000);
  const titulares: Array<Extract<Plano, { tipo: "titular" }>> = [
    { tipo: "titular", titulo: "Banco sancionado: S/ 10,000 por transferencia inusual", detalle: "«La autenticación fue correcta.» Igual tenía que monitorear.", fuente: "Indecopi · Puno 2026" },
    { tipo: "titular", titulo: "19,602 denuncias por fraude en 7 meses", detalle: "Perú, enero a julio de 2026.", fuente: "Ministerio Público" },
    { tipo: "titular", titulo: "+155% de estafas a bancos de la región", detalle: "Y +42% de cuentas mula.", fuente: "BioCatch · LATAM 2025" },
  ];
  m.musica("suspenso");
  for (const t of titulares) {
    m.audio.whoosh();
    await mostrar(m, e, t, 1100);
  }
  m.audio.boom();
  m.destello = 8;
  await mostrar(m, e, { tipo: "golpe", lineas: ["¿QUIÉN TE", "PROTEGE?"], color: PAL.ambar }, 1800);
  try {
    window.localStorage.setItem(INTRO_VISTA, "1");
  } catch {
    // sin almacenamiento: se verá otra vez
  }
  await m.fundirA(true, 12);
}

/** Epílogo: los datos que no se olvidan. */
export async function epilogo(m: Motor, pais: Pais) {
  const e: Estado = { plano: { tipo: "lema" }, inicio: m.t };
  m.barraSuperior = { texto: "LOS DATOS", color: PAL.rojoOscuro };
  m.escena = dibujar(e);
  m.musica("triste");
  await m.fundirA(false, 16);
  const datos = datosEpilogo(pais);
  for (let i = 0; i < datos.length; i++) {
    m.audio.sello();
    await mostrar(m, e, { tipo: "dato", dato: datos[i], n: i + 1, total: datos.length }, 7000);
  }
  m.barraSuperior = null;
  m.musica("guardian");
  await mostrar(m, e, { tipo: "lema" }, 6000);
  await m.fundirA(true, 20);
}
