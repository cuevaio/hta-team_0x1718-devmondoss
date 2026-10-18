# 13 · API propuesta, contratos y eventos canónicos

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

> Los endpoints originales se **mencionan** en los MD del equipo, pero no se ha auditado el repositorio ni su implementación. Esta propuesta añade un adaptador y rutas de juego que deben acoplarse a los contratos reales.

## Endpoints observados en documentos base
`POST /api/transfers` (transferencia); `/api/alerts` (alertas); `/guardian/reply` (respuesta a Guardián); `/verdict` (veredicto); `GET /api/stats` (estadísticas). `GET /api/cases` se marcaba **pendiente**. Deben verificarse método, auth, payload y semántica con código.

## Nuevas rutas de juego propuestas
| Método | Ruta | Uso | Permiso |
|---|---|---|---|
| POST | `/api/game/rooms` | crear sala | presentador |
| POST | `/api/game/rooms/{id}/join` | alias + rol asignado | público con token de sala |
| GET | `/api/game/scenarios` | catálogo sin verdad oculta | jugador |
| POST | `/api/game/runs` | iniciar escenario, versión y semilla | servidor/presentador |
| POST | `/api/game/actions` | crear acción contextual o transferencia sintética | jugador autenticado en sala |
| GET | `/api/game/runs/{id}` | estado actual y decisiones públicas | autorizado |
| GET | `/api/game/rooms/{id}/events?after_seq=N` | resync por eventos ordenados | monitor/autorizado |
| POST | `/api/game/surveys` | encuesta anónima voluntaria | jugador |
| POST | `/api/game/rooms/{id}/reset` | iniciar **nuevo** run, no borrar historial | presentador |

## Ejemplo: request de acción
```json
{
 "room_id":"r_001",
 "scenario_run_id":"run_013",
 "action_type":"transfer.requested",
 "target_ref":"beneficiary_M01",
 "amount_pen":4800,
 "idempotency_key":"run013_step2_once"
}
```
**El cliente NO envía** `risk_score`, `ground_truth`, `status`, `is_mule`, `policy_result` ni balances. Si recibe esos campos, ignorar y registrar intento de contaminación.

## Respuesta de admisión
```json
{"action_id":"a_112","transfer_id":"tx_255","status":"PENDING","accepted_at":"2026-10-17T20:00:00-05:00","status_url":"/api/game/runs/run_013"}
```
Aceptar la acción **no equivale** a que la transferencia se autorizó; se esperan eventos confirmados del ledger.

## Evento de monitor
```json
{"event_id":"evt_017","room_id":"r_001","run_id":"run_013","transaction_id":"tx_255","seq":17,"type":"transfer.held","occurred_at":"2026-10-17T20:00:00-05:00","payload":{"amount_pen":4800,"state":"HELD","rule_id":"P4","synthetic":true}}
```

## Tipos de eventos mínimos
`room.started`, `action.accepted`, `transfer.created`, `transfer.held`, `guardian.prompted`, `guardian.answered`, `detective.started`, `evidence.created`, `policy.decided`, `transfer.released`, `transfer.rejected`, `case.escalated`, `memory.updated`, `agent.failed`, `run.finished`.

## Privacidad de payload
No enviar PII, prompt íntegro, secretos, seed privada, datos internos sin sanitizar ni `ground_truth` a canales públicos. Los IDs de evidencia públicos deben ser ficticios y accesibles sólo en su sala. Versionar contratos.

## Resync, conflictos y errores
401/403 por rol; 409 `ACTION_ALREADY_APPLIED` con estado canónico; 422 por variante no permitida; 429 por exceso; 503 sin motor. El monitor reconsulta DB por `after_seq` y reconcilia gaps sin extrapolar. Toda ruta mutante revalida identidad y sala en servidor.
