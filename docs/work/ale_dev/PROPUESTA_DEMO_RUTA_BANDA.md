# Propuesta: Ruta Banda rápida + Ataque en vivo para la demo final

> Autora: Ale (rama `ale-dev`) · Fecha: dom 18 oct 2026, ~05:00 (hora Lima)
> Estado: **PROPUESTA para análisis del equipo.** No cambia código. Basada en una revisión del repo en `main` (commit `f3095fb`, 04:55) y en la URL pública `https://web-production-be4c9.up.railway.app`.
> Objetivo: que el público escanee un QR, lance un ataque real contra la plataforma en ≤15–20 s y vea cómo lo frenamos, sin eliminar la profundidad de la ruta banda.

> **Cambios tras sincronizar con Tony:** `main` ahora permite agentes con Ollama y automatiza el túnel público del servidor local. La revisión en `f3095fb` confirma que el acceso rápido de banda, `?foco=1` y el rate limiting siguen pendientes; el monitor ya tenía confirmación de mula con error visible y `--persistir` ya configura Memoria persistente para el servidor local.

---

## 1. Contexto y rúbrica (PDF oficial "Cómo se evalúa a los equipos")
    10|
- **Paso 0 (eliminatorio):** URL pública desplegada · demo en vivo (slides o video grabado NO cuentan) · código en GitHub · entrega **dom 18, 09:00**.
- **Técnico 75%:** Complejidad técnica 30% · Funciona (flujo completo en vivo desde la URL pública) 25% · Calidad técnica 20%.
- **Producto 25%:** Problema e impacto 15% · Claridad (qué, por qué, qué quedó fuera) 10%.
- **Bonus tracción:** +0,25 si personas fuera del equipo lo usaron y se ve en registros/datos del producto; +0,5 uso repetido/volumen/lista de espera/pago. Capturas, cuentas del equipo o tráfico automatizado no cuentan.
- **Desempate:** gana más Complejidad técnica; luego Funciona.
- Demo: 3 min (0:00–0:30 problema · 0:30–2:30 demo en vivo · 2:30–3:00 arquitectura), **se corta en el minuto 3**, desde la computadora de la organización.

**Implicancia:** el ataque en vivo debe (a) arrancar rápido, (b) correr sobre la URL pública, (c) mostrar la arquitectura actuando (reglas → pausa → Memoria → agentes → política → evidencia) para sumar Complejidad visible y ganar desempates.

    20|## 2. Diagnóstico del estado actual

| Tema | Hoy | Problema para la demo |
|---|---|---|
| Sala EN VIVO (jam) | Quiz "¿estafa o real?" de 8 rondas, 119 s fijos | **No llama a `/api/transfers`**: el pipeline, los agentes y el monitor no se mueven. Consume todo el bloque de demo |
| Ruta banda (`guion.ts` `rutaBanda`) | Sí llama al pipeline real; muestra señales, RETENIDO, agentes, FRENADO con regla y "0 llamadas de IA" | Del QR al primer golpe: **>90 s** (intro >11 s, título, apodo, país, arcade obligatorio `guion.ts:144`, 5 menús) |
| Enlace directo | Existe `?sala=XXXX` (`salaDelEnlace`), que salta el video pero aún pide toque, apodo y país | No existe `?modo=banda` ni entrada rápida equivalente |
| Monitor | Datos completos, QR y botón **Confirmar mula** para el caso seleccionado, con error visible en el botón | No existe `?foco=1`, vista de proyector ni atajos directos M-01/M-02/M-03 |
| Ataques que pasan | 16–22% en combinaciones al azar (monto chico → P3; S/4,800 a M-02/M-03 → P8) | Falta la narrativa rápida y el atajo de "quemar cuenta" por destino |
| Límite de peticiones | No existe (no hay `middleware.ts`) | Spam posible; no usar límite solo por IP (parte del público puede compartir Wi-Fi) |
    30|| Memoria | El servidor local ya soporta `--persistir` y configura `MEMORIA_ARCHIVO`; la última verificación de Railway dio `/api/health` → `memoria_persistente: false` | Falta configurar y verificar persistencia en Railway; allí un reinicio aún puede borrar mulas |
| `veredicto()` en `components/monitor/monitor.tsx` | El wrapper no tiene `try/catch`, pero los botones que lo invocan sí capturan y muestran el error | **YA CUBIERTO en la UI**; mantener el mensaje visible |

Pruebas locales (no en prod): 50 atacantes simultáneos a ritmo humano → 0 errores, p95 5 ms. En Railway el equipo midió 60 jugadores (p95 739 ms, 0 errores); 100 no está probado.

## 3. Principio de diseño

**No simplificar la ruta banda: comprimirla.** Se mantienen las 5 decisiones del atacante (víctima, táctica, cuenta, monto, horario) y toda la secuencia de protección, pero:
1. se elimina la fricción de entrada,
2. las 5 decisiones viven en una sola pantalla con valores preseleccionados,
    40|3. la animación de protección tiene duración fija y se puede saltar.

Quien tiene prisa ataca en 2 toques; quien quiere explorar (incluido un jurado) arma su propia combinación.

## 4. Diseño propuesto

### 4.1 Entrada directa `/play?modo=banda`
- Rama nueva en `jugar()` de `components/juego2d/guion.ts`, mismo patrón que `salaDelEnlace`.
- Salta: video, pantalla de título, diálogos, elección de país (Perú por defecto) y arcade obligatorio.
- Apodo automático tipo `Banda-XK3` (evita groserías y apodos repetidos), con opción "cambiar" que reutiliza el teclado actual y el filtro de `lib/juego/alias.ts`.
    50|- Pantalla "guarida": *"Tu banda tiene 3 cuentas alquiladas y una víctima en la mira. ¿Cómo atacas?"*
- El audio sigue arrancando tras el primer toque.

### 4.2 Planificador en una pantalla (reemplaza los 5 menús secuenciales de `planear()`)
Arriba, **3 planes de ataque de un toque** que llenan los 5 campos con una combinación coherente (usar los valores existentes en `datos.ts`: `TACTICAS`, `DESTINOS`, `MONTOS`; ajustar si los nombres difieren):

| Plan | Víctima | Táctica | Cuenta | Monto | Horario |
|---|---|---|---|---|---|
| 📞 Falso banco | Rosa | Llamada del "banco" | M-01 | S/4,800 | Madrugada |
| 💬 Falso familiar | Jorge | Chat "hijo en apuros" | M-02 | S/1,500 (o el monto existente más cercano) | Noche |
    60|| 📱 Chip duplicado | Lucía | Sin señal / SIM swap | M-03 | Todo de una | Madrugada |

Debajo, los **5 campos como fichas editables** (un toque abre opciones). Agregar **"OTRO MONTO"** con entrada numérica (1–50,000), validada en cliente; el servidor ya valida con zod.

Botón gigante: **EJECUTAR GOLPE**.

### 4.3 Secuencia del golpe en el celular (~8 s, duración fija)
| t | Qué se ve | Fuente de datos |
|---|---|---|
| 0–1 s | "Enviando S/4,800 a M-01…" + `POST /api/transfers` real | respuesta del pipeline |
    70|| 1–3 s | Señales nivel 0 caen una por una con su puntaje (+3 cuenta nueva, +2 madrugada, +2 llamada activa…) y barra que sube hasta 5 | `nivel0` del caso |
| 3 s | Sello **RETENIDO · antes de cualquier IA** | decisión de pausa |
| 3–6 s | Agentes se encienden en orden (Coordinador → Guardián → Detective → Auditor) con una línea cada uno, p. ej. *"Detective: 14 remitentes nuevos en 48 h"* | `actores` / `evidencia` |
| 6–8 s | Sello final **FRENADO · regla P4** con frase en lenguaje simple + "Sin nosotros: S/4,800 perdidos · Con nosotros: retenidos" (importe sintético) | `decision` |

- Botón **"Saltar"** para quien ya lo vio.
- Al final: **OTRO GOLPE** (mantiene el plan) y **CAMBIAR PLAN**.

### 4.4 Cuando el golpe pasa (honestidad como feature)
- Mostrar: *"PASÓ · P3. Monto chico a una cuenta nueva. Pero dejaste rastro: el analista ya está mirando M-02."*
    80|- Tras la confirmación del operador, el siguiente intento a esa cuenta: **FRENADO P1 · Memoria · 0 llamadas de IA** (~2 s) con *"Esta cuenta ya fue quemada por otro ataque."*
- Pendiente de decisión del equipo: ¿P8 con S/4,800 a M-02/M-03 es intencional? (`lib/policy/engine.ts`, `lib/agents/decisiones/detective.ts`). No cambiarlo después de las 07:30.

### 4.5 Proyector `/monitor?foco=1` (`components/monitor/monitor.tsx` + CSS)
- Contadores grandes: Ataques · Frenados · Pasaron · Resueltos sin IA · S/ retenido (etiqueta "sintético").
- Ticker de los últimos 6 casos: apodo, plan, sello, regla, iniciales de agentes (lee `/api/cases` y `/api/stats`, ya existen).
- Rotación automática que muestra en grande el último caso FRENADO (barra de puntaje, agentes, regla, E-xx).
- QR grande a `/play?modo=banda` cuando no hay actividad.
- **Botones "Confirmar mula M-01 / M-02 / M-03"**: buscan el último caso con esa cuenta destino y hacen `POST /api/cases/[id]/verdict` con el token de operador. Con try/catch y mensaje visible ("falta token" / error).
- Legible a 5 m con zoom 100% en 1366×768, sin scroll.
    90|
### 4.6 Robustez
- **Límite por apodo + global, no solo por IP** (parte del público puede compartir red): p. ej. 1 golpe cada 3 s por apodo (la animación de 8 s ya lo cumple) y ~150 req/s global → 429 con mensaje amable. En `app/api/transfers/route.ts` o `middleware.ts`.
- **Memoria persistente en Railway:** `MEMORIA_ARCHIVO=.datos/memoria.json` sobre el volumen. Aceptación: `/api/health` → `memoria_persistente: true`.
- En producción, si falta `DEMO_TOKEN`, `reset`/`verdict` deben fallar cerrado (503).

## 5. Tiempos objetivo

| Paso | Hoy | Propuesto |
|---|---|---|
   100|| Escanear → pantalla de ataque | >60 s | ~5 s |
| Elegir y ejecutar | 5 menús | ~3 s (plan preseleccionado) |
| Ver protección completa | variable | ~8 s (saltable) |
| **QR → primer golpe visible** | **>90 s** | **~15 s** |
| Golpes por persona en 2 min | 1 | 6–8 |

## 6. Guion de demo (3:00)

**Antes del cronómetro:** monitor `/monitor?foco=1&token=…` abierto en la computadora del organizador; QR en la slide del problema: "Saquen el celular y escaneen".

   110|| Tiempo | Presentador | Operador | Proyector |
|---|---|---|---|
| 0:00–0:30 | Problema: 26,728 denuncias por extorsión en 2025 (Mininter–Minjusdh); solo 19.5% de víctimas denuncia (INEI ENAPRES 2025); >40 mil denuncias por delitos informáticos en 2024 (SIDPOL). Indecopi: autenticar no exime de monitorear | Monitor listo | Slide + QR |
| 0:30–0:40 | "Ustedes son la banda. Tienen 3 cuentas alquiladas. Roben." | Cambia a `?foco=1` | Contadores en 0 |
| 0:40–1:20 | Lee el ticker: "Ana: falso banco a Rosa, S/4,800 → RETENIDO antes de la IA → FRENADO P4" | — | Ticker + agentes |
| 1:20–1:35 | "Este pasó: monto chico a cuenta nueva. No lo escondemos; deja rastro." | — | "PASÓ · P3" |
| 1:35–1:45 | "Un analista revisa y quema la cuenta." | Clic **Confirmar mula M-02** | Mulas en Memoria: 1 |
| 1:45–2:30 | "Desde ahora todos los ataques a esa cuenta mueren al instante, sin gastar IA." | — | Cascada **P1 · 0 IA** |
| 2:30–3:00 | Arquitectura sobre el marcador: reglas → pausa → Memoria → agentes → política fija → Auditor con E-xx. "El LLM razona, no decide sobre el dinero. Modo simulado, datos sintéticos. N personas atacaron, está en `/api/stats`." | — | Marcador final |

   120|## 7. Plan de implementación (antes del freeze 08:00)

| # | Tarea | Archivos | Esfuerzo | Aceptación |
|:-:|---|---|:-:|---|
| 1 | `/play?modo=banda` + guarida + apodo automático | `components/juego2d/guion.ts`, `components/juego/datos.ts` | 30–45 min | QR → guarida ≤5 s en celular real |
| 2 | Planificador en una pantalla con 3 planes + fichas + OTRO MONTO | `components/juego2d/guion.ts` (`planear()`), `components/juego/datos.ts` | 45–60 min | Plan → golpe en ≤3 s; combinación libre funciona |
| 3 | Animación fija ~8 s + Saltar + OTRO GOLPE / CAMBIAR PLAN + mensaje "PASÓ" | `components/juego2d/guion.ts` (`rutaBanda()`) | 30–45 min | QR → FRENADO ≤20 s con datos móviles |
| 4 | Monitor `?foco=1` + atajos Confirmar mula M-01/M-02/M-03 (**PARCIAL: ya existe confirmación del caso seleccionado y error visible**) | `components/monitor/monitor.tsx`, `components/monitor/monitor.module.css` | 60–75 min | Caso visible ≤1.5 s; tras confirmar, siguiente golpe = P1 con 0 IA; atajos legibles y error visible sin token |
| 5 | Límite por apodo + global | `app/api/transfers/route.ts` o `middleware.ts` | 30 min | 50 apodos a ritmo humano: 0 respuestas 429; un apodo a 10 req/s: 429; `npm test` verde |
| 6 | Memoria persistente en Railway (**PARCIAL: `npm run servidor -- --persistir` ya la configura en local**) | Variables y volumen Railway | 10 min | `memoria_persistente: true`; tras redeploy la mula sigue en P1 |
   130|| 7 | Prueba de carga en prod 07:30 | `scripts/carga-salas.ts` o equivalente | 15 min | 100 atacantes 60 s; revisar p95/errores; luego un único reset con token |

**Recortes si falta tiempo (en orden):** OTRO MONTO → rotación automática del monitor → límite global fino. **Nunca recortar:** URL pública, demo en vivo, entrega antes de las 09:00 (enviar 08:30).

## 8. Runbook

- **T-60:** deploy congelado desde 08:00 (anotar commit); `/api/health` OK (`agentes: simulado`, `token_operador: true`, `memoria_persistente: true`); probar 3 celulares (Wi-Fi y datos móviles); un único reset; QR impreso.
- **T-15:** anotar línea base de `/api/stats`; 2–3 celulares del equipo listos por si el público no entra.
- **T-2:** monitor con zoom 125–150%, sonido del juego apagado en el proyector.
- **Después:** rotar `DEMO_TOKEN` en Railway (queda en el historial de la computadora del organizador).
   140|
**Plan B (nunca video como demo principal):** datos móviles si el Wi-Fi satura → celulares del equipo si nadie entra → laptop con `npm run servidor -- --red --juego --persistir` + `cloudflared` si Railway cae (preguntar antes al organizador) → `npm run demo` en vivo como último recurso.

## 9. Preguntas abiertas para el equipo
1. ¿P8 con S/4,800 a M-02/M-03 es intencional?
2. ¿Conservamos el jam como gancho antes del pitch o lo sacamos del flujo?
3. ¿Quién es operador (token) y quién presenta?
4. ¿Supabase o volumen activos en prod para partidas/arcade?
5. ¿Commit exacto desplegado en Railway?

   150|## 10. No verificado
Tiempos reales en celular; rendimiento de canvas/audio en gama baja; capacidad de Railway >60 jugadores; nombres exactos de constantes en `datos.ts` (ajustar la tabla de planes a los valores reales).
