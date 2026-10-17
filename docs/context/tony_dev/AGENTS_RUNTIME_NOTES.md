# Tony_dev — Notas del runtime de agentes

> Notas técnicas que dejó investigadas Ale en S0, ahora para el runtime de Tony (`lib/agents/`). Referencia: [../../work/tony_dev/TASKS.md](../../work/tony_dev/TASKS.md).

## Decisiones de stack ya resueltas

Esto cierra la casilla *"Confirmar stack y proveedor de LLM"* de H0–2. 

| Nivel en `runtime.ts` | Modelo | Precio por millón de tokens | Quién lo usa |
|---|---|---|---|
| `rapido` | `claude-haiku-5-5` | $0.10 entrada / $0.50 salida | 🧭 Coordinador, 🛡️ Guardián, 🔍 Detective |
| `capaz` | `claude-opus-5-5` | $4 entrada / $20 salida | 📋 Auditor |

El Auditor solo corre en casos pausados o escalados, así que el volumen es bajo y el costo se mantiene. Si aprieta, el paso intermedio es `claude-sonnet-5-5` ($2 / $10).

SDK: `@anthropic-ai/sdk`.

---

## Restricciones de la API que afectan el runtime

Verificadas contra la referencia actual. Varias contradicen lo que uno recuerda, y todas afectan a `runtime.ts`.

**1 · El tool use forzado ya no existe.** `tool_choice: {type: "any"}` y `{type: "tool", name: ...}` devuelven **400** en los modelos actuales. El doc 19 pide "salida JSON validada contra esquema", y la forma correcta hoy es:

- **structured outputs** — `output_config: { format: {...} }`, o `client.messages.parse()` que valida solo; **o**
- `tool_choice: auto` + `strict: true` en la definición de la tool (necesita `additionalProperties: false` y `required`).

**2 · El prefill de assistant está eliminado** (400). No se puede forzar JSON abriendo la respuesta con `{`. Va por structured outputs.

**3 · Guardián ∥ Detective NO es parallel tool use.** Son dos requests independientes lanzados concurrentes desde `pipeline.ts` (`Promise.all`). El parallel tool use es otra cosa: varias tools dentro de *una* respuesta.

**4 · Parallel tool use: todos los `tool_result` van en UN SOLO mensaje de usuario.** Partirlos en varios le enseña al modelo a dejar de paralelizar. Aplica al Detective, que llama hasta 6 tools. Si una tool falla, devolver `tool_result` con `is_error: true`; nunca omitirla.

**5 · `claude-haiku-5-5` tiene effort `medium` por defecto**, no `high`. Fijarlo explícito en `output_config: { effort: ... }`. Para el Guardián, `low` probablemente alcanza y baja latencia.

**6 · El thinking viene vacío por defecto** (`display: "omitted"`). Si quiero mostrar el razonamiento en el timeline en vivo —y se ve muy bien en demo— hay que pedir `thinking: { type: "adaptive", display: "summarized" }`.

**7 · Prompt caching.** El orden de render es `tools` → `system` → `messages`. El system prompt y la lista de tools son idénticos en cada caso, así que el `cache_control` va después de ellos y los datos variables al final. Verificar con `usage.cache_read_input_tokens`: si sale 0 siempre, algo lo está invalidando.

**8 · No escatimar `max_tokens`** — ~16000 sin streaming. Si queda corto, la salida se corta a medias y hay que reintentar.

**9 · Inyección de prompt.** Todo texto del cliente va como **dato, nunca como instrucción**: delimitarlo claramente en el mensaje y jamás concatenarlo dentro del system prompt. Tools de solo lectura, excepto `enviar_mensaje`.

---
