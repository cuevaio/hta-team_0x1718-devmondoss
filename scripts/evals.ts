import { e7FalsosPositivos, gastoPorEscenario } from '@/lib/agents/evals';

/** npm run evals — evals de los agentes sin API key (datos sintéticos). */
async function main() {
  console.log('\n=== Gasto de LLM por escenario (verifica AGENT_PLAYBOOKS §7) ===\n');
  const filas = await gastoPorEscenario();
  console.table(
    filas.map((f) => ({
      escenario: f.escenario,
      coordinador: f.llamadas.coordinador,
      detective: f.llamadas.detective,
      guardian: f.llamadas.guardian,
      auditor: f.llamadas.auditor,
      TOTAL: f.total,
    })),
  );

  const e7 = e7FalsosPositivos();
  console.log('\n=== E7 — Falsos positivos: "solo fan-in" vs. Detective (fan-in + reenvío rápido) ===\n');
  console.log(`Población sintética: ${e7.poblacion.mulas} mulas · ${e7.poblacion.comercios} comercios · ${e7.poblacion.personas} personas\n`);
  console.table({
    'Solo fan-in': e7.soloFanIn,
    'Detective (tabla)': e7.detective,
  });
  console.log('\nE5 (1 agente vs. multiagente): pendiente, necesita ANTHROPIC_API_KEY.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
