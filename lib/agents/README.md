# lib/agents — bloque de Tony

Agentes del sistema. Diseño y por qué: [AGENT_PLAYBOOKS](../../docs/context/tony_dev/AGENT_PLAYBOOKS.md).

## Cómo se usa (para `lib/pipeline.ts`)

La forma recomendada es el **orquestador**: nunca lanza, y si un agente falla
lo reporta en `errores` y su salida queda ausente (→ la Policy aplica P10).

```ts
import { obtenerAgentes, investigar, continuarGuardian, auditar, debeAuditar, acumularIA } from '@/lib/agents';

const agentes = obtenerAgentes();               // AGENTS_MOCK=1 → mocks; si no, Claude real

// 1. Después de las reglas (score ≥ 3 o alerta AML):
const inv = await investigar(caso, ctx, agentes);
caso.salidas = { ...caso.salidas, ...inv.salidas };
caso.ia = acumularIA(caso.ia, inv.uso);

// 2. Si el Guardián preguntó y no terminó: mostrar inv.turnoGuardian.mensaje y esperar.
//    Con la respuesta (o '' si no respondió a tiempo):
const t = await continuarGuardian(caso, ctx, agentes, texto);
if (t.turno?.terminado) caso.salidas.guardian = t.turno.salida;
caso.ia = acumularIA(caso.ia, { guardian: t.uso });

// 3. Policy (tuya) → caso.decision
// 4. Expediente, después de la decisión:
if (debeAuditar(caso)) {
  const a = await auditar(caso, ctx, agentes);
  caso.salidas.auditor = a.salida;
  caso.ia = acumularIA(caso.ia, { auditor: a.uso });
}
```

También puedes llamar a `AgentsApi` directo (`agentes.detective(caso, ctx)`); está en `lib/contracts/firmas.ts`.

## Lo que `ctx` (ToolContext) debe cumplir

- `ctx.analytics.<fuente>(cuenta)` → `{ data, evidencia: Evidencia[] }`. Claves: `perfil_cuenta`, `listas_riesgo`, `fan_in`, `reenvio_rapido`, `estructuracion`, `ciclos`, `canales` (este último recibe el **cliente**). Forma de `data`: `lib/contracts/analytics.ts`.
- `ctx.evidencia.registrar(fuente, dato)` → `Evidencia` con id `E-xx`. **Tiene que quedar en `caso.evidencia`** antes de la siguiente llamada: el Guardián reconstruye la conversación desde ahí y el Auditor arma las afirmaciones desde ahí.
- `ctx.memoria.get(cuenta)` → `Veredicto | null`.
- `ctx.mensajes.enviar(cliente, texto)`.

## Orden del pipeline

1. `coordinador` → a quién invocar (`salida_temprana: true` ⇒ saltar directo a Policy).
2. `detective` y `guardianTurno` en paralelo (`Promise.all`), solo los invocados.
3. Policy decide.
4. `auditor` **después**, solo si se pausa/escala o es alerta AML; no bloquea la pausa.

## Guardián: protocolo de turnos

| Llamada | Significa |
|---|---|
| `guardianTurno(caso, ctx)` | primer turno: envía la primera pregunta |
| `guardianTurno(caso, ctx, 'texto')` | el cliente respondió |
| `guardianTurno(caso, ctx, '')` | el cliente **no respondió a tiempo** (timeout) |

Devuelve `{ mensaje?, terminado, salida? }`. Cuando `terminado` es `true`, `salida` trae el `SalidaGuardian`.

## Archivos

| Archivo | Qué es |
|---|---|
| `decisiones/` | lógica determinista pura (tablas de decisión) |
| `esquemas.ts` | esquemas pequeños que devuelve el LLM |
| `prompts.ts` | prompts de sistema y tope de tokens por agente |
| `llm.ts` | frontera con Anthropic (structured outputs, effort low) |
| `runtime.ts` | `runAgent`: validación + 1 reintento + `AgentError` |
| `coordinador.ts` `detective.ts` `guardian.ts` `auditor.ts` | adaptadores: unen decisiones + tools + LLM, con fallback |
| `mocks.ts` | `AGENTS_MOCK=1`: salidas fijas por escenario, misma lógica de ensamblado |
| `orquestador.ts` | `investigar`, `continuarGuardian`, `auditar`, `debeAuditar`, `acumularIA` |
| `simulacion.ts` | ToolContext en memoria + runAgent falso: para testear tu pipeline sin LLM, y como **referencia** de lo que tu ToolContext debe cumplir |
| `evals.ts` | E7 y gasto de LLM por escenario (`npm run evals`) |
| `index.ts` | `obtenerAgentes()` y `crearAgentes(deps)` |

## Estado

Probado con LLM y tools falsos (108 tests). `npm run evals` muestra el gasto por escenario. **Pendiente de probar contra la API real:** falta una `ANTHROPIC_API_KEY`.
