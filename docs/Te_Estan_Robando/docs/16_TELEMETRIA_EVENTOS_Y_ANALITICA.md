# 16 · Telemetría y analítica de partidas

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Propósito
Convertir **acciones que ocurren realmente** en evidencias reproducibles. La UI no crea resultados, las consultas leen registros canónicos. `ground_truth` sintético solamente en el servicio evaluador; no disponible a agentes ni a jugadores.

## Unidad de análisis
- `room_id`: sala aislada, no equivale a persona.
- `run_id`: ejecución concreta de una versión de escenario y `seed`.
- `participant_id`: ID efímero sin correo ni teléfono.
- `transfer_id`: operación única identificada por idempotencia.
- `case_id`: expediente; un caso puede contener varias transferencias.
- `agent_call_id`: llamada única de modelo; puede haber varias por transferencia.
Una persona puede generar múltiples intentos; nunca usar `transfers_count` como tamaño de muestra de personas.

## Esquema de evento mínimo
```json
{"event_id":"evt-001","schema_version":1,"room_id":"room-a","run_id":"run-a1","seq":1,"occurred_at":"2026-10-17T21:00:00-05:00","source":"ledger","type":"transfer.held","subject_id":"tx-a1","synthetic":true,"payload":{"state":"HELD","amount_pen":4800,"reason_id":"L0_HIGH_RISK"}}
```
Campos obligatorios: ID global, secuencia por sala, marca temporal de servidor, emisor, versión, tipo, run y correlación. Nunca incluir secretos, DNI, teléfono, audio ni detalles innecesarios.

## Eventos recomendados
| Categoría | Evento | Momento canónico |
|---|---|---|
| Sesión | `room.started`, `participant.joined`, `run.started`, `run.finished` | Persistidos por orquestador |
| Jugabilidad | `player.decision`, `attack.card_played`, `scenario.step_completed` | Action API valida y registra |
| Dinero | `transfer.requested`, `transfer.accepted`, `transfer.held`, `transfer.released`, `transfer.rejected`, `transfer.failed` | Ledger/transaction manager |
| Seguridad | `risk.scored`, `guardian.prompted`, `guardian.answered`, `detective.started`, `evidence.created`, `policy.decided`, `auditor.completed` | Pipeline |
| Memoria | `memory.suspected`, `memory.confirmed`, `memory.expired`, `memory.dismissed`, `memory.hit` | Servicio correspondiente |
| Experimento | `survey.presented`, `survey.submitted`, `participant.opted_out` | Cliente + API |
| Resiliencia | `agent.timed_out`, `realtime.reconnected`, `case.manual_review_needed` | Worker / monitor |

## Reglas para contar
1. Contar por `transfer_id` y estado final, nunca por número de eventos.
2. No sumar «soles protegidos» como si cada intento fuese una pérdida evitada real. Etiqueta recomendable: **«importe sintético de transferencias riesgosas retenidas»**.
3. Una retención de pago legítimo no es éxito; registrar fricción y eventual liberación.
4. Si un fraude sintético nunca llegó a intentar transferir, no incorporarlo al denominador de detección transaccional.
5. No mezclar runs de baseline y defensa en el mismo denominador sin etiquetar tratamiento.
6. Los fallos por servidor deben reportarse como fallos de prueba, no como detección exitosa.

## Integridad y calidad
Claves idempotentes, `seq` monótono dentro de sala, marcas de tiempo del servidor, origen de señales (`bank_synthetic`, `scenario_only`, `derived`), versión de política y versión de escenario. Resolver duplicados y ordenar por secuencia. Proveer descarga CSV de datos **agregados y anónimos**, no conversaciones brutas.

## Dashboard del jurado
Vista A: transferencias y estados en tiempo real. Vista B: expediente con evidencia clicable. Vista C: resultados acumulados por escenario/tipo de verdad. Vista D: fallos y limitaciones. Todos los números con etiqueta «SIMULADO / N = ...» y fecha de ejecución. Fuente de verdad PostgreSQL, Realtime solamente transporte.
