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
- lockout rate;
- cuentas legítimas de alto volumen marcadas como mula.

## Accessibility metrics

- completion by available channel;
- fallback success;
- % cases requiring third-party help;
- task completion time;
- WCAG/assistive-tech compatibility.

## Operational / AML metrics

- analyst minutes per case / per alert;
- cases auto-evidenced;
- % recomendaciones con evidencia completa (toda afirmación citada);
- acuerdo analista ↔ recomendación;
- escalation rate;
- mean time to resolution;
- backlog de alertas;
- evidence completeness.

## AI efficiency metrics

- % transacciones que llegan a IA (objetivo: pequeña fracción);
- llamadas de IA por caso (víctima nueva vs mula conocida);
- tokens / costo estimado por caso;
- hit rate de la Memoria (casos resueltos sin IA);
- latencia de la decisión de pausa;
- tasa de fallos de agente que caen al modo seguro.

## Product metric equation

Una forma conceptual:

```text
Net Protection Value =
Fraud Loss Prevented
- False Positive Cost
- Customer Friction Cost
- Operational Cost (analistas + IA)
```

## Experiments

### E1 — Hold vs alert-only
Simular 1,000 risk events y comparar pérdida potencial bajo reacción tardía.

### E2 — Adaptive challenge
Medir completion frente a fixed challenge en 3 user states.

### E3 — Scam interruption
Comparar baseline warning genérico vs warning contextual.

### E4 — Evidence timeline
Medir minutos necesarios para investigar caso con y sin expediente agregado.

### E5 — Multiagente vs agente único
Mismo set de casos. Comparar:
- % afirmaciones con evidencia citada;
- acuerdo con etiqueta del dataset;
- llamadas de IA y latencia.

Si el agente único empata en calidad con menor costo → simplificar (kill criterion 6 en `12`).

### E6 — Valor de la Memoria
Sobre datos sintéticos: ¿cuántas transferencias posteriores hacia mulas confirmadas se habrían pausado sin IA? Mide pérdida evitada y llamadas ahorradas (H8).

### E7 — Falsos positivos de alto volumen
Comparar regla “solo fan-in” vs “fan-in + reenvío rápido” en cuentas legítimas tipo comercio. Mide cuántos negocios se habrían congelado por error.

> Todo resultado del hackathon proviene de datos simulados o sintéticos y se presenta como tal.
