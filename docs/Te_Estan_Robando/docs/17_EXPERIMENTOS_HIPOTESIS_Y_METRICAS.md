# 17 · Diseño experimental, hipótesis y métricas

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Objetivo
Tres preguntas independientes: **¿funciona técnicamente? ¿se entiende/acepta? ¿existe interés de compra?** No inferir una de otra.

## Hipótesis de los documentos base
| Código original | Hipótesis operacionalizada | Prueba |
|---|---|---|
| H1 | Un hold ocurre antes de que salga dinero sintético en operaciones de alto riesgo | `held_committed_at <= any agent_call.started_at`; `executed_at` nulo mientras HELD |
| H3 | Autenticación correcta no elimina riesgo | CU-01 con `auth_valid=true`; comparar etiqueta de verdad y decisión de política |
| H5 | Personas aceptarían protección con fricción limitada | Encuesta de aceptación declarada; reportar `n` y contexto |
| H8 | Se aprovecha evidencia previa de una cuenta | Antes/después de un veredicto válido de M-01 en memoria |
| H10 | Algunos escenarios no requieren LLM | N.º de agent_calls por operación y proporción de cero llamadas |
| E3 | Intervención contextual vs advertencia genérica | A/B con escenarios equivalentes y controles de orden |

## Qué significa cada métrica
- **TTPA** (Time To Protective Action): `held_committed_at - accepted_at`, medido con reloj del servidor; no usar el tiempo desde que el jugador ve una animación. Solo tiene sentido para transacciones que requieren retención. Reportar p50/p95 y `n`.
- **TPR / sensibilidad simulada:** TP / (TP + FN), donde TP es operación de fraude **etiquetada previamente** y retenida antes de ejecución; FN es fraude etiquetado que salió. Indeterminado si no hay negativos suficientes.
- **FPR:** FP / (FP + TN), donde FP es pago legítimo retenido indebidamente y TN legítimo permitido. Si retención legítima requerida por política, aclarar definición.
- **Precisión:** TP/(TP+FP), condicionada por prevalencia artificial de escenarios; NO extrapolar a producción.
- **Tasa de completitud:** personas que terminan / personas que inician; por rol y variante.
- **Confianza/aceptación:** % respuestas «sí» / respuestas válidas; añadir denominador y no respuesta. No representa adopción en bancos.
- **Cobertura de evidencia:** N afirmaciones de expediente con `evidence_id` existente / N afirmaciones verificables auditadas. Auditar si las citas apoyan de verdad la afirmación, no solo si hay ID.
- **Latencia de expediente:** `case.ready_at - investigation.started_at`.
- **Coste IA:** tokens y coste estimado según proveedor/costo vigente, conservando versión de modelo.
- **Fricción:** demora adicional en pagos legítimos, tasa de retenciones, pasos para recuperar acceso y cuestionario.

## Experimento A/B razonable
`baseline` es una implementación controlada de aviso genérico, **no la seguridad de un banco real**. `defense` ejecuta el motor propuesto. Aleatorizar orden entre jugadores o usar grupos independientes comparables; conservar mismo tipo de escenario y seed predefinido por variante. No reutilizar Memoria entrenada por defensa dentro de la baseline. Anotar aprendizaje, selección voluntaria, abandono y fatiga.

## Encuesta de 3 preguntas (tal como propone el MD base)
1. Al finalizar A: «¿Cuánta frustración sentiste?» (5 opciones ordinales).
2. Al finalizar B: «¿Cuánto te molestó la pausa?» (No / Un poco / Mucho).
3. Al finalizar: «¿Activarías esta protección en tu banco, aun si a veces retrasa un pago?» (Sí / No / No sé).
Si las personas juegan únicamente un brazo, adaptar cuestionario manteniendo preguntas y anotar variante.

## Análisis y resultados
Presentar `n_personas`, `n_operaciones`, clasificación por escenarios, tasa, intervalos simples cuando proceda y lista de fallos. Una muestra de evento tecnológico es de conveniencia: indicar sesgo de selección y observación, sin extrapolar a población peruana. Evitar comparar grupo técnico con población general.

## Matriz de resultados por rellenar con datos reales
| Hipótesis | Medida | Resultado | n | Evidencia (run/event) | Estado |
|---|---|---|---|---|---|
| H1 | p95 TTPA en holds | POR MEDIR | — | — | sin ejecutar |
| H3 | TP con autenticación correcta | POR MEDIR | — | — | sin ejecutar |
| E3 | Diferencia de caída por brazo | POR MEDIR | — | — | sin ejecutar |
| H5 | Sí / respuestas válidas | POR MEDIR | — | — | sin ejecutar |
| H8 | Reusos de memoria | POR MEDIR | — | — | sin ejecutar |
| H10 | % sin IA | POR MEDIR | — | — | sin ejecutar |
