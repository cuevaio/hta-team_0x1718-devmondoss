# S06 · El pequeño intento que pasó

> **Ficha de escenario v1 · Stress test** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Un adversario activa una operación mínima sintética a cuenta nueva sin otras señales. La regla L0 del documento la deja pasar. El juego no oculta el falso negativo; muestra cómo cambia la evaluación al acumular evidencia posterior.

## 2. Qué hipótesis prueba
Stress test. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Fraude sintético. **Importe sintético:** S/300. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Elegir carta de bajo monto, observar que el sistema no asegura detección perfecta, continuar con una segunda situación independiente.

## 5. Señales del motor (con procedencia obligatoria)
beneficiario_nuevo=true (+2), monto_no_atipico, sin llamada, sin dispositivo nuevo. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Permitir si sigue puntaje bajo; registrar fallo. Una sospecha posterior NO revierte el resultado del pasado.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
FN y tiempo de detección retrospectiva (no tiempo de prevención).

## 9. No falsear
El juego no enseña combinaciones de evasión reales ni instrucciones delictivas.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
