# Ale_dev — Runtime de agentes + Frente cliente + Experiencia

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). Marca cada casilla al terminar.

**Soy dueño de:** runtime LLM · `pipeline.ts` · 🧭 Coordinador · tools del Guardián · 🛡️ Guardián · API routes · pantalla de dos paneles · deploy · README · video de respaldo.

**Entrego a Tony:** `runAgent` (runtime), `runPipeline`, mocks de Coordinador y Guardián.
**Recibo de Tony:** `evaluateRules`, `decide`, `memory.get/confirm`, tools con evidencia, mocks de Detective y Auditor.

## H0–2 · Contratos (con Tony)
- [ ] Confirmar stack y proveedor de LLM
- [ ] Esquemas zod en `lib/contracts/`
- [ ] Firmas acordadas y mergeadas en `main`

## H2–4 · Scaffold + deploy
- [ ] Proyecto Next.js + TypeScript
- [ ] Deploy inicial con URL pública
- [ ] Variables de entorno (API key solo en env, nunca en el repo)

## H4–7 · Runtime de agentes
- [ ] `agents/runtime.ts`: niveles `rapido` / `capaz`
- [ ] Validación zod + 1 reintento → modo seguro
- [ ] Presupuesto máx. 10 llamadas por caso + timeout
- [ ] Log de uso (llamadas, tokens, ms) → `caso.ia`
- [ ] Modo `AGENTS_MOCK=1`

## H7–9 · Pipeline + API
- [ ] `pipeline.ts`: reglas → Coordinador → agentes (paralelo) → policy → Auditor → Caso
- [ ] `POST /api/transfer`, `GET /api/case/[id]`, `POST /api/guardian/reply`, `POST /api/demo/reset`
- [ ] Mocks de Coordinador y Guardián en `agents/mocks.ts`

## 🔁 SYNC 1 (H9) — demo sin IA
- [ ] Los 3 actos dan la regla correcta con mocks

## H9–13 · 🛡️ Guardián
- [ ] Tools: `disponibilidad`, `canales_seguros`, `enviar_mensaje`, `esperar_respuesta`
- [ ] Chat simulado en la app, máx. 3 turnos
- [ ] Nunca pide claves / OTP / tarjeta; nunca aprueba
- [ ] Rosa → `manipulacion_probable`; Lucía → `sin_respuesta` / `canal_comprometido`

## H13–15 · 🧭 Coordinador
- [ ] Consulta Memoria primero → salida temprana
- [ ] Invoca Guardián ∥ Detective solo si hacen falta
- [ ] Fallback determinista
- [ ] Jorge → 0 llamadas; Bodega → solo Detective

## 🔁 SYNC 2 (H17) — agentes reales
- [ ] Mismas decisiones que con mocks

## H15–22 · Pantalla de dos paneles
- [ ] 📱 Celular: transferencia, pantalla de pausa, chat del Guardián
- [ ] 🖥️ Consola: timeline en vivo (polling 1s), expediente con citas clickeables
- [ ] Botón Confirmar mula / Descartar
- [ ] Embudo (tx → sospechosas → IA) + contador de llamadas de IA por caso

## H22–25 · Controles de demo
- [ ] Reset, selector de acto, botón “segunda víctima”
- [ ] Demo reproducible en < 3 min sin tocar código

## 🔁 SYNC 3 (H23) — demo completo en URL pública
- [ ] Los 3 actos funcionan en producción

## H25–27 · Cierre
- [ ] Deploy final
- [ ] README: cómo correrlo y qué datos son simulados

## H27–30 · Respaldo
- [ ] Video del demo completo
- [ ] Ensayo ×2 con Tony

## Si hay recorte (ver blueprint §8)
- Quitar acto extra (Lucía)
- Coordinador como función determinista
- Timeline estático
