# 03 — Problem Map

## Problema raíz

La protección antifraude es parcialmente reactiva y depende de una interacción humana oportuna.

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
```

## Availability Gap

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

Es **cuánto demoró la acción protectora efectiva**.

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
- investigación manual;
- costo de soporte;
- reclamos y disputas;
- sanciones/regulación;
- reputación;
- churn;
- falsos positivos;
- presión por controles más duros que generan nueva fricción.

## Loop negativo clásico

```text
más fraude
   ↓
más reglas duras
   ↓
más falsos positivos
   ↓
más fricción / soporte
   ↓
usuarios crean workarounds
   ↓
comparten credenciales / dependen de terceros
   ↓
nueva superficie de riesgo
```

## Tensión central

**Seguridad** vs **autonomía** vs **conveniencia** no deberían ser tratadas como objetivos mutuamente excluyentes.
