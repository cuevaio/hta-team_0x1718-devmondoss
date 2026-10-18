# 24 · Glosario y decisiones de arquitectura (ADR)

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Glosario
- **AML:** prevención de lavado de activos y evaluación de transacciones/cuentas sospechosas.
- **Cuenta mula:** cuenta utilizada para recibir o mover fondos relacionados con fraude; en nuestra demo es una **etiqueta sintética**.
- **Guardián:** agente de verificación de contexto con cliente ficticio; no autoriza transferencias.
- **Detective:** agente investigador de patrón de cuenta receptora; evidencia obtenida de tools deterministas.
- **Auditor:** validador de respaldo de afirmaciones y consistencia de expediente.
- **Coordinador:** selecciona acciones / agentes según un caso; no reemplaza reglas de retención.
- **Policy Engine:** componente determinista que transforma evidencias en decisiones permitidas.
- **Memoria:** registro de cuentas/decisiones previas, con estatus, procedencia y vigencia.
- **Ledger sintético:** estados y asientos de transferencias ficticias.
- **TTPA:** tiempo servidor entre admisión de intento y acción protectora persistida.
- **Fan-in:** número de remitentes distintos que convergen hacia una cuenta por ventana temporal.
- **Reenvío rápido:** fracción de fondos recibidos que se transfiere después en ventana corta, calculada sobre datos visibles.
- **Ground truth:** etiqueta del escenario definida ANTES de ejecutar el motor y oculta para él.
- **Baseline:** variante de control simulada con aviso genérico; NO reproducción completa de sistemas bancarios peruanos.
- **Falso positivo:** pago legítimo clasificado/retendido indebidamente; **falso negativo:** fraude sintético permitido.
- **TTL:** tiempo de vigencia de una clasificación provisional o veredicto.

## ADR-001 — La protección se compromete antes de invocar LLM
**Decisión:** reglas y control transaccional síncronos; investigar asíncrono sobre hold persistido. **Razón:** no depender de latencia/caída IA. **Coste:** retención injustificada; requiere expiración y revisión.

## ADR-002 — El juego nunca conoce el resultado por anticipado
**Decisión:** `scenario_truth` en servicio privado de evaluación. **Razón:** evitar fuga / trampa. **Coste:** infraestructura de métricas separada.

## ADR-003 — Historial persistido como fuente de verdad
**Decisión:** PostgreSQL y ledger; Realtime notifica. **Razón:** verificación y reconexión. **Coste:** outbox, secuencias y control de acceso.

## ADR-004 — El LLM no libera saldo
**Decisión:** Guardián/Detective retornan estructuras evaluables; Policy determina. **Razón:** auditabilidad. **Coste:** políticas completas y versionadas.

## ADR-005 — Confirmación durable de mula supervisada
**Decisión:** respetar MD base con validación humana para `CONFIRMED`. **Alternativa:** `SUSPECTED` temporal con límites, sin llamarla confirmación. **Disparador para revisar:** cambio intencionado y probado del modelo de gobernanza.

## ADR-006 — Pixel art como arnés de pruebas
**Decisión:** escenas cortas + estaciones accionables, no física multiplayer compleja. **Razón:** maximizar evidencia por minuto. **Coste:** menor sofisticación lúdica inicial.

## ADR-007 — Repetición verificable, no vídeo amañado
**Decisión:** `run_id`, semilla, fixture y eventos reales; replay etiquetado cuando sea grabación. **Razón:** confianza del jurado.

## Registro de decisiones futuras
Cada ADR nuevo: problema, opciones, decisión, tradeoffs, propietario, fecha y link al PR/test.
