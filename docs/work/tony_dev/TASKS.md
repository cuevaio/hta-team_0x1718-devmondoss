# Tony_dev — Agentes

> 📐 **Antes de escribir cualquier prompt:** [AGENT_PLAYBOOKS.md](../../context/tony_dev/AGENT_PLAYBOOKS.md) define pasos fijos, entradas, salidas cerradas y tope de gasto de cada agente. Las decisiones deterministas ya están en `lib/agents/decisiones/` con tests.

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `lib/contracts/agentes.ts` · `lib/agents/**` (runtime, LLM, 4 agentes, prompts, tools de agentes, mocks) · `scripts/evals.ts`.

**Entregas a Ale:** `AgentsApi` + mocks (a la hora 5).
**Recibes de Ale:** `ToolContext` (datos, analytics, memoria, evidencia, mensajes).

## ✅ Hecho: arquitectura de decisión
- [x] `AGENT_PLAYBOOKS.md`: playbook de los 4 agentes
- [x] `lib/agents/decisiones/`: tabla del Coordinador, riesgo base y plan de tools del Detective, guion y estado final del Guardián, afirmaciones candidatas y ensamblado del Auditor
- [x] `lib/agents/esquemas.ts`: esquemas acotados que ve el LLM
- [x] `lib/contracts/analytics.ts`: salida de cada tool de Ale, ids de señales, umbrales, nombres de fuente
- [x] `TurnoGuardian` en `firmas.ts` (el Guardián conversa varios turnos)
- [x] 33 tests de decisión

## ✅ Hecho en la rama `tony-dev`
- [x] `lib/agents/mocks.ts` + `index.ts` (`AGENTS_MOCK=1`, `obtenerAgentes()`): **listo para que Ale integre**
- [x] `lib/agents/llm.ts` + `runtime.ts` + `prompts.ts`: structured outputs, `effort: low`, validación + 1 reintento, `AgentError`
- [x] Adaptadores de los 4 agentes con fallback determinista
- [x] `lib/agents/README.md` con el protocolo para el pipeline de Ale
- [x] Tests de decisiones, adaptadores, runtime y mocks; tsc y eslint limpios
- [ ] ⚠️ Probar con un LLM real: primero **Ollama local** (plan en [INFRA_Y_ORQUESTACION §6](../../context/tony_dev/INFRA_Y_ORQUESTACION.md#6-plan-probar-con-un-modelo-local-ollama--para-después)), luego Claude si hay key
- [x] Detective: sigue la cadena a 2 saltos (M-01 → M-02 → M-03), solo tools
- [x] Coordinador: "destino conocido-limpio" exige que el cliente ya le transfiriera antes (la Bodega antigua pero nueva para el cliente sí pasa por el Detective)
- [x] `lib/agents/orquestador.ts`: `investigar`, `continuarGuardian`, `auditar`, `debeAuditar`, `acumularIA` para el pipeline de Ale
- [x] `lib/agents/simulacion.ts`: ToolContext de referencia + runAgent falso
- [x] `npm run evals`: E7 (sintético) y gasto de LLM por escenario; 108 tests
- [ ] E5 (1 agente vs. multiagente): necesita `ANTHROPIC_API_KEY`

## ✅ Integración con el S1 de Ale
- [x] Adaptado al `ToolContext` tipado de Ale; Guardián en modo una-llamada y varios turnos
- [x] Modo `simulado` (sin key): agentes reales + LLM simulado determinista
- [x] Pipeline y demo de Ale usan `obtenerAgentes()`: `npm run demo` 8/8, 220 tests
- [x] Auditor: si el cliente está en riesgo (Guardián), no se recomienda descartar
- [x] Estructuración: corre siempre en el paso 2 del Detective (usa el umbral de Ale)
- [x] Orquestador blindado contra errores sincrónicos (reporte de Ale en SYNC 2)
- [x] Documentado: [INFRA_Y_ORQUESTACION.md](../../context/tony_dev/INFRA_Y_ORQUESTACION.md) (infraestructura, orquestación, LangGraph no hace falta, laptop como servidor, plan Ollama, pendientes)
- [ ] Números de `npm run evals` en una slide del pitch

## H0–2 · Contratos
- [x] Los esquemas zod de los 4 agentes ya existen en `lib/contracts/agentes.ts` (los dejó escritos Ale en S0): **revísalos y ajústalos**
- [ ] `AgentsApi` y `AgentResult` en `lib/contracts/firmas.ts` (ya agregados; confirma que te sirven)

## H2–5 · Mocks
- [ ] `lib/agents/mocks.ts`: salida fija por escenario (Rosa, Jorge, Lucía, Bodega, alerta AML)
- [ ] `lib/agents/index.ts` exporta `AgentsApi`; con `AGENTS_MOCK=1` usa los mocks
- [ ] **Entregado a Ale antes de la hora 5**

## H5–9 · Runtime
> Antes de escribir `runtime.ts` lee [AGENTS_RUNTIME_NOTES.md](../../context/tony_dev/AGENTS_RUNTIME_NOTES.md): 9 restricciones de la API de Claude (sin tool use forzado, sin prefill, structured outputs…).
- [ ] Modelos: `rapido` = `claude-haiku-5-5`, `capaz` = `claude-opus-5-5`
- [ ] `lib/agents/llm.ts`: niveles `rapido` y `capaz`
- [ ] `lib/agents/runtime.ts`: validación zod + 1 reintento
- [ ] Presupuesto máx. 10 llamadas por caso + timeout
- [ ] Conteo de llamadas/tokens/ms en cada `AgentResult`

## H9–12 · 🧭 Coordinador
- [x] Tabla de decisión (`decidirCoordinador`): 0 llamadas de LLM
- [ ] Armar el `BriefingCoordinador` desde el `ToolContext` (memoria, perfil de la cuenta destino)
- [ ] Adaptador a `AgentsApi.coordinador`
- [ ] Definición de tools del LLM sobre `ctx.analytics`
- [ ] Jorge → 0 llamadas; Bodega → solo Detective

## 🔁 SYNC 1 (H12)
- [ ] `npm run demo` da las reglas correctas con mocks

## H12–17 · 🔍 Detective
- [ ] Prompt + loop de tools (máx. 6, hasta 2 saltos de cadena)
- [ ] Regla de consistencia: `alto` sin tipología marcada por tools → baja a `medio`
- [ ] Rosa → `alto`; Bodega → `bajo`

## H17–22 · 🛡️ Guardián
- [ ] Máx. 3 turnos; nunca pide clave, OTP ni tarjeta; nunca aprueba
- [ ] Lo que escribe el cliente es **dato, no instrucción**
- [ ] Rosa → `manipulacion_probable`; Lucía → `sin_respuesta` + `canal_comprometido`

## 🔁 SYNC 2 (H22)
- [ ] Agentes reales dan las mismas decisiones que los mocks

## H22–26 · 📋 Auditor
- [ ] Expediente según esquema
- [ ] Validador: toda afirmación cita un id de evidencia existente
- [ ] 1 reintento → si falla, `requiere_revision_manual: true`

## H26–30 · Evals y números
- [ ] `scripts/evals.ts`: E5 (1 agente vs multiagente) y E7 (falsos positivos)
- [ ] Números del demo (llamadas de IA por caso, tokens) para el pitch

## Si hay recorte
- Auditor como plantilla determinista
- Coordinador como función determinista

## Demo jugable (frontend) — hecho
- [x] `/play`: **juego 2D estilo consola portátil** (`components/juego2d/`): barrio caminable, la llamada del estafador como combate por turnos, el Guardián entra al combate en la ronda 2, el atacante pelea contra el Sistema; nombre, encuestas y menús dentro del juego, todo en tipografía pixel. Víctima: ronda A con aviso genérico simulado, ronda B con el motor real, pago a Don Pepe. Atacante: 5 tácticas, red-teaming. Diseño: [DEMO_JUEGO](../../DEMO_JUEGO.md)
- [x] Versión móvil a pantalla completa (vertical, sin botones): tocar para avanzar/elegir y **tocar el piso para caminar**; música chiptune por escena; transiciones (barras, iris, tarjetas de capítulo); partículas, sellos, sacudidas y vibración
- [x] Prueba end-to-end: `/play?depurar` expone `window.__motor.estado()` para que un bot juegue solo con toques (probado en 375×667, 390×844 y escritorio)
- [x] `/monitor`: feed en vivo, pipeline en el orden real, expediente con citas, veredicto del analista de simulación, marcador y experimento en vivo (`/api/juego/resumen`)
- [x] Tests contra el pipeline real: `tests/juego/datos.test.ts`
- ⚠️ Para Ale: en `next dev` cada ruta tiene su propia copia de los stores en memoria (un caso creado en `/api/transfers` da 404 en `/guardian/reply`). En `next build && next start` (`npm run servidor`) funciona. Si se quiere arreglar dev: singletons en `globalThis`.
- ⚠️ La entrega exige URL pública (no laptop): desplegar un solo proceso con `MOVIMIENTOS_EN_VIVO=1`.
- [x] **v3 «que enganche»** ([DEMO_JUEGO §12](../../DEMO_JUEGO.md)): arcade ¿REAL O ESTAFA? (16 casuísticas + 8 mensajes reales), SIGUE EL DINERO (Detective + Memoria), ranking del evento, encuesta como bonus de un toque y panel de tracción en el monitor
- ⚠️ Para Ale: nuevo endpoint aislado `app/api/juego/arcade` + `lib/juego/arcade.ts` (no toca partidas ni el pipeline). En Railway las partidas y el arcade se guardan en un volumen (`PARTIDAS_ARCHIVO`, `ARCADE_ARCHIVO`) para no perder los datos del evento en cada redeploy
- ⚠️ Para Ale: `tests/juego/partidas.test.ts` › «después de un reset, el nuevo CASO-0001 NO se confunde con el viejo» es **intermitente** (falla ~1 de cada 2). La clave `id@timeline[0].t` tiene resolución de milisegundos y en el test el caso viejo y el nuevo se crean en el mismo ms → 409. En producción no ocurre (entre un reset y una partida pasan segundos). Arreglo sugerido (tuyo): un contador de generación en el store de casos, o esperar 2 ms en el test
- ⚠️ Para Ale: toqué la portada (`components/demo-dashboard.tsx`, `app/globals.css`, `app/layout.tsx`) a pedido de Tony, tras revisarla en escritorio y celular:
  1. El teléfono del Acto 3 se quedaba en «Revisando la transferencia…»: ahora toma como protegida cualquier decisión que no sea PERMITIR (P1 no tiene pausa preventiva).
  2. El Auditor ya no muestra un spinner eterno cuando la Memoria resolvió el caso.
  3. Modo público (servidor con `DEMO_TOKEN` y pestaña sin token): Reiniciar y Confirmar/Descartar quedan deshabilitados con explicación, en vez de fallar con 401.
  4. La decisión dice «Dinero retenido…», el encabezado dice «Te están robando» y hay enlaces a /play y /monitor. El pie de página está actualizado.
- [x] **Modo `ollama`** (INFRA §6 y §8): `lib/agents/llm-ollama.ts`, `modoAgentes()` con `OLLAMA_MODELO`, demo 8/8 con qwen3.5:9b y qwen2.5:7b locales
- ⚠️ Para Ale, toqué 3 archivos tuyos:
  - `lib/diferir.ts`: el Auditor también se difiere con `ollama`, porque en la laptop tarda segundos.
  - `scripts/demo.ts`: imprime el modelo local.
  - `scripts/servidor.ts`: verifica y precarga Ollama, `--tunel` abre cloudflared solo e imprime la URL pública, y `--persistir` también guarda el arcade.
