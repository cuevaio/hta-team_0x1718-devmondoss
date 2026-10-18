# S04 · El comerciante inocente

> **Ficha de escenario v1 · CU-05** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Don Pepe recibe numerosos pagos por su comercio, pero no presenta reenvío inmediato irregular. El jugador hace un primer pago mayorista. La IA debe diferenciar negocio de posible mula.

## 2. Qué hipótesis prueba
CU-05. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Legítimo sintético. **Importe sintético:** S/2600. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Elegir bodega, pagar mercadería, observar factura sintética y resultado, sin penalización narrativa si el motor se equivoca.

## 5. Señales del motor (con procedencia obligatoria)
fan_in_alto=true, reenvio_rapido=false, actividad_comercial_consistente=true. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Detective consulta datos, Policy P8 permite según señales; no es obligatorio activar Guardián. Si hay hold, contabilizar falso positivo.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
FPR, latencia de autorización, coste IA y molestia percibida.

## 9. No falsear
Que reciba muchos pagos no es evidencia suficiente de lavado o fraude.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
