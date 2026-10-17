# Ale_dev — Plan de sprints (vista alto nivel)

> Vista agrupada de [../../work/ale_dev/TASKS.md](../../work/ale_dev/TASKS.md). El checklist tiene el detalle casilla por casilla; esto es para saber **en qué sprint estoy, qué lo cierra y qué me bloquea**.
>
> Fuente de verdad del reparto: [../../work/00_WORK_BLUEPRINT.md](../../work/00_WORK_BLUEPRINT.md).

**Mi frente:** runtime LLM · `pipeline.ts` · 🧭 Coordinador · 🛡️ Guardián · API routes · UI de dos paneles · deploy.

---

## Mapa de sprints

| Sprint | Horas | Qué construyo | Lo cierra |
|:-:|:-:|---|---|
| **S0** | 0–4 | Contratos + scaffold + deploy vacío | URL pública viva y contratos en `main` |
| **S1** | 4–9 | Runtime de agentes + pipeline con mocks | 🔁 **SYNC 1** — 3 actos con la regla correcta, sin IA |
| **S2** | 9–15 | Guardián + Coordinador (mis dos agentes) | 🔁 **SYNC 2** (H17) — IA real da las mismas decisiones |
| **S3** | 15–25 | Dos paneles + controles de demo | 🔁 **SYNC 3** (H23) — 3 actos en producción |
| **S4** | 25–30 | Deploy final, README, video, ensayo | Freeze (H27) |

---

## S0 · Fundaciones (H0–4)

**Objetivo:** que ninguno de los dos quede esperando al otro el resto del hackathon.

- Contratos zod en `lib/contracts/` **con Tony, sentados juntos**. Esquemas de salida de los 4 agentes tal cual están en [19 §3](../tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md#3-agentes).
- Scaffold Next.js + TS.
- Deploy inicial con URL pública (hello world basta).
- API key solo en variables de entorno.

**Por qué el deploy va aquí y no al final:** desplegar vacío en la hora 2 y redesplegar seguido evita el desastre clásico de la hora 29. Es la tarea más barata con mayor retorno de todo el plan.

**Lo entrego a Tony:** firmas de `runAgent` y `runPipeline`.
**Lo recibo de Tony:** firmas de `evaluateRules`, `decide`, `memory.get/confirm`.

---

## S1 · Runtime + pipeline (H4–9)

**Objetivo:** el esqueleto completo corriendo con salidas falsas. Es el sprint que garantiza que a la hora 9 existe un demo.

- `agents/runtime.ts` — niveles `rapido` / `capaz`, validación zod + 1 reintento → modo seguro, presupuesto de 10 llamadas por caso, timeout, log de uso hacia `caso.ia`.
- `AGENTS_MOCK=1` para que todo corra sin gastar un token.
- `pipeline.ts` — reglas → Coordinador → agentes en paralelo → policy → Auditor → Caso.
- Rutas: `POST /api/transfer`, `GET /api/case/[id]`, `POST /api/guardian/reply`, `POST /api/demo/reset`.
- Mocks de Coordinador y Guardián en `agents/mocks.ts`.

**Criterio de salida (SYNC 1):** los 3 actos dan la regla correcta con mocks, en local. **Esto tiene prioridad absoluta sobre tocar agentes reales.**

---

## S2 · Mis agentes (H9–15)

**🛡️ Guardián (H9–13).** Tools `disponibilidad`, `canales_seguros`, `enviar_mensaje`, `esperar_respuesta`. Chat simulado en la app, máximo 3 turnos.

Tres reglas de comportamiento que no son opcionales:
- **nunca aprueba** — solo reporta el estado del usuario;
- **nunca pide claves, OTP ni datos de tarjeta** — es exactamente lo que pide un estafador;
- **el silencio no es aprobación.**

Objetivo verificable: Rosa → `manipulacion_probable`; Lucía → `sin_respuesta` / `canal_comprometido`.

**🧭 Coordinador (H13–15).** Memoria primero (salida temprana), invoca Guardián ∥ Detective solo si hacen falta, con fallback determinista.

Objetivo verificable: Jorge → **0 llamadas de IA**; Bodega → solo Detective.

**Criterio de salida (SYNC 2):** con IA real, las decisiones son las mismas que con mocks. Si no, se activa el plan de recorte del blueprint §8 — y el primero de mi lado es *Coordinador como función determinista*.

---

## S3 · Experiencia (H15–25)

**Dos paneles (H15–22).**
- 📱 Celular: transferencia, pantalla de pausa, chat del Guardián.
- 🖥️ Consola: timeline en vivo (polling 1s), expediente con citas clickeables, botón Confirmar mula / Descartar, embudo (tx → sospechosas → IA) y contador de llamadas de IA por caso.

**Controles de demo (H22–25).** Reset, selector de acto, botón "segunda víctima". Objetivo: demo reproducible en menos de 3 minutos sin tocar código.

**Criterio de salida (SYNC 3):** los 3 actos funcionan en la URL pública. A partir de aquí se congelan features; solo arreglos.

---

## S4 · Cierre (H25–30)

- Deploy final.
- README: cómo correrlo y qué datos son simulados.
- **Video de respaldo del demo completo** — por si falla internet o la API en vivo.
- Ensayo ×2 con Tony.

---

## Decisiones de stack ya resueltas

Esto cierra la casilla *"Confirmar stack y proveedor de LLM"* de H0–2. **Confirmar con Tony antes de escribir el runtime.**

| Nivel en `runtime.ts` | Modelo | Precio por millón de tokens | Quién lo usa |
|---|---|---|---|
| `rapido` | `claude-haiku-5-5` | $0.10 entrada / $0.50 salida | 🧭 Coordinador, 🛡️ Guardián, 🔍 Detective |
| `capaz` | `claude-opus-5-5` | $4 entrada / $20 salida | 📋 Auditor |

El Auditor solo corre en casos pausados o escalados, así que el volumen es bajo y el costo se mantiene. Si aprieta, el paso intermedio es `claude-sonnet-5-5` ($2 / $10).

SDK: `@anthropic-ai/sdk`.

---

## Restricciones de la API que afectan mi runtime

Verificadas contra la referencia actual. Varias contradicen lo que uno recuerda, y todas pegan en S1.

**1 · El tool use forzado ya no existe.** `tool_choice: {type: "any"}` y `{type: "tool", name: ...}` devuelven **400** en los modelos actuales. El doc 19 pide "salida JSON validada contra esquema", y la forma correcta hoy es:

- **structured outputs** — `output_config: { format: {...} }`, o `client.messages.parse()` que valida solo; **o**
- `tool_choice: auto` + `strict: true` en la definición de la tool (necesita `additionalProperties: false` y `required`).

**2 · El prefill de assistant está eliminado** (400). No se puede forzar JSON abriendo la respuesta con `{`. Va por structured outputs.

**3 · Guardián ∥ Detective NO es parallel tool use.** Son dos requests independientes lanzados concurrentes desde `pipeline.ts` (`Promise.all`). El parallel tool use es otra cosa: varias tools dentro de *una* respuesta.

**4 · Parallel tool use: todos los `tool_result` van en UN SOLO mensaje de usuario.** Partirlos en varios le enseña al modelo a dejar de paralelizar. Pega en el Detective de Tony, que llama hasta 6 tools — avisarle. Si una tool falla, devolver `tool_result` con `is_error: true`; nunca omitirla.

**5 · `claude-haiku-5-5` tiene effort `medium` por defecto**, no `high`. Fijarlo explícito en `output_config: { effort: ... }`. Para el Guardián, `low` probablemente alcanza y baja latencia.

**6 · El thinking viene vacío por defecto** (`display: "omitted"`). Si quiero mostrar el razonamiento en el timeline en vivo —y se ve muy bien en demo— hay que pedir `thinking: { type: "adaptive", display: "summarized" }`.

**7 · Prompt caching.** El orden de render es `tools` → `system` → `messages`. El system prompt y la lista de tools son idénticos en cada caso, así que el `cache_control` va después de ellos y los datos variables al final. Verificar con `usage.cache_read_input_tokens`: si sale 0 siempre, algo lo está invalidando.

**8 · No escatimar `max_tokens`** — ~16000 sin streaming. Si queda corto, la salida se corta a medias y hay que reintentar.

**9 · Inyección de prompt.** Todo texto del cliente va como **dato, nunca como instrucción**: delimitarlo claramente en el mensaje y jamás concatenarlo dentro del system prompt. Tools de solo lectura, excepto `enviar_mensaje`.

---

## Mis riesgos

| Riesgo | Mitigación |
|---|---|
| Quedo esperando el núcleo de Tony | Mocks desde S1; mi pipeline corre con `AGENTS_MOCK=1` |
| La UI se come las horas y no llego a SYNC 3 | Dos paneles estáticos primero, timeline en vivo después (es el recorte #5 del blueprint) |
| El LLM falla o se pone lento en el demo en vivo | Modo mock + video de respaldo de S4 |
| El costo se dispara | Presupuesto de 10 llamadas por caso en el runtime + Memoria primero |
| Los contratos cambian a mitad de camino | `lib/contracts/` y `pipeline.ts` solo con revisión de Tony |

---

## Convención de ramas

Blueprint §7: ramas `ale/<tema>`, PRs pequeños, revisión del otro en menos de 15 min y si no puede, se mergea y se revisa después.

- `ale/scaffold-runtime` → S0 + S1 (esta rama)
- `ale/agents-guardian` → S2
- `ale/ui-paneles` → S3
- `ale/deploy-final` → S4

**Pendiente de acordar con Tony:** el tronco. `origin/main` sigue en el commit inicial y todo el trabajo del equipo vive en `docs/multiagent-track04-b1`, así que hay que decidir si los PRs van a `main` o a esa rama antes del primer PR.
