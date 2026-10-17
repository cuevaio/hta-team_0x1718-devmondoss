# Tony_dev — Agentes

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `src/contracts/agents.ts` · `src/agents/**` (runtime, LLM, 4 agentes, prompts, tools de agentes, mocks) · `scripts/evals.ts`.

**Entregas a Ale:** `AgentsApi` + mocks (a la hora 5).
**Recibes de Ale:** `ToolContext` (datos, analytics, memoria, evidencia, mensajes).

## H0–2 · Contratos
- [ ] Esquemas zod de salida de Coordinador, Guardián, Detective y Auditor (según `19` §3)
- [ ] `AgentResult<T>` y `AgentsApi` en `contracts/agents.ts`

## H2–5 · Mocks
- [ ] `agents/mocks.ts`: salida fija por escenario (Rosa, Jorge, Lucía, Bodega, alerta AML)
- [ ] `agents/index.ts` exporta `AgentsApi`; con `AGENTS_MOCK=1` usa los mocks
- [ ] **Entregado a Ale antes de la hora 5**

## H5–9 · Runtime
- [ ] `agents/llm.ts`: niveles `rapido` y `capaz`
- [ ] `agents/runtime.ts`: validación zod + 1 reintento
- [ ] Presupuesto máx. 10 llamadas por caso + timeout
- [ ] Conteo de llamadas/tokens/ms en cada `AgentResult`

## H9–12 · 🧭 Coordinador
- [ ] Consulta Memoria primero → salida temprana
- [ ] Decide qué especialistas invocar
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
