# 10 — Agentic System Hypothesis

## Cuándo un agente SÍ tiene sentido

Un sistema agentic aporta cuando debe:

- consultar varias fuentes;
- elegir qué evidencia falta;
- decidir qué herramienta invocar;
- adaptar un flujo;
- coordinar verificaciones;
- explicar por qué escaló;
- mantener política del usuario durante indisponibilidad.

## Cuándo NO tiene sentido

- scoring determinista simple;
- regla de monto;
- cálculo de velocity;
- MFA;
- detección de device fingerprint;
- decisiones irreversibles sin policy guardrails.

Eso debe seguir en componentes deterministas/modelos especializados.

## Arquitectura híbrida

```text
TRANSACTION
    ↓
Deterministic Risk Engine
    ↓
Context Orchestrator
    ├─ Identity evidence
    ├─ Device evidence
    ├─ Behavioral evidence
    ├─ Accessibility preference
    ├─ User safety policy
    └─ Beneficiary / scam signals
             ↓
        Policy Engine
       /      |      \
    ALLOW    HOLD   CHALLENGE
                      ↓
               Human / user
```

## Roles hipotéticos

### Context Agent
Reúne evidencia de fuentes autorizadas.

### Availability Agent
Estima si un challenge es viable, sin inferir atributos sensibles innecesariamente.

### Verification Planner
Escoge secuencia mínima de verificación.

### Scam Context Agent
Busca patrones de coerción/social engineering.

### Explanation Agent
Produce resumen auditable para usuario/operador.

## Guardrails obligatorios

- el LLM no mueve dinero;
- herramientas con permisos mínimos;
- policy engine final determinista;
- logs completos;
- no inferir discapacidad como señal de fraude;
- preferencias de accesibilidad explícitas y voluntarias;
- timeout/circuit breaker;
- human-in-the-loop para casos extremos.
