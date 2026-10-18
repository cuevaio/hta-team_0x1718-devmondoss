import type { AgentResult, Caso, SalidaCoordinador, ToolContext } from '@/lib/contracts';
import { ResultadoPerfil, veredictoVigente } from '@/lib/contracts';
import { decidirCoordinador, type BriefingCoordinador } from './decisiones/coordinador';
import { USO_CERO, evidenciaDelCaso, llamarTool } from './util';

/** Días de antigüedad a partir de los cuales una cuenta destino se considera "conocida". */
const DIAS_CUENTA_CONOCIDA = 90;

/** 🧭 Coordinador: arma el briefing y aplica la tabla. 0 llamadas de LLM. */
export async function coordinador(caso: Caso, ctx: ToolContext): Promise<AgentResult<SalidaCoordinador>> {
  const t0 = Date.now();
  const destino = caso.transaccion.destino;

  const v = ctx.memoria?.get(destino) ?? null;
  const memoria_hit = !!v && v.veredicto === 'mula_confirmada' && veredictoVigente(v);

  // "Conocido-limpio" = el cliente YA le transfería antes (no es beneficiario nuevo)
  // y es una cuenta propia con historia. Una cuenta antigua pero nueva para el
  // cliente (p. ej. la Bodega) no cuenta: ahí sí hay que mirar al destino.
  let destino_conocido_limpio = false;
  const beneficiarioNuevo = caso.nivel0.senales.includes('beneficiario_nuevo');
  if (!memoria_hit && !caso.nivel0.atajo && caso.puerta === 'transferencia' && !beneficiarioNuevo) {
    const perfil =
      evidenciaDelCaso(caso.evidencia, 'perfil_cuenta', ResultadoPerfil, destino) ??
      (await llamarTool(ctx, 'perfil_cuenta', destino, ResultadoPerfil));
    destino_conocido_limpio =
      !!perfil &&
      perfil.data.banco_propio &&
      perfil.data.antiguedad_dias !== null &&
      perfil.data.antiguedad_dias >= DIAS_CUENTA_CONOCIDA;
  }

  // Red regional y país: lecturas sin evidencia (la evidencia la emite el Detective).
  const red_hit = !memoria_hit && ctx.red?.get(destino)?.veredicto === 'mula_confirmada';
  const paisDe = (cuenta: string) => ctx.data?.cuenta(cuenta)?.pais ?? 'pe';
  const destino_extranjero = caso.puerta === 'transferencia' && paisDe(destino) !== paisDe(caso.transaccion.origen);

  const briefing: BriefingCoordinador = {
    puerta: caso.puerta,
    score: caso.nivel0.score,
    senales: caso.nivel0.senales,
    atajo: caso.nivel0.atajo,
    memoria_hit,
    destino_conocido_limpio,
    red_hit,
    destino_extranjero,
  };
  return { salida: decidirCoordinador(briefing), uso: { ...USO_CERO, ms: Date.now() - t0 } };
}
