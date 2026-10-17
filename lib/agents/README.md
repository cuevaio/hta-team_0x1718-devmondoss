# lib/agents — bloque de Tony

Agentes del sistema. Diseño y por qué: [AGENT_PLAYBOOKS](../../docs/context/tony_dev/AGENT_PLAYBOOKS.md).

## Cómo se usa (para `lib/pipeline.ts`)

```ts
import { obtenerAgentes } from '@/lib/agents';

const agentes = obtenerAgentes();            // AGENTS_MOCK=1 → mocks; si no, Claude real
const { salida, uso } = await agentes.detective(caso, ctx);
```

`AgentsApi` está en `lib/contracts/firmas.ts`. Cada método devuelve `{ salida, uso }`; **suma `uso` a `caso.ia`**.

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
| `index.ts` | `obtenerAgentes()` y `crearAgentes(deps)` |

## Estado

Probado con LLM y tools falsos (99 tests). **Pendiente de probar contra la API real:** falta una `ANTHROPIC_API_KEY`.
