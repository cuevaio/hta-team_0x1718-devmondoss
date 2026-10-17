# 03 — Problem Map

## Problema raíz

La protección antifraude es parcialmente reactiva y depende de una interacción humana oportuna. Y cuando el fraude ocurre, la investigación del lado receptor (AML) vuelve a empezar desde cero, en otro equipo.

```text
Digitalización acelerada
        ↓
Más superficie transaccional
        ↓
Más identidad / dinero / acciones en canales digitales
        ↓
Fraude + ingeniería social + ATO + dispositivo robado
        ↓
Sistema detecta anomalía
        ↓
Envía challenge / alerta
        ↓
¿usuario disponible y capaz de responder?
       / \
     sí   no
     ↓     ↓
control   exposure window
             ↓
     dinero llega a cuenta mula
             ↓
     alerta AML → analista reconstruye manualmente
```

## Gap 1 — Availability Gap

Definición:

> Tiempo entre el momento en que una operación o patrón se vuelve riesgoso y el momento en que el titular legítimo puede participar de manera efectiva en una acción protectora.

Ejemplo:

```text
T0  02:13 — nueva cuenta beneficiaria
T1  02:13 — alerta enviada
T2  02:20 — segunda transferencia
T3  día 4 — usuario vuelve a tener conectividad
```

La métrica relevante no es “alert sent in 3 seconds”.

Es **cuánto demoró la acción protectora efectiva** (TTPA, ver `14`).

## Gap 2 — Investigation Gap

Definición:

> Tiempo y trabajo manual entre que el sistema de monitoreo genera una alerta y que existe una decisión (descartar / escalar) con evidencia trazable.

Ejemplo (HIPÓTESIS, a validar con analistas):

```text
T0  alerta AML sobre cuenta receptora
T1  analista abre 4–6 sistemas: core, monitoreo, listas, KYC, historial
T2  arma a mano el perfil y las contrapartes
T3  decide y redacta la justificación
T4  la alerta siguiente espera en el backlog
```

Mientras el caso espera, la mula sigue recibiendo de nuevas víctimas.

## Causas inmediatas

### C1 — Dependencia de canales
- push;
- SMS;
- llamada;
- correo;
- app;
- agencia.

### C2 — Dependencia de contexto técnico
- celular operativo;
- SIM activa;
- internet;
- batería;
- app actualizada;
- cámara/sensor disponible.

### C3 — Dependencia cognitiva
- reconocer estafa;
- comprender urgencia;
- diferenciar banco real vs impersonación;
- comprender consecuencias.

### C4 — Dependencia de accesibilidad
- lector de pantalla compatible;
- alternativa a llamada de voz;
- interacción motora posible;
- lenguaje comprensible.

### C5 — Dependencia temporal
- el challenge tiene valor solamente si ocurre antes de que el dinero se vuelva irrecuperable.

### C6 — Dependencia de reconstrucción manual
- el contexto del caso está repartido en varios sistemas;
- cada analista lo arma a su manera → inconsistencia;
- la justificación se redacta a mano → trazabilidad débil.

### C7 — Silo fraude ↔ AML
- el equipo de fraude ve al emisor; el de AML ve al receptor;
- una mula confirmada en AML no siempre frena la siguiente transferencia de otra víctima.

## Efectos para el usuario

- pérdida de fondos;
- bloqueo de cuenta legítima;
- pérdida de autonomía;
- necesidad de terceros;
- estrés y tiempo perdido;
- abandono de servicios digitales;
- desconfianza.

## Efectos para la institución financiera

- fraude y chargebacks;
- investigación manual y backlog de alertas;
- costo de soporte;
- reclamos y disputas;
- sanciones/regulación (consumidor y AML);
- reputación;
- churn;
- falsos positivos;
- presión por controles más duros que generan nueva fricción.

## Loop negativo clásico

```text
más fraude
   ↓
más reglas duras + más alertas
   ↓
más falsos positivos + más backlog
   ↓
más fricción / soporte / fatiga del analista
   ↓
usuarios crean workarounds · alertas se cierran sin diligencia
   ↓
comparten credenciales / dependen de terceros · mulas siguen activas
   ↓
nueva superficie de riesgo
```

## Loop positivo que buscamos

```text
víctima 1 → pausa → investigación de la cuenta destino → analista confirma mula
     ↑                                                        ↓
víctima 2 protegida al instante  ←──────────  Memoria de riesgo
```

## Dónde actúa cada componente

| Causa | Componente (ver `19`) |
|---|---|
| C1, C2, C5 | 🛡️ Guardián + Policy Engine (pausa) |
| C3 | 🛡️ Guardián (preguntas específicas de estafa) |
| C4 | 🛡️ Guardián (canal alternativo según preferencia declarada) |
| C6 | 🔍 Detective + 📋 Auditor |
| C7 | 🧠 Memoria de riesgo + 🧭 Coordinador |

## Tensión central

**Seguridad** vs **autonomía** vs **conveniencia** vs **costo operativo** no deberían ser tratadas como objetivos mutuamente excluyentes.
