import type { AgentsApi, Caso, Evidencia, SalidaGuardian, ToolContext } from '@/lib/contracts';
import { decidirCoordinador } from './decisiones/coordinador';
import { afirmacionesCandidatas, auditorDeterministico, ensamblarAuditor } from './decisiones/auditor';
import { ensamblarDetective, type Hallazgos } from './decisiones/detective';
import { BANCO_PREGUNTAS } from './decisiones/guardian';
import { AuditorLLM, DetectiveLLM } from './esquemas';
import { USO_CERO } from './util';

/**
 * Agentes simulados (`AGENTS_MOCK=1`): salidas fijas por escenario, sin LLM ni
 * red. Pasan por la MISMA lógica de ensamblado que los agentes reales, así que
 * dan las mismas decisiones que el sistema con IA.
 *
 * Solo dependen de `ctx.evidencia.registrar` (para que los ids sean reales) y,
 * opcionalmente, de `ctx.memoria`. No necesitan analytics.
 */

export type Escenario = 'mula' | 'bodega' | 'suplantacion' | 'neutral';

/** Detecta el escenario del demo por los ids de la transacción. */
export function detectarEscenario(caso: Caso): Escenario {
  const destino = caso.transaccion.destino.toLowerCase();
  const origen = caso.transaccion.origen.toLowerCase();
  if (/^m-?\d|mula/.test(destino)) return 'mula';
  if (/bodega|pepe/.test(destino)) return 'bodega';
  if (/luc[ií]a/.test(origen) || caso.nivel0.senales.includes('dispositivo_nuevo')) return 'suplantacion';
  return 'neutral';
}

function hallazgosDe(escenario: Escenario, cuenta: string): Hallazgos {
  const base = {
    listas: { cuenta, en_lista: false, listas: [] },
    fan_in: { cuenta, remitentes_nuevos: 0, ventana_horas: 48, marcado: false },
    reenvio: { cuenta, porcentaje_reenviado: 0, ventana_horas: 2, destinos: [], marcado: false },
  };
  switch (escenario) {
    case 'mula':
      return {
        perfil: { cuenta, banco_propio: true, antiguedad_dias: 12, tipo: 'persona' },
        listas: base.listas,
        fan_in: { cuenta, remitentes_nuevos: 14, ventana_horas: 48, marcado: true },
        reenvio: { cuenta, porcentaje_reenviado: 0.91, ventana_horas: 2, destinos: ['M-02', 'M-03'], marcado: true },
      };
    case 'bodega':
      return {
        perfil: { cuenta, banco_propio: true, antiguedad_dias: 900, tipo: 'comercio' },
        listas: base.listas,
        fan_in: { cuenta, remitentes_nuevos: 40, ventana_horas: 48, marcado: true },
        reenvio: { cuenta, porcentaje_reenviado: 0.05, ventana_horas: 2, destinos: [], marcado: false },
      };
    case 'suplantacion':
      // Cuenta de otro banco: no se ve su historial (19 §10)
      return { perfil: { cuenta, banco_propio: false, antiguedad_dias: null, tipo: 'desconocido' }, ...base };
    case 'neutral':
      return { perfil: { cuenta, banco_propio: true, antiguedad_dias: 400, tipo: 'persona' }, ...base };
  }
}

/** Registra un hallazgo como evidencia si hay ledger; si no, ids locales estables. */
function registrar(ctx: ToolContext | undefined, contador: { n: number }, fuente: string, dato: unknown): Evidencia {
  if (ctx?.evidencia?.registrar) return ctx.evidencia.registrar(fuente, dato);
  contador.n += 1;
  return { id: `E-${String(contador.n).padStart(2, '0')}`, fuente, dato };
}

const ESTADO_GUARDIAN: Record<Escenario, SalidaGuardian['estado_usuario']> = {
  mula: 'manipulacion_probable',
  bodega: 'no_consultado',
  suplantacion: 'canal_comprometido',
  neutral: 'confirmado_seguro',
};

export function crearAgentesMock(): AgentsApi {
  const contador = { n: 0 };

  return {
    async coordinador(caso, ctx) {
      const v = ctx?.memoria?.get(caso.transaccion.destino) ?? null;
      const salida = decidirCoordinador({
        puerta: caso.puerta,
        score: caso.nivel0.score,
        senales: caso.nivel0.senales,
        atajo: caso.nivel0.atajo,
        memoria_hit: v?.veredicto === 'mula_confirmada',
        destino_conocido_limpio: false,
      });
      return { salida, uso: USO_CERO };
    },

    async detective(caso, ctx) {
      const esc = detectarEscenario(caso);
      const h = hallazgosDe(esc, caso.transaccion.destino);
      const ev = [
        registrar(ctx, contador, 'perfil_cuenta', h.perfil),
        registrar(ctx, contador, 'fan_in', h.fan_in),
        registrar(ctx, contador, 'reenvio_rapido', h.reenvio),
      ];
      // Bodega es el caso ambiguo: el "LLM" simulado la baja a `bajo`
      const llm =
        esc === 'bodega'
          ? DetectiveLLM.parse({
              riesgo_destino: 'bajo',
              hipotesis: 'Comercio antiguo con alto volumen y sin reenvío rápido',
              evidencia: [ev[1].id, ev[2].id],
            })
          : undefined;
      const { salida } = ensamblarDetective({
        hallazgos: h,
        evidencia: ev.map((e) => e.id),
        cadena: h.reenvio?.destinos.length ? [caso.transaccion.destino, ...h.reenvio.destinos] : [caso.transaccion.destino],
        llm,
      });
      return { salida, uso: USO_CERO };
    },

    async guardianTurno(caso, ctx, mensajeCliente) {
      const esc = detectarEscenario(caso);
      const cliente = caso.transaccion.origen;
      // Turno 1: pregunta. Turno 2 en adelante: resultado del escenario.
      if (mensajeCliente === undefined) {
        const texto = BANCO_PREGUNTAS.Q1.texto;
        await ctx?.mensajes?.enviar(cliente, texto);
        return { salida: { mensaje: texto, terminado: false }, uso: USO_CERO };
      }
      const ev = registrar(ctx, contador, 'guardian_respuesta', {
        pregunta: BANCO_PREGUNTAS.Q1.texto,
        texto: mensajeCliente,
        id: 'Q1',
        clasificacion: mensajeCliente === '' ? 'sin_respuesta' : 'si',
      });
      return {
        salida: {
          terminado: true,
          salida: {
            estado_usuario: mensajeCliente === '' && esc === 'mula' ? 'sin_respuesta' : ESTADO_GUARDIAN[esc],
            senales_manipulacion: esc === 'mula' && mensajeCliente !== '' ? ['guiado_por_telefono'] : [],
            canal_usado: esc === 'suplantacion' ? 'sms' : 'app',
            evidencia: [ev.id],
          },
        },
        uso: USO_CERO,
      };
    },

    async auditor(caso) {
      const candidatas = afirmacionesCandidatas(caso.evidencia);
      const riesgo = caso.salidas.detective?.riesgo_destino;
      if (candidatas.length === 0) return { salida: auditorDeterministico(candidatas, riesgo), uso: USO_CERO };
      const esc = detectarEscenario(caso);
      const escalar = riesgo !== 'bajo';
      const llm = AuditorLLM.parse({
        resumen: escalar
          ? 'Transferencia hacia una cuenta con patrón de mula; se recomienda escalar al analista.'
          : 'La cuenta destino no presenta un patrón de riesgo; se recomienda descartar.',
        hipotesis: esc === 'mula' ? 'estafa_vishing_mula' : esc === 'bodega' ? 'falso_positivo_comercio' : 'indeterminada',
        recomendacion: escalar ? 'escalar' : 'descartar',
        indices_afirmaciones: candidatas.slice(0, 4).map((_, i) => i),
        acciones: escalar ? ['confirmar_mula', 'preparar_borrador_ROS'] : ['sin_accion'],
        confianza: 'alta',
      });
      return { salida: ensamblarAuditor(llm, candidatas, { evidencia: caso.evidencia, riesgoDetective: riesgo }), uso: USO_CERO };
    },
  };
}
