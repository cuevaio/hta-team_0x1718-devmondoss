# 34 · Handoff para desarrolladores y orden de integración

> No se ha inspeccionado ni certificado ningún repositorio. Las rutas mencionadas en MD base deben verificarse en el código vigente.

## Primeras verificaciones
1. Obtener SHA del repositorio actual, URL de API, staging y contratos reales de `/api/transfers`, `/api/alerts`, `/guardian/reply`, `/verdict`, `/api/stats`.
2. Determinar si `GET /api/cases` existe. Verificar cómo se persisten estado de transferencias y evidencia; no inferir funcionamiento por nombres de funciones.
3. Confirmar que `lib/rules/level0.ts` y scores descritos por el MD coinciden con código. Si difieren, versionar specs y registrar discrepancia.
4. Verificar qué integra hoy Guardián/Detective/Auditor con Policy y qué estados realmente produce; ¿cómo se declara CONFIRMED una cuenta?
5. Revisar deploy, secretos y entorno.

## Contratos entre equipos
**Frontend:** emite `action_type`, selección permitida e idempotency key; escucha eventos canónicos. No modifica score, ledger ni ground truth.
**Game Orchestrator:** traduce escena a inputs sintéticos y valida rol/sala/seed. Mantiene cartas finitas.
**Motor:** toma decisiones financieras, produce evidencia con IDs reales, estados y timestamps.
**DB:** consistencia transaccional, historia y aislamiento multiroom.
**Analítica:** consulta ground truth restringido de escenarios para scorecard, no para motor.
**Equipo de pitch:** usa evidencia desplegada y un guion cronometrado.

## Definición mínima de API estable
- Transferencia: acepta una operación sintética y devuelve identificador, nunca un éxito anticipado.
- Consulta: permite obtener estado canónico y evidencias públicas.
- Eventos: `event_id`, `seq`, `run_id`, `transaction_id`, `occurred_at`, `type`.
- Consulta de estadísticas: contadores por run y tratamiento con denominadores.
- Acción de demo: requiere permiso; puede iniciar nuevo run, no sobrescribir el anterior.

## Matriz de responsabilidades por componente
| Componente | Prueba de entrega | Documento |
|---|---|---|
| Banco simulado | doble débito imposible, HELD antes IA | 12, 20 |
| API | respuesta + contratos y errores | 13 |
| Data | migración, RLS y semillas | 14, 18 |
| Realtime | resync por secuencia | 15 |
| Métricas | scorecard con denominadores | 16, 17 |
| Frontend | escena responsiva y estado honesto | 06, 07, 25, 26 |
| Contenido | narrativa sin guiones peligrosos | 08, 09, escenarios |
| Presentación | URL pública y experimento auditado | 22, 30, 32 |

## Prohibiciones de integración
No introducir endpoint de «marcar protegido» desde UI. No usar localStorage como única fuente financiera. No aceptar ground truth en request de scoring. No crear seeds que contengan números ficticios iguales a resultado de evaluación sin recalcular. No copiar secretos ni datos reales al repositorio.
