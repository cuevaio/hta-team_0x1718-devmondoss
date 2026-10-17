# Tony_dev — Núcleo + Frente AML

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). Marca cada casilla al terminar.

**Soy dueño de:** datos semilla · Reglas nivel 0 · Policy Engine · 🧠 Memoria · `evidence.ts` · tools del Detective · 🔍 Detective · 📋 Auditor · Puerta B · narrativa del pitch.

**Entrego a Ale:** `evaluateRules`, `decide`, `memory.get/confirm`, tools con evidencia, mocks de Detective y Auditor.
**Recibo de Ale:** `runAgent` (runtime), `runPipeline`, mocks de Coordinador y Guardián.

## H0–2 · Contratos (con Ale)
- [ ] Confirmar stack y proveedor de LLM
- [ ] Esquemas zod en `lib/contracts/`: Caso, Evidencia, salidas de los 4 agentes
- [ ] Firmas acordadas y mergeadas en `main`

## H2–4 · Datos semilla
- [ ] `lib/data/seed.json`: Rosa, Jorge, Lucía, M-01, M-02, M-03, Bodega Don Pepe, ~200 tx de fondo
- [ ] M-01: 14 remitentes nuevos en 48h, ~90% reenviado en < 2h hacia M-02 → M-03
- [ ] Bodega: muchos remitentes **sin** reenvío rápido
- [ ] Lucía: pago recurrente del hotel como beneficiario habitual

## H4–6 · Reglas + Policy
- [ ] `rules/level0.ts` con puntajes de `19` §2
- [ ] `policy/engine.ts` con P1–P10 en orden
- [ ] Tests: Rosa = 7, Lucía (atacante) = 6, Bodega = 4, hotel → P2, Jorge → P1

## H6–9 · Memoria + tools
- [ ] `memory/store.ts`: get, confirm, expiración 90 días
- [ ] `evidence.ts`: ids `E-xx` asignados fuera del LLM
- [ ] Tools: `perfil_cuenta`, `fan_in`, `reenvio_rapido`, `estructuracion`, `ciclos`, `listas_riesgo`
- [ ] Mocks de Detective y Auditor en `agents/mocks.ts`

## 🔁 SYNC 1 (H9) — demo sin IA
- [ ] Los 3 actos dan la regla correcta con mocks

## H9–14 · 🔍 Detective
- [ ] Prompt + loop de tools (máx. 6, hasta 2 saltos en la cadena)
- [ ] Regla de consistencia: `alto` sin tipología → baja a `medio`
- [ ] Rosa → `alto` (`fan_in` + `reenvio_rapido`); Bodega → `bajo`

## H14–18 · 📋 Auditor
- [ ] Expediente según esquema de `19` §3
- [ ] Validador: toda afirmación con id de evidencia existente
- [ ] 1 reintento → si falla, `requiere_revision_manual: true`

## 🔁 SYNC 2 (H17) — agentes reales
- [ ] Mismas decisiones que con mocks

## H18–22 · Puerta B
- [ ] `POST /api/alert`: alerta AML → Coordinador → Detective → Auditor (sin Guardián)
- [ ] `POST /api/memory/confirm`
- [ ] (Opcional) muestra pequeña de SAML-D → JSON

## H22–27 · Calidad + números
- [ ] Tests e2e de todos los escenarios con IA real
- [ ] Ajustar umbrales de tipologías
- [ ] Números del embudo y llamadas de IA por caso para el pitch

## 🔁 SYNC 3 (H23) — demo completo en URL pública
- [ ] Los 3 actos funcionan en producción

## H27–30 · Pitch
- [ ] Guion de 3 min basado en `17_PITCH_NARRATIVE.md`
- [ ] Slides con números reales del demo (marcados como simulados)
- [ ] Ensayo ×2

## Si hay recorte (ver blueprint §8)
- Quitar Puerta B → AML solo dentro del acto 2
- Fusionar Auditor dentro del Detective
