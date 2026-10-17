# 04 — User States

## Segmentación recomendada

No segmentar primero por “joven / adulto mayor / discapacitado”.

Segmentar por **capacidad de respuesta segura en ese momento**.

Una misma persona puede cambiar de estado en horas.

---

## State A — Immediate

**Condiciones**
- conectado;
- teléfono disponible;
- canal accesible;
- suficiente alfabetización digital;
- puede evaluar y responder.

**Riesgo principal**
- phishing / vishing / coerción pese a estar autenticado.

---

## State B — Delayed

**Ejemplos**
- durmiendo;
- trabajando sin teléfono;
- manejando;
- reunión prolongada;
- vuelo.

**Riesgo**
- la alerta existe, pero la ventana útil puede expirar antes de verla.

---

## State C — Unreachable

**Ejemplos**
- zona rural sin cobertura;
- viaje internacional sin roaming;
- montaña / mina / mar;
- hospitalización;
- dispositivo dañado.

**Riesgo**
- security flow espera respuesta que no llegará.

---

## State D — Channel Mismatch

**Ejemplos**
- usuario sordo y fallback por llamada;
- usuario ciego y challenge visual;
- limitación motora y gesto complejo;
- barrera cognitiva o de lenguaje.

**Riesgo**
- challenge técnicamente “disponible” pero funcionalmente inaccesible.

---

## State E — Compromised Channel

**Ejemplos**
- celular robado;
- SIM swap;
- email comprometido;
- malware / remote access;
- dispositivo compartido bajo control de tercero.

**Riesgo**
- el mismo canal usado para verificar es el canal comprometido.

---

## State F — Authenticated but Manipulated

**Ejemplos**
- usuario real siguiendo instrucciones de un estafador;
- falsa “cuenta segura”;
- falso soporte;
- falso familiar / ejecutivo;
- coerción.

```text
FaceID ✔
Password ✔
OTP ✔
Device ✔
Intent ✖
```

**Riesgo**
- authentication succeeds, safety fails.

---

## State G — Shared Device

**Ejemplos**
- teléfono familiar compartido;
- pequeño comercio usando un solo equipo;
- adulto mayor ayudado por familiar;
- múltiples cuentas en el mismo terminal.

**Riesgos**
- privacidad;
- exposición de notificaciones;
- confusión de identidad;
- dependencia de terceros;
- credenciales memorizadas por otra persona.

---

## State H — Low-resource digital user

**Contexto**
- smartphone antiguo;
- almacenamiento lleno;
- plan prepago;
- batería degradada;
- poco espacio para updates;
- conectividad intermitente.

**Riesgo**
- mecanismos “normales” fallan por infraestructura personal, no por negligencia.

---

## Matriz rápida

| Estado | Puede ver alerta | Puede autenticarse | Canal confiable | Puede decidir rápido |
|---|---:|---:|---:|---:|
| Immediate | Sí | Sí | Generalmente | Sí |
| Delayed | Después | Sí | Sí | No |
| Unreachable | No | No/Después | Sí | No |
| Channel mismatch | Quizás | Quizás | Sí | Depende |
| Compromised | Sí | Sí | No | Sí/No |
| Manipulated | Sí | Sí | Sí | Sí, pero intención dañada |
| Shared device | Sí | Sí | Parcial | Depende |
| Low-resource | Intermitente | Intermitente | Sí | Depende |

---

## Qué componente responde a cada estado

| Estado | Respuesta del sistema (ver `19`) | En demo |
|---|---|---|
| A — Immediate | Reglas; si hay riesgo, 🛡️ Guardián pregunta en el mismo flujo | — |
| B — Delayed | Pausa temporal; el silencio no se toma como aprobación | — |
| C — Unreachable | Pausa de la operación riesgosa; operaciones habituales siguen pasando | Acto extra (viajera) |
| D — Channel mismatch | 🛡️ Guardián elige canal alternativo según preferencia declarada | Fuera del MVP |
| E — Compromised | 🛡️ Guardián excluye el canal comprometido para verificar | Acto extra (viajera) |
| F — Manipulated | 🛡️ Guardián pregunta específicamente por guía telefónica / urgencia; cooldown | **Acto 1 (Rosa)** |
| G — Shared device | Device trust ≠ person trust; no confiar solo en el dispositivo | Fuera del MVP |
| H — Low-resource | Mensajes cortos, canal liviano (SMS) como alternativa | Fuera del MVP |

---

## Estados de la cuenta destino (frente B1)

El otro extremo de la transferencia también tiene estados. Los evalúa el 🔍 Detective y los confirma un analista.

| Estado | Señales típicas | Respuesta |
|---|---|---|
| **Conocida y limpia** | historial largo, contrapartes estables, sin reenvío rápido | no investigar (ahorro) |
| **Nueva / sin historial** | cuenta reciente, pocas operaciones | investigar si el monto es relevante |
| **Alto volumen legítimo** | muchos remitentes (ej. bodega, comercio), pero el dinero se queda o se usa en gastos normales | **no confundir con mula** (ver `15` R10) |
| **Mula probable** | fan-in de remitentes nuevos + reenvío rápido + posibles montos bajo umbral | pausa + escalar al analista |
| **Mula confirmada** | validada por analista | entra a 🧠 Memoria → pausa inmediata sin IA para futuras transferencias |
