# S05 · Sin señal durante 72 horas

> **Ficha de escenario v1 · CU-04** · Datos 100% sintéticos · Diseñado, NO necesariamente implementado · Cutoff: 17/10/2026.

## 1. Objetivo narrativo
Lucía viaja y pierde conectividad. Un tercero intenta operación desde dispositivo desconocido; en paralelo existe pago recurrente legítimo del hotel. Nadie responde desde teléfono.

## 2. Qué hipótesis prueba
CU-04. Resultados verificados mediante la transacción/eventos y no por la animación. Una historia emocionante NO es medida de eficacia.

## 3. Verdad reservada del evaluador
**Etiqueta:** Mixto: un fraude y un pago legítimo. **Importe sintético:** S/3500 + pago recurrente. La etiqueta vive únicamente en `scenario_truth`; no se entrega a agentes ni a Policy.

## 4. Escena UX y decisiones permitidas
En mapa de hotel aparece icono sin señal; el usuario no puede enviar respuesta y observa estados al reconectar, sin sesión siempre online.

## 5. Señales del motor (con procedencia obligatoria)
dispositivo_nuevo=true, beneficiario_nuevo=true, titular_sin_respuesta; hotel_recurrente=true. El servidor decide cuáles datos envía al motor; el frontend no proporciona score, resultado ni verdad sintética.

## 6. Flujo esperado para el test, no final garantizado
Operación anómala HELD por P7 según políticas; pago recurrente permitido por P2 si datos soportan. El silencio no autoriza nada.

## 7. Qué debe observar el monitor
El `run_id`, `transaction_id`, cronología de eventos, las herramientas invocadas, la regla Policy exacta, las evidencias E-XX reales si aparecen, estado de ledger y error si existe. El público ve solo campos sanitizados.

## 8. Métricas y éxito
2 resultados separados, capacidad de no bloquear rutina, ttl y fallback del hold.

## 9. No falsear
Caso hipotético. Confirmación por canal alternativo no debe suponer conectividad, mantener límite honesto.

## 10. Reproducibilidad / aceptación
- Fixture versionado, semilla y cuentas sintéticas aisladas por sala.
- Un evento `run.started`, acciones realizadas, al menos un evento canónico de decisión o fallo.
- Nunca afirmar `HELD` antes de ver estado persistido.
- Export del run con datos observados y versión del motor.
- Marcar PASS sólo si aserciones del escenario se cumplen; si no, registrar FAIL real.

## 11. Documentos relacionados
[Catálogo de casos](../docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md) · [Motor y Policy](../docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md) · [Telemetría](../docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md) · [Pruebas QA](../docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
