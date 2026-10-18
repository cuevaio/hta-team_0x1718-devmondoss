# Ale_dev — Infraestructura backend

> Fuente de verdad: [../00_WORK_BLUEPRINT.md](../00_WORK_BLUEPRINT.md). **Trabajas solo en `main`, sin pedir permiso.** Avisa solo si cambias un contrato (`CONTRACT:` en el commit).

**Eres dueño de:** `app/api/**` · `lib/contracts/{caso,memoria,validadores,firmas,context}.ts` · `lib/data/` · `lib/analytics/` · `lib/rules/` · `lib/policy/` · `lib/memory/` · `lib/evidence/` · `lib/cases/` · `lib/observability/` · `lib/juego/` · `lib/seguridad/` · `lib/pipeline.ts` · `scripts/demo.ts` · `scripts/servidor.ts` · deploy · README.

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
- [x] ~~Deploy en Vercel~~ → **reemplazado por la laptop como servidor**: Tony decidió no usar serverless ([INFRA_Y_ORQUESTACION](../../context/tony_dev/INFRA_Y_ORQUESTACION.md) §4: en Vercel cada instancia tiene su propia RAM y el acto de Jorge fallaría al azar). Ver «Producción».

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

## H22–26 · Producción (la laptop como servidor)
- [x] Prueba local de producción: `next build` + `next start`, los 6 casos del demo por HTTP con la regla correcta, caminos 400/404, reset
- [x] **`npm run servidor`** (INFRA §5, §7): compila, arranca, reinicia y muestra URLs. Next corre dentro del proceso (sin hijos huérfanos); avisa con claridad si el puerto está ocupado; `caffeinate` en macOS. `--red` · `--tunel` · `--juego` · `--persistir`
- [x] **Token de operador** (INFRA §5): con `DEMO_TOKEN`, `reset`, `verdict` y borrar partidas exigen `x-demo-token` (comparación en tiempo constante). `--red`/`--tunel` lo exigen y lo generan si falta. El frontend lo toma de `/?token=…` y lo quita de la URL
- [x] **Memoria persistente opcional** (INFRA §4, `MEMORIA_ARCHIVO`): escritura atómica, R10 se vuelve a exigir al cargar, un archivo corrupto se aparta en vez de sobrescribirse. Verificado: tras matar el proceso, Jorge sigue en P1 con 0 IA
- [x] `/api/health` muestra `modos` (y si hay token, nunca cuál)
- [x] `next.config.ts`: `outputFileTracingRoot` fijado (un lockfile suelto en `C:\Users\HP` confundía la raíz)
- [x] README (cómo correrlo, qué es simulado, sección sobre sesgos)
- [x] [`docs/work/API.md`](../API.md) con la API para el frontend (§12: modo juego y servidor)
- [ ] ❓ ¿La entrega exige URL pública? Si sí: `npm run servidor -- --red --tunel` + `cloudflared` (decisión del equipo, INFRA §5)

## 🎮 Lo que el juego necesita del backend (DEMO_JUEGO §9)
- [x] `GET /api/cases`: feed en vivo, del más nuevo al más viejo, con los agentes en el orden en que actuaron
- [x] `alias` anónimo por intento en `transfers`/`alerts` (rechaza correo, teléfono y enlaces — §8)
- [x] Movimientos en vivo (`MOVIMIENTOS_EN_VIVO=1`): solo lo **permitido** mueve dinero y alimenta el fan-in; el reset vuelve a la semilla
- [x] `POST/GET/DELETE /api/juego/partidas` + `GET /api/juego/resumen` (tabla de §6). Lo robado lo calcula el sistema; caso inexistente → 400, repetido → 409. Las partidas sobreviven al reset del demo (`PARTIDAS_ARCHIVO` opcional)
- [x] Guardián multiturno y métricas para el marcador: ya existían

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

✅ **Resuelto por Tony** (56cad02): `investigar` lanzaba de forma sincrónica
si al `AgentsApi` le faltaba un método. Ahora el orquestador lo envuelve y
degrada a P10. Mi captura en el pipeline queda como segunda barrera.

---

## Para Tony — auditoría de agentes pre-demo (TOQUÉ tu bloque, a pedido de Ale)

Revisión crítica de lógica antes del demo. Cada arreglo tiene un test que lo
reproducía (`tests/agents/auditoria-logica.test.ts`,
`tests/agents/llm-parametros.test.ts`) y la matriz del atacante
(`tests/scenarios/matriz-atacante.test.ts`, 750 combinaciones) que lo fija. No
cambié ningún contrato.

| Archivo | Error | Arreglo |
|---|---|---|
| `llm.ts` | `thinking: disabled` en todas las llamadas: **Opus 5.5 (Auditor) responde 400 siempre** | solo Haiku lo manda; en Opus/Sonnet 5.5 se omite (adaptativo con `effort: low`) |
| `llm.ts` | `max_tokens` 700 del Auditor: con thinking activo se cortaba y `parsed_output` llegaba `null` | mínimo 4,000 cuando hay thinking |
| `llm.ts` + `runtime.ts` | reintentos multiplicados (SDK 2 × runtime 2): hasta ~150 s colgado | `maxRetries: 0` en el SDK; el runtime no reintenta 400/401/403/404/422 ni un `refusal` |
| `decisiones/guardian.ts` | «no sé», «no recuerdo», «no estoy segura» se leían como **«no»** → `confirmado_seguro` → P8 liberaba | `DUDA` se evalúa antes que la negación → `incierta` |
| `llm-simulado.ts` | igual que arriba, y un «no, solo me llamó el banco…» descartaba la señal | duda → `incierta`; «no» + señal → `incierta` |
| `decisiones/detective.ts` | el LLM podía bajar a `bajo` (→ P8, libera) una cuenta con **reenvío rápido** o estructuración; la regla 2 del prompt no se hacía cumplir | `llmPuedeBajar`: solo `fan_in` (la Bodega) es descartable |
| `decisiones/auditor.ts` | el `resumen` libre podía traer cifras sin respaldo (y el README decía «el modelo nunca produce una cifra») | `cifrasSinRespaldo`: se retira el resumen y va a revisión manual |

Lo más grave estaba en MI bloque (Policy): con el Guardián esperando
respuesta, P8 liberaba el dinero. **Un «falso banco» (score 7) hacia cualquier
cuenta que no fuera M-01 pasaba** con la pregunta en pantalla: 280 de 750
combinaciones. Ahora es P7 hasta que el cliente responda.

**Riesgo residual que no es un bug:** un cliente coaccionado que responde «no»
a todo, hacia una cuenta sin tipologías (p. ej. externa), termina en P8. El
sistema solo puede frenar ahí si el destino muestra algo. Conviene decirlo en
el pitch antes de que lo pregunte el jurado.

---

## Para Tony — hallazgos jugando el videojuego en Chrome real

Un bot (puppeteer-core + Chrome, fuera del repo) jugó las tres partidas
completas sobre `/play?depurar`: víctima honesta (38 s), víctima coaccionada
(92 s) y atacante con plan de 5 intentos (46 s). Sin errores de página ni de
consola. **El juego está sólido**; esto es lo que salió:

| # | Dónde | Hallazgo | Estado |
|---|---|---|---|
| 1 | `lib/juego/partidas.ts` (mío) | tras un reset los ids vuelven a `CASO-0001` y toda partida nueva daba **409**: se perdían los datos del evento | ✅ corregido (id + hora de creación) |
| 2 | `lib/agents/auditor.ts` | un caso PAUSADO por P7 (Guardián esperando) mostraba «Recomendación: descartar» en el monitor | ✅ corregido (`guardianPendiente`) y regla en el prompt |
| 3 | `components/juego2d/guion.ts` ~l.522 y ~l.715 | si `registrarPartida` falla, el juego dice «No pude guardar tu partida» y **a continuación** «ya aparece en el MONITOR». Se contradice | ✅ corregido por Tony (`guardada` en `rutaBanda`) |

Lo que sí funciona, verificado en el juego: la mentira «NO, LO HAGO YO» tres
veces no libera nada (P5, la cuenta destino delata); el pago a Don Pepe pasa
sin molestar (P2); el hueco del monto chico pasa por P3 y el atacante lo
encuentra («Huecos encontrados: 2»); el monitor cuenta las partidas bien.

**Límite que el juego no muestra:** las «cuentas alquiladas» #2 y #3 son
mulas de 6–7 días que el motor ve como `bajo`. Una víctima coaccionada que
responde «no» a un destino así termina en P8 (se libera). Hoy el juego no lo
enseña porque en la ronda B siempre se transfiere a M-01 (la mula conocida).

---

## Para Tony — pendientes que son de tu bloque (no los toqué)

### 1. Cuentas externas: una afirmación sin respaldo con cita válida ✅

> Resuelto por Tony el 18/10 con tu propuesta: `observable` en `ResultadoReenvio`,
> `ResultadoCiclos` y `ResultadoTransfronterizo` (opcional, ausente = observable).
> El Auditor escribe «No se ven las salidas de la cuenta X: es de otra entidad».
> Test: `tests/scenarios/red-regional.test.ts`. Importa para la red regional:
> CO-M-11 (CU-06) es una cuenta externa.

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

### 2. Juego: una mula nueva no se «quema» sola (DEMO_JUEGO §4) ⏳

El mecanismo de movimientos en vivo funciona (fan-in de M-02: 1 → 4 con tres
jugadores), pero la escena «cada robo quema la cuenta» **no ocurre sola**:

- Hay 3 víctimas, así que una mula nueva llega como mucho a 4 remitentes
  nuevos; el umbral de fan-in es 5 (`UMBRALES.fan_in_remitentes_nuevos`).
- Aunque llegara, el Detective exige `fan_in` **y** `reenvio_rapido`, y una
  mula del juego no reenvía en vivo lo que recibe.

Opciones de diseño (decisión tuya, no la invento): más cuentas víctima en el
juego; simular que la mula reenvía al recibir (es lo que hace una mula real);
o montar la escena sobre M-01, que ya funciona hoy (alerta → «Confirmar mula»
→ P1 para todos, sin IA). `tests/data/movimientos-en-vivo.test.ts` fija el
límite actual: si cambia el diseño, ese test avisa.

### 3. Juego: ¿3 preguntas o 4? (DEMO_JUEGO §6)

La tabla dice «máximo 3 por partida» (frustración, pausa, activaría), pero la
fila de **Confianza** (CGAP) pide «1 pregunta por ronda» (¿seguirías usando tu
banca digital?), lo que daría 4 o 5. Implementé las 3 de la tabla. Si la de
confianza entra, es un campo más en `lib/juego/partidas.ts`.

---

## EN VIVO · LA BANDA — hecho el 18/10/2026

El modo multijugador en el que la sala ataca la capa de verdad: cada golpe pasa
por `evaluarTransferencia` y sale en el monitor. Documentado en
`docs/DEMO_JUEGO.md §17` y `docs/work/API.md §13`.

**Mío (nuevo):** `lib/juego/golpes.ts` (catálogo del servidor), el método
`Salas.golpe()`, `components/juego2d/salaBanda.ts` (la pantalla),
`tests/juego/salas-banda.test.ts` y `tests/api/salas-banda.test.ts`.

**Toqué archivos de Tony** (poquito, y avisado):

| Archivo | Qué le hice |
|---|---|
| `lib/juego/salas.ts` | juego `banda`, fase `ataque`, acción `golpe`, puntaje y `VistaSala.banda`. Las salas de cartas no cambian |
| `components/juego2d/sala.ts` | solo tipos: la pantalla de cartas ignora `banda` |
| `components/juego2d/guion.ts` | tercera tarjeta en «¿Qué juegan?» y `salaDeLaBanda()` |
| `components/monitor/monitor.tsx` | el panel de salas proyecta los golpes reales |
| `components/juego/datos.ts` | el catálogo de golpes ahora viene de `lib/juego/golpes.ts` (antes estaba duplicado en el cliente) |

**Dos cosas que dejé decididas y se pueden discutir:**

1. **El reloj de las salas** se envuelve (`() => Date.now()`), para que un test
   que finge el reloj del sistema también mueva el de las salas.
2. **El feed se ordena por `orden`** (un contador por sala), no por `t`: dos
   golpes del mismo milisegundo empataban y el proyector los mostraba en orden
   aleatorio. Es el mismo problema de resolución que el de `partidas.ts`.

### Pendientes de este modo

- Los puntos de una sala de LA BANDA **no entran al ranking del arcade**
  (`/api/juego/arcade` no tiene un modo `banda`); sí quedan los intentos en
  `/api/juego/partidas` como `rol: 'atacante'`. Si quieres que sume al ranking
  general del evento, es un modo más en tu `lib/juego/arcade.ts`.
- Un jugador que cierra el navegador antes del final no registra su partida de
  atacante (los casos sí están en el monitor desde el primer golpe).
- Las salas no se borran al terminar: siguen en RAM hasta las 2 h.
