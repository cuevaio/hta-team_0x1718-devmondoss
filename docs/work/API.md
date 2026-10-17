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
  "datos": {
    "cuentas": 46, "clientes": 3, "movimientos": 200,
    "nota": "DATOS 100% SINTÉTICOS, generados por scripts/seed.ts..."
  }
}
```

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

El cliente responde a una pregunta del Guardián.

```json
{ "texto": "sí" }
```

El texto se guarda en el `timeline` como **dato, nunca como instrucción** para
un modelo (doc 15, R5). `404` si el caso no existe.

**Detalle que importa para la UI:** la clasificación rápida determinista solo
cubre respuestas de **hasta 4 palabras** (`sí`, `no`, `claro`, `para nada`…).
Una frase más larga queda sin clasificar y la resuelve el modelo; mientras el
runtime de IA no esté conectado, cae al lado conservador (`sin_respuesta`), que
**no libera dinero**. Si el panel ofrece botones de respuesta corta en vez de
texto libre, el resultado es más predecible para el demo.

---

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

**Errores:** `400` si falta `validado_por`; `404` si el caso no existe.

Después de esto, una transferencia nueva al mismo destino se pausa por **P1 con
0 llamadas de IA** (CU-03). Es el momento más fuerte del demo: conviene que la
UI lo muestre explícitamente.

---

## 8. `GET /api/stats`

Embudo y consumo de IA, para el panel de métricas.

```json
{
  "transacciones_evaluadas": 5,
  "sospechosas": 5,
  "con_llamadas_de_ia": 0,
  "llamadas_de_ia_totales": 0,
  "costo_estimado_total": 0,
  "por_regla": { "P4": 1, "P5": 2, "P1": 1, "P8": 1 },
  "mulas_en_memoria": 1,
  "nota_datos": "DATOS 100% SINTÉTICOS..."
}
```

`sospechosas` cuenta los casos con `score >= 3`. `por_regla` sirve directo para
un gráfico de barras de decisiones.

---

## 9. `POST /api/demo/reset`

Vacía casos y Memoria para repetir el demo desde cero. Sin cuerpo.

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
npm test             # 182 tests
npm run typecheck
```

El script `npm run demo` recorre CU-01 a CU-05 e imprime decisión, regla,
evidencia y consumo de IA de cada caso. Es la forma más rápida de ver qué debe
devolver la API antes de escribir la UI.
