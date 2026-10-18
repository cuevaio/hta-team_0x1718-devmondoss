/**
 * Demo de consola — criterio de salida del SYNC 1 (blueprint §6).
 *
 *   npm run demo
 *
 * Corre CU-01, CU-02, CU-03 y CU-05 end-to-end y muestra, por cada caso, la
 * decisión, la regla aplicada, la evidencia citada y el consumo de IA.
 *
 * Mientras no exista el frontend (Fase 2), esto ES el demo.
 *
 * Dueño: Ale_dev.
 */
import type { Caso, Transaccion } from '../lib/contracts';
import { crearVeredicto, memoria } from '../lib/memory/store';
import { repo } from '../lib/data/repo';
import { estadisticas, evaluarAlerta, evaluarTransferencia } from '../lib/pipeline';
import { modoAgentes, obtenerAgentes } from '../lib/agents';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  verde: '\x1b[32m',
  rojo: '\x1b[31m',
  ambar: '\x1b[33m',
  azul: '\x1b[36m',
};

function titulo(texto: string) {
  console.log(`\n${C.bold}${C.azul}${'─'.repeat(72)}${C.reset}`);
  console.log(`${C.bold}${texto}${C.reset}`);
  console.log(`${C.bold}${C.azul}${'─'.repeat(72)}${C.reset}`);
}

function colorDe(accion: string) {
  if (accion === 'PERMITIR') return C.verde;
  if (accion === 'ESCALAR') return C.rojo;
  return C.ambar;
}

function mostrar(caso: Caso, esperado: { accion: string; regla: string }) {
  const d = caso.decision!;
  const ok = d.accion === esperado.accion && d.regla === esperado.regla;
  const marca = ok ? `${C.verde}✓${C.reset}` : `${C.rojo}✗${C.reset}`;

  console.log(
    `\n  ${marca} ${colorDe(d.accion)}${C.bold}${d.accion}${C.reset} por regla ${C.bold}${d.regla}${C.reset}` +
      `${ok ? '' : `  ${C.rojo}(esperado ${esperado.accion}/${esperado.regla})${C.reset}`}`,
  );
  console.log(
    `  ${C.dim}score nivel 0: ${caso.nivel0.score} · señales: ${caso.nivel0.senales.join(', ') || '—'}${C.reset}`,
  );

  if (caso.salidas.detective) {
    const det = caso.salidas.detective;
    console.log(
      `  ${C.dim}detective: riesgo ${det.riesgo_destino} · tipologías: ${det.tipologias.join(', ') || '—'} · cadena: ${det.cadena.join(' → ')}${C.reset}`,
    );
  }
  if (caso.salidas.guardian) {
    const g = caso.salidas.guardian;
    console.log(
      `  ${C.dim}guardián: ${g.estado_usuario} · señales: ${g.senales_manipulacion.join(', ') || '—'} · canal: ${g.canal_usado}${C.reset}`,
    );
  }

  if (caso.evidencia.length > 0) {
    console.log(`  ${C.dim}evidencia:${C.reset}`);
    for (const e of caso.evidencia) {
      console.log(`    ${C.dim}${e.id}  ${e.fuente}${C.reset}`);
    }
  }

  if (caso.salidas.auditor) {
    const a = caso.salidas.auditor;
    console.log(`  ${C.dim}expediente: recomienda ${a.recomendacion} (confianza ${a.confianza})${C.reset}`);
    for (const af of a.afirmaciones) {
      console.log(`    ${C.dim}· ${af.texto} [${af.evidencia.join(', ')}]${C.reset}`);
    }
  }

  const ia = caso.ia;
  const etiqueta = ia.llamadas === 0 ? `${C.verde}0 llamadas de IA${C.reset}` : `${ia.llamadas} llamadas de IA`;
  console.log(`  ${C.dim}consumo: ${etiqueta}${C.dim} · ${ia.tokens} tokens${C.reset}`);

  return ok;
}

const tx = (origen: string, destino: string, monto: number): Transaccion => ({
  origen,
  destino,
  monto,
  moneda: 'PEN',
});

async function main() {
  const agentes = obtenerAgentes();
  const modo = modoAgentes();
  console.log(`Agentes: ${modo === 'claude' ? 'Claude (API real)' : modo === 'ollama' ? `Ollama local (${process.env.OLLAMA_MODELO})` : 'simulados (sin API key)'}`);
  const resultados: boolean[] = [];

  console.log(`\n${C.bold}Adaptive Financial Security — demo de consola${C.reset}`);
  console.log(`${C.dim}${repo.notaDatos()}${C.reset}`);

  // ── CU-01 ────────────────────────────────────────────────────
  titulo('CU-01 · Rosa — frenar una estafa a un cliente autenticado');
  console.log(
    `${C.dim}Rosa recibe una llamada del "banco" y transfiere S/4,800 a M-01, un beneficiario nuevo.${C.reset}`,
  );
  const rosa = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
    agentes,
    contexto: { llamada_activa_o_acceso_remoto: true },
    respuestaCliente: 'sí, me está guiando un asesor del banco',
  });
  resultados.push(mostrar(rosa.caso, { accion: 'ESCALAR', regla: 'P4' }));
  if (rosa.buzon.enviados.length > 0) {
    console.log(`  ${C.dim}preguntas enviadas al cliente:${C.reset}`);
    for (const m of rosa.buzon.enviados) console.log(`    ${C.dim}· ${m.texto}${C.reset}`);
  }

  // ── CU-02 ────────────────────────────────────────────────────
  titulo('CU-02 · La mula — investigar la cuenta destino y entregar el expediente');
  console.log(`${C.dim}Alerta AML sobre M-01. Entra por Puerta B: sin Guardián.${C.reset}`);
  const alerta = await evaluarAlerta('M-01', 'patrón de fan-in con reenvío inmediato', { agentes });
  // Puerta B: sin cliente a quien preguntar, la regla que aplica es P5.
  resultados.push(mostrar(alerta.caso, { accion: 'ESCALAR', regla: 'P5' }));

  console.log(`\n  ${C.dim}El analista revisa el expediente y confirma en 1 clic:${C.reset}`);
  memoria.confirm(
    'M-01',
    crearVeredicto({
      cuenta: 'M-01',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: alerta.caso.id,
      hoy: repo.ahora(),
    }),
  );
  console.log(`  ${C.verde}✓${C.reset} M-01 entra a la Memoria de riesgo (validada por analista_01)`);

  // ── CU-03 ────────────────────────────────────────────────────
  titulo('CU-03 · Jorge — proteger a la siguiente víctima');
  console.log(`${C.dim}Jorge intenta transferir a M-01, ya confirmada como mula.${C.reset}`);
  const jorge = await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200), { agentes });
  resultados.push(mostrar(jorge.caso, { accion: 'ESCALAR', regla: 'P1' }));
  const sinIA = jorge.caso.ia.llamadas === 0;
  console.log(
    `  ${sinIA ? C.verde + '✓' : C.rojo + '✗'}${C.reset} ${sinIA ? 'Protegido sin gastar una sola llamada de IA' : 'ATENCIÓN: gastó IA, debería ser 0'}`,
  );
  resultados.push(sinIA);

  // ── CU-05 ────────────────────────────────────────────────────
  titulo('CU-05 · Bodega Don Pepe — no bloquear un pago legítimo');
  console.log(
    `${C.dim}Primer pago grande a una cuenta que recibe de muchas personas pero NO reenvía.${C.reset}`,
  );
  const bodega = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000), { agentes });
  resultados.push(mostrar(bodega.caso, { accion: 'PERMITIR', regla: 'P8' }));
  const sinGuardian = bodega.caso.salidas.guardian === undefined;
  console.log(
    `  ${sinGuardian ? C.verde + '✓' : C.rojo + '✗'}${C.reset} ${sinGuardian ? 'No se molestó al cliente: el Guardián no se invocó' : 'ATENCIÓN: se invocó al Guardián'}`,
  );
  resultados.push(sinGuardian);

  // ── CU-04 ────────────────────────────────────────────────────
  titulo('CU-04 · Lucía — suplantación con la titular sin señal  (🟢 could)');
  console.log(`${C.dim}Un atacante entra desde un dispositivo nuevo. Lucía viaja sin señal.${C.reset}`);
  const atacante = await evaluarTransferencia(tx('C-LUCIA', 'M-02', 3000), {
    agentes,
    contexto: { dispositivo_nuevo_24h: true },
  });
  resultados.push(mostrar(atacante.caso, { accion: 'PAUSAR', regla: 'P7' }));

  console.log(`\n${C.dim}  Mientras tanto, su pago recurrente al hotel:${C.reset}`);
  const hotel = await evaluarTransferencia(tx('C-LUCIA', 'H-SOL', 650), { agentes });
  resultados.push(mostrar(hotel.caso, { accion: 'PERMITIR', regla: 'P2' }));

  // ── Embudo ───────────────────────────────────────────────────
  titulo('Embudo y consumo de IA');
  const stats = estadisticas();
  console.log(`  transacciones evaluadas : ${stats.transacciones_evaluadas}`);
  console.log(`  sospechosas (score >= 3): ${stats.sospechosas}`);
  console.log(`  casos con IA            : ${stats.con_llamadas_de_ia}`);
  console.log(`  llamadas de IA totales  : ${stats.llamadas_de_ia_totales}`);
  console.log(`  mulas en Memoria        : ${stats.mulas_en_memoria}`);
  console.log(`  decisiones por regla    : ${JSON.stringify(stats.por_regla)}`);

  const m = stats.metricas;
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
  const ms = (x: number | null) => (x === null ? '—' : `${x} ms`);
  const ahorro = m.eficiencia_ia.llamadas_evitadas_por_memoria;
  console.log(`\n  ${C.bold}Métricas (doc 14)${C.reset}`);
  console.log(
    `  TTPA con pausa preventiva: p50 ${ms(m.ttpa.con_pausa_preventiva.p50_ms)} · máx ${ms(m.ttpa.con_pausa_preventiva.max_ms)} (${m.ttpa.con_pausa_preventiva.casos} casos)`,
  );
  console.log(
    `  afirmaciones citadas     : ${pct(m.trazabilidad.pct_afirmaciones_citadas)} (${m.trazabilidad.afirmaciones_con_cita_valida}/${m.trazabilidad.afirmaciones}) · citas inexistentes: ${m.trazabilidad.citas_inexistentes}`,
  );
  // Los casos del demo se eligieron por ser interesantes: casi todos son
  // sospechosos. Este porcentaje NO es el de una población real.
  console.log(
    `  transacciones con IA     : ${pct(m.eficiencia_ia.pct_transacciones_con_ia)} ${C.dim}(de ${stats.transacciones_evaluadas} casos elegidos para el demo, no una población real)${C.reset}`,
  );
  console.log(
    `  llamadas evitadas (E6)   : ${ahorro.estimado ?? '—'} ${C.dim}(estimado: ${ahorro.base})${C.reset}`,
  );
  console.log(`  ${C.dim}${m.ttpa.nota}${C.reset}`);

  // ── Veredicto ────────────────────────────────────────────────
  const ok = resultados.filter(Boolean).length;
  const total = resultados.length;
  console.log(`\n${C.bold}${'═'.repeat(72)}${C.reset}`);
  if (ok === total) {
    console.log(`${C.verde}${C.bold}  ✓ SYNC 1: ${ok}/${total} comprobaciones correctas${C.reset}`);
  } else {
    console.log(`${C.rojo}${C.bold}  ✗ SYNC 1: ${ok}/${total} comprobaciones correctas${C.reset}`);
  }
  console.log(`${C.bold}${'═'.repeat(72)}${C.reset}\n`);

  process.exit(ok === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
