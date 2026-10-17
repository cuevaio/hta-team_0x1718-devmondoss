# API HTTP — contrato para la Fase 2 (frontend)

> Backend de Ale_dev. Esta es la superficie que consumirá la pantalla de dos
> paneles de la [Fase 2](00_WORK_BLUEPRINT.md#7-fase-2--frontend-por-asignar).
>
> Todos los ejemplos de esta página son **respuestas reales** capturadas del
> servidor, no inventadas. Los datos son sintéticos (ver `/api/health`).

**Base local:** `http://localhost:3000`
**Formato:** JSON en cuerpo y respuesta. Sin autenticación en el MVP.

---

## 1. El objeto que importa: `Caso`

Casi todos los endpoints devuelven un `Caso`. **La consola del analista y el
panel del cliente son dos vistas de este mismo objeto** (doc 19 §6), así que el
frontend no necesita nada más para pintar ambos paneles.

```ts
interface Caso {
  id: string;                   // 'CASO-0001'
  puerta: 'transferencia' | 'alerta_aml';
  transaccion: { origen, destino, monto, moneda: 'PEN' };
  nivel0: { senales: string[]; score: number; atajo?: 'P1' | 'P2' };
  evidencia: Array<{ id: string; fuente: string; dato: unknown }>;
  salidas: { coordinador?; guardian?; detective?; auditor? };
  decision?: { accion: Decision; regla: 'P1'..'P10'; t: string };
  timeline: Array<{ t: string; actor: string; evento: string; detalle?: unknown }>;
  ia: { llamadas: number; tokens: number; costo_estimado: number };
}
```

`decision.accion` es uno de:

| Acción | Significado para el frontend |
|---|---|
| `PERMITIR` | el dinero sale; no hay nada que mostrar al cliente |
| `VERIFICAR` | cooldown + verificación: pedir confirmación por canal seguro |
| `PAUSAR` | el dinero queda retenido hasta verificación |
| `ESCALAR` | retenido **y** en cola del analista |

**Qué pintar con qué:**

- 📱 **panel del cliente** → `transaccion`, `decision.accion`, y los mensajes
  del Guardián (ver §5);
- 🖥️ **consola del analista** → `timeline` (en vivo), `salidas.auditor`
  (expediente con citas), `evidencia` (el detalle de cada cita), `decision.regla`;
- 📊 **embudo y contador de IA** → `ia` por caso, y `/api/stats` para el total.

### `timeline` — el orden es significativo

Secuencia real de un caso de CU-01:

```
caso_creado → nivel0_evaluado → pausa_preventiva → plan
→ estado_usuario → riesgo_destino → expediente → decision
```

`pausa_preventiva` aparece **antes** de `plan`: el dinero se retiene antes de
consultar a cualquier agente, así la latencia del modelo no expone fondos
(TTPA ≈ 0). Si el frontend quiere mostrar "tu dinero ya está protegido", ese
es el evento que lo habilita, no `decision`.

### `evidencia` — cada cita del expediente se puede abrir

Las `fuente` posibles son las de AGENT_PLAYBOOKS §6: `perfil_cuenta`,
`fan_in`, `reenvio_rapido`, `estructuracion`, `ciclos`, `listas_riesgo`,
`guardian_respuesta`.

```json
{
  "id": "E-01",
  "fuente": "perfil_cuenta",
  "dato": { "cuenta": "M-01", "banco_propio": true, "antiguedad_dias": 8, "tipo": "desconocido" }
}
```

Cada afirmación del Auditor cita uno o más de estos ids. **Los ids los emite el
sistema, nunca el modelo**, así que una cita a un id inexistente sería una
alucinación detectada — por eso vale hacerlas clickeables.

---

## 2. `GET /api/health`

Salud del servicio y confirmación de que los datos son simulados.

```json
{
  "ok": true,
  "servicio": "adaptive-financial-security",
  "t": "2026-10-17T22:19:38.431Z",
  "agentes": "simulado",
  "datos": {
    "cuentas": 46, "clientes": 3, "movimientos": 200,
    "nota": "DATOS 100% SINTÉTICOS, generados por scripts/seed.ts..."
  }
}
```

`agentes` es `"claude"` si hay `ANTHROPIC_API_KEY` real, o `"simulado"` si
corre el LLM determinista. En modo simulado el contador de IA **sí** cuenta las
llamadas que gastaría con el modelo real, así el embudo es honesto en ambos
modos.

> Conviene mostrar `datos.nota` en algún lugar visible de la UI. Es un requisito
> del Definition of Done: todo dato marcado como simulado.

---

## 3. `POST /api/transfers` — Puerta A

Evalúa una transferencia y devuelve el `Caso` completo. **`201 Created`.**

```json
{
  "transaccion": { "origen": "C-ROSA", "destino": "M-01", "monto": 4800, "moneda": "PEN" },
  "contexto": {
    "dispositivo_nuevo_24h": false,
    "cambio_sim_o_clave_72h": false,
    "llamada_activa_o_acceso_remoto": true,
    "horario_atipico": false
  },
  "respuestaCliente": "sí"
}
```

`contexto` son señales que **reporta el canal del banco**, no inferencias sobre
la persona. Todas opcionales; lo que no se envía se deriva de los datos
(beneficiario nuevo, monto vs. promedio de 90 días).

`respuestaCliente` es opcional y existe para guionar el demo. En un flujo real,
la respuesta llega por `/api/cases/[id]/guardian/reply`.

**Respuesta (recortada), caso de Rosa:**

```json
{
  "id": "CASO-0001",
  "puerta": "transferencia",
  "nivel0": {
    "senales": ["beneficiario_nuevo", "monto_atipico", "llamada_activa"],
    "score": 7
  },
  "salidas": {
    "detective": {
      "riesgo_destino": "alto",
      "tipologias": ["fan_in", "reenvio_rapido", "estructuracion"],
      "hipotesis": "cuenta de paso (mula) en cadena de layering",
      "cadena": ["M-01", "M-02", "M-03"],
      "evidencia": ["E-01", "E-02", "E-03", "E-04"]
    },
    "guardian": {
      "estado_usuario": "manipulacion_probable",
      "senales_manipulacion": ["guiado_por_telefono"],
      "canal_usado": "app",
      "evidencia": ["E-05"]
    }
  },
  "decision": { "accion": "ESCALAR", "regla": "P4", "t": "..." },
  "ia": { "llamadas": 0, "tokens": 0, "costo_estimado": 0 }
}
```

**Errores:** `400` con `{ error, detalle }` si el cuerpo no valida.

---

## 4. `POST /api/alerts` — Puerta B (AML)

Una alerta sobre una cuenta, sin cliente al otro lado. **No pasa por el
Guardián** y produce expediente igual. **`201 Created`.**

```json
{ "cuenta": "M-01", "motivo": "fan-in con reenvío inmediato" }
```

En la respuesta, `puerta` es `"alerta_aml"` y `salidas.guardian` viene
`undefined`. La regla aplicada suele ser **P5**: con destino de riesgo alto y
sin cliente a quien preguntar, se escala.

**Errores:** `400` si `cuenta` falta, está vacía o es solo espacios; `404` si
la cuenta no existe en los datos. La alerta viene del monitoreo del propio
banco sobre sus cuentas: una cuenta desconocida es una entrada inválida, no un
caso (antes se abría el caso y la falta de datos terminaba en PERMITIR).

---

## 5. `GET /api/cases/[id]`

Estado del caso. **Es el endpoint de polling** (blueprint §2: cada 1 s).

Devuelve el mismo `Caso`. `404` si no existe.

```bash
curl localhost:3000/api/cases/CASO-0001
```

> Para el timeline en vivo, basta comparar `timeline.length` entre respuestas.
> No hay SSE ni websockets en el MVP, a propósito.

---

## 6. `POST /api/cases/[id]/guardian/reply`

El cliente responde al Guardián. **Devuelve el `Caso` actualizado**, con la
decisión recalculada si la conversación cerró.

```json
{ "texto": "sí" }
```

`texto: ""` significa **el cliente no respondió a tiempo**. El texto se trata
como dato, nunca como instrucción para un modelo (doc 15, R5).

### El Guardián es multiturno

`POST /api/transfers` abre la conversación y **deja la pregunta pendiente**: no
responde por el cliente. El flujo es:

```
POST /api/transfers
  → timeline: evento `pregunta` con el texto a mostrar
  → salidas.guardian ausente
  → decision: ESCALAR / P5   ← el dinero YA está retenido

POST /api/cases/[id]/guardian/reply  { "texto": "sí" }
  → salidas.guardian: { estado_usuario: "manipulacion_probable",
                        senales_manipulacion: ["guiado_por_telefono"] }
  → decision: ESCALAR / P4   ← decisión refinada
```

**Lo que importa para la UI:** la protección no espera la respuesta. Ya en la
primera llamada el caso está escalado por P5; la respuesta del cliente solo
precisa el diagnóstico. Si el panel muestra «tu dinero está protegido», puede
hacerlo desde el evento `pausa_preventiva`, sin esperar nada.

El guion tiene **máximo 3 preguntas**. Si el cliente calla las tres veces, la
conversación cierra en `sin_respuesta` y la decisión pasa a P4 — el silencio no
libera dinero, y llamar de nuevo no cambia el resultado:

| Llamada | `salidas.guardian` | `decision` |
|:-:|---|---|
| 1 con `""` | pendiente, nueva pregunta | ESCALAR / P5 |
| 2 con `""` | pendiente, nueva pregunta | ESCALAR / P5 |
| 3 con `""` | `sin_respuesta` | ESCALAR / **P4** |
| 4 con `""` | `sin_respuesta` | ESCALAR / P4 |

Para pintar el chat, los eventos `pregunta` del `timeline` traen cada texto en
`detalle.mensaje`, y las respuestas quedan como evidencia con fuente
`guardian_respuesta`.

**Clasificación:** las respuestas de hasta 4 palabras (`sí`, `no`, `claro`,
`para nada`…) las resuelve una tabla determinista; las frases más largas las
clasifica el modelo. Botones de respuesta corta hacen el demo más predecible,
pero el texto libre también funciona.

**Errores:** `400` si falta `texto`; `404` si el caso no existe.

## 7. `POST /api/cases/[id]/verdict`

El analista confirma o descarta. **Es el único camino hacia la Memoria.**

```json
{ "veredicto": "mula_confirmada", "validado_por": "analista_01" }
```

`veredicto` ∈ `mula_confirmada` | `descartada`. `validado_por` es
**obligatorio y no vacío**: sin un humano, nada entra a la Memoria (doc 15, R10).

```json
{
  "caso": "CASO-0003",
  "veredicto": {
    "cuenta": "M-01", "veredicto": "mula_confirmada",
    "validado_por": "analista_01",
    "fecha": "2026-10-17", "expira": "2027-01-15",
    "expediente": "CASO-0003", "apelacion_abierta": false
  }
}
```

**Errores:** `400` si falta `validado_por` o es solo espacios (no identifica a
ningún humano, R10), o si la Memoria rechaza el veredicto; `404` si el caso no
existe. En todos los `400`, nada entra a la Memoria.

Después de esto, una transferencia nueva al mismo destino se pausa por **P1 con
0 llamadas de IA** (CU-03). Es el momento más fuerte del demo: conviene que la
UI lo muestre explícitamente.

---

## 8. `GET /api/stats`

Embudo, consumo de IA y métricas del doc 14, para el panel de métricas.
Respuesta real tras la secuencia del demo (en modo simulado; los `ms` varían):

```json
{
  "transacciones_evaluadas": 6,
  "sospechosas": 5,
  "con_llamadas_de_ia": 4,
  "llamadas_de_ia_totales": 5,
  "costo_estimado_total": 0,
  "por_regla": { "P4": 1, "P5": 1, "P1": 1, "P8": 1, "P7": 1, "P2": 1 },
  "mulas_en_memoria": 1,
  "nota_datos": "DATOS 100% SINTÉTICOS...",
  "metricas": {
    "eficiencia_ia": {
      "pct_transacciones_con_ia": 0.667,
      "llamadas_por_caso_con_ia": 1.25,
      "tokens_totales": 0,
      "casos_resueltos_sin_ia": 2,
      "resueltos_por_memoria": 1,
      "hit_rate_memoria": 0.167,
      "llamadas_evitadas_por_memoria": {
        "estimado": 1.5,
        "casos_p1": 1,
        "casos_p1_con_base": 1,
        "base": "por cada caso P1: promedio de llamadas de IA de los casos previos al mismo destino"
      }
    },
    "modo_seguro": { "casos_con_falla_de_agente": 0, "decididos_por_p10": 0, "tasa_modo_seguro": 0 },
    "friccion": {
      "permitidos": 2, "retenidos": 4, "tasa_de_retencion": 0.667,
      "por_accion": { "ESCALAR": 3, "PERMITIR": 2, "PAUSAR": 1 },
      "preguntas_al_cliente": 1
    },
    "trazabilidad": {
      "expedientes": 3, "expedientes_con_evidencia_completa": 3,
      "afirmaciones": 12, "afirmaciones_con_cita_valida": 12,
      "pct_afirmaciones_citadas": 1, "citas_inexistentes": 0
    },
    "ttpa": {
      "con_pausa_preventiva": { "casos": 3, "p50_ms": 0, "max_ms": 2 },
      "sin_pausa_preventiva": { "casos": 1, "p50_ms": 0, "max_ms": 0 },
      "nota": "ms del proceso que corrió; en modo simulado no incluye la latencia de un modelo real"
    }
  },
  "registro_reciente": [
    { "tipo": "agente", "t": "...", "caso": "CASO-0001", "agente": "detective",
      "llamadas": 0, "tokens": 0, "ms": 0, "resultado": "ok" },
    { "tipo": "decision", "t": "...", "caso": "CASO-0001", "regla": "P4",
      "accion": "ESCALAR", "degradado": false, "llamadas_ia_del_caso": 2 }
  ]
}
```

Las claves de primer nivel de antes no cambiaron; `metricas` y
`registro_reciente` son nuevas (`lib/observability/`).

**Cómo leer las métricas** (para no mostrar un número engañoso):

| Campo | Qué es | Cuidado |
|---|---|---|
| `null` en cualquier cociente | no hay casos para medirlo | no es 0: mostrar «—» |
| `pct_transacciones_con_ia` | casos que gastaron IA / total | los 6 casos del demo se eligieron por ser sospechosos: **no** es el % de una población real |
| `llamadas_evitadas_por_memoria` | **estimación** E6: por cada P1, lo que costó investigar ese mismo destino antes | mostrar siempre con la palabra «estimado»; `null` si no hubo investigación previa comparable |
| `trazabilidad.citas_inexistentes` | citas a un `E-xx` que no existe en el caso | es la alucinación detectable; debería ser 0 |
| `ttpa.con_pausa_preventiva` | ms entre que llega la transacción y la pausa | mide esta capa, no la latencia de un LLM real |
| `friccion.tasa_de_retencion` | decisiones que retienen dinero | **no** es tasa de falsos positivos: el caso no sabe si era fraude de verdad. Esa cifra sale de los evals (E7) |

**`registro_reciente`** son las últimas 20 entradas del registro del doc 19
§9: una por agente que corrió (llamadas, tokens, latencia, `ok`/`error`) y una
por decisión. **No contiene texto del cliente** ni atributos de la persona: los
campos son una lista cerrada y un test lo verifica.

---

## 9. `POST /api/demo/reset`

Vacía casos, Memoria y registro para repetir el demo desde cero. Sin cuerpo.

```json
{ "ok": true, "reiniciado": true }
```

---

## 10. Notas de estado para el frontend

**El estado vive en memoria del proceso.** No hay base de datos (blueprint §2),
así que un reinicio del servidor borra casos y Memoria. En Vercel, además, cada
instancia tiene su propio estado: el demo debe correrse como una secuencia
continua contra la misma instancia, no en pestañas independientes.

**Los ids son secuenciales por proceso** (`CASO-0001`, `CASO-0002`…). No
asumir que un id sobrevive un reinicio.

**Toda decisión trae su regla.** Nunca mostrar una acción sin su `regla`: la
explicabilidad es un criterio de aceptación de los tres casos de uso *must*.

---

## 11. Verificación rápida

```bash
npm run dev          # servidor en :3000
npm run demo         # los 5 casos de uso en consola, con sus reglas
npm test             # 271 tests
npm run typecheck
```

El script `npm run demo` recorre CU-01 a CU-05 e imprime decisión, regla,
evidencia y consumo de IA de cada caso. Es la forma más rápida de ver qué debe
devolver la API antes de escribir la UI.
