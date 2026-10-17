# 14 — Metrics & Experiments

## North Star candidate

### Time To Protective Action (TTPA)

Tiempo entre la primera señal de riesgo relevante y una acción que efectivamente limita la pérdida.

```text
TTPA = t(protective_action) - t(first_material_risk_signal)
```

No confundir con notification latency.

## Fraud metrics

- fraud loss rate;
- prevented loss;
- scam conversion rate;
- account takeover loss;
- mule payout rate.

## Friction metrics

- false positive rate;
- challenge abandonment;
- legitimate payment delay;
- support contacts;
- lockout rate.

## Accessibility metrics

- completion by available channel;
- fallback success;
- % cases requiring third-party help;
- task completion time;
- WCAG/assistive-tech compatibility.

## Operational metrics

- analyst minutes per case;
- cases auto-evidenced;
- escalation rate;
- mean time to resolution;
- evidence completeness.

## Product metric equation

Una forma conceptual:

```text
Net Protection Value =
Fraud Loss Prevented
- False Positive Cost
- Customer Friction Cost
- Operational Cost
```

## Experiments

### E1 — Hold vs alert-only
Simular 1,000 risk events y comparar pérdida potencial bajo reacción tardía.

### E2 — Adaptive challenge
Medir completion frente a fixed challenge en 3 user states.

### E3 — Scam interruption
Comparar baseline warning genérico vs warning contextual.

### E4 — Evidence timeline
Medir minutos necesarios para investigar caso con y sin timeline agregada.
