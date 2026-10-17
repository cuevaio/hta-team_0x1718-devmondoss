# Ale_dev — Infraestructura backend

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `src/server.ts` · `routes/` · `contracts/caso.ts` y `context.ts` · `data/` · `analytics/` · `rules/` · `policy/` · `memory/` · `evidence/` · `cases/` · `observability/` · `pipeline.ts` · `scripts/demo.ts` · deploy · README.

**Entregas a Tony:** `ToolContext` (datos, analytics, memoria, evidencia, mensajes).
**Recibes de Tony:** `AgentsApi` + mocks (a la hora 5).

## H0–2 · Scaffold
- [ ] TypeScript + Fastify + zod + vitest; `npm run dev`, `npm test`
- [ ] `contracts/caso.ts` y `contracts/context.ts`

## H2–4 · Deploy
- [ ] Railway desde `main`, `/health`, `.env.example`
- [ ] URL pública responde

## H4–6 · Datos
- [ ] `data/seed.json`: Rosa, Jorge, Lucía, M-01, M-02, M-03, Bodega Don Pepe, ~200 tx de fondo
- [ ] M-01: 14 remitentes nuevos en 48h, ~90% reenviado en < 2h hacia M-02 → M-03
- [ ] Bodega: muchos remitentes **sin** reenvío rápido
- [ ] Lucía: pago recurrente al hotel
- [ ] `data/repo.ts`

## H6–8 · Reglas + Policy
- [ ] `rules/level0.ts` con puntajes de `19` §2
- [ ] `policy/engine.ts` con P1–P10 en orden
- [ ] Tests: Rosa 7, Lucía 6, Bodega 4, hotel → P2, Jorge → P1

## H8–10 · Memoria, evidencia, analytics
- [ ] `memory/store.ts`: get, confirm, expiración 90 días
- [ ] `evidence/ledger.ts`: ids `E-xx` asignados por el sistema
- [ ] `analytics/`: `fanIn`, `reenvioRapido`, `estructuracion`, `ciclos`, `listasRiesgo`, `disponibilidad`, `canalesSeguros`
- [ ] Tests de tipologías sobre M-01 (mula) y Bodega (legítima)

## H10–12 · Pipeline + API con mocks
- [ ] `cases/store.ts` con timeline
- [ ] `pipeline.ts`: reglas → Coordinador → agentes en paralelo → policy → Auditor
- [ ] Rutas `/transfers`, `/cases/:id`, `/cases/:id/guardian/reply`

## 🔁 SYNC 1 (H12)
- [ ] `npm run demo` corre CU-01, CU-02, CU-03 y CU-05 con mocks

## H12–17 · Puerta B y observabilidad
- [ ] `/alerts` (Puerta B: sin Guardián)
- [ ] `/cases/:id/verdict` (confirma / descarta; solo lo confirmado entra a la Memoria)
- [ ] `/stats`: embudo (tx → sospechosas → IA) y llamadas de IA por caso

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
