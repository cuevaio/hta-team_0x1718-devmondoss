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
