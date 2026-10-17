# 11 — Lean Canvas v1

> v1 (2026-10-17): incorpora el frente AML (B1) y el sistema multiagente.

## Problem

1. La protección antifraude depende parcialmente de reacción rápida del usuario.
2. Autenticación fuerte no demuestra intención segura (estafa, suplantación, extorsión).
3. Investigar alertas AML exige reconstrucción manual: backlog, inconsistencia y riesgo regulatorio.
4. Fraude y AML trabajan en silos: confirmar una mula no protege a tiempo a la siguiente víctima.

## Existing Alternatives

- push/SMS/email;
- OTP / biometría;
- call center;
- limits;
- transaction monitoring;
- bloqueos;
- branch;
- manual fraud review;
- investigación AML manual en varios sistemas.

## Customer Segments

### End users
- Titulares de cuentas y billeteras digitales.
- Analistas de fraude y AML.

### Early use cases
- usuarios autenticados pero manipulados (vishing, falso banco, falso familiar);
- suplantación: dispositivo nuevo / SIM swap con titular sin responder;
- cuentas receptoras con patrón de mula;
- backlog de alertas AML.

### Buyer
Institución financiera / plataforma de pagos / billetera digital.

### Internal champions
Fraud, Risk, AML/Compliance, Security, Digital Product, Customer Protection.

## Unique Value Proposition

> **Pausa, pregunta, investiga y aprende: protegemos el dinero aunque el cliente no pueda reaccionar, y cada investigación protege a la siguiente víctima.**

Versión corta:

> **Seguridad financiera que sigue funcionando aunque tú no estés mirando.**

## Solution

- pausa protectora (policy-based hold);
- interrupción de estafa con preguntas específicas;
- investigación automática de la cuenta destino (B1);
- expediente con evidencia citada;
- memoria de riesgo fraude ↔ AML;
- todo orquestado por un sistema multiagente con IA solo donde aporta.

## Key Metrics

- Time To Protective Action (TTPA);
- fraud prevented;
- false positive rate;
- minutos de analista por alerta;
- % recomendaciones con evidencia completa;
- acuerdo analista ↔ recomendación;
- % transacciones que llegan a IA;
- llamadas de IA por caso / costo por caso;
- hit rate de la Memoria.

## Channels

- integración bancaria;
- wallet/payment APIs;
- risk/fraud stack;
- herramientas de case management AML;
- enterprise pilots.

## Cost Structure

- integrations;
- model inference (controlado por embudo + memoria + modelo por nivel);
- fraud data;
- security;
- audit/logging;
- compliance;
- support;
- enterprise implementation.

## Revenue

Hipótesis:
- SaaS enterprise;
- pricing por MAU protegido;
- pricing por caso investigado / alerta;
- risk platform license.

## Unfair Advantage

**Hoy: ninguno probado.**

Posibles moats futuros:
- memoria de riesgo validada por analistas (fraude ↔ AML);
- policy feedback dataset;
- cross-channel behavior history;
- verified scam intelligence network;
- deeply embedded integrations.
