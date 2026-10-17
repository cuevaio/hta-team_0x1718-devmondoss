# Ale_dev — Infraestructura backend

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `app/api/**` · `lib/contracts/{caso,memoria,validadores,firmas,context}.ts` · `lib/data/` · `lib/analytics/` · `lib/rules/` · `lib/policy/` · `lib/memory/` · `lib/evidence/` · `lib/cases/` · `lib/observability/` · `lib/pipeline.ts` · `scripts/demo.ts` · deploy · README.

**Entregas a Tony:** `ToolContext` (datos, analytics, memoria, evidencia, mensajes).
**Recibes de Tony:** `AgentsApi` + mocks (a la hora 5).

## 🔌 Integrar los agentes de Tony (ya listos en `lib/agents/`)

> Guía completa: [lib/agents/README.md](../../../lib/agents/README.md). Los agentes funcionan sin API key con `AGENTS_MOCK=1`.

- [ ] `lib/rules/level0.ts` emite **exactamente** estos ids: `beneficiario_nuevo`, `monto_atipico`, `dispositivo_nuevo`, `cambio_sim_o_clave`, `llamada_activa`, `horario_atipico` (`SENALES_NIVEL0` en `lib/contracts/analytics.ts`)
- [ ] `nivel0.atajo = 'P1'` si el destino está en Memoria; `'P2'` si es beneficiario habitual sin señales de compromiso
- [ ] `ToolContext.analytics.<fuente>(cuenta)` para `perfil_cuenta`, `listas_riesgo`, `fan_in`, `reenvio_rapido`, `estructuracion`, `ciclos`, y `canales(cliente)`; cada una devuelve `{ data, evidencia }` con la forma de `lib/contracts/analytics.ts`
- [ ] `ToolContext.evidencia.registrar(fuente, dato)` asigna `E-xx` y **lo agrega a `caso.evidencia`** (el Guardián y el Auditor leen de ahí)
- [ ] `canales(cliente).canal_comprometido = true` si la operación viene de dispositivo nuevo o cambio de SIM
- [ ] Pipeline: `investigar` → (`continuarGuardian`…) → Policy → `auditar` si `debeAuditar`; ver el ejemplo en el README
- [ ] Sumar el uso con `acumularIA` (alimenta el contador de IA del demo)
- [ ] Endpoint `POST /api/cases/[id]/guardian/reply` → `continuarGuardian(caso, ctx, agentes, texto)`; `''` = no respondió a tiempo
- [ ] Policy: si un agente invocado no tiene salida (falló) → P10
- [ ] Para tests del pipeline sin LLM: `crearCtx`, `casoDe`, `crearRunAgentFalso` de `lib/agents/simulacion.ts`

## H0–2 · Scaffold ✅
- [x] Next.js 15 + TypeScript + Tailwind + zod 4 + vitest (`app/` y `lib/` en la raíz, alias `@/`)
- [x] Contratos en `lib/contracts/` (`caso`, `agentes`, `memoria`, `validadores`, `firmas`) + 32 tests
- [ ] `lib/contracts/context.ts` (`ToolContext`) para los agentes de Tony

## H2–4 · Deploy
- [x] `.env.example` versionado, `.env.local` ignorado
- [ ] ⚠️ Deploy inicial con URL pública (Vercel; requiere cuenta) + `/api/health`

## H4–6 · Datos
- [ ] `lib/data/seed.json`: Rosa, Jorge, Lucía, M-01, M-02, M-03, Bodega Don Pepe, ~200 tx de fondo
- [ ] M-01: 14 remitentes nuevos en 48h, ~90% reenviado en < 2h hacia M-02 → M-03
- [ ] Bodega: muchos remitentes **sin** reenvío rápido
- [ ] Lucía: pago recurrente al hotel
- [ ] `lib/data/repo.ts`

## H6–8 · Reglas + Policy
- [ ] `lib/rules/level0.ts` con puntajes de `19` §2
- [ ] `lib/policy/engine.ts` con P1–P10 en orden
- [ ] Tests: Rosa 7, Lucía 6, Bodega 4, hotel → P2, Jorge → P1

## H8–10 · Memoria, evidencia, analytics
- [ ] `lib/memory/store.ts`: get, confirm, expiración 90 días
- [ ] `lib/evidence/ledger.ts`: ids `E-xx` asignados por el sistema
- [ ] `lib/analytics/`: `fanIn`, `reenvioRapido`, `estructuracion`, `ciclos`, `listasRiesgo`, `disponibilidad`, `canalesSeguros`
- [ ] Tests de tipologías sobre M-01 (mula) y Bodega (legítima)

## H10–12 · Pipeline + API con mocks
- [ ] `lib/cases/store.ts` con timeline
- [ ] `lib/pipeline.ts`: reglas → Coordinador → agentes en paralelo → policy → Auditor
- [ ] Rutas `/api/transfers`, `/api/cases/[id]`, `/api/cases/[id]/guardian/reply`

## 🔁 SYNC 1 (H12)
- [ ] `npm run demo` corre CU-01, CU-02, CU-03 y CU-05 con mocks

## H12–17 · Puerta B y observabilidad
- [ ] `/api/alerts` (Puerta B: sin Guardián)
- [ ] `/api/cases/[id]/verdict` (confirma / descarta; solo lo confirmado entra a la Memoria)
- [ ] `/api/stats`: embudo (tx → sospechosas → IA) y llamadas de IA por caso

## H17–22 · Robustez
- [ ] Tests e2e por escenario
- [ ] Modo seguro P10 (error / timeout / presupuesto excedido)
- [ ] `scripts/demo.ts` pulido, salida legible en consola

## 🔁 SYNC 2 (H22)
- [ ] Agentes reales dan las mismas decisiones que los mocks

## H22–26 · Producción
- [ ] Deploy final; demo corre contra la URL pública
- [ ] README (cómo correrlo, qué es simulado)
- [ ] `docs/work/API.md` con la API para el frontend de la Fase 2

## Si hay recorte
- Quitar CU-04 (Lucía)
- Quitar Puerta B
