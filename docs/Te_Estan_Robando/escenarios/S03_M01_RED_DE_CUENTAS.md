# S03 · La cuenta que recibe de muchos

> **Ficha de escenario v1 · CU-02, CU-03** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Varios jugadores transfieren hacia cuenta sintética M-01. La cuenta recibe y reenvía parte de movimientos; Detective construye expediente con E-07, E-08 y E-09 de cálculos deterministas. Después una decisión de cuenta se reutiliza.

## 2. Qué hipótesis prueba
CU-02, CU-03. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Fraude sintético. **Importe sintético:** S/variable: eventos individuales. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Desde el barrio varios ciudadanos crean pagos de prueba; observar grafo en monitor y prueba posterior hacia el mismo destino.

## 5. Señales del motor (con procedencia obligatoria)
fan_in_48h derivado de ledger; reenvio_rapido_2h derivado; status Memoria SUSPECTED/CONFIRMED; evidence_ids E-XX. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Puerta AML → Detector/Detective → Auditor y caso → revisión humana de prueba si se confirma; siguiente pago a cuenta ya CONFIRMED → Memoria → Policy P1 → HELD sin IA.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
n remitentes, eventos utilizados, exactitud de consultas, TTL, tiempo hasta expediente, 0 IA en reuso.

## 9. No falsear
No contar intentos HELD como fondos recibidos por M-01; para hacer fan-in real en ledger, incluir transacciones ejecutadas específicas.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
