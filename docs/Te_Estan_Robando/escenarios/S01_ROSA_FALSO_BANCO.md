# S01 · La llamada de las seis

> **Ficha de escenario v1 · CU-01** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
La bodega de Rosa está llena. Recibe una llamada de un falso asesor del banco y le sugieren una transferencia a cuenta de resguardo. El jugador tiene 45 segundos de presión ficticia, pero el tiempo del actor no decide la autorización del banco.

## 2. Qué hipótesis prueba
CU-01. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Fraude sintético. **Importe sintético:** S/4800. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
Bodega, cliente que paga, teléfono, terminal de pagos; decidir responder, ignorar, colgar, hacer transferencia o buscar ayuda.

## 5. Señales del motor (con procedencia obligatoria)
beneficiario_nuevo=true (+2), monto_atipico=true (+2), llamada_activa=simulada (+3), auth_valid=true. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Reglas L0 → consulta Memoria → HOLD duradero → Guardián y Detective → Policy; si no hay intento transaccional, no contar protección bancaria.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
t_admisión→t_hold; transferencia ejecutada sí/no; resultado del Guardián; fricción y encuesta.

## 9. No falsear
Una llamada es señal exclusivamente dramatizada/simulada; browser convencional no obtiene por sí mismo llamadas telefónicas nativas.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
