# S09 · Dos transferencias y una memoria cambiante

> **Ficha de escenario v1 · Resiliencia** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Dos jugadores inician operaciones hacia M-01 casi simultáneamente mientras se actualiza estado CONFIRMED. La decisión debe ser coherente con la versión de estado usada y una última validación antes de ejecutar.

## 2. Qué hipótesis prueba
Resiliencia. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Mixto. **Importe sintético:** S/2 × 200. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Disparar en dos clientes; inspeccionar versionado y secuencias; reporte de orden en monitor.

## 5. Señales del motor (con procedencia obligatoria)
memory_version, policy_version, accepted_at, decision_committed_at. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Ninguna operación puede eludir política vigente sólo por un stale cache no verificado; registrar semántica exacta de concurrencia.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
incidentes de race, n releases, n holds por versión.

## 9. No falsear
Caso para test de integración; no hace falta dramatizar para demo.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
