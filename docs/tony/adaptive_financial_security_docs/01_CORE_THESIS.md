# 01 — Core Thesis

## Definición corta

La seguridad financiera digital moderna puede detectar anomalías en segundos, pero muchas veces la acción protectora efectiva todavía depende de que el usuario vea una alerta y reaccione a tiempo.

El gap central es:

```text
ANOMALÍA
   ↓
DETECCIÓN
   ↓
ALERTA
   ↓
¿EL USUARIO PUEDE RESPONDER AHORA?
   ├─ Sí → challenge / bloqueo / confirmación
   └─ No → ventana de exposición
```

## Tesis de problema

> **La seguridad de una cuenta no debería degradarse drásticamente cuando el titular legítimo está temporalmente indisponible.**

La indisponibilidad puede ser completamente normal:

- viaje;
- falta de señal;
- sueño;
- trabajo;
- hospitalización;
- teléfono perdido o robado;
- cambio de SIM;
- dispositivo compartido;
- barreras visuales, auditivas o motoras;
- baja alfabetización digital;
- coerción o manipulación en tiempo real.

## La suposición escondida del sistema actual

Muchos flujos de seguridad presuponen que el usuario:

1. tiene su teléfono;
2. tiene conectividad;
3. recibe la alerta;
4. reconoce que es importante;
5. comprende el riesgo;
6. distingue una comunicación legítima de una estafa;
7. puede usar el canal ofrecido;
8. responde dentro de una ventana útil.

Cuando cualquiera de esas condiciones falla, el sistema puede seguir “funcionando” técnicamente mientras la protección real deja de hacerlo.

## Cuatro dimensiones distintas

### Identity
¿Es realmente el titular o una persona autorizada?

### Authorization
¿Tiene permiso para realizar esa acción?

### Intent
¿La acción expresa su voluntad real o está siendo manipulada/coaccionada?

### Availability
¿Puede participar de manera segura en una verificación ahora mismo?

Una operación puede pasar Identity + Authorization y aun fallar Intent o Availability.

## Principio de diseño

> **No maximizar bloqueos. Maximizar protección útil minimizando daño por falsos positivos y exclusión.**

Una solución defendible debe optimizar simultáneamente:

```text
Fraud prevented ↑
Legitimate operations blocked ↓
Time to protective action ↓
User autonomy ↑
Accessible verification ↑
Operational cost ↓
```

## Lo que NO estamos afirmando

- No afirmamos que los bancos “no tengan seguridad”. Tienen múltiples controles.
- No afirmamos que toda operación fraudulenta deba ser reembolsada automáticamente.
- No afirmamos que discapacidad, edad o pobreza sean señales de riesgo.
- No afirmamos que IA deba decidir unilateralmente sobre fondos.
- No afirmamos que Latinoamérica tenga universalmente “la mayor tasa de fraude del mundo”; diferentes métricas producen rankings distintos.

La afirmación defendible es más precisa: **la región presenta alta exposición a estafas, fuerte crecimiento de ataques de ingeniería social y brechas estructurales de conectividad, habilidades y madurez de ciberseguridad.**
