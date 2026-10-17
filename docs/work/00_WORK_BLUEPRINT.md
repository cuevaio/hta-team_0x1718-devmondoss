# Work Blueprint: Ale_dev + Tony_dev

> Cómo nos dividimos el MVP ([13_MVP_30H](../context/tony_dev/adaptive_financial_security_docs/13_MVP_30H.md)) y el sistema multiagente ([19_MULTIAGENT_SYSTEM](../context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md)) en 30h sin bloquearnos.
>
> Checklists individuales: [tony_dev/TASKS.md](tony_dev/TASKS.md) · [ale_dev/TASKS.md](ale_dev/TASKS.md). **Este documento es la fuente de verdad**; si algo cambia, se cambia aquí primero.
>
> **Regla de oro:** acordamos los contratos en la hora 0–2, cada uno trabaja contra *mocks* del otro y a la **hora 9 ya existe un demo end-to-end sin IA**.

---

## 1. División

| | **Tony_dev** — Núcleo + Frente AML | **Ale_dev** — Runtime de agentes + Frente cliente + Experiencia |
|---|---|---|
| **Dueño de** | datos, reglas, policy, memoria, tools y agentes del lado cuenta destino | infraestructura de agentes, orquestación, lado cliente, UI y deploy |
| **Componentes** | datos semilla · Reglas nivel 0 · Policy Engine · 🧠 Memoria · tools del Detective · 🔍 Detective · 📋 Auditor · Puerta B (alerta AML) | runtime LLM · pipeline · 🧭 Coordinador · tools del Guardián · 🛡️ Guardián · API · pantalla de dos paneles · deploy |
| **Cubre** | B1 + lógica de decisión | Track 04 (lado cliente) + todo lo que se ve |
| **Además** | narrativa del pitch y números del embudo | demo controls, video de respaldo, README |

**Por qué así:** cada uno es dueño de un frente completo (de la tool a la salida del agente). Las únicas uniones son los contratos, el runtime de agentes y el pipeline, y las tres quedan definidas en la hora 0–2.

---

## 2. Stack propuesto (confirmar en H0)

| Capa | Propuesta | Motivo |
|---|---|---|
| App | **Next.js + TypeScript** (frontend + API routes en un solo proyecto) | un solo repo, un solo deploy |
| Contratos | **zod** | validar salidas de agentes y el objeto Caso |
| Datos | JSON en `lib/data/` + memoria en proceso | sin base de datos en el MVP |
| LLM | wrapper propio `llm.ts` con 2 niveles: `rapido` y `capaz` | proveedor intercambiable; **proveedor pendiente** |
| Tiempo real en UI | polling cada 1s a `/api/case/[id]` | más simple que SSE/websockets |
| Deploy | Vercel o Railway | URL pública desde la hora 4 |
| Opcional | script Python para muestrear SAML-D → JSON | solo si sobra tiempo |

---

## 3. Estructura del repo

```text
app/
  page.tsx                      # pantalla dos paneles                    → Ale
  api/transfer/route.ts         # Puerta A                                → Ale
  api/alert/route.ts            # Puerta B (alerta AML)                   → Tony
  api/case/[id]/route.ts        # leer caso (polling)                     → Ale
  api/guardian/reply/route.ts   # respuesta del cliente al chat           → Ale
  api/memory/confirm/route.ts   # analista confirma / descarta            → Tony
  api/demo/reset/route.ts       # reiniciar demo                          → Ale
lib/
  contracts/                    # zod: Caso, Evidencia, salidas agentes   → AMBOS (cambio = PR revisado por el otro)
  data/seed.json                # Rosa, Jorge, Lucía, M-01..03, Bodega    → Tony
  rules/level0.ts               # señales + score + atajos                → Tony
  policy/engine.ts              # P1–P10                                  → Tony
  memory/store.ts               # get / confirm / expira                  → Tony
  evidence.ts                   # asigna ids E-xx                         → Tony
  tools/detective/*.ts          # perfil, fan_in, reenvio, estructuracion,
                                # ciclos, listas                          → Tony
  tools/guardian/*.ts           # disponibilidad, canales_seguros,
                                # enviar_mensaje, esperar_respuesta       → Ale
  agents/runtime.ts             # llamar LLM, validar, reintento,
                                # presupuesto, timeout, log de uso        → Ale
  agents/mocks.ts               # salidas fijas por escenario             → AMBOS (cada uno las de sus agentes)
  agents/coordinador.ts                                                   → Ale
  agents/guardian.ts                                                      → Ale
  agents/detective.ts                                                     → Tony
  agents/auditor.ts                                                       → Tony
  pipeline.ts                   # reglas → coordinador → agentes → policy
                                # → auditor → caso                        → Ale (Tony revisa)
tests/scenarios/                # un test por acto del demo               → cada uno los suyos
```

---

## 4. Contratos compartidos (H0–2, juntos)

Lo único que **no** se cambia sin avisar:

```ts
// lib/contracts — firmas acordadas
evaluateRules(tx, ctx)        → { senales: string[], score: number, atajo?: "P1" | "P2" }      // Tony
decide(caso)                  → { accion: "PERMITIR"|"PAUSAR"|"VERIFICAR"|"ESCALAR", regla: string } // Tony
memory.get(cuenta)            → Veredicto | null                                               // Tony
memory.confirm(cuenta, v)     → void                                                           // Tony
tool(...)                     → { data, evidencia: Evidencia[] }   // ids asignados por evidence.ts
runAgent(nombre, input, schema, { nivel, maxLlamadas, timeoutMs })
                              → { salida, uso: { llamadas, tokens, ms } }                      // Ale
runPipeline(tx | alerta)      → Caso                                                           // Ale
```

Esquemas de salida de cada agente: los de [19_MULTIAGENT_SYSTEM §3](../context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md#3-agentes), tal cual.

**Mocks:** con `AGENTS_MOCK=1` cada agente devuelve una salida fija según el escenario. Así Ale construye UI y pipeline sin esperar los agentes de Tony, y Tony prueba la policy sin esperar el runtime de Ale.

---

## 5. Plan por horas

### Tony_dev

| Horas | Tarea | Definition of Done |
|---|---|---|
| 0–2 | 🤝 Contratos + estructura (con Ale) | `lib/contracts` y firmas acordadas en `main` |
| 2–4 | Datos semilla | `seed.json` valida; M-01 tiene 14 remitentes nuevos en 48h y reenvía ~90% en < 2h; Bodega tiene fan-in **sin** reenvío |
| 4–6 | Reglas nivel 0 + Policy P1–P10 | test por escenario: Rosa = 7, Lucía = 6, Bodega = 4, hotel → P2 |
| 6–9 | Memoria + `evidence.ts` + 6 tools del Detective | cada tool devuelve evidencia con id; tests de tipologías |
| **9** | **🔁 SYNC 1** | **demo end-to-end con mocks: los 3 actos dan la regla correcta** |
| 9–14 | 🔍 Detective (prompt, loop de tools, regla de consistencia) | Rosa → `alto` con `fan_in` + `reenvio_rapido`; Bodega → `bajo` |
| 14–18 | 📋 Auditor + validador de citas + reintento | ninguna afirmación sin id válido; si falla → `requiere_revision_manual` |
| **17** | **🔁 SYNC 2** | **agentes reales integrados en el pipeline** |
| 18–22 | Puerta B (`/api/alert`) + `memory/confirm` + (opcional) muestra SAML-D | alerta AML produce expediente sin pasar por el Guardián |
| 22–27 | Tests e2e de escenarios, ajuste de umbrales, números del embudo | todos los tests de `tests/scenarios` verdes con IA real |
| **23** | **🔁 SYNC 3** | **demo completo en la URL pública** |
| 27–30 | Guion del pitch + slides con números reales del demo | pitch de 3 min ensayado 2 veces |

### Ale_dev

| Horas | Tarea | Definition of Done |
|---|---|---|
| 0–2 | 🤝 Contratos + estructura (con Tony) | igual que Tony |
| 2–4 | Scaffold Next.js + deploy inicial + variables de entorno | URL pública con “hello world” |
| 4–7 | `agents/runtime.ts`: 2 niveles de modelo, validación zod + 1 reintento, presupuesto, timeout, log de uso, modo mock | un agente de prueba devuelve JSON válido y registra llamadas/tokens |
| 7–9 | `pipeline.ts` + API routes con mocks | `POST /api/transfer` devuelve un Caso completo |
| **9** | **🔁 SYNC 1** | igual que Tony |
| 9–13 | Tools del Guardián + 🛡️ Guardián (chat simulado en la app, máx. 3 turnos, nunca pide claves/OTP, nunca aprueba) | Rosa → `manipulacion_probable`; Lucía → `sin_respuesta` / `canal_comprometido` |
| 13–15 | 🧭 Coordinador: Memoria primero, invocación en paralelo, salida temprana, fallback determinista | Jorge → 0 llamadas; Bodega → solo Detective |
| **17** | **🔁 SYNC 2** | igual que Tony |
| 15–22 | Pantalla de dos paneles: 📱 transferencia, pausa y chat · 🖥️ timeline en vivo, expediente con citas clickeables, botón confirmar/descartar, embudo y contador de IA | los 3 actos se pueden ejecutar desde la UI |
| 22–25 | Controles de demo: reset, selector de acto, botón “segunda víctima” | demo reproducible en < 3 min sin tocar código |
| **23** | **🔁 SYNC 3** | igual que Tony |
| 25–27 | Deploy final + README | README con cómo correrlo y qué es simulado |
| 27–30 | Ensayo + **video de respaldo** del demo | video grabado por si falla internet o la API |

---

## 6. Sincronizaciones

| Hora | Nombre | Criterio Go | Si NO se cumple |
|---|---|---|---|
| 2 | Contratos | firmas y esquemas en `main` | no se avanza hasta cerrarlos |
| 9 | Demo sin IA | 3 actos correctos con mocks, en local | prioridad absoluta antes de tocar agentes reales |
| 17 | Agentes reales | pipeline con IA real da las mismas decisiones que los mocks | activar plan de recorte (§8) |
| 23 | Demo completo | los 3 actos funcionan en la URL pública | congelar features; solo arreglos |
| 27 | Freeze | nada nuevo entra | — |

Entre syncs: **check de 5 min cada ~4h** — qué terminé, qué sigue, qué me bloquea.

---

## 7. Forma de trabajo con git

- Ramas: `tony/<tema>` y `ale/<tema>`; PRs pequeños hacia `main`.
- El otro revisa en < 15 min; si no puede, se mergea y se revisa después (no bloquear).
- `lib/contracts/` y `pipeline.ts`: **siempre** con revisión del otro.
- `main` siempre desplegable.
- Una sola API key de LLM compartida, con presupuesto, en variables de entorno (nunca en el repo).

---

## 8. Plan de recorte (si vamos atrasados en SYNC 2)

| Orden | Recorte | Quién |
|:-:|---|---|
| 1 | Quitar acto extra (Lucía) | Ale |
| 2 | Quitar Puerta B; el frente AML se muestra solo dentro del acto 2 | Tony |
| 3 | Fusionar Auditor dentro del Detective | Tony |
| 4 | Coordinador como función determinista | Ale |
| 5 | Timeline estático en vez de en vivo | Ale |

**Nunca se recorta:** pausa, Memoria (acto 3), expediente con evidencia citada ni el contador de IA. Son el diferencial.

---

## 9. Riesgos de la división

| Riesgo | Mitigación |
|---|---|
| Los contratos cambian a mitad de camino | carpeta `contracts/` con revisión obligatoria del otro |
| Uno espera al otro | mocks desde la hora 7–9 |
| El LLM falla o se vuelve lento en vivo | modo mock + video de respaldo |
| Costo de API | presupuesto por caso en el runtime + Memoria |
| Integración tardía | SYNC 1 a la hora 9 sin IA |
