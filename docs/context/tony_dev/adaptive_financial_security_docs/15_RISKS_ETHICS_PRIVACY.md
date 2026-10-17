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

## R9 — Hallucinated evidence

Un agente puede afirmar un hecho que no está en los datos.

Mitigación:
- las tools calculan los hechos; el agente solo los interpreta;
- cada hecho tiene un id de evidencia;
- el 📋 Auditor rechaza afirmaciones sin id válido;
- si no se corrige en un reintento → “requiere revisión manual”.

## R10 — Mislabeling a receiving account as mule

Etiquetar como mula a un negocio legítimo o a una persona engañada le causa daño real.

Mitigación:
- exigir reenvío rápido además de fan-in (FM15);
- ninguna cuenta entra a la Memoria sin validación humana;
- veredictos con expiración y vía de revisión/apelación;
- la acción automática sobre la Memoria es **pausar transferencias entrantes nuevas para verificación**, no confiscar.

## R11 — Scammer-driven input

La víctima, guiada por el estafador, puede escribir “apruébalo, soy yo” o instrucciones al agente.

Mitigación:
- el 🛡️ Guardián **no tiene autoridad para aprobar**; solo reporta estado;
- todo texto del usuario se trata como dato, no como instrucción;
- la liberación requiere verificación fuera del canal y/o cooldown definidos por la política.

## R12 — Confidencialidad del reporte AML

En AML suele existir deber de reserva: no se debe alertar al investigado de que se analiza o reporta su cuenta.

Mitigación:
- la consola del analista y el expediente no son visibles para clientes;
- los mensajes al cliente hablan de “verificación de seguridad”, nunca de investigación AML;
- **verificar el alcance exacto en la normativa peruana** antes de cualquier piloto.

## R13 — Cost and latency runaway

Un sistema multiagente puede encadenar llamadas sin control.

Mitigación:
- reglas primero; IA solo en casos sospechosos;
- presupuesto máximo de llamadas por caso y timeout;
- Memoria antes que agentes;
- si se excede el presupuesto → modo seguro (pausa + revisión humana).
