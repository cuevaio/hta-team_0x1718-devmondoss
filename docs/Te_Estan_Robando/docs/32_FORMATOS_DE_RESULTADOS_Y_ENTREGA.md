# 32 · Plantillas finales de evidencia, resultados y entrega

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Informe técnico por corrida
```markdown
### Run: [ID] | escenario: [ID/versión] | commit: [SHA]
Fecha/hora: [servidor] | entorno: [sandbox/deploy]
Verdad sintética (evaluador): [fraude/legítimo/mixto]
Señales accesibles al motor: [lista + procedencia]
Operaciones: [N] | retenidas: [N] | permitidas: [N] | rechazadas: [N]
TTPA: [ms] | Agent calls: [N] | Policy: [rule id]
Evidencia: [event_id + evidence_id] | Error si aplica: [detalle]
Limitaciones: [datos faltantes, sesgo, timeout, lag]
Resultado observado: [PASS/FAIL, descripción]
```

## Reporte para jurado
1. **Problema real** (cita oficial, alcance exacto).
2. **Qué construimos realmente** (sin confundir plan/implantado).
3. **Qué ocurrió en el sandbox** (resultados medidos por runs).
4. **Qué dijeron usuarios** (n, preguntas, sesgos).
5. **Qué no funciona** (falsos negativos, latencia, nuevas señales).
6. **Próximos pasos con entidad** (hipótesis comercial).

## Markdown de entrega (BORRADOR, completar datos)
```markdown
# Te están robando — El barrio no duerme
Una capa de protección preejecución que evalúa transferencias sintéticas,
retiene las riesgosas por reglas y utiliza agentes para verificar e investigar,
con decisiones deterministas y evidencias auditables.

## Problema
Las alertas no siempre llegan a tiempo y autenticación correcta no implica
que el usuario actúe libre de manipulación.

## A quién ayuda
Titulares de banca digital y equipos de fraude/AML de entidades financieras.

## Demo
Una experiencia 2D pixel art reproduce escenarios de riesgo en un ledger
ficticio y expone en vivo las decisiones del motor.

## Lo implementado
[DESCRIBIR SOLO LO DEMOSTRADO EN REPO/DESPLIEGUE]

## Evidencia
[N operaciones sintéticas], [N personas], [resultados y errores verificables].

## Limitaciones
No integrado a banco, datos sintéticos, señales acotadas, sin eficacia
validada en producción, Memoria confirmada con intervención humana según
arquitectura base.
```

## Registro de resultados comparados
| Campo | Baseline simulada | Protección propuesta | Evidencia |
|---|---|---|---|
| n transferencias | — | — | — |
| Fraudes sintéticos retenidos | — | — | — |
| Pagos legítimos permitidos | — | — | — |
| Tiempo p95 de retención | — | — | — |
| Llamadas IA por operación | — | — | — |

El guion y documento anteriores contienen marcadores. **No son resultados obtenidos**.
