# lib/agents — bloque de Tony

Agentes del sistema. Diseño y por qué: [AGENT_PLAYBOOKS](../../docs/context/tony_dev/AGENT_PLAYBOOKS.md). Infraestructura, orquestación y plan Ollama: [INFRA_Y_ORQUESTACION](../../docs/context/tony_dev/INFRA_Y_ORQUESTACION.md).

## Cómo se usa (para `lib/pipeline.ts`)

La forma recomendada es el **orquestador**: nunca lanza, y si un agente falla
lo reporta en `errores` y su salida queda ausente (→ la Policy aplica P10).

```ts
import { obtenerAgentes, investigar, continuarGuardian, auditar, debeAuditar, acumularIA } from '@/lib/agents';

const agentes = obtenerAgentes();               // Claude si hay ANTHROPIC_API_KEY; si no, simulado

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

## Modos (`obtenerAgentes` / `modoAgentes`)

| Modo | Cuándo | Qué corre |
|---|---|---|
| `claude` | hay `ANTHROPIC_API_KEY` real y `AGENTS_MOCK` ≠ `1` | agentes reales + Claude |
| `simulado` | `AGENTS_MOCK=1` o no hay key | agentes reales + tools reales + **LLM simulado** determinista (`llm-simulado.ts`). Cuenta 1 llamada por invocación (0 tokens) para que el contador muestre lo que gastaría con IA real |

`crearAgentesMock()` (salidas fijas por escenario, sin tools) queda solo para tests.

## Integración con el pipeline de Ale (hecha)

`lib/pipeline.ts` y `scripts/demo.ts` ya usan `obtenerAgentes()` en vez de `lib/agents-provisional.ts` (ese archivo quedó sin uso). `npm run demo` da 8/8 con los agentes reales.

## Lo que `ctx` (ToolContext) debe cumplir

- El `ToolContext` tipado de `lib/contracts/firmas.ts` (lo construye `lib/tool-context.ts`). El Guardián usa `canales_seguros` y `disponibilidad` con el **id de cliente** (`ctx.data.clientePorCuenta(origen)`).
- `ctx.evidencia.registrar(fuente, dato)` → `Evidencia` con id `E-xx`. **Tiene que quedar en `caso.evidencia`** antes de la siguiente llamada (`storeCasos.sincronizarEvidencia`): el Guardián reconstruye la conversación desde ahí (`guardian_pregunta`, `guardian_respuesta`) y el Auditor arma las afirmaciones desde ahí.
- `ctx.memoria.get(cuenta)` → `Veredicto | null`.
- `ctx.mensajes.enviar(cliente, texto)`.

## Orden del pipeline

1. `coordinador` → a quién invocar (`salida_temprana: true` ⇒ saltar directo a Policy).
2. `detective` y `guardianTurno` en paralelo (`Promise.all`), solo los invocados.
3. Policy decide.
4. `auditor` **después**, solo si se pausa/escala o es alerta AML; no bloquea la pausa.

## Guardián: dos modos

| Llamada | Qué hace |
|---|---|
| `guardianTurno(caso, ctx, 'texto')` | usa ese texto como respuesta a la pregunta pendiente (la envía antes si no se había enviado) |
| `guardianTurno(caso, ctx)` | toma respuestas del buzón (`ctx.mensajes.esperar`); si no hay, devuelve la pregunta y `terminado: false` |
| `guardianTurno(caso, ctx, '')` | el cliente **no respondió a tiempo** |

Sigue preguntando (máx. 3) hasta un «sí» de riesgo o hasta agotar el guion. Si el cliente no es alcanzable (`disponibilidad`), no espera: `sin_respuesta`. Si hay canal comprometido, no pregunta: `canal_comprometido`.

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
| `llm-simulado.ts` | LLM simulado determinista para el modo sin key |
| `index.ts` | `obtenerAgentes()`, `modoAgentes()` y `crearAgentes(deps)` |

## Estado

Integrado con el pipeline de Ale: 220 tests y `npm run demo` 8/8 en modo simulado. `npm run evals` muestra el gasto por escenario. **Pendiente de probar contra la API real:** falta una `ANTHROPIC_API_KEY`.
