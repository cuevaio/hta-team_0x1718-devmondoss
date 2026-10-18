# 20 · Matriz de QA, aceptación y regresión

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Pirámide
Unidad: reglas, Policy y consultas de fan-in/reenvío; integración: API → ledger → outbox → event stream; E2E: acciones del personaje → cambios persistidos → inspector del monitor; simulación adversarial: tests de escenarios etiquetados con verdad oculta.

## Casos obligatorios
| ID | Acción | Condición de éxito demostrable | Tipo |
|---|---|---|---|
| T01 | Crear S01 con riesgo alto | `HELD` persistido antes del primer request LLM | E2E P0 |
| T02 | Rosa responde «No» bajo destino de alto riesgo | `HELD` continúa, sin `RELEASED` del Guardián | integración P0 |
| T03 | Guardián no responde | retención no se transforma en liberación | caos P0 |
| T04 | Confirmar M-01 en flujo de prueba autorizado | memoria vigente con evidencia/versionado | integración P0 |
| T05 | Segundo pago a M-01 confirmada | consulta Memoria → P1, 0 agent_calls | E2E P0 |
| T06 | S04 Don Pepe legítimo | sin señal suficiente, Policy permite; si falla se contabiliza FP | E2E P0 |
| T07 | S06 monto chico fraudulento | registrar resultado observado, incluso si permitió | límite P1 |
| T08 | Presionar transferir dos veces | exactamente un débito posible | concurrencia P0 |
| T09 | Dos jugadores en salas separadas | ningún dato o memoria de sala A en B | auth P0 |
| T10 | Reconectar monitor con secuencia intermedia | reconstruye estado sin doble conteo | integración P1 |
| T11 | Inyectar `ground_truth=true` en payload | campo ignorado y no altera scoring | seguridad P0 |
| T12 | Expirar cuenta confirmada | deja de tratarse como confirmación permanente | regresión P1 |
| T13 | Legítimo a cuenta de alto volumen | fan-in solo no equivale a mula | regresión P0 |
| T14 | Abrir presentación sin login | app, slides, repo y descripción se muestran | entrega P0 |
| T15 | Errores de APIs / 503 | el juego y monitor anuncian error en vez de inventar resultado | caos P0 |

## Aserciones automatizables
```text
∀ tx: state=HELD ⇒ executed_at IS NULL
∀ release: actor=PolicyEngine; authorized_by valid rule_id/version
∀ tx: count(ledger debit on execute) <= 1
∀ confirmed_memory: evidence_ids NOT EMPTY and validated_by IS NOT NULL and valid_until > now
∀ agent_claim: referenced evidence exists AND supports claim
∀ run: server decision independent from scenario ground_truth label
```
La aserción `confirmed_memory` admite seeds sintéticos preparados si `validated_by=fixture` y esa condición se revela al jurado. No usarla para afirmar revisión humana ocurrida en la partida.

## Prueba con personas
Realizar al menos 2–3 sesiones piloto fuera del equipo, observar dónde se confunden, anotar tarea/completitud y preguntas sin dar pistas. Etiquetar piloto como tal y no mezclar con la sesión final. Si el participante requiere explicación del facilitador, marcarla.

## Calidad del pitch
Modo jurado reproducible: desde URL nueva y navegador incógnito iniciar S01, ver hold, abrir expediente, ejecutar M-01 o caso legítimo; duración objetivo ≤ 90 s. Si no hay internet o falla modelo: estado de degradación honesto y datos previos verificables, no vídeo pretendido como tiempo real.

## Hoja de test por ejecución
`test_id, commit_sha, env, date, test_run_id, scenario_version, expected, observed, pass_fail, evidence_url, note`. No marcar PASS sin log o captura de resultado.
