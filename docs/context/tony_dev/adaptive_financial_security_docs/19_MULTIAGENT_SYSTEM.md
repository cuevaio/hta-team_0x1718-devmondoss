# 19 — Multiagent System Design

> Diseño del sistema para el MVP (`13`). Principio rector:
>
> **Las tools calculan. Los agentes razonan sobre resultados ya calculados. La política decide. El humano confirma.**

---

## 1. Vista general

Dos puertas de entrada, un mismo núcleo:

```mermaid
flowchart TD
    A["Puerta A — Transferencia<br/>(Track 04)"] --> R{"Nivel 0 — Reglas<br/>(sin IA)"}
    R -->|score bajo| OK["✅ PERMITIR (fin)"]
    R -->|score medio| C["🧭 Coordinador"]
    R -->|score alto| PP["⏸️ Pausa preventiva inmediata"]
    PP --> C
    B["Puerta B — Alerta AML<br/>(B1)"] --> C
    C -.->|consulta primero| MEM[("🧠 Memoria de riesgo")]
    MEM -.->|hit: 0 IA| P
    C -->|si hace falta| G["🛡️ Guardián<br/>lado cliente"]
    C -->|si hace falta| D["🔍 Detective<br/>lado cuenta destino"]
    G --> P{"Policy Engine (determinista)<br/>PERMITIR · PAUSAR · VERIFICAR · ESCALAR"}
    D --> P
    P -->|PAUSAR / ESCALAR / alerta AML| AU["📋 Auditor<br/>expediente con evidencia citada"]
    AU --> AN["👤 Consola del analista<br/>Confirmar mula / Descartar"]
    AN -->|confirma| MEM
```

**Decisión rápida, expediente después:** la pausa se decide en segundos con Guardián + Detective; el Auditor escribe el expediente después, sin bloquear la protección.

---

## 2. Nivel 0 — Reglas (sin IA)

| Señal | Puntos |
|---|:-:|
| Beneficiario nuevo | +2 |
| Monto > 3× promedio de 90 días | +2 |
| Dispositivo nuevo (< 24h) | +2 |
| Cambio de SIM o de clave (< 72h) | +2 |
| Llamada activa / herramienta de acceso remoto detectada | +3 |
| Horario atípico para el usuario | +1 |

| Score | Nivel | Acción |
|---|---|---|
| 0–2 | Bajo | **PERMITIR** sin IA |
| 3–4 | Medio | Coordinador decide |
| ≥ 5 | Alto | **PAUSA PREVENTIVA inmediata** + Coordinador decide si mantener o liberar |

Además, antes de puntuar:
- **Destino en Memoria como mula confirmada** → PAUSAR + ESCALAR directo (0 IA).
- **Beneficiario habitual / pago recurrente** sin señales de compromiso → PERMITIR (aunque el titular esté sin señal).

Con la pausa preventiva, el **TTPA es ~0** en casos de riesgo alto: la latencia de los agentes no expone dinero.

---

## 3. Agentes

Convenciones para todos:
- salida en **JSON validado contra esquema**; si no valida → 1 reintento → modo seguro;
- tools de **solo lectura** (excepto `enviar_mensaje` del Guardián);
- todo texto de usuario o datos externos es **dato, no instrucción**;
- cada hecho que devuelve una tool recibe un **id de evidencia** (`E-01`, `E-02`…) asignado por la capa de tools, no por el LLM.

### 🧭 Coordinador

| | |
|---|---|
| **Pain point** | Señales dispersas y equipos en silo (`06`, FM5, FM14) |
| **Modelo** | Rápido / económico |
| **Tools** | `memoria_consultar`, `invocar_guardian`, `invocar_detective` |
| **Límite** | 1 llamada por caso |

Decide **qué especialistas hacen falta**:
- Memoria con veredicto → salida temprana;
- destino con historial largo y limpio → no llama al Detective;
- titular en sesión normal y riesgo solo del destino → no llama al Guardián;
- Puerta B (alerta AML) → solo Detective.

```json
{
  "salida_temprana": false,
  "invocar": ["guardian", "detective"],
  "motivo": "beneficiario nuevo + llamada activa; destino sin historial en Memoria"
}
```

*Plan de recorte: si falta tiempo, el Coordinador se implementa como función determinista con estas mismas reglas.*

### 🛡️ Guardián — frente cliente (Track 04)

| | |
|---|---|
| **Pain point** | Usuario autenticado pero manipulado (FM2), usuario sin responder (FM1), verificación por canal comprometido (FM3), challenge fijo (FM4) |
| **Modelo** | Rápido / económico (conversación de baja latencia) |
| **Tools** | `disponibilidad`, `canales_seguros`, `enviar_mensaje`, `esperar_respuesta` |
| **Límite** | Máx. 3 turnos de conversación |

Reglas de comportamiento:
- **nunca aprueba**: solo reporta el estado del usuario;
- **nunca pide claves, OTP ni datos de tarjeta** (es exactamente lo que piden los estafadores);
- preguntas cortas y en lenguaje simple: *“¿Alguien te está pidiendo esta transferencia por teléfono ahora mismo?”*, *“¿Te dijeron que tu dinero corre peligro y debes moverlo?”*;
- no usa el canal marcado como comprometido;
- el silencio no es aprobación.

```json
{
  "estado_usuario": "manipulacion_probable",
  "senales_manipulacion": ["guiado_por_telefono", "urgencia"],
  "canal_usado": "app",
  "evidencia": ["E-04", "E-05"]
}
```

`estado_usuario ∈ { confirmado_seguro, manipulacion_probable, sin_respuesta, canal_comprometido, no_consultado }`

### 🔍 Detective — frente cuenta destino (B1)

| | |
|---|---|
| **Pain point** | Reconstrucción manual del caso (FM13), patrones de lavado, confusión mula vs negocio (FM15) |
| **Modelo** | Rápido / económico (interpreta resultados ya calculados) |
| **Tools** | `perfil_cuenta`, `fan_in`, `reenvio_rapido`, `estructuracion`, `ciclos`, `listas_riesgo` |
| **Límite** | Máx. 6 llamadas a tools; puede seguir la cadena hasta 2 saltos (M-01 → M-02 → M-03) |

Por qué es agente y no solo reglas: decide **qué tool llamar después** (si está en lista, para; si hay reenvío, sigue la cadena; si hay fan-in sin reenvío, verifica si parece comercio) y explica la combinación.

Tipologías marcadas por las tools (deterministas):

| Tipología | Condición (configurable) |
|---|---|
| `fan_in` | ≥ 5 remitentes nuevos en 48h |
| `reenvio_rapido` | ≥ 70% de lo recibido sale en < 2h |
| `estructuracion` | ≥ 3 operaciones entre 90% y 100% de `UMBRAL_REPORTE` *(valor real a verificar en normativa)* |
| `circular` | ciclo de profundidad ≤ 3 que vuelve al origen |
| `en_lista` | coincidencia en lista de riesgo o Memoria |

> **Mula probable = `fan_in` + `reenvio_rapido`.** Fan-in solo no basta (la bodega también lo tiene).

```json
{
  "riesgo_destino": "alto",
  "tipologias": ["fan_in", "reenvio_rapido"],
  "hipotesis": "cuenta de paso (mula) en cadena de layering",
  "cadena": ["M-01", "M-02", "M-03"],
  "evidencia": ["E-07", "E-08", "E-09"]
}
```

**Consistencia:** si el agente dice `alto` pero ninguna tool marcó tipología, el sistema lo baja a `medio` y lo marca para revisión.

### 📋 Auditor

| | |
|---|---|
| **Pain point** | Falta de trazabilidad y consistencia, riesgo regulatorio (B1, `05` compliance), alucinaciones (R9) |
| **Modelo** | Más capaz (solo corre en casos pausados/escalados y alertas AML) |
| **Tools** | `leer_caso` (todas las evidencias del caso) |
| **Límite** | 1 llamada + 1 reintento |

```json
{
  "resumen": "Transferencia de S/4,800 guiada por llamada hacia cuenta con patrón de mula.",
  "hipotesis": "estafa_vishing + mula",
  "recomendacion": "escalar",
  "afirmaciones": [
    {"texto": "La cuenta recibió de 14 remitentes nuevos en 48h", "evidencia": ["E-07"]},
    {"texto": "Reenvió el 91% de lo recibido en menos de 2h", "evidencia": ["E-08"]},
    {"texto": "La clienta indicó que la estaban guiando por teléfono", "evidencia": ["E-04"]}
  ],
  "acciones_sugeridas": ["confirmar mula", "preparar borrador de ROS"],
  "confianza": "alta",
  "requiere_revision_manual": false
}
```

**Validación:** toda afirmación debe citar ≥ 1 id de evidencia existente en el caso. Si no → reintento → `requiere_revision_manual: true`.

---

## 4. Policy Engine (determinista)

Se evalúa en orden; **la primera regla que aplica gana**.

| # | Condición | Decisión |
|:-:|---|---|
| P1 | Destino en Memoria = mula confirmada | **PAUSAR + ESCALAR** (0 IA) |
| P2 | Beneficiario habitual / recurrente y sin señales de compromiso | **PERMITIR** |
| P3 | Score 0–2 | **PERMITIR** |
| P4 | Detective `alto` y Guardián ∈ {manipulación, sin respuesta, canal comprometido} | **PAUSAR + ESCALAR** |
| P5 | Detective `alto` y Guardián `confirmado_seguro` | **PAUSAR + ESCALAR** (posible coerción, R7) |
| P6 | Guardián `manipulacion_probable` (destino bajo/medio) | **VERIFICAR**: cooldown + verificación fuera del canal |
| P7 | Guardián ∈ {sin respuesta, canal comprometido} (destino bajo/medio) | **PAUSAR** hasta verificación por canal seguro |
| P8 | Detective `bajo` y Guardián ∈ {confirmado_seguro, no_consultado} | **PERMITIR** |
| P9 | Detective `medio` y Guardián ∈ {confirmado_seguro, no_consultado} | **VERIFICAR** (cooldown corto) |
| P10 | Error / timeout / presupuesto excedido | score ≥ 5 → **PAUSAR + revisión humana**; si no → **VERIFICAR** |

Cada decisión guarda la regla aplicada (`P1`…`P10`) → explicable y auditable.

---

## 5. 🧠 Memoria de riesgo

```json
{
  "cuenta": "M-01",
  "veredicto": "mula_confirmada",
  "validado_por": "analista_01",
  "fecha": "2026-10-17",
  "expira": "2027-01-15",
  "expediente": "CASO-0001",
  "apelacion_abierta": false
}
```

- Solo entra lo **validado por un humano** (R10).
- Expira (90 días por defecto) y admite revisión.
- Efecto: pausar transferencias **nuevas** hacia esa cuenta para verificación; no confiscar.
- Es el puente fraude ↔ AML y la principal fuente de ahorro de IA.

---

## 6. Objeto Caso (compartido por todos)

```json
{
  "id": "CASO-0001",
  "puerta": "transferencia",
  "transaccion": {"origen": "rosa", "destino": "M-01", "monto": 4800, "moneda": "PEN"},
  "nivel0": {"senales": ["beneficiario_nuevo", "monto_atipico", "llamada_activa"], "score": 7},
  "evidencia": [{"id": "E-07", "fuente": "fan_in", "dato": {"remitentes_nuevos": 14, "horas": 48}}],
  "salidas": {"coordinador": {}, "guardian": {}, "detective": {}, "auditor": {}},
  "decision": {"accion": "PAUSAR", "regla": "P4", "t": "..."},
  "timeline": [],
  "ia": {"llamadas": 6, "tokens": 0, "costo_estimado": 0}
}
```

La consola del analista y el panel del cliente son **vistas de este mismo objeto**.

---

## 7. Optimización de recursos

| Técnica | Efecto |
|---|---|
| **Embudo** | Reglas resuelven la mayoría; IA solo en sospechosas (H10) |
| **Memoria primero** | Casos repetidos = 0 llamadas |
| **Salida temprana del Coordinador** | No se llama a especialistas innecesarios |
| **Modelo por tarea** | Barato para coordinar/conversar/interpretar; capaz solo para el expediente |
| **Paralelismo** | Guardián ∥ Detective → menor latencia |
| **Tools calculan, LLM interpreta** | El agente recibe resúmenes, no miles de filas → menos tokens |
| **Presupuesto por caso** | Máx. 10 llamadas y timeout → nunca se dispara el costo (R13) |
| **Expediente asíncrono** | La protección no espera al modelo más lento |

### Llamadas de IA esperadas por escenario (estimado de diseño, a medir)

| Escenario | Coordinador | Guardián | Detective | Auditor | Total |
|---|:-:|:-:|:-:|:-:|:-:|
| Transferencia normal | 0 | 0 | 0 | 0 | **0** |
| Rosa (estafa + mula nueva) | 1 | 2–3 | 1–2 | 1 | **5–7** |
| Jorge (mula en Memoria) | 0 | 0 | 0 | 0 | **0** |
| Pago a bodega (falso positivo evitado) | 1 | 0 | 1 | 0 | **2** |
| Alerta AML (Puerta B) | 1 | 0 | 1–2 | 1 | **3–4** |

---

## 8. Recorrido por acto del demo

| Acto | Puerta | Ruta | Regla | Resultado |
|---|---|---|---|---|
| 1 — Rosa | A | Reglas (7) → pausa preventiva → Coordinador → Guardián ∥ Detective | P4 | PAUSAR + ESCALAR |
| 2 — Mula | — | Auditor → expediente → analista confirma | — | M-01 entra a Memoria |
| 3 — Jorge | A | Memoria hit | P1 | PAUSAR, 0 IA |
| Extra — Lucía | A | Reglas (6) → pausa preventiva → Guardián: sin respuesta + canal comprometido | P7 | Ataque pausado; hotel (P2) pasa |
| Control — Bodega | A | Reglas (4) → Coordinador → solo Detective: fan-in sin reenvío | P8 | PERMITIR |

---

## 9. Observabilidad

Cada llamada registra: agente, modelo, tools usadas, tokens, latencia, salida validada / rechazada, regla final aplicada. Esto alimenta:
- el **embudo** y el **contador de IA** visibles en el demo;
- los experimentos E5, E6, E7 (`14`);
- la auditoría del caso.

---

## 10. Límite conocido: mula en otro banco

En el demo, la mula M-01 está en **el mismo banco**, así que el Detective ve todo su historial. En la realidad, si la cuenta destino está en **otra entidad**, el banco no ve a dónde reenvía el dinero.

Lo que sí ve: **qué le envían sus propios clientes**. Esa señal sola ya es fuerte.

```mermaid
flowchart TD
    T["Transferencia a cuenta destino"] --> Q{"¿La cuenta destino es<br/>de nuestro banco?"}
    Q -->|sí| FULL["🔍 Detective completo<br/>fan-in · reenvío rápido · cadena · ciclos"]
    Q -->|no| PART["🔍 Detective parcial<br/>solo lo que NUESTROS clientes le envían"]
    FULL --> P["Policy normal (P1–P10)"]
    PART --> S["Tipología fan_in_interno:<br/>≥ 3 clientes nuestros le transfieren<br/>por primera vez en 48h"]
    S --> P
    P --> AN["👤 Analista puede confirmarla"]
    AN --> MEM[("🧠 Memoria: mismo efecto P1")]
    MEM -.->|a futuro| S8["S8: compartir señales<br/>entre bancos"]
```

| | Cuenta destino interna | Cuenta destino externa |
|---|---|---|
| Fan-in | todos los remitentes | solo remitentes que son clientes nuestros (`fan_in_interno`) |
| Reenvío rápido / cadena / ciclos | ✔ | ✖ no visible |
| Riesgo máximo sin Guardián | `alto` | `medio` (`alto` si se combina con manipulación del Guardián) |
| Memoria | ✔ | ✔ con validación del analista |

**Respuesta para el jurado:** el demo muestra el caso completo (mula interna). Para mulas externas, el sistema funciona con lo que el banco sí ve y escala con S8 (señales compartidas entre bancos) a futuro.

---

## 11. Pendientes

- Elegir stack y proveedor de LLM (un solo proyecto con frontend + API).
- Definir `UMBRAL_REPORTE` y validar umbrales de tipologías con datos sintéticos.
- Decidir si se usa una muestra de SAML-D o solo datos semilla propios.
- Confirmar con reglas del hackathon la inscripción Track 04 + uso de B1.
