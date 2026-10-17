# 09 — Solution Space

> Este documento NO elige una solución. Define opciones a validar.

## S1 — Adaptive Challenge Engine

Selecciona challenge según:
- riesgo;
- disponibilidad;
- confiabilidad de canal;
- preferencias de accesibilidad;
- urgencia de la operación.

No depende de una sola modalidad.

---

## S2 — Protective Hold

Ante riesgo alto + usuario no alcanzable:

```text
ALLOW → HOLD TEMPORAL → VERIFY → RELEASE / BLOCK
```

No todo debe ser “aprobar o bloquear para siempre”.

---

## S3 — User-defined safety policies

Ejemplos voluntarios:

- durante viaje, nuevo beneficiario > S/500 → hold;
- nuevo dispositivo + cambio de clave + transferencia → deny;
- transferencias recurrentes → allow;
- emergencia → mecanismo alternativo previamente configurado.

---

## S4 — Trusted recovery graph

Métodos preestablecidos de recuperación:
- segundo dispositivo;
- contacto seguro voluntario;
- token físico;
- passkey;
- presencial;
- videollamada accesible;
- combinación de evidencias.

Nunca asumir que un tercero es obligatorio.

---

## S5 — Scam-intent interruption

Para operación legítimamente autenticada pero contextualmente peligrosa:

- preguntas específicas de scam;
- explicación contextual;
- friction escalonada;
- cooldown para operación irreversible;
- verificación fuera del canal comprometido.

---

## S6 — Post-breach heightened mode

Tras exposición de datos / dispositivo / identidad:
- elevar vigilancia;
- cambiar canales permitidos;
- ignorar ciertos factores comprometidos;
- reforzar nuevas cuentas beneficiarias.

---

## S7 — Evidence timeline

Construcción automática de:

```text
login → device → beneficiary → amount → alerts → responses → blocks
```

Útil para soporte, fraude, auditoría y reclamo.

---

## S8 — Cross-institution signal sharing

A más largo plazo, señales sobre:
- cuenta mula;
- beneficiario riesgoso;
- identidad comprometida;
- dispositivo;
- scam campaign.

Requiere gobernanza y privacidad fuertes.

---

## Criterio para escoger

La solución ganadora debe demostrar mejor:

1. reducción de riesgo;
2. menor dependencia de reacción inmediata;
3. mínima fricción legítima;
4. accesibilidad;
5. explicabilidad;
6. viabilidad de integración.
