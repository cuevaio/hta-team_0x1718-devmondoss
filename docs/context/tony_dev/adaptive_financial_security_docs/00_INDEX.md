# Adaptive Financial Security — Research Pack

> **Última actualización: 2026-10-17.** Se incorpora la dirección final: **Track 04** como problema principal + adaptación del reto **B1 (investigación de alertas AML)** dentro de un **sistema multiagente**.

## Contexto del hackathon

- **Track 04 — Seguridad:** extorsión, estafas, suplantación y desinformación. → **track principal**.
- **Reto B1 — Investigación de alertas AML:** información dispersa y trabajo manual para investigar alertas; propone un agente que reconstruya el caso y recomiende descartar / escalar con justificación trazable.
- **Decisión:** competir en Track 04 y absorber B1 como el **frente del analista** dentro de la misma solución.
- **Pendiente:** confirmar en las reglas del hackathon que esta combinación es válida para la inscripción.

## North Star

**Problema central:** gran parte de la seguridad financiera digital sigue siendo reactiva y asume que el titular legítimo puede ver, entender y responder a una alerta a tiempo. Esa suposición falla en viajes, zonas sin conectividad, pérdida del dispositivo, discapacidad, baja alfabetización digital, dispositivos compartidos, hospitalización, trabajo sin acceso al teléfono, coerción o ingeniería social.

**Tesis:** la protección financiera debería seguir funcionando cuando el usuario no está disponible —o no está en condiciones— para defender activamente su cuenta.

**Tesis ampliada — la cadena del dinero:** el dinero de una estafa siempre termina en una cuenta receptora (mula) que luego lo mueve (layering). Es **la misma transacción vista desde dos extremos**: fraude contra el cliente (Track 04) y alerta AML (B1). Hoy esos equipos trabajan separados y lo que aprende uno no protege al otro.

> No estamos diseñando “seguridad para personas vulnerables”. Estamos investigando **seguridad resiliente a la disponibilidad humana**.

## La solución en una frase

> **Si alguien intenta estafarte, pausamos el pago, investigamos la cuenta que iba a recibir tu dinero y, si es una mula, la próxima víctima ya está protegida.**

**Pausa → Pregunta → Investiga → Aprende**, implementado como sistema multiagente:

```text
Reglas (sin IA) → 🧭 Coordinador → 🛡️ Guardián ∥ 🔍 Detective → Policy Engine determinista
      → 📋 Auditor (expediente) → Analista valida → 🧠 Memoria de riesgo
```

Diseño completo en [19_MULTIAGENT_SYSTEM.md](19_MULTIAGENT_SYSTEM.md).

---

## Lectura rápida (15 min)

`00` → `01` → `19` → `13` → Work Blueprint → `17`

## Índice de documentos

1. [01_CORE_THESIS.md](01_CORE_THESIS.md) — tesis central, cadena del dinero, dos gaps y principios.
2. [02_LATAM_AND_ANDEAN_CONTEXT.md](02_LATAM_AND_ANDEAN_CONTEXT.md) — por qué el problema es especialmente relevante en Latinoamérica y el contexto andino (incluye cuentas mula y AML).
3. [03_PROBLEM_MAP.md](03_PROBLEM_MAP.md) — mapa causal: Availability Gap + Investigation Gap.
4. [04_USER_STATES.md](04_USER_STATES.md) — segmentación por capacidad de respuesta + estados de la cuenta destino.
5. [05_STAKEHOLDERS.md](05_STAKEHOLDERS.md) — afectados, compradores, operadores (incluye analista AML), reguladores y tensiones.
6. [06_CURRENT_SYSTEM.md](06_CURRENT_SYSTEM.md) — arquitectura actual de fraude y de AML, y dónde se inserta nuestra capa.
7. [07_FAILURE_MODES.md](07_FAILURE_MODES.md) — fallas estructurales y qué componente responde a cada una.
8. [08_JTBD_AND_HYPOTHESES.md](08_JTBD_AND_HYPOTHESES.md) — Jobs To Be Done e hipótesis falsables.
9. [09_SOLUTION_SPACE.md](09_SOLUTION_SPACE.md) — espacio de solución y qué opciones entran al MVP.
10. [10_AGENTIC_SYSTEM_HYPOTHESIS.md](10_AGENTIC_SYSTEM_HYPOTHESIS.md) — por qué multiagente, roles finales y guardrails.
11. [11_LEAN_CANVAS.md](11_LEAN_CANVAS.md) — Lean Canvas v1.
12. [12_VALIDATION_RESEARCH.md](12_VALIDATION_RESEARCH.md) — entrevistas, validación posible en el hackathon y kill criteria.
13. [13_MVP_30H.md](13_MVP_30H.md) — MVP multiagente en 30 horas, plan por horas y demo en 3 actos.
14. [14_METRICS_AND_EXPERIMENTS.md](14_METRICS_AND_EXPERIMENTS.md) — métricas de protección, fricción, AML y eficiencia de IA.
15. [15_RISKS_ETHICS_PRIVACY.md](15_RISKS_ETHICS_PRIVACY.md) — riesgos de discriminación, privacidad, autonomía, alucinación y etiquetado de mulas.
16. [16_ECOSYSTEM_ALIGNMENT.md](16_ECOSYSTEM_ALIGNMENT.md) — alineación con ecosistemas y con Track 04 / B1.
17. [17_PITCH_NARRATIVE.md](17_PITCH_NARRATIVE.md) — narrativa de pitch: Rosa, la mula y la segunda víctima.
18. [18_SOURCES.md](18_SOURCES.md) — fuentes, datasets y cifras verificables.
19. [19_MULTIAGENT_SYSTEM.md](19_MULTIAGENT_SYSTEM.md) — **diseño del sistema multiagente**: agentes, tools, contratos, policy engine, memoria y optimización de recursos.
20. [Work Blueprint](../../../work/00_WORK_BLUEPRINT.md) *(en `docs/work/`)* — **división de trabajo Ale_dev / Tony_dev**: dueños, contratos, plan por horas, syncs y plan de recorte.

---

## Convenciones

- **HECHO**: respaldado por fuente pública.
- **HIPÓTESIS**: requiere validación con usuarios, equipos antifraude/AML o datos reales.
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

Y para cada agente: **¿qué pain point resuelve que una regla o un solo agente no resolverían igual de bien y más barato?**
