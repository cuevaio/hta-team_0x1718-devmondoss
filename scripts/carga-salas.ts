/**
 * Prueba de carga de una sala EN VIVO: N jugadores virtuales entran, el
 * anfitrión empieza, y todos consultan el estado cada 0,6 s y responden cada
 * ronda, como los celulares reales. Mide latencia y errores.
 *
 *   npx tsx scripts/carga-salas.ts http://localhost:3200 100
 *   npx tsx scripts/carga-salas.ts https://web-production-be4c9.up.railway.app 60
 *
 * Los alias son `CARGA…`: no registra jugadas en /api/juego/arcade, así que
 * no ensucia los datos del evento (la sala vive en RAM y se oculta sola).
 *
 * Dueño: Tony_dev.
 */

const base = (process.argv[2] ?? 'http://localhost:3200').replace(/\/+$/, '');
const n = Number(process.argv[3] ?? 50);
const SONDEO_MS = 600;

type Vista = { fase: string; ronda: number; mio: { respondio: boolean } | null };

const latencias: number[] = [];
let errores = 0;
let respuestas = 0;

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T | null> {
  const t0 = performance.now();
  try {
    const r = await fetch(`${base}${ruta}`, {
      method: cuerpo ? 'POST' : 'GET',
      headers: cuerpo ? { 'content-type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    latencias.push(performance.now() - t0);
    if (!r.ok && r.status !== 409) errores++;
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    errores++;
    return null;
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function jugador(codigo: string, alias: string): Promise<void> {
  await pedir(`/api/juego/salas/${codigo}`, { accion: 'unirse', alias, pais: 'pe' });
  let respondida = -1;
  for (;;) {
    const v = await pedir<Vista>(`/api/juego/salas/${codigo}?alias=${alias}`);
    if (v?.fase === 'fin') return;
    if (v?.fase === 'responder' && respondida !== v.ronda) {
      respondida = v.ronda;
      // Responden a lo largo de la ventana, como la gente.
      void (async () => {
        await espera(500 + Math.random() * 6000);
        const r = await pedir(`/api/juego/salas/${codigo}`, { accion: 'responder', alias, ronda: v.ronda, dijo_estafa: Math.random() < 0.6 });
        if (r) respuestas++;
      })();
    }
    await espera(SONDEO_MS);
  }
}

function pct(xs: number[], p: number) {
  const o = [...xs].sort((a, b) => a - b);
  return Math.round(o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))] ?? 0);
}

async function main() {
  console.log(`Sala de carga en ${base} con ${n} jugadores…`);
  const creada = await pedir<{ codigo: string; token: string }>('/api/juego/salas', { alias: 'CARGA0', pais: 'pe', juego: 'real_o_estafa' });
  if (!creada) throw new Error('no se pudo crear la sala');
  const { codigo, token } = creada;
  const jugando = Array.from({ length: n - 1 }, (_, i) => jugador(codigo, `CARGA${i + 1}`));
  await espera(3000);
  await pedir(`/api/juego/salas/${codigo}`, { accion: 'iniciar', token });
  const t0 = Date.now();
  await Promise.all([...jugando, jugador(codigo, 'CARGA0')]);
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    JSON.stringify(
      {
        sala: codigo,
        jugadores: n,
        segundos: s,
        pedidos: latencias.length,
        pedidos_por_segundo: Math.round(latencias.length / Math.max(1, s)),
        latencia_ms: { p50: pct(latencias, 50), p95: pct(latencias, 95), p99: pct(latencias, 99), max: pct(latencias, 100) },
        respuestas_aceptadas: respuestas,
        esperadas: n * 8,
        errores,
      },
      null,
      2,
    ),
  );
}

void main();
