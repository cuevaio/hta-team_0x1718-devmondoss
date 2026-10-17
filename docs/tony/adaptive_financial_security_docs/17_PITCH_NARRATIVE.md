# 17 — Pitch Narrative

## Hook

> Tu banco puede detectar una operación sospechosa en segundos. Pero si alguien te está guiando por teléfono —o si estás cuatro días sin señal—, ¿quién protege tu dinero?

## Problem

Los sistemas financieros son muy buenos autenticando identidad y cada vez mejores detectando anomalías.

Pero muchas defensas terminan en:

```text
alert → wait for user → user reacts
```

Eso funciona solo si el usuario está disponible y no está siendo manipulado.

Y cuando el fraude ocurre, el dinero llega a una cuenta mula que otro equipo —AML— investiga a mano, días después, mientras esa misma cuenta sigue recibiendo de nuevas víctimas.

## Human reality

El usuario puede:
- estar siendo manipulado por un scammer;
- estar viajando o sin señal;
- dormir;
- perder el celular;
- compartir dispositivo;
- no poder usar el canal estándar.

## Regional urgency

La región se digitaliza rápido mientras scams, vishing, remote-access fraud, fraude desde dispositivos robados y cuentas mula crecen.

El reto ya no es solamente verificar **quién** hace clic.

Es verificar si la acción sigue siendo segura cuando el contexto humano falla — y que lo aprendido proteja a la siguiente persona.

## Thesis

> **Financial security should not depend on perfect human availability.**

## Product primitive

**Pausa → Pregunta → Investiga → Aprende.**

Un equipo de agentes de IA, cada uno con un trabajo:
- 🧭 **Coordinador** — decide a quién llamar y corta temprano;
- 🛡️ **Guardián** — protege al cliente: pregunta, verifica por canal seguro;
- 🔍 **Detective** — investiga la cuenta que recibe el dinero;
- 📋 **Auditor** — arma el expediente; nada sin evidencia.

La IA recomienda. Una política determinista decide:

```text
PERMITIR / PAUSAR / VERIFICAR / ESCALAR
```

## Demo story (3 actos)

1. **Rosa.** Recibe la llamada de un “falso banco” y transfiere S/4,800. FaceID ✔, OTP ✔. El Guardián pregunta: *“¿alguien te está guiando por teléfono?”* — sí. **Pausa.**
2. **La mula.** El Detective revisa la cuenta destino: 14 remitentes nuevos en 48h, 90% reenviado en menos de 2h. El Auditor arma el expediente. El analista confirma en un clic.
3. **Jorge.** Intenta transferir a la misma cuenta. **Pausa inmediata. Cero llamadas de IA.** El sistema aprendió.

## Por qué es eficiente

- La mayoría de transacciones nunca toca la IA.
- Cada mula se investiga una vez y protege a todas sus siguientes víctimas.
- Modelo barato para conversar; modelo capaz solo para el expediente.

## Closing

> Hoy la seguridad financiera pregunta: “¿puedes confirmar esto ahora?”
>
> Nosotros preguntamos: **“¿cómo protegemos tu intención cuando no puedes responder… y cómo hacemos que tu caso proteja al siguiente?”**
