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
- [x] `lib/agents-provisional.ts` borrado (reemplazado por `obtenerAgentes()`).
- [x] `POST /api/cases/[id]/guardian/reply` multiturno vía `responderGuardian` (usa `continuarGuardian`, sincroniza evidencia, re-decide y audita). Verificado en vivo: 3 silencios → `sin_respuesta` → P4.
- [x] `/api/health` expone `modoAgentes()` (`claude` | `simulado`).

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
- [x] `lib/observability/`: métricas del doc 14 (TTPA, trazabilidad de citas, E6 llamadas evitadas por la Memoria, modo seguro, fricción) + registro del doc 19 §9. Aditivo en `/api/stats`; 28 tests
- [x] La hora de la decisión ya no incluye la latencia del Auditor (`finalizar()` la reescribía después del expediente)

## H17–22 · Robustez
- [x] Tests e2e por escenario (`tests/scenarios/casos-de-uso.test.ts`, 28 tests)
- [x] Modo seguro P10 (error / timeout / presupuesto excedido) + test
- [x] `scripts/demo.ts` con salida legible y verificación 8/8 (+ métricas, con la aclaración de que los casos no son una población real)
- [x] Rutas endurecidas: `verdict` con `validado_por` de solo espacios daba 500 → 400; `alerts` sobre cuenta inexistente abría un caso PERMITIDO → 404. Tests en `tests/api/`

## 🔁 SYNC 2 (H22)
- [x] Agentes reales dan las mismas decisiones que los mocks: demo 8/8, 5 llamadas de IA

## H22–26 · Producción
- [x] Prueba local de producción: `next build` + `next start`, los 6 casos del demo por HTTP con la regla correcta, caminos 400/404, reset
- [ ] Deploy final; demo corre contra la URL pública
- [x] README (cómo correrlo, qué es simulado, sección sobre sesgos)
- [x] [`docs/work/API.md`](../API.md) con la API para el frontend de la Fase 2

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

`lib/agents-provisional.ts` ya se borró: el pipeline usa el orquestador de
Tony (`investigar` / `continuarGuardian` / `auditar`) con el bucle multiturno
del Guardián y la sincronización de evidencia que pide `lib/agents/README.md`.

**Para Tony:** `investigar` documenta que nunca lanza, pero lanza de forma
sincrónica si al `AgentsApi` le falta un método (`agentes.detective is not a
function`). Mi pipeline lo captura y degrada a P10, pero conviene envolver la
llamada sincrónica dentro del orquestador.

---

## Deploy — pasos cuando haya cuenta de Vercel

Ya verificado en local con el mismo artefacto (`next build` + `next start`):
las 8 rutas responden, `/api/stats` y `/api/health` son dinámicas (no se
prerenderizan con datos vacíos) y la secuencia del demo da las reglas correctas.

1. `npx vercel login` y `npx vercel link` (proyecto nuevo, framework Next.js, sin cambios de build).
2. Sin variables de entorno el runtime corre en **simulado**. La API key se
   agrega después en el panel de Vercel (Settings → Environment Variables),
   nunca en el repo.
3. `npx vercel --prod` y luego `curl <url>/api/health` → `"agentes":"simulado"`.
4. Correr la secuencia del demo contra la URL **en una sola sesión seguida**:
   el estado vive en memoria y cada instancia tiene el suyo (API.md §10).

---

## Para Tony — hallazgo en cuentas externas (no lo toqué: es tu bloque)

**Repro:** `POST /api/transfers` de `C-ROSA` a `X-99` (cuenta de otro banco,
`banco_propio: false`). `reenvio_rapido` devuelve `porcentaje_reenviado: 0` y
entra al ledger como evidencia. Si el caso termina en PAUSAR/ESCALAR (p. ej.
por P10), la plantilla de `afirmacionDe` en `lib/agents/decisiones/auditor.ts`
escribe *«Reenvió el 0% de lo recibido en menos de 2 h»* citando un `E-xx`
**válido**. El validador de citas no puede detectarlo: la cita existe, el dato
no se observó (doc 19 §10: de una cuenta externa no vemos sus salidas).

**Propuesta** (`CONTRACT:`): agregar `observable: boolean` a `ResultadoReenvio`
y `ResultadoCiclos` en `lib/contracts/analytics.ts`. Yo lo pongo en `false`
para cuentas externas en `lib/analytics/`; tu Auditor omite la afirmación (o
escribe «no observable: cuenta de otra entidad») cuando es `false`. No cambia
ningún caso del demo: todas sus cuentas son del banco propio.

