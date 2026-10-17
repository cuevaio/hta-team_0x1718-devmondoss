import { describe, expect, it } from 'vitest';
import { e7FalsosPositivos, gastoPorEscenario } from '@/lib/agents/evals';

describe('evals', () => {
  it('E7: el Detective detecta las mismas mulas sin marcar comercios legítimos', () => {
    const r = e7FalsosPositivos();
    expect(r.detective.mulasDetectadas).toBe(r.soloFanIn.mulasDetectadas);
    expect(r.detective.legitimasMarcadas).toBeLessThan(r.soloFanIn.legitimasMarcadas);
    expect(r.detective.legitimasMarcadas).toBe(0);
  });
  it('gasto por escenario coincide con AGENT_PLAYBOOKS §7', async () => {
    const filas = await gastoPorEscenario();
    expect(Math.max(...filas.map((f) => f.total))).toBeLessThanOrEqual(2);
    const por = (s: string) => filas.find((f) => f.escenario.startsWith(s))!.total;
    expect(por('Transferencia normal')).toBe(0);
    expect(por('Rosa — estafa')).toBe(1);
    expect(por('Rosa — responde en texto')).toBe(2);
    expect(por('Jorge')).toBe(0);
    expect(por('Bodega')).toBe(1);
    expect(por('Alerta AML con patrón')).toBe(1);
    expect(por('Alerta AML ambigua')).toBe(2);
  });
});
