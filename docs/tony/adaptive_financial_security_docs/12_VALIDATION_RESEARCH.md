# 12 — Validation Research

## Objetivo

Validar el problema antes de construir una arquitectura compleja.

## Entrevistas — orden sugerido

1. fraude/risk;
2. customer support;
3. digital product;
4. usuarios que hayan sufrido operación no reconocida/scam;
5. usuarios con barreras de accesibilidad;
6. compliance/consumer protection.

## Preguntas para fraud/risk

- ¿Qué ocurre después de que una operación es marcada high-risk?
- ¿Qué hacen si el cliente no responde?
- ¿Cuánto tiempo pueden mantener una operación?
- ¿Qué tipos de transacción no pueden retener?
- ¿Cuál es el false positive más costoso?
- ¿Cómo detectan usuario legítimo manipulado por un scammer?
- ¿Qué señales tienen pero no logran combinar a tiempo?
- ¿Qué parte sigue siendo manual?

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
- willingness to pilot / provide sandbox data.

## Kill criteria

Matar o pivotar si:

1. la institución ya resuelve el gap con holds adaptativos;
2. no puede accederse a ninguna señal adicional útil;
3. el costo de falsos positivos supera ampliamente fraude evitado;
4. regulación impide cualquier intervención autónoma propuesta;
5. el “agent” solo agrega conversación, no decisión/operación útil.
