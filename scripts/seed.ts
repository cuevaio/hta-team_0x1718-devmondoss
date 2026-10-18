/**
 * Generador determinista de lib/data/seed.json.
 *
 *   npx tsx scripts/seed.ts
 *
 * Determinista a propósito: con el mismo seed produce el mismo archivo, así el
 * demo es reproducible y los tests de analytics no se vuelven intermitentes.
 *
 * Dueño: Ale_dev.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Cuenta, Cliente, Movimiento, Semilla } from '../lib/data/types';

/** PRNG determinista (mulberry32). Nada de Math.random. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1718);

/** Ancla temporal del demo. Todo se calcula relativo a esto. */
const AHORA = new Date('2026-10-17T02:13:00.000Z');

function desplazar(horas: number): string {
  return new Date(AHORA.getTime() + horas * 3_600_000).toISOString();
}

const UMBRAL_REPORTE = 10_000;

// ─────────────────────────────────────────────────────────────
// Cuentas
// ─────────────────────────────────────────────────────────────

const cuentas: Cuenta[] = [
  { id: 'C-ROSA', nombre: 'Rosa Quispe', tipo: 'persona', abierta: '2019-03-11' },
  { id: 'C-JORGE', nombre: 'Jorge Mamani', tipo: 'persona', abierta: '2021-07-02' },
  { id: 'C-LUCIA', nombre: 'Lucía Flores', tipo: 'persona', abierta: '2020-01-20' },
  // Cadena de layering: M-01 recibe, M-02 y M-03 mueven.
  { id: 'M-01', nombre: 'Cuenta M-01', tipo: 'desconocido', abierta: '2026-10-09' },
  { id: 'M-02', nombre: 'Cuenta M-02', tipo: 'desconocido', abierta: '2026-10-10' },
  { id: 'M-03', nombre: 'Cuenta M-03', tipo: 'desconocido', abierta: '2026-10-11' },
  // Control de falsos positivos: fan-in alto, sin reenvío.
  { id: 'B-PEPE', nombre: 'Bodega Don Pepe', tipo: 'comercio', abierta: '2017-05-04' },
  { id: 'H-SOL', nombre: 'Hotel Sol Andino', tipo: 'comercio', abierta: '2015-11-30' },
];

// ─────────────────────────────────────────────────────────────
// Clientes
// ─────────────────────────────────────────────────────────────

const clientes: Cliente[] = [
  {
    id: 'rosa',
    nombre: 'Rosa Quispe',
    cuenta: 'C-ROSA',
    promedio_90d: 420,
    beneficiarios_habituales: ['B-PEPE'],
    dispositivo_habitual: 'dev-rosa-01',
    canales_disponibles: ['app', 'sms', 'llamada'],
    canales_comprometidos: [],
    alcanzable: true,
  },
  {
    id: 'jorge',
    nombre: 'Jorge Mamani',
    cuenta: 'C-JORGE',
    promedio_90d: 380,
    beneficiarios_habituales: [],
    dispositivo_habitual: 'dev-jorge-01',
    canales_disponibles: ['app', 'sms'],
    canales_comprometidos: [],
    alcanzable: true,
  },
  {
    id: 'lucia',
    nombre: 'Lucía Flores',
    cuenta: 'C-LUCIA',
    promedio_90d: 650,
    // El hotel es pago recurrente: debe seguir pasando aunque ella no responda (P2).
    beneficiarios_habituales: ['H-SOL'],
    dispositivo_habitual: 'dev-lucia-01',
    canales_disponibles: ['app', 'sms'],
    // CU-04: viaja sin señal y el dispositivo nuevo del atacante contamina la app.
    canales_comprometidos: ['app'],
    alcanzable: false,
  },
];

// ─────────────────────────────────────────────────────────────
// Movimientos
// ─────────────────────────────────────────────────────────────

const movimientos: Movimiento[] = [];
let n = 0;
const mov = (origen: string, destino: string, monto: number, horas: number) => {
  movimientos.push({
    id: `T-${String(++n).padStart(4, '0')}`,
    origen,
    destino,
    monto: Math.round(monto * 100) / 100,
    moneda: 'PEN',
    t: desplazar(horas),
  });
};

// --- M-01: 14 remitentes nuevos en 48h (tipología fan_in) ---
const remitentesM01: string[] = [];
for (let i = 1; i <= 14; i++) {
  const victima = `C-VIC-${String(i).padStart(2, '0')}`;
  remitentesM01.push(victima);
  cuentas.push({
    id: victima,
    nombre: `Cliente ${i}`,
    tipo: 'persona',
    abierta: '2022-01-01',
  });
  // Repartidos en las últimas 48h, antes de ahora.
  mov(victima, 'M-01', 800 + rand() * 4200, -47 + i * 3.1);
}

// --- M-01 reenvía ~91% en menos de 2h (tipología reenvio_rapido) ---
const recibidoM01 = movimientos
  .filter((m) => m.destino === 'M-01')
  .reduce((s, m) => s + m.monto, 0);
mov('M-01', 'M-02', recibidoM01 * 0.62, -1.2);
mov('M-01', 'M-03', recibidoM01 * 0.29, -0.6);

// --- La cadena sigue: M-02 → M-03 (2 saltos) ---
mov('M-02', 'M-03', recibidoM01 * 0.55, -0.4);

// --- M-01 también estructura: 3 ops entre 90% y 100% del umbral ---
for (let i = 0; i < 3; i++) {
  mov('M-01', 'M-02', UMBRAL_REPORTE * (0.92 + i * 0.02), -30 + i * 4);
}

// --- Bodega Don Pepe: fan-in alto SIN reenvío rápido (CU-05) ---
// Es el control de falsos positivos: si esto da "mula", el sistema es inservible.
for (let i = 1; i <= 23; i++) {
  const comprador = `C-COMP-${String(i).padStart(2, '0')}`;
  cuentas.push({
    id: comprador,
    nombre: `Comprador ${i}`,
    tipo: 'persona',
    abierta: '2021-06-15',
  });
  mov(comprador, 'B-PEPE', 25 + rand() * 180, -46 + i * 1.9);
}
// La bodega paga a proveedores, pero lento y por poco monto: no es reenvío.
mov('B-PEPE', 'C-PROV-01', 300, -8);
cuentas.push({ id: 'C-PROV-01', nombre: 'Proveedor mayorista', tipo: 'comercio', abierta: '2016-02-02' });

// --- Historial normal de Rosa (para que su promedio_90d tenga sustento) ---
for (let i = 1; i <= 18; i++) {
  mov('C-ROSA', 'B-PEPE', 180 + rand() * 400, -24 * (i * 4));
}

// --- Pago recurrente de Lucía al hotel (P2) ---
for (let i = 1; i <= 6; i++) {
  mov('C-LUCIA', 'H-SOL', 620 + rand() * 90, -24 * 30 * i);
}

// --- Historial normal de Jorge ---
// CU-05 exige que su pago a la bodega sea el PRIMERO (beneficiario nuevo → +2),
// así que su historial va al hotel, no a B-PEPE.
for (let i = 1; i <= 12; i++) {
  mov('C-JORGE', 'H-SOL', 150 + rand() * 300, -24 * (i * 6));
}

// --- Población de fondo: ruido legítimo para que el embudo se vea real ---
const fondo = cuentas.filter((c) => c.tipo === 'persona').map((c) => c.id);
const destinos = ['B-PEPE', 'H-SOL', 'C-PROV-01'];
while (movimientos.length < 200) {
  const origen = fondo[Math.floor(rand() * fondo.length)];
  const destino = destinos[Math.floor(rand() * destinos.length)];
  if (origen === destino) continue;
  // Jorge no debe tener historial con la bodega (ver arriba, CU-05).
  if (origen === 'C-JORGE' && destino === 'B-PEPE') continue;
  mov(origen, destino, 20 + rand() * 350, -24 * (1 + rand() * 80));
}

// ─────────────────────────────────────────────────────────────
// Red regional (después del fondo: no altera los movimientos de arriba)
// ─────────────────────────────────────────────────────────────

// Bancos sintéticos de la red. Ninguno es real.
const BANCO_CO = { banco: 'co-banco-cafetero', pais: 'co' as const };

cuentas.push(
  // CU-06: mula en Colombia que el banco colombiano ya confirmó.
  { id: 'CO-M-11', nombre: 'Cuenta CO-M-11', tipo: 'desconocido', abierta: '2026-10-05', pais: 'co', banco: BANCO_CO.banco },
  { id: 'BO-Q-02', nombre: 'Cuenta BO-Q-02', tipo: 'desconocido', abierta: '2026-10-08', pais: 'bo', banco: 'bo-banco-altiplano' },
  // CU-07: cuenta de este banco que recibe de pocos y saca el dinero del país en menos de 2 h.
  { id: 'M-04', nombre: 'Cuenta M-04', tipo: 'desconocido', abierta: '2026-10-12' },
  { id: 'C-ANA', nombre: 'Ana Torres', tipo: 'persona', abierta: '2020-09-14' },
);
clientes.push({
  id: 'ana',
  nombre: 'Ana Torres',
  cuenta: 'C-ANA',
  promedio_90d: 520,
  beneficiarios_habituales: [],
  dispositivo_habitual: 'dev-ana-01',
  canales_disponibles: ['app', 'sms'],
  canales_comprometidos: [],
  alcanzable: true,
});

// M-04: solo 3 remitentes (no llega a fan-in), pero reenvía el 88% al exterior.
const recibidoM04 = [2300, 1900, 2600];
recibidoM04.forEach((monto, i) => {
  const remitente = `C-REG-0${i + 1}`;
  cuentas.push({ id: remitente, nombre: `Cliente regional ${i + 1}`, tipo: 'persona', abierta: '2021-03-03' });
  mov(remitente, 'M-04', monto, -5 + i);
});
const totalM04 = recibidoM04.reduce((s, m) => s + m, 0);
mov('M-04', 'CO-M-11', totalM04 * 0.55, -1.4);
mov('M-04', 'BO-Q-02', totalM04 * 0.33, -0.8);

const redRegional = [
  {
    veredicto: {
      cuenta: 'CO-M-11',
      veredicto: 'mula_confirmada',
      validado_por: 'analista-co-07',
      fecha: '2026-10-14',
      expira: '2027-01-12',
      expediente: 'CO-EXP-0042',
      apelacion_abierta: false,
      emisor: BANCO_CO,
    },
    ficha: {
      cuenta: 'CO-M-11',
      tipologias: ['fan_in', 'reenvio_rapido'],
      hipotesis: 'Cuenta de paso (posible mula): recibe de varios remitentes nuevos y reenvía rápido',
      afirmaciones: [
        { texto: 'La cuenta CO-M-11 recibió de 9 remitentes nuevos en 48 h', evidencia: ['E-02'] },
        { texto: 'Reenvió el 87% de lo recibido en menos de 2 h', evidencia: ['E-03'] },
      ],
      basado_en_red: false,
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Escribir
// ─────────────────────────────────────────────────────────────

const semilla: Semilla = {
  generado: AHORA.toISOString(),
  nota:
    'DATOS 100% SINTÉTICOS, generados por scripts/seed.ts con PRNG determinista (seed 1718). ' +
    'No corresponden a ninguna persona, cuenta ni institución real. ' +
    'Ningún campo contiene atributos demográficos, de salud ni socioeconómicos (doc 15, R1).',
  umbral_reporte: UMBRAL_REPORTE,
  cuentas,
  clientes,
  movimientos: movimientos.sort((a, b) => a.t.localeCompare(b.t)),
  red_regional: redRegional,
};

const destino = resolve(import.meta.dirname, '../lib/data/seed.json');
writeFileSync(destino, JSON.stringify(semilla, null, 2) + '\n');

console.log(`seed.json escrito: ${semilla.cuentas.length} cuentas, ${semilla.clientes.length} clientes, ${semilla.movimientos.length} movimientos`);
