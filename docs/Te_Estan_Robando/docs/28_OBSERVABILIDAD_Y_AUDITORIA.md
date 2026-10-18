# 28 · Observabilidad, auditoría y visualización del pipeline

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Objetivo del monitor
Traducir evidencia de ingeniería a historia visual sin fabricar ninguna transición. El monitor separa actividad del motor, ledger, investigación, analítica y fiabilidad.

## Distribución propuesta
Panel izquierdo: feed últimos casos (`alias`, escenario, monto sintético, estado y hora). Centro: DAG temporal de reglas → hold → Coordinador → Guardián/Detective → Policy → Auditor, con nodos que se encienden **sólo** ante eventos. Derecha: KPIs por run y contadores de IA. Inferior: expediente seleccionado, evidencia E-XX, historial de Memoria, links a logs.

## Campos para inspección
`run_id`, `transfer_id`, `scenario_id`, `policy_version`, `model_version`, `rule_id`, `risk_features` con procedencia, `state_before/after`, `agent_call_count`, `held_committed_at`, `executed_at`, `evidence_ids`, `memory_status`, `errors`, `synthetic`.

## Trazas técnicas
- `trace_id` atraviesa Game API, ledger, reglas, agentes y outbox.
- `span` por operación: `admit`, `risk_score`, `hold_commit`, `investigate`, `policy`, `ledger_commit`, `publish_event`.
- Medir latencia de DB, API, IA, Realtime. Separar `model_response_time` y `time_to_hold`.
- Mantener `agent_output_raw` en logs internos redactados cuando sea preciso para depuración; la UI pública sólo muestra afirmaciones validadas.

## Evidencia clicable
Cada etiqueta E-XX abre: consulta utilizada, ventana temporal, IDs sintéticos de transacciones, resultado computado, hora, algoritmo/versionado y advertencias. Nada de cifras calculadas por LLM si pueden obtenerse de SQL/tools deterministas.

## Alertas de observabilidad
Anomalías: más de N fallos por minuto; un hold seguido por ejecución sin release; gap en secuencia; agent timeout; caída de monitor; fuga de ground truth. N se define según capacidad real del sistema, no hardcodear un SLA ficticio.

## Export
`/api/game/runs/:id/report` (propuesto) devuelve resumen JSON y CSV agregado. Los artefactos muestran qué pruebas hicieron realmente los usuarios y cuándo.
