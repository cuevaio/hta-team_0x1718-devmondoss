# 08 — JTBD & Hypotheses

## JTBD principal — usuario

> **Cuando no puedo vigilar activamente mi cuenta, quiero que mis reglas de protección sigan representando mis intereses para evitar pérdidas sin bloquear innecesariamente mi vida financiera.**

## JTBD — fraud team

> Cuando una operación parece anómala y el usuario no responde, quiero decidir qué nivel de protección aplicar usando contexto suficiente para reducir fraude sin disparar falsos positivos.

## JTBD — support

> Cuando un usuario reporta una operación tarde, quiero reconstruir automáticamente qué pasó y qué controles actuaron para resolver el caso con evidencia.

## JTBD — product

> Quiero ofrecer seguridad fuerte sin convertir cada anomalía en una llamada o visita física.

---

# Hipótesis de problema

## H1 — Availability Gap
Una parte significativa del riesgo ocurre entre detección y reacción humana.

**Falsación:** la mayoría de instituciones ya mantiene automáticamente fondos de alto riesgo cuando el cliente no responde.

## H2 — Fixed verification is insufficient
Challenges actuales no se adaptan bien a distintos estados de disponibilidad.

**Falsación:** los bancos ya seleccionan dinámicamente canales y políticas según estado/contexto del usuario.

## H3 — Intent is under-modeled
La identidad correcta no basta para scams de ingeniería social.

**Falsación:** sistemas existentes detectan de forma consistente coerción/scam y reducen este fraude a niveles marginales.

## H4 — Accessibility and fraud are siloed
Accesibilidad y antifraude operan como funciones separadas.

**Falsación:** equipos comparten señales, políticas y KPIs de forma integrada.

## H5 — Customers want delegated safety preferences
Usuarios aceptarían preconfigurar políticas de protección más estrictas para estados de indisponibilidad.

**Falsación:** usuarios perciben cualquier delegación/bloqueo temporal como peor que el riesgo de fraude.

## H6 — Banks have economic incentive
Reducir fraude + soporte + reclamos justifica integrar una capa nueva.

**Falsación:** costo de fraude relevante ya es absorbido con menor costo que cualquier integración adicional.
