# S10 · Lo que el banco no sabe

> **Ficha de escenario v1 · Integridad de señales** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Escenario escenifica una llamada, pero el adaptador no recibe la señal desde una fuente bancaria. El motor debe declarar ausencia, no inventarla.

## 2. Qué hipótesis prueba
Integridad de señales. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Fraude sintético. **Importe sintético:** S/4800. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Repetir el caso Rosa con y sin señal `scenario_only`; comparar política y cobertura sin maquillar resultado.

## 5. Señales del motor (con procedencia obligatoria)
llamada_activa=NOT_AVAILABLE vs llamada_activa=simulated; otras señales constantes. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Dos resultados observados, no asumir misma decisión; determinar si reglas restantes protegen el caso.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
cobertura señales, delta de scoring, FP/FN con y sin señal.

## 9. No falsear
No afirmar acceso directo a llamadas del teléfono.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
