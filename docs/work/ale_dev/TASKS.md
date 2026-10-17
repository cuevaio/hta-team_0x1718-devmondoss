# Ale_dev — Infraestructura backend

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `app/api/**` · `lib/contracts/{caso,memoria,validadores,firmas,context}.ts` · `lib/data/` · `lib/analytics/` · `lib/rules/` · `lib/policy/` · `lib/memory/` · `lib/evidence/` · `lib/cases/` · `lib/observability/` · `lib/pipeline.ts` · `scripts/demo.ts` · deploy · README.

**Entregas a Tony:** `ToolContext` (datos, analytics, memoria, evidencia, mensajes).
**Recibes de Tony:** `AgentsApi` + mocks (a la hora 5).

## 🔌 Agentes de Tony — integrados

> Guía: [lib/agents/README.md](../../../lib/agents/README.md).

- [x] `lib/pipeline.ts` y `scripts/demo.ts` usan `obtenerAgentes()` (Claude si hay key; si no, simulado). `npm run demo` 8/8.
- [x] Mi Guardián funciona con tu modelo de una llamada (`respuestaCliente` o buzón) y también en varios turnos.
- [x] Mis agentes usan tu `ToolContext` tipado (`canales_seguros`, `disponibilidad` con id de cliente).
- [ ] `lib/agents-provisional.ts` quedó sin uso: bórralo cuando quieras.
- [ ] `POST /api/cases/[id]/guardian/reply` hoy solo registra el texto: para el modo varios turnos debe llamar `agentes.guardianTurno(caso, ctx, texto)` (tras `sincronizarEvidencia`), y si `terminado` → `decide` → auditor. Opción: `continuarGuardian` de `lib/agents`.
- [ ] `/api/health` puede mostrar `modoAgentes()` (`claude` | `simulado`).

## H0–2 · Scaffold ✅
- [x] Next.js 15 + TypeScript + Tailwind + zod 4 + vitest (`app/` y `lib/` en la raíz, alias `@/`)
- [x] Contratos en `lib/contracts/` (`caso`, `agentes`, `memoria`, `validadores`, `firmas`) + 32 tests
- [x] `ToolContext` tipado en `lib/contracts/firmas.ts` (`CONTRACT:` — ver nota al pie)

## H2–4 · Deploy
- [x] `.env.example` versionado, `.env.local` ignorado
- [ ] ⚠️ Deploy inicial con URL pública (Vercel; requiere cuenta) + `/api/health`

## H4–6 · Datos
- [x] `lib/data/seed.json` generado por `scripts/seed.ts` (PRNG determinista, 200 movimientos)
- [x] M-01: 14 remitentes nuevos en 48h, 91% reenviado en < 2h hacia M-02 → M-03
- [x] Bodega: 11 remitentes nuevos **sin** reenvío rápido (0%)
- [x] Lucía: pago recurrente al hotel (P2)
- [x] `lib/data/repo.ts`

## H6–8 · Reglas + Policy
- [x] `lib/rules/level0.ts` con puntajes de `19` §2 y señales de `SENALES_NIVEL0`
- [x] `lib/policy/engine.ts` con P1–P10 en orden
- [x] Tests: Rosa 7, Lucía 6, Bodega 4, hotel → P2, Jorge → P1

## H8–10 · Memoria, evidencia, analytics
- [x] `lib/memory/store.ts`: get, confirm, expiración 90 días, apelación
- [x] `lib/evidence/ledger.ts`: ids `E-xx` asignados por el sistema, uno por caso
- [x] `lib/analytics/`: `perfilCuenta`, `fanIn`, `reenvioRapido`, `estructuracion`, `ciclos`, `listasRiesgo`, `cadenaReenvio`, `disponibilidad`, `canalesSeguros`
- [x] Tests de tipologías sobre M-01 (mula) y Bodega (legítima)

## H10–12 · Pipeline + API con mocks
- [x] `lib/cases/store.ts` con timeline y contador de IA
- [x] `lib/pipeline.ts`: reglas → pausa → Memoria → Coordinador → agentes en paralelo → policy → Auditor
- [x] Las 8 rutas del blueprint §3, probadas en vivo contra el servidor

## 🔁 SYNC 1 (H12)
- [x] `npm run demo` → **8/8**: CU-01 P4, CU-02 P5, CU-03 P1 (0 IA), CU-05 P8, CU-04 P7 + hotel P2

## H12–17 · Puerta B y observabilidad
- [x] `/api/alerts` (Puerta B: sin Guardián)
- [x] `/api/cases/[id]/verdict` (solo lo validado por un humano entra a la Memoria)
- [x] `/api/stats`: embudo y llamadas de IA por caso

## H17–22 · Robustez
- [ ] Tests e2e por escenario
- [x] Modo seguro P10 (error / timeout / presupuesto excedido) + test
- [x] `scripts/demo.ts` con salida legible y verificación 8/8

## 🔁 SYNC 2 (H22)
- [ ] Agentes reales dan las mismas decisiones que los mocks

## H22–26 · Producción
- [ ] Deploy final; demo corre contra la URL pública
- [ ] README (cómo correrlo, qué es simulado)
- [ ] `docs/work/API.md` con la API para el frontend de la Fase 2

## Si hay recorte
- Quitar CU-04 (Lucía)
- Quitar Puerta B


---

## Nota de contrato (S1)

Dos cambios en `lib/contracts/firmas.ts`, commiteados con `CONTRACT:`:

1. **`ToolContext.data` y `.analytics` ahora están tipados.** Estaban como
   `Record<string, ...>`, y `data: Record<string, (...args: never[]) => unknown>`
   era imposible de llamar: un parámetro `never[]` no acepta un string, así que
   `ctx.data.cliente('rosa')` no compilaba. `analytics` devolvía `data: unknown`
   y forzaba un cast en cada uso. Los nombres de los campos no cambiaron.
2. **P5 del Policy Engine se amplió** a cualquier destino de riesgo alto, no
   solo cuando el Guardián dice `confirmado_seguro`. Faltaba un caso real: en
   la Puerta B no hay cliente a quien preguntar, así que `estadoUsuario` queda
   indefinido y el caso caía hasta P10 pese al riesgo alto. Ahora P4 y P5
   cubren juntos todo destino `alto`.

Además, `lib/agents-provisional.ts` es temporal: compone las funciones de
decisión de Tony (`lib/agents/decisiones/*`) con mis analytics, sin LLM, para
no quedar bloqueado hasta su `AgentsApi`. Se borra cuando llegue.
