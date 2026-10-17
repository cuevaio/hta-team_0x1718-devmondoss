# 17 — Pitch Narrative

## Hook

> Tu banco puede detectar una operación sospechosa en segundos. Pero si tú estás cuatro días sin señal, ¿quién protege tu dinero durante esos cuatro días?

## Problem

Los sistemas financieros son muy buenos autenticando identidad y cada vez mejores detectando anomalías.

Pero muchas defensas terminan en:

```text
alert → wait for user → user reacts
```

Eso funciona solo si el usuario está disponible.

## Human reality

El usuario puede:
- estar viajando;
- no tener señal;
- dormir;
- perder el celular;
- compartir dispositivo;
- no poder usar el canal estándar;
- estar siendo manipulado por un scammer.

## Regional urgency

La región se digitaliza rápido mientras scams, vishing, remote-access fraud y fraude desde dispositivos robados crecen.

El reto ya no es solamente verificar **quién** hace clic.

Es verificar si la acción sigue siendo segura cuando el contexto humano falla.

## Thesis

> **Financial security should not depend on perfect human availability.**

## Product primitive

Una capa de protección adaptativa que combina:
- riesgo;
- disponibilidad;
- confiabilidad del canal;
- políticas del usuario;
- contexto de la operación.

Y decide:

```text
ALLOW / HOLD / CHALLENGE / ESCALATE
```

## Demo story

Un usuario viaja y queda sin señal.
Un atacante entra desde un dispositivo nuevo y agrega un beneficiario.

El sistema detecta la anomalía.
El usuario no responde.

En lugar de tratar el silencio como ausencia de problema, entra en protective hold.

Cuando el usuario vuelve, verifica por un canal seguro y recupera control.

## Closing

> Hoy la seguridad financiera pregunta: “¿puedes confirmar esto ahora?”
>
> Nosotros preguntamos: **“¿cómo protegemos tu intención cuando no puedes responder?”**
