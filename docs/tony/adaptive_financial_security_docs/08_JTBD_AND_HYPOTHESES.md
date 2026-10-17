# 08 — JTBD & Hypotheses

## JTBD principal — usuario

> **Cuando no puedo vigilar activamente mi cuenta, quiero que mis reglas de protección sigan representando mis intereses para evitar pérdidas sin bloquear innecesariamente mi vida financiera.**

## JTBD — fraud team

> Cuando una operación parece anómala y el usuario no responde, quiero decidir qué nivel de protección aplicar usando contexto suficiente para reducir fraude sin disparar falsos positivos.

## JTBD — support

> Cuando un usuario reporta una operación tarde, quiero reconstruir automáticamente qué pasó y qué controles actuaron para resolver el caso con evidencia.

## JTBD — analista AML

> Cuando llega una alerta sobre una cuenta, quiero recibir el caso ya reconstruido —perfil, contrapartes, patrones y evidencia— para validar una recomendación en minutos en vez de investigar desde cero.

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

## H7 — Investigation time is dominated by context gathering
La mayor parte del tiempo por alerta se va en reunir información, no en decidir.

**Falsación:** analistas reportan que el contexto ya les llega consolidado y que el cuello de botella es la decisión.

## H8 — One mule, many victims
Una cuenta mula recibe de varias víctimas; confirmarla temprano previene pérdidas posteriores.

**Falsación:** en datos reales/sintéticos, la mayoría de cuentas receptoras de fraude recibe de una sola víctima antes de cerrarse.

## H9 — Specialists beat a generalist
Agentes especializados con pocas tools producen recomendaciones más consistentes y trazables que un solo agente con todas las tools.

**Falsación:** un solo agente logra igual calidad (evidencia citada, acuerdo con analista) con menor costo y latencia (experimento E5 en `14`).

## H10 — Most traffic never needs AI
Las reglas deterministas resuelven la gran mayoría de transacciones; la IA solo hace falta en una fracción pequeña.

**Falsación:** para obtener buena detección hay que pasar por el LLM una fracción alta del tráfico, lo que vuelve el costo inviable.
