# 07 — Failure Modes

## FM1 — Notification ≠ protection

**Falla:** el sistema detecta y avisa, pero no cambia el estado del riesgo.

**Ejemplo:** usuario sin conectividad durante 4 días.

---

## FM2 — Authentication without intent

**Falla:** identidad correcta, intención manipulada.

**Ejemplo:** estafador guía a la víctima durante una transferencia.

---

## FM3 — Same-channel verification

**Falla:** se usa el teléfono comprometido para confirmar que el teléfono no está comprometido.

---

## FM4 — Fixed challenge

**Falla:** el mismo OTP / llamada / biometría para contextos distintos.

**Resultado:** fricción o exclusión.

---

## FM5 — Alert fatigue

**Falla:** demasiadas alertas → usuario deja de distinguir prioridad.

---

## FM6 — False positive lockout

**Falla:** seguridad excesiva bloquea operaciones legítimas críticas.

**Ejemplo:** usuario viajando necesita pagar hotel o emergencia.

---

## FM7 — User becomes the incident response team

**Falla:** se espera que el usuario identifique fraude, contacte banco, bloquee, recopile evidencia y reclame.

---

## FM8 — Accessibility as afterthought

**Falla:** fallback depende de voz, visión o interacción no disponible para ese usuario.

---

## FM9 — Shared device ambiguity

**Falla:** device trust se confunde con person trust.

---

## FM10 — Post-breach identity realism

**Falla:** el estafador posee datos verdaderos filtrados y construye una comunicación mucho más creíble.

---

## FM11 — Policy cliff

**Falla:** regla binaria “allow/block” sin capacidad de hold temporal, challenge alternativo o protección gradual.

---

## FM12 — Recovery deadline mismatch

**Falla:** procesos de reclamo/recuperación pueden depender de notificación rápida, mientras la disponibilidad real del usuario puede ser tardía.

**Nota:** no asumir que cualquier plazo interno elimina derechos legales; esto depende de normativa y caso concreto.

---

## FM13 — Manual case reconstruction

**Falla:** cada alerta AML exige reconstruir a mano historial, contrapartes y señales.

**Resultado:** backlog, inconsistencia entre analistas y alertas cerradas sin la debida diligencia.

---

## FM14 — Fraud–AML silo

**Falla:** lo que AML confirma sobre una cuenta receptora no frena a tiempo las transferencias de nuevas víctimas hacia esa misma cuenta.

---

## FM15 — High-volume legitimate account mislabeled

**Falla:** una bodega o comercio que recibe muchos pagos pequeños se parece a una mula por fan-in.

**Resultado:** congelar a un negocio legítimo y perder confianza. Lo que distingue a una mula es el **reenvío rápido**, no solo la cantidad de remitentes.

---

## FM16 — AI theater

**Falla:** agregar un LLM que conversa pero no cambia la decisión, o que gasta llamadas en cada transacción.

**Resultado:** costo alto, latencia alta y ninguna mejora medible.

---

## Qué componente responde a cada falla

| Falla | Componente (ver `19`) |
|---|---|
| FM1 Notification ≠ protection | Policy Engine: pausa |
| FM2 Authentication without intent | 🛡️ Guardián |
| FM3 Same-channel verification | 🛡️ Guardián (excluye canal comprometido) |
| FM4 Fixed challenge | 🛡️ Guardián (elige canal) |
| FM5 Alert fatigue | Reglas + 🧭 Coordinador: solo escala lo necesario |
| FM6 False positive lockout | Policy Engine: operaciones habituales siguen pasando |
| FM7 User becomes incident response | 📋 Auditor arma el expediente |
| FM11 Policy cliff | Policy Engine con estados graduales |
| FM13 Manual reconstruction | 🔍 Detective + 📋 Auditor |
| FM14 Fraud–AML silo | 🧠 Memoria de riesgo |
| FM15 Mislabeled legit account | 🔍 Detective (exige reenvío rápido) + validación humana |
| FM16 AI theater | Embudo: reglas primero, IA solo en casos sospechosos |
