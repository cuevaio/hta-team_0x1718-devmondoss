# 19 · Amenazas, límites técnicos y mitigaciones

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Fronteras de confianza
Jugador/Phaser (no fiable) → API de juego (autenticación/autorización) → Orquestador (señales controladas) → motor financiero (decisión) → DB/ledger (fuente de verdad) → outbox/Realtime (visualización, no mandato). `ground_truth` permanece aislado de componentes de decisión.

## Riesgos concretos
| Amenaza | Impacto | Mitigación y evidencia de prueba |
|---|---|---|
| Cliente envía `decision=RELEASED` | Fraude de demo / bypass | Ignorar campos prohibidos, Policy firma resultado en servidor, test de 422 |
| Doble clic / retry | Doble egreso de balance | clave idempotente única y ledger transaccional |
| Transferencia concurrente + cambio en Memoria | Carrera de autorización | orden/versión canónica + comprobación final en commit |
| Agente no responde o alucina | Retención incorrecta o recomendación inventada | timeout, hold persistente, evidencia tipada y fallback de revisión |
| Prompt injection en alias/nota | Manipular investigación | datos no confiables, delimitación, tools de solo lectura, validar salidas |
| Event stream se corta | monitor incorrecto | snapshot + `after_seq`, estado «reconectando», no deducir éxito |
| `ground_truth` filtrado a agentes | Falsa precisión | namespace y permisos aislados; test canario de no filtración |
| Falsos positivos masivos | Clientes legítimos perjudicados | separación de riesgo, expiración del hold, revisión y métricas |
| Etiquetar comercio inocente como mula | Daño injusto | sospecha provisional ≠ confirmación, TTL y corrección |
| Exponer endpoint demo público | abuso/costos | cuota, cooldown, anti-bot, límite de modelos y sesiones |
| Riesgo sólo observable en interfaz | demo falsa | comprobar ledger y timestamps persistidos |
| Dependencia exclusiva de laptop del equipo | imposibilidad de exhibir | despliegue accesible desde navegador del evento |

## Caso particular: llamada activa
No presuponer telemetría nativa de llamadas del celular disponible a una web. Si el caso requiere esa señal, marcarla `scenario_only` y mostrar que es un input ficticio. Se puede comparar variante sin esa señal para demostrar robustez ante datos faltantes.

## Caso particular: cuenta externa
Sin conexión a bancos o consorcios no se obtiene historial completo de otras entidades. `fan_in` y `reenvio_rapido` sólo se calculan sobre universo de movimientos sintéticos visible a este banco/sandbox. No afirmar que detecta toda red bancaria ni pagos interbancarios reales.

## Pérdida / indisponibilidad de saldo
Una «pausa» prolongada puede causar daño si impide pagos necesarios. Definir SLA de atención, vencimiento, rutas alternativas y revisión de bloqueos. No automatizar liberación por silencio ni imponer bloqueo indefinido. No hay política de producción definida en los documentos base.

## Privacidad y ética
Ver [18](18_PRIVACIDAD_SEGURIDAD_Y_ETICA.md). Ver [12](12_ESTADOS_LEDGER_Y_CONSISTENCIA.md) para invariantes.
