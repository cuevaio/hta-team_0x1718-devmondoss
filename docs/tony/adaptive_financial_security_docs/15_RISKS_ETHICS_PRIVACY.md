# 15 — Risks, Ethics & Privacy

## R1 — Discriminatory risk scoring

Nunca usar edad, discapacidad o condición socioeconómica como atajo para “fraud probability”.

**Principio:** adaptar el canal/protección, no penalizar identidad.

## R2 — Overblocking

Un sistema demasiado protector puede impedir acceso a fondos durante emergencia.

Mitigación:
- holds temporales;
- fallback;
- emergency path;
- human escalation;
- user-configured policies.

## R3 — Sensitive inference

No inferir innecesariamente discapacidad, salud, ubicación precisa o vulnerabilidad.

Preferir:
- capability preference explícita;
- “voice unavailable” antes que “user is deaf”;
- “screen-reader mode” antes que diagnóstico.

## R4 — Agent authority

El agente no debe poseer autoridad irrestricta sobre dinero.

Separar:
- reasoning/orchestration;
- deterministic policy;
- financial execution.

## R5 — Compromised agent context

Prompt injection / malicious content puede intentar alterar decisión.

Mitigación:
- structured tools;
- allowlists;
- read-only evidence;
- policy validation;
- deterministic boundaries.

## R6 — Privacy accumulation

Cuanto más contexto reunimos, mayor impacto de breach.

Mitigación:
- data minimization;
- short retention;
- field-level encryption;
- purpose limitation;
- access logging.

## R7 — Coercion edge case

La víctima puede declarar voluntariamente que sí quiere transferir porque está bajo presión.

No hay solución perfecta. Requiere:
- contextual friction;
- cool-off;
- safe exit;
- human review.

## R8 — Accessibility theater

No afirmar “inclusivo” solo por agregar TTS.

Validar con usuarios y estándares reales.
