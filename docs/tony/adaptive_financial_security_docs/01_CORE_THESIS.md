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

---

## La cadena del dinero

El dinero de una estafa no desaparece: llega a una cuenta receptora y desde ahí se mueve.

```text
VÍCTIMA ──transferencia──▶ CUENTA MULA ──reenvío rápido──▶ más cuentas (layering)
   ↑                            ↑
Track 04: estafa,         B1: alerta AML,
suplantación, extorsión   lavado de activos
```

Es **la misma transacción vista desde dos extremos**. Del lado del emisor es fraude contra un cliente; del lado del receptor es una alerta AML. Hoy suelen investigarlo equipos distintos, con herramientas distintas y en momentos distintos.

## Dos gaps, un sistema

| Gap | Quién lo sufre | Definición |
|---|---|---|
| **Availability Gap** | Titular de la cuenta | Tiempo entre que una operación se vuelve riesgosa y que el titular puede participar de forma segura en la protección |
| **Investigation Gap** | Analista de fraude / AML | Tiempo y trabajo manual entre que se genera una alerta y que existe una decisión con evidencia trazable |

Ambos gaps comparten causa: **señales dispersas que nadie convierte a tiempo en una decisión**. Ambos se atacan con el mismo núcleo: agentes que reúnen contexto, una política determinista que decide y una memoria que reutiliza lo aprendido.

## Cómo se traduce en producto

```text
PAUSA      → la operación riesgosa no sale, pero tampoco se bloquea todo
PREGUNTA   → se verifica con el titular por un canal seguro; el silencio no es un “sí”
INVESTIGA  → se perfila la cuenta destino y se arma un expediente con evidencia
APRENDE    → la mula confirmada protege a la siguiente víctima sin costo extra
```

## Principio de diseño

> **No maximizar bloqueos. Maximizar protección útil minimizando daño por falsos positivos y exclusión.**

Una solución defendible debe optimizar simultáneamente:

```text
Fraud prevented ↑
Legitimate operations blocked ↓
Time to protective action ↓
Analyst time per alert ↓
User autonomy ↑
Accessible verification ↑
Operational cost (incl. IA) ↓
```

## Lo que NO estamos afirmando

- No afirmamos que los bancos “no tengan seguridad”. Tienen múltiples controles.
- No afirmamos que toda operación fraudulenta deba ser reembolsada automáticamente.
- No afirmamos que discapacidad, edad o pobreza sean señales de riesgo.
- No afirmamos que IA deba decidir unilateralmente sobre fondos: los agentes recomiendan, una política determinista decide.
- No afirmamos que toda cuenta receptora sospechosa sea criminal: muchas mulas son a su vez personas reclutadas o engañadas, y muchas cuentas con muchos ingresos son negocios legítimos.
- No afirmamos que Latinoamérica tenga universalmente “la mayor tasa de fraude del mundo”; diferentes métricas producen rankings distintos.

La afirmación defendible es más precisa: **la región presenta alta exposición a estafas, fuerte crecimiento de ataques de ingeniería social y de cuentas mula, y brechas estructurales de conectividad, habilidades y madurez de ciberseguridad.**
