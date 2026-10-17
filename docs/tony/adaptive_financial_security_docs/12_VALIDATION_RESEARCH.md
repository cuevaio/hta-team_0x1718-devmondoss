# 12 — Validation Research

## Objetivo

Validar el problema antes de construir una arquitectura compleja.

## Entrevistas — orden sugerido

1. fraude/risk;
2. analistas AML / oficial de cumplimiento;
3. customer support;
4. digital product;
5. usuarios que hayan sufrido operación no reconocida/scam;
6. usuarios con barreras de accesibilidad;
7. compliance/consumer protection.

## Preguntas para fraud/risk

- ¿Qué ocurre después de que una operación es marcada high-risk?
- ¿Qué hacen si el cliente no responde?
- ¿Cuánto tiempo pueden mantener una operación?
- ¿Qué tipos de transacción no pueden retener?
- ¿Cuál es el false positive más costoso?
- ¿Cómo detectan usuario legítimo manipulado por un scammer?
- ¿Qué señales tienen pero no logran combinar a tiempo?
- ¿Qué parte sigue siendo manual?

## Preguntas para analistas AML

- Cuéntame cómo investigaste la última alerta, paso a paso.
- ¿Cuántos sistemas abriste? ¿Cuánto tiempo te tomó reunir el contexto vs decidir?
- ¿Cuántas alertas tienes en cola hoy?
- ¿Qué patrones aparecen más (fan-in, reenvío rápido, estructuración, circulares)?
- ¿Cómo distingues una mula de un negocio con muchos ingresos?
- ¿Lo que confirmas como mula llega al equipo de fraude? ¿Cuánto tarda?
- ¿Qué tendría que traer un resumen automático para que confíes en él?

## Preguntas para soporte

- ¿Cuál fue el último caso donde el cliente notó el fraude horas/días después?
- ¿Qué evidencia faltaba?
- ¿Qué sistemas tuvieron que consultar?
- ¿Cuánto demora reconstruir un incidente?
- ¿Qué porcentaje termina en agencia/llamada?

## Preguntas para usuarios

Evitar: “¿usarías una app que...?”

Usar:
- Cuéntame la última vez que viste una operación extraña.
- ¿Cuándo te enteraste?
- ¿Qué hiciste primero?
- ¿Qué pasó si no tenías señal/teléfono?
- ¿Qué parte fue más difícil?
- ¿Qué te pidió demostrar la entidad?
- ¿Qué harías si no pudieras responder por 48 horas?

## Preguntas de accesibilidad

- ¿Qué mecanismo de autenticación te resulta imposible o incómodo?
- ¿Qué haces cuando el fallback es una llamada?
- ¿Dependes de otra persona?
- ¿Qué información terminas compartiendo?
- ¿Qué alternativa te permitiría mantener autonomía?

## Evidencia mínima para seguir

Al menos 3 de 5 deben cumplirse:

- problema repetido por varios roles;
- workaround manual frecuente;
- costo claro;
- casos donde user response delay empeora resultado;
- willingness to pilot / provide sandbox data;
- analistas confirman que reunir contexto domina su tiempo (H7).

## Kill criteria

Matar o pivotar si:

1. la institución ya resuelve el gap con holds adaptativos;
2. no puede accederse a ninguna señal adicional útil;
3. el costo de falsos positivos supera ampliamente fraude evitado;
4. regulación impide cualquier intervención autónoma propuesta;
5. el “agent” solo agrega conversación, no decisión/operación útil;
6. un solo agente (o reglas) logra la misma calidad con menor costo y latencia que el sistema multiagente (H9);
7. las mulas en los datos reciben de una sola víctima, por lo que la Memoria no protege a nadie más (H8).

---

## Validación posible dentro del hackathon

Con 30h no hay tiempo para un estudio completo. Mínimo viable:

1. **2–3 conversaciones de 10 min** con mentores o jurados de banca/fraude/AML usando las preguntas de arriba.
2. **Datos sintéticos:** revisar en una muestra de SAML-D / IBM AML si las cuentas lavadoras reciben de múltiples orígenes (H8).
3. **Experimento E5** (`14`): mismo set de casos con 1 agente vs multiagente → comparar evidencia citada, llamadas y latencia.
4. **Embudo real del demo:** cuántas transacciones simuladas llegan a IA (H10).

Todo resultado se presenta como **simulación / sintético**, nunca como dato de producción.
