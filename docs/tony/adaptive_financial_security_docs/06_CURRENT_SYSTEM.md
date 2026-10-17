# 06 — Current System

## Arquitectura simplificada actual

```text
LOGIN / DEVICE
     ↓
Identity & Authentication
(password / OTP / biometrics)
     ↓
Transaction request
     ↓
Risk engine
(device, IP, amount, history,
beneficiary, velocity, location)
     ↓
Rules / model
     ├─ low risk → allow
     ├─ medium → challenge
     └─ high → block / hold / review
                    ↓
               notification
                    ↓
                  user
```

## Controles clásicos útiles

- MFA / OTP;
- biometría;
- device binding;
- behavioral analytics;
- velocity rules;
- límites transaccionales;
- new-beneficiary controls;
- AML / mule detection;
- transaction monitoring;
- fraud operations;
- alertas push/SMS/email;
- bloqueos manuales;
- call center;
- branch escalation.

El problema no es que estos controles sean inútiles. El problema aparece en los **gaps entre ellos**.

## Tres paradigmas distintos

### Authentication
“¿Quién eres?”

### Transaction risk
“¿Esta operación se parece a fraude?”

### Customer safety
“¿Esta operación refleja la intención segura del usuario y puede verificarse de manera accesible y oportuna?”

La tercera pregunta es la menos resuelta.

## Arquitectura organizacional fragmentada

```text
IAM / Identity ─────┐
Fraud engine ───────┤
Mobile app ─────────┤
Contact center ─────┤──> incident
Security / SIEM ────┤
Complaints ─────────┤
Accessibility ──────┘
```

Cada equipo ve una parte distinta.

## Hipótesis de gap

La información existe, pero la organización no siempre convierte señales dispersas en una **política contextual de protección** antes de que el dinero salga.
