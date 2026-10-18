# 29 · Futuro de integración bancaria y límites de cobertura

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Alcance de la demo
No hay dinero bancario ni autorización de una entidad. Toda transferencia es una operación sintética entre cuentas del propio sandbox. La retención se ejecuta en el ledger ficticio.

## Arquitectura de integración hipotética
Para bloquear una transferencia real, una institución debe insertar un control de autorización antes del movimiento irrevocable, con señales y permisos apropiados. La arquitectura sería: solicitud de pago → validación de identidad y permisos del banco → evaluación de riesgo → retención/autorización provisional → investigaciones y revisiones → aplicación de decisión por el core. Requiere SLA, reconciliación, acuerdos de seguridad, regulación aplicable y gobernanza bancaria.

## Lo que una integración necesita
- Contrato de decisión síncrona y estados de autorización.
- Señales legítimas disponibles: patrones históricos de cliente, beneficiario, dispositivos bajo autorización, reglas del banco.
- Canales alternativos verificables, si existen.
- Protección de privacidad y datos financieros.
- Capacidad para liberar pagos legítimos, procedimiento de revisión y disputas.
- Evaluación de falsos positivos por segmentos y pruebas operativas de latencia.
- Trazabilidad, retención de logs y segregación de funciones AML/fraude.

## Qué no puede prometerse
- Conocer llamadas telefónicas nativas desde una web sin integraciones.
- Anular transferencias ejecutadas irrevocablemente por mostrar un alerta.
- Vigilar cuentas en otras instituciones sin fuente legítima compartida.
- Declarar actividad criminal sólo por fan-in.
- Garantizar cero pérdidas o cero bloqueo a legítimos.
- Acreditar reducción regulatoria/sanciones sin evaluación formal.

## Narrativa comercial
Buyer = banco/procesador con control del punto preejecución; usuarios operacionales = fraude, prevención, AML. Propuesta de valor a validar: disminuir tiempo de respuesta y duplicación investigativa manteniendo fricción controlada. Separar ahorro **estimado** vs medido, y uso del hackathon vs interés de compra.

## Roadmap posthack
Validación con especialistas → piloto offline de datos anonimizados/históricos → sandbox controlado con socio → pruebas de seguridad y privacidad → integración bancaria limitada con revisión y controles; ninguna fase está asegurada.
