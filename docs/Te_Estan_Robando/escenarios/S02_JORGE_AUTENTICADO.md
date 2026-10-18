# S02 · Autenticación correcta ≠ operación segura

> **Ficha de escenario v1 · CU-01** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Jorge se encuentra en su vivienda. Una operación atípica de S/10,000 se intenta desde una sesión correctamente autenticada. El jugador observa que FaceID/token no demuestran voluntad libre ni coincidencia con patrones.

## 2. Qué hipótesis prueba
CU-01. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Fraude sintético. **Importe sintético:** S/10000. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Abrir app ficticia, aprobar operación con autenticación sintética, observar comprobación contextual y expediente.

## 5. Señales del motor (con procedencia obligatoria)
beneficiario_nuevo=true, monto_atipico=true, auth_valid=true, llamada_activa=ausente. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Evaluar anomalía sin depender de llamada; si señales no alcanzan umbral, documentar fallo; no forzar protección.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
TPR sobre transferencias autenticadas y tiempo de hold.

## 9. No falsear
Inspirado en caso Puno Indecopi 14/07/2026; NO reconstrucción exacta de la resolución ni datos reales de Jorge.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
