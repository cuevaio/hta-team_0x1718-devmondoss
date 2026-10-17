# Adaptive Financial Security

> **Si alguien intenta estafarte, pausamos el pago, investigamos la cuenta que
> iba a recibir tu dinero y, si es una mula, la próxima víctima ya está
> protegida.**

Capa de protección multiagente que se inserta entre el risk engine de un banco
y la ejecución del pago, y sobre la cola de alertas AML.

Hackathon · Track 04 (seguridad: estafa, extorsión, suplantación) + reto B1
(investigación de alertas AML).

---

## ⚠️ Todos los datos son sintéticos

`lib/data/seed.json` lo genera `scripts/seed.ts` con un PRNG determinista
(semilla 1718). **No corresponde a ninguna persona, cuenta ni institución
real.** Ningún registro contiene atributos demográficos, de salud ni
socioeconómicos — ver *Sobre los sesgos* más abajo.

No hay core bancario, ni modelo de ML entrenado, ni KYC, ni red interbancaria.
Las cifras del demo son de una simulación, no de producción.

---

## Correrlo

Node 20+.

```bash
npm install
cp .env.example .env.local      # opcional: solo si vas a conectar el LLM
npm run demo                    # ← empieza por aquí
```

`npm run demo` recorre los 5 casos de uso en consola y muestra, por cada uno,
la decisión, la regla aplicada, la evidencia citada y el consumo de IA. Es la
forma más rápida de ver qué hace el sistema.

```bash
npm run dev        # servidor en http://localhost:3000
npm test           # 227 tests
npm run typecheck
npm run seed       # regenera lib/data/seed.json (determinista)
```

Hoy el proyecto es **solo backend**: route handlers de Next.js. El frontend es
la Fase 2 y consumirá la API documentada en [docs/work/API.md](docs/work/API.md).

---

## Qué hace, en concreto

```
Transferencia ──► Reglas nivel 0 (sin IA)
                      │ score ≥ 5
                      ▼
                 PAUSA PREVENTIVA  ← el dinero se retiene ANTES de llamar a
                      │              cualquier agente (TTPA ≈ 0)
                      ▼
                 🧠 Memoria ──► mula conocida → P1, 0 llamadas de IA
                      │
                      ▼
                 🧭 Coordinador ──► decide qué especialistas hacen falta
                      │
            ┌─────────┴─────────┐
            ▼                   ▼
      🛡️ Guardián          🔍 Detective
      lado cliente         cuenta destino
            └─────────┬─────────┘
                      ▼
            Policy Engine determinista
            PERMITIR / VERIFICAR / PAUSAR / ESCALAR
                      │
                      ▼
            📋 Auditor ──► expediente con evidencia citada
                      │
                      ▼
            👤 Analista confirma ──► 🧠 Memoria
```

Tres principios que explican el diseño:

**El LLM razona; no decide sobre el dinero.** El Policy Engine es determinista
(P1–P10, la primera regla que aplica gana) y toda decisión guarda su regla, así
es explicable y auditable.

**Las tools calculan; los agentes interpretan.** Los hechos del expediente
(«14 remitentes nuevos en 48h», «91% reenviado en menos de 2h») los calculan
funciones deterministas en `lib/analytics/`. El modelo nunca produce una cifra.

**Los ids de evidencia los emite el sistema.** `lib/evidence/ledger.ts` asigna
`E-01`, `E-02`… y cada afirmación del expediente debe citar uno que exista. Una
cita a un id inexistente es una alucinación detectable, no un texto plausible.

---

## Los 5 casos de uso

Salida real de `npm run demo`:

| Caso | Escenario | Resultado | Regla | IA |
|---|---|---|:-:|:-:|
| **CU-01** | Rosa transfiere S/4,800 guiada por una llamada del «banco» | ESCALAR | P4 | 3 |
| **CU-02** | Alerta AML sobre la cuenta destino → expediente para el analista | ESCALAR | P5 | 1 |
| **CU-03** | Jorge transfiere a la misma mula, ya confirmada | ESCALAR | **P1** | **0** |
| **CU-05** | Primer pago grande a Bodega Don Pepe (negocio legítimo) | PERMITIR | P8 | 1 |
| **CU-04** | Atacante desde dispositivo nuevo; Lucía viaja sin señal | PAUSAR | P7 | 0 |
| | …y su pago recurrente al hotel sigue pasando | PERMITIR | P2 | 0 |

**CU-05 es el control de falsos positivos y el caso más instructivo.** La
bodega legítima tiene *fan-in* igual que la mula: recibe de muchas personas
distintas. Si la decisión dependiera de esa señal, bloquearíamos al comercio.
Lo único que las separa es que la mula **reenvía el 91% en menos de 2 horas** y
la bodega **no reenvía nada**. Por eso `esMulaProbable()` exige el par
`fan_in + reenvio_rapido`: fan-in solo no basta.

**CU-03 es el diferencial.** Lo que aprendió el caso de Rosa protege a Jorge
sin investigar de nuevo y sin gastar una sola llamada de modelo.

> **5 llamadas de IA en total**, y Jorge cuesta 0: ese es el ahorro que produce
> la Memoria. Sin `ANTHROPIC_API_KEY` el runtime corre en modo simulado
> (determinista) y cuenta las llamadas que gastaría con el modelo real, así el
> embudo del demo es honesto en ambos modos.

---

## Estructura

```
app/api/**            8 route handlers (ver docs/work/API.md)
lib/
  contracts/          esquemas zod y firmas compartidas entre los dos devs
  data/               seed.json determinista + repositorio
  rules/level0.ts     6 señales, puntajes del doc 19 §2
  policy/engine.ts    P1–P10, determinista
  memory/store.ts     veredictos validados por un humano, expiran a 90 días
  evidence/ledger.ts  ids E-xx emitidos por el sistema
  analytics/          fan-in, reenvío rápido, estructuración, ciclos, canales…
  cases/store.ts      objeto Caso + timeline + contador de IA
  pipeline.ts         orquestación
  agents/             agentes con LLM (Tony_dev)
scripts/
  seed.ts             genera los datos
  demo.ts             los 5 casos de uso en consola
tests/                227 tests
```

---

## Sobre los sesgos

Un sistema antifraude que puntúa a las personas por lo que *son*, en vez de por
lo que ocurre en la operación, discrimina. Es el error fácil de cometer cuando
se agregan señales «porque mejoran el score».

Las 6 señales del nivel 0 son todas propiedades de la **operación**:
beneficiario nuevo, monto atípico, dispositivo nuevo, cambio de SIM o clave,
llamada activa, horario atípico. Ninguna es un atributo de la persona.

`tests/rules/sin-sesgo.test.ts` lo hace cumplir y **falla** si alguien
introduce un atributo demográfico, de salud o socioeconómico en el modelo, en
los datos semilla o en el motor de reglas.

Donde el sistema sí modela algo del cliente —si puede responder ahora, por qué
canal— describe la **situación**, no a la persona: «app comprometida», «no
alcanzable». Nunca un diagnóstico inferido. Adaptar el canal, no penalizar la
identidad.

---

## Documentación

| Documento | Para qué |
|---|---|
| [docs/CASOS_DE_USO.md](docs/CASOS_DE_USO.md) | problema, actores y los 5 casos con sus criterios de aceptación |
| [docs/SOLUCION.md](docs/SOLUCION.md) | resumen visual de la solución |
| [docs/work/00_WORK_BLUEPRINT.md](docs/work/00_WORK_BLUEPRINT.md) | división del trabajo y contratos entre devs |
| [docs/work/API.md](docs/work/API.md) | **la API HTTP, para la Fase 2** |
| [docs/context/tony_dev/adaptive_financial_security_docs/](docs/context/tony_dev/adaptive_financial_security_docs/) | investigación: tesis, problema, diseño multiagente |

---

## Estado

**Backend completo y verificado**: datos, reglas, policy, memoria, ledger de
evidencia, analytics, pipeline, las 8 rutas y el script de demo. 227 tests,
typecheck y lint limpios, `next build` correcto.

**Agentes integrados**: el pipeline usa el orquestador de `lib/agents`
(Tony_dev). `npm run demo` da 8/8 con los agentes reales en modo simulado.

**Pendiente**: probar contra la API real de Claude (falta una
`ANTHROPIC_API_KEY`), el deploy público y el frontend de la Fase 2.
