# Ale_dev — Plan de sprints (vista alto nivel)

> Vista agrupada de [../../work/ale_dev/TASKS.md](../../work/ale_dev/TASKS.md). El checklist tiene el detalle casilla por casilla; esto sirve para saber **en qué sprint estoy, qué lo cierra y qué me bloquea**.
>
> Fuente de verdad del reparto: [../../work/00_WORK_BLUEPRINT.md](../../work/00_WORK_BLUEPRINT.md). Solo `main`, sin pedir permiso.

**Mi bloque:** toda la infraestructura backend determinista: API, datos, analytics, reglas, policy, memoria, evidencia, casos, pipeline, observabilidad, deploy y script de demo. **No toco prompts ni LLM:** eso es de Tony.

## Mapa de sprints

| Sprint | Horas | Qué construyo | Lo cierra |
|:-:|:-:|---|---|
| **S0** ✅ | 0–4 | Scaffold Next.js + contratos zod + `.env.example` | contratos en `main` (hecho) · deploy público pendiente |
| **S1** | 4–12 | Datos, reglas nivel 0, Policy P1–P10, Memoria, ledger, analytics, casos, pipeline con mocks de Tony | 🔁 **SYNC 1 (H12)** — `npm run demo` corre CU-01/02/03/05 con la regla correcta, sin IA |
| **S2** | 12–22 | Puerta B, `/verdict`, `/stats`, embudo y uso de IA, e2e, modo seguro P10 | 🔁 **SYNC 2 (H22)** — con agentes reales salen las mismas decisiones |
| **S3** | 22–26 | Deploy final, README, `docs/work/API.md` para el frontend | 🔁 **SYNC 3 (H26)** — casos corriendo en la URL pública |
| **Fase 2** | 27+ | Frontend (por asignar) sobre la API | — |

## Qué ya está hecho (S0)

- Next.js 15 + TypeScript + Tailwind 4 + vitest, estructura `app/` y `lib/` en la raíz, alias `@/*`.
- `lib/contracts/`: `caso`, `agentes`, `memoria`, `validadores`, `firmas` + 32 tests.
- `.env.example` con los dos niveles de modelo.

## Lo que entrego a Tony

`ToolContext` (datos, analytics, memoria de solo lectura, evidencia con ids `E-xx`, mensajes). Los datos y los analytics salen de mi bloque, así que **priorizo `lib/data/` y `lib/analytics/` antes que el pipeline** (hora 10 como máximo).

## Lo que recibo de Tony

`AgentsApi` y los mocks (hora 5). Mi pipeline corre con `AGENTS_MOCK=1` desde el primer día.

## Mis riesgos

| Riesgo | Mitigación |
|---|---|
| Deploy bloqueado (cuenta de Vercel) | Resolver la cuenta hoy; mientras tanto todo corre en local con `npm run demo` |
| Quedo esperando los mocks de Tony | Escribo mis propios stubs mínimos con el contrato de `firmas.ts` |
| Los datos semilla no distinguen mula de bodega | Primero tests de analytics sobre M-01 y Bodega (el reenvío rápido es lo que las separa) |
| Costo de IA | El embudo y la Memoria evitan llamadas; yo expongo el contador en `/api/stats` |
