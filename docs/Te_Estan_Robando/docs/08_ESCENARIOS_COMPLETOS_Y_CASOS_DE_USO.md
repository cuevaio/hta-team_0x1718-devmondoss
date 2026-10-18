# 08 · Catálogo de escenarios y fichas jugables

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Ficha estándar de escenario
Cada ficha guarda: `scenario_id`, versión, origen (oficial / hipótesis), `seed`, contexto narrativo, operaciones legítimas, operaciones etiquetadas como fraude, señales disponibles (con procedencia), decisiones del jugador, tratamiento, salida esperada **para test** y resultado observado real. El ground truth queda server-only.

### S01 · La llamada de las seis — Rosa — CU-01
- Contexto: bodega en hora pico; Rosa recibe llamada del falso «equipo de seguridad» de Banco Andino ficticio.
- Monto: S/4,800 sintéticos a beneficiario M-01 nuevo. Autenticación correcta es condición del caso, no señal de inocencia.
- Acciones: atender, ignorar, colgar, intentar transferir, consultar canal seguro ficticio. Distracciones: pedido y cliente de la bodega.
- Señales admisibles: cuenta nueva +2, monto atípico +2, llamada activa +3 **solo si motor dispone de señal simulada que el escenario inyecta de forma identificable**. Puntajes proceden de los MD del equipo, sujetos a cotejo con código.
- Flujo esperado: reglas → `HELD` → Guardián y Detective (si corresponde) → Policy P4 o P5 → expediente. Si Rosa resiste y no transfiere, no se cuenta como fraude «detenido por motor».
- Métricas: decisiones humanas, retenciones, secuencia, TTPA, fricción y percepción.

### S02 · El token no basta — Jorge — CU-01
- Inspiración verificable: Indecopi, Puno, S/10,000, 14/07/2026 (no recreación literal).
- Jorge intenta movimiento atípico autenticado; beneficiario nuevo y monto fuera de patrón. Sin inventar que el banco observa una llamada.
- Esperado: sistema decide basándose en señales de riesgo independientes de autenticación y muestra razón verificable.
- Métrica: de operaciones fraudulentas etiquetadas, cuántas retuvo aun autenticadas correctamente.

### S03 · M-01, la misma cuenta — CU-02 y CU-03
- 4 o más participantes generan pagos hacia cuenta sintética M-01 desde universos aislados por sala (o misma sala de ensayo); fan-in y reenvío calculados a partir de movimientos en DB.
- Detector: evidencia E-07 fan-in N remitentes nuevos/48 h; E-08 reenvío M%/2 h; E-09 cadena M-01 → M-02 → M-03. **N y M calculados, jamás inventados por LLM**.
- Fase A: investigación y creación de expediente. Fase B: confirmación del analista de prueba (o seed previamente confirmada), Memoria actualizada. Fase C: nuevo intento hacia M-01 → P1 → `HELD` sin IA.
- Distinguir «evidencia extraída» de «cuenta confirmada». Si nuevos flujos usan estado provisional, mostrarlo y no llamar P1 de confirmación.
- Métricas: tiempo de expediente, cobertura de citas, reuso y llamadas IA evitadas.

### S04 · Don Pepe, el comerciante inocente — CU-05
- Comercio con muchos pagadores, sin patrón de reenvío rápido. Primer pedido grande de Rosa es legítimo. Puede generar score medio; Detective analiza y Policy P8 permite si no hay otros riesgos.
- Si se bloquea, registrar falso positivo real del sistema simulado; no convertir en «final narrativo dramático».
- Métricas: false positive rate y demora del pago legítimo.

### S05 · Lucía, 72 h sin señal — CU-04 opcional
- Lucía viaja, dispositivo nuevo intenta agregar beneficiario y transferir, titular sin conectividad. Pago recurrente al hotel desde patrón conocido sigue pasando.
- Dos operaciones diferentes: ataque `HELD`, pago legítimo `RELEASED` según política. No asumir canal alternativo efectivamente disponible.
- Métricas: no-respuesta, retención inicial, efectos sobre pago habitual.

### S06 · El pequeño intento que pasó — test de límite
- Simulación de S/300 a beneficiario nuevo sin otras señales. Los MD indican score 2 y «pasa» con reglas de nivel 0. Etiqueta reservada fraudulenta.
- Esperado en test de regresión del comportamiento actual: puede terminar permitido; es **falso negativo**, no prueba de invulnerabilidad.
- A futuro, si se descubre cuenta problemática, medir qué protege Memoria de eventos posteriores, sin reescribir este error.

### S07 · Intento duplicado — resiliencia, no fraude
- Jugador presiona dos veces «Transferir» o pierde conectividad y reintenta. Mismo `idempotency_key` debe crear una sola operación; no duplicar saldo ni KPI.

### S08 · Guardián no responde — resiliencia
- El modelo excede timeout. Si existía retención, ésta continúa conforme a política; evento `agent.failed`, nunca `RELEASED` implícito.

### S09 · Dos operaciones simultáneas hacia M-01 — concurrencia
- Ejecutar 2 transferencias concurrentes mientras se actualiza Memoria; serialización idempotente y versión de política registradas; ninguna evade revisión confirmada por carrera.

### S10 · Señal inexistente — integridad
- Un escenario requiere llamada activa, pero el adaptador carece de esa señal. Debe documentarse `source=simulated`, `not_available` o eliminarse del score; nunca suponer acceso al sistema operativo.

## Matriz de soporte
| IDs | Función demostrada | Prioridad |
|---|---|---|
| S01 | manipulación / retención | P0 |
| S03 | investigación + memoria | P0 |
| S04 | falsos positivos | P0 |
| S02 | operaciones autenticadas atípicas | P1 |
| S06–S08 | límites e invariantes | P1 |
| S05, S09–S10 | extensión / estrés | P2 |

## Casos reales vs ficticios
Las escenas están **inspiradas** en fenómenos y algunos expedientes verificados; Rosa/Don Pepe/Lucía, M-01, los importes (excepto coincidencias expresas) y los hechos de partida son inventados. Ver [02](02_PROBLEMA_EVIDENCIA_Y_CASOS_PERU.md) y los originales.
