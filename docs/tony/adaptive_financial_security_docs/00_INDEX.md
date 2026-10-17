# Adaptive Financial Security — Research Pack

## North Star

**Problema central:** gran parte de la seguridad financiera digital sigue siendo reactiva y asume que el titular legítimo puede ver, entender y responder a una alerta a tiempo. Esa suposición falla en viajes, zonas sin conectividad, pérdida del dispositivo, discapacidad, baja alfabetización digital, dispositivos compartidos, hospitalización, trabajo sin acceso al teléfono, coerción o ingeniería social.

**Tesis:** la protección financiera debería seguir funcionando cuando el usuario no está disponible para defender activamente su cuenta.

> No estamos diseñando “seguridad para personas vulnerables”. Estamos investigando **seguridad resiliente a la disponibilidad humana**.

---

## Índice de documentos

1. [01_CORE_THESIS.md](01_CORE_THESIS.md) — tesis central, definición del problema y principios.
2. [02_LATAM_AND_ANDEAN_CONTEXT.md](02_LATAM_AND_ANDEAN_CONTEXT.md) — por qué el problema es especialmente relevante en Latinoamérica y el contexto andino.
3. [03_PROBLEM_MAP.md](03_PROBLEM_MAP.md) — mapa causal completo del problema.
4. [04_USER_STATES.md](04_USER_STATES.md) — segmentación por capacidad de respuesta, no por demografía.
5. [05_STAKEHOLDERS.md](05_STAKEHOLDERS.md) — afectados, compradores, operadores, reguladores y tensiones.
6. [06_CURRENT_SYSTEM.md](06_CURRENT_SYSTEM.md) — cómo funciona hoy la arquitectura de seguridad financiera.
7. [07_FAILURE_MODES.md](07_FAILURE_MODES.md) — fallas estructurales del modelo reactivo.
8. [08_JTBD_AND_HYPOTHESES.md](08_JTBD_AND_HYPOTHESES.md) — Jobs To Be Done e hipótesis falsables.
9. [09_SOLUTION_SPACE.md](09_SOLUTION_SPACE.md) — espacio de solución sin casarnos con una implementación.
10. [10_AGENTIC_SYSTEM_HYPOTHESIS.md](10_AGENTIC_SYSTEM_HYPOTHESIS.md) — dónde un sistema agentic sí podría aportar y dónde no.
11. [11_LEAN_CANVAS.md](11_LEAN_CANVAS.md) — Lean Canvas v0 basado en hipótesis.
12. [12_VALIDATION_RESEARCH.md](12_VALIDATION_RESEARCH.md) — plan de entrevistas, experimentos y criterios para matar la idea.
13. [13_MVP_30H.md](13_MVP_30H.md) — alcance de un prototipo demostrable en 30 horas.
14. [14_METRICS_AND_EXPERIMENTS.md](14_METRICS_AND_EXPERIMENTS.md) — métricas de producto, fraude, fricción y seguridad.
15. [15_RISKS_ETHICS_PRIVACY.md](15_RISKS_ETHICS_PRIVACY.md) — riesgos de discriminación, privacidad, autonomía y seguridad.
16. [16_ECOSYSTEM_ALIGNMENT.md](16_ECOSYSTEM_ALIGNMENT.md) — cómo se alinea con prioridades de producto, infraestructura, inclusión y ciberseguridad sin depender de una organización concreta.
17. [17_PITCH_NARRATIVE.md](17_PITCH_NARRATIVE.md) — narrativa de pitch centrada en problema, no en tecnología.
18. [18_SOURCES.md](18_SOURCES.md) — fuentes y cifras verificables.

---

## Convenciones

- **HECHO**: respaldado por fuente pública.
- **HIPÓTESIS**: requiere validación con usuarios, equipos antifraude o datos reales.
- **RIESGO**: supuesto que puede romper el producto.
- **NO CONCLUIR**: afirmación tentadora pero no suficientemente sustentada.

## Regla de trabajo

No construir una feature hasta poder responder:

1. ¿Quién sufre el problema?
2. ¿Con qué frecuencia ocurre?
3. ¿Cuánto cuesta no resolverlo?
4. ¿Cómo se resuelve hoy?
5. ¿Por qué falla el mecanismo actual?
6. ¿Qué evidencia demostraría que nuestra intervención mejora el resultado?
