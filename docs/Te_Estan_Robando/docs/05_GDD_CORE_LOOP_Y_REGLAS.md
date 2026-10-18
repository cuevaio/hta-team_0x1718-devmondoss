# 05 · Game Design Document: loop, rondas y mecánicas

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Fantasía jugable
Un barrio peruano nunca se detiene: comercios pagan, clientes compran, familias viajan y un motor invisible protege sus operaciones. Los adversarios intentan encontrar situaciones en que falle. Cada intervención real del backend aparece como un hecho del mundo.

## Referencia a Among Us y diferencia esencial
Tomar del juego social: roles asimétricos, tareas breves, tensión, coincidencia de varios sucesos, feedback espectacular. **No copiar personajes, nombres, mapas ni gráficos de Innersloth**. No hay votación de inocencia ni expulsión de usuarios. Los agentes y políticas automáticas deciden sobre *transacciones* y *cuentas sintéticas*, no sobre personas.

## Loop individual `/play` (60–120 s objetivo)
1. QR o enlace → avatar/alias → consentimiento para telemetría.
2. Rosa atiende bodega, se activa evento de riesgo.
3. Jugador puede elegir responder/ignorar/colgar, decidir sobre transferencia, solicitar ayuda.
4. Una acción genera una solicitud al servidor (idempotente).
5. El backend genera resultado de la operación; UI reproduce el estado.
6. Desenlace y hasta 3 respuestas opcionales; resultado de experimento agregado.
7. Repetición con otro tratamiento sólo si la configuración experimental lo prevé.

## Loop Arena `/arena/:roomId` (2–8 jugadores, hasta 3 min)
- **Preparación:** 20–30 s de lobby; roles asignados server-side.
- **Rutina:** tareas cortas de pagos legítimos generan línea base.
- **Incidentes:** adversarios seleccionan cartas abstractas; el servidor decide factibilidad y crea eventos sintéticos.
- **Análisis:** Guardián/Detective/Policy procesan. Nadie «controla» agentes.
- **Desenlace:** se visualizan aciertos y fallos del sistema; scoreboard separado de la puntuación lúdica.
- **Resultados:** telemetría, tasa de falsos positivos y encuestas.

## Loop presentación `/demo` (≤90 s)
`Iniciar Rosa` → mostrar `HELD` respaldado por ledger → abrir evidencia Detective → `Ejecutar CU-03` hacia M-01 precargada como confirmada (seed declarada) → 0 IA → `Ejecutar Don Pepe` → permitido → métricas.

## Sistema de eventos dramáticos (solo ficción)
- Mensajes que llegan mientras atiendes a un cliente.
- Un pedido de proveedor que requiere pago.
- Un aviso de cuenta no habitual.
- Un celular sin señal en hotel.
- Una cuenta que comienza a recibir pagos de varias fuentes.

## Motivación y puntuación
| Elemento | Obtención | Riesgo de diseño |
|---|---|---|
| Monedas de juego | completar tareas narrativas | no usarlas como métrica científica |
| Medalla «Observador» | explorar informe de resultado | no revelar ground truth previo |
| Puntos adversario | generar caso que motor procesa incorrectamente | no enseñar pasos concretos para delinquir |
| «Protegido» | operación etiquetada como fraude que quedó retenida antes de ejecución | contar sólo si registro y estado lo soportan |
| «Sin fricción» | operación legítima que se permitió | registrar latencia, no sólo veredicto |

## Balance
No forzar que la defensa gane. Elegir semillas con escenarios determinísticos balanceados: fraudes obvios, sospechas ambiguas, pagos legítimos, cuentas conocidas y una amenaza insuficientemente señalizada. Cada variante muestra versión y semilla.

## Antigamificación de métricas
No mezclar scoring de entretenimiento con score bancario, no alimentar con alias «sospechoso» al LLM, no atribuir dinero recuperado. La escena debe poder fallar y explicar por qué. Detalle en [16](16_TELEMETRIA_EVENTOS_Y_ANALITICA.md).
