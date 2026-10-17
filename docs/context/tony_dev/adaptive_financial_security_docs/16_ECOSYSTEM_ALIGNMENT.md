# 16 — Ecosystem Alignment

Este documento traduce la idea a criterios que suelen valorar ecosistemas de producto, infraestructura y venture, sin diseñarla para una organización concreta.

## 1. Problema local, arquitectura global

El dolor es muy visible en Latinoamérica por:
- digitalización acelerada;
- ingeniería social;
- conectividad desigual;
- alta diversidad de dispositivos y habilidades;
- costos reales de fraude y reclamos.

Pero el primitive es global:

> **protect critical financial actions when the human owner is unavailable, manipulated or unable to use the default channel.**

## 2. Infraestructura, no chatbot

El proyecto puede vivir como:
- risk middleware;
- policy engine;
- verification orchestration layer;
- SDK/API.

Eso aumenta extensibilidad y defensibilidad.

## 3. AI donde aporta

AI sirve para:
- orquestar evidencia entre agentes especializados;
- conversar para detectar manipulación;
- comprender contexto;
- adaptar flujo;
- generar explicación;
- detectar señales semánticas.

No reemplaza:
- authentication;
- cryptography;
- policy enforcement;
- ledger;
- deterministic limits.

## 4. Product quality

Un buen producto debe mostrar:
- flujo end-to-end;
- estado visible;
- razón de decisión;
- fallback;
- edge cases;
- failure states.

## 5. Business quality

Debe responder:
- quién paga;
- cuánto cuesta hoy el problema;
- qué sistema reemplaza o complementa;
- qué integración necesita;
- qué KPI mejora.

## 6. Social value sin charity framing

La inclusión no es una feature “CSR”.

Si el sistema funciona mejor para:
- adulto mayor offline;
- persona ciega;
- persona sin roaming;
- usuario con teléfono robado;
- usuario manipulado;

también se vuelve más robusto para cualquier usuario.

## 7. Demo credibility

Mejor:
> “Aquí está una transferencia, aquí están las señales, aquí el usuario no responde y aquí el sistema cambia de estrategia.”

Peor:
> “Nuestro agente usa IA para prevenir fraude en LATAM.”

## 8. Encaje con Track 04 y con el reto B1

| Exigencia | Cómo la cubrimos |
|---|---|
| Track 04 — estafas | 🛡️ Guardián: interrupción con preguntas específicas + pausa |
| Track 04 — suplantación | Dispositivo nuevo / SIM swap + titular sin respuesta → pausa; canal comprometido excluido |
| Track 04 — extorsión | Cooldown, verificación fuera del canal, la víctima no puede “autoaprobar” bajo presión |
| Track 04 — desinformación | Solo indirecta (impersonación del banco); no la forzamos |
| B1 — reconstruir el caso | 🔍 Detective con tools deterministas |
| B1 — patrones de lavado | fan-in, reenvío rápido, estructuración, ciclos |
| B1 — cruzar listas | tool de listas + 🧠 Memoria |
| B1 — recomendación trazable | 📋 Auditor con evidencia citada |
| B1 — el analista valida | consola del analista |

Mensaje: **un núcleo, dos frentes.** Protege al cliente en tiempo real y le ahorra trabajo al analista; lo que aprende uno protege al otro.

## 9. IA con criterio de recursos

Un jurado técnico valora que la IA sea **necesaria y barata**, no omnipresente:
- embudo: reglas → pocas sospechosas → IA;
- modelo según la tarea;
- memoria que vuelve gratis los casos repetidos;
- métricas de costo visibles en el demo.
