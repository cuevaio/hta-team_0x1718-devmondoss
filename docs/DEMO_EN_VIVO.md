# Demo en vivo: que la gente ataque y el sistema resista

> Para el equipo que presenta. Cómo se arma, qué se dice y qué hacer si algo falla. El detalle técnico está en [INFRA_Y_ORQUESTACION §6 y §8](context/tony_dev/INFRA_Y_ORQUESTACION.md) y en [DEMO_JUEGO](DEMO_JUEGO.md).

## La idea en una frase

**El público ataca al sistema desde su celular mientras lo proyectamos; después lo saturamos a propósito y se ve que igual frena los robos.**

## La presentación: slides → backend → juego

Son **tres pantallas en el proyector, en este orden**. Conviene abrirlas antes en tres pestañas.

| # | Pantalla | URL | Tiempo |
|---|---|---|---|
| 1 | **Slides** (portada, problema, solución) | `npm run pitch` → http://localhost:4000 | ~1:30 |
| 2 | **Backend en vivo**: la suite corre por el pipeline real y se ve qué hizo cada agente | En la Mac: `http://localhost:3200/demo` (en Railway, el mismo `/demo`). No pide token | ~2:00 |
| 3 | **Juego + monitor**: el público ataca | QR de la portada (`/play`) y `/monitor?token=TOKEN` | ~3:00 |
| 4 | **Slides**: la oportunidad (última diapositiva) | pestaña 1 | ~0:30 |

El token (`DEMO_TOKEN`) solo lo pide el monitor. `/demo` no lo necesita: la suite no deja rastro (repone la Memoria) y corre una sola vez a la vez.

### `/demo`: el backend en vivo (2 minutos)

Un solo botón: **▶ correr suite**. Son 11 pruebas (`lib/demo/suite.ts`, las mismas de `tests/scenarios`) contra el pipeline del servidor, con los agentes que tenga configurados. Cada prueba muestra:

- el **flujo**: Reglas → Pausa → Memoria → Red → Coordinador → Detective → Guardián → Policy → Auditor. Se encienden las etapas que actuaron, cada una con su dato en dos palabras («score 7», «riesgo alto», «manipulado»), y en rojo si fallaron;
- **el dinero** viaja por el flujo y se detiene donde lo retienen (en dorado) o llega al final («pagado»);
- la **decisión** grande, arriba a la derecha, y los **chequeos** como píldoras verdes;
- plegados: la traza, la evidencia de las tools y el expediente del Auditor con sus citas.
- la **terminal del backend**: el request, cada paso del pipeline con su tiempo real y las tools que corrió cada agente;
- el **narrador**: en los momentos clave el flujo se detiene con un diálogo hecho de los datos reales del caso. Muestra los documentos que juntó el Detective, el chat del Guardián con la respuesta del cliente, el expediente con sus citas y la decisión. Son 8 en toda la suite, cortos. Se cierra solo; **Mantener** lo deja abierto para explicar y **Continuar** (o Enter) sigue.

Duración de la suite (medida el 18/10/2026): ~1,3 min a 1× con «explicar», ~40 s a 2×.

| # | Prueba | Qué decir |
|---|---|---|
| 1 | Falso asesor del banco | «El dinero se retiene antes de la IA. La IA investiga después y el Auditor cita cada hecho» |
| 2 | Inyección de instrucciones | «El estafador intenta engañar al modelo. No importa: quien decide sobre el dinero es una Policy determinista» |
| 3 | El cliente no contesta | «El silencio no es aprobación» |
| 4–6 | Bodega, suplantación, hotel | «No bloqueamos todo: el pago legítimo pasa sin molestar al cliente» |
| 7–8 | Alerta AML → la siguiente víctima | «Un analista confirma la mula y Jorge queda protegido al instante, con 0 llamadas de IA» |
| 9 | Mula confirmada en otro país | «La red regional avisa antes de cualquier agente» |
| 10 | Se cae el modelo | «Falla segura: sin IA, el dinero no sale» |
| 11 | Matriz del atacante | «750 ataques combinados y 0 violaciones de los 5 invariantes» |

Tiempos medidos el 18/10/2026: con agentes simulados, ~16 s (el panel deja ver cada traza). Con Ollama qwen3.5:9b en la Mac, ~40 s, 11/11.

La suite **no le deja rastro al juego**: guarda la Memoria antes de empezar y la repone al terminar, así que M-01 no queda confirmada. Los 750 casos de la matriz no quedan en el monitor y no mueven dinero. Los casos de las otras 10 pruebas sí aparecen en el monitor, con alias «SUITE». Se corre una vez a la vez.

Después: «Ahora ustedes son la banda» → pestaña 3 y el guion de abajo desde el minuto 0:00.

> El juego del público está en Vercel (`te-estan-robando.vercel.app/play`, el QR de los slides) y `/demo` en Railway. Usan el mismo Supabase, así que el ranking y la encuesta son los mismos.

## Las 3 pantallas

| Pantalla | Dónde | Quién la mira |
|---|---|---|
| **Juego** `/play` | El celular de cada persona (QR) | El público |
| **Monitor** `/monitor?token=…` | Proyector | Todos; lo maneja el presentador |
| **Terminal** `npm run servidor` | La Mac, enchufada | Solo el técnico |

## Dos piezas separadas: el juego y el modelo

El juego no necesita la Mac; el modelo sí. Por eso se corren por separado:

```
Celulares y proyector ──► RAILWAY: juego, monitor, salas, datos (URL fija, siempre encendido)
                              │  solo cuando un agente tiene que razonar
                              ▼
               túnel ──► puente con clave (Mac) ──► Ollama (Mac)
```

1. **El juego** se despliega en Railway desde GitHub (cada merge a `main`).
2. **El modelo**, en la Mac:
   ```bash
   npm run puente-ollama
   ```
   El comando imprime 4 variables: `OLLAMA_URL`, `OLLAMA_TOKEN`, `OLLAMA_MODELO` y `OLLAMA_THINK`.
3. **Conectar:** pegar esas 4 variables en el servicio del juego en Railway (*Variables*). Railway se reinicia una vez, en 1–2 min, y el monitor pasa a decir «agentes con modelo local».
   - Si el proyecto de Railway es el de la cuenta de Tony (`te-estan-robando`), `npm run puente-ollama -- --railway` hace este paso solo y lo deshace al cerrar con Ctrl+C.
4. **Si la Mac se apaga o el túnel se cae:** el juego sigue funcionando. El cortacircuitos pasa a reglas + memoria y las decisiones son las mismas.

Ollama nunca queda abierto a internet. El puente solo deja pasar chat, carga y lista de modelos, y exige la clave.

⚠ **Conectar ANTES de presentar:** cambiar variables reinicia Railway, y se pierden las salas y casos en curso.

Medido el 18/10/2026 entre Railway (California) y la Mac (Lima): una respuesta libre del Guardián, razonada por el modelo de la Mac, tardó 6–10 s. Las respuestas con botones del juego no pasan por el modelo y son instantáneas.

**Un solo servidor de juego para el evento.** Si hay dos proyectos de Railway corriendo el juego, elijan uno solo para el QR: las salas EN VIVO existen únicamente en el servidor donde se crearon.

## Alternativa: todo en la Mac

## 30 minutos antes (si todo corre en la Mac)

1. Mac **enchufada** y en una red estable (Wi-Fi del evento o el hotspot de un celular).
2. Ollama abierto, con el modelo cargado: `ollama run qwen3.5:9b "hola"`.
3. Arrancar:
   ```bash
   npm run servidor -- --red --juego --persistir --tunel
   ```
   Esperar a que diga `✓ Servidor listo · agentes: ollama` y `✓ Ollama listo con qwen3.5:9b`.
4. Copiar la **URL pública** que imprime (`https://….trycloudflare.com`) y el **token**.
5. En el navegador del proyector abrir `URL/monitor?token=TOKEN`. El token se borra de la barra de direcciones al cargar.
6. Probar desde un celular **con datos móviles**, no por Wi-Fi: escanear el QR del monitor y que abra el juego.
7. **No cerrar la terminal:** si se cierra, la URL pública muere y cambia al volver a abrirla.

> Plan B siempre encendido: https://web-production-be4c9.up.railway.app (misma app, agentes simulados). Si la Mac falla, se sigue ahí sin perder el hilo.

## El guion (8–10 minutos)

| Min | Qué pasa | Qué se dice |
|---|---|---|
| 0:00 | Proyector en `/monitor`. Se pide al público que escanee el QR | «Saquen el celular: van a robar un banco» |
| 0:30 | Unos entran a **LA BANDA** (atacar) y otros a **¿REAL O ESTAFA?** | «Elijan: ser la víctima o ser la banda» |
| 1:30 | En el monitor se encienden los agentes con cada intento: Reglas → Pausa → Guardián / Detective → Policy → Auditor | «Miren: el dinero se pausa ANTES de la IA. La IA investiga después» |
| 3:00 | El presentador crea una sala **EN VIVO · LA BANDA** y proyecta su QR. **Toda la sala ataca la capa real durante 2:30**: cada golpe es un caso de verdad que aparece en el monitor con su alias. Un hueco vale 1000 puntos y el primero de la sala con esa táctica suma +500 | «Ahora ustedes son la banda: intenten robar» |
| 4:30 | En plena ola de golpes, el presentador **confirma la mula** en el expediente. Desde ahí, todos los golpes a esa cuenta caen por P1 con 0 IA, y se ve en el feed | «Lo aprendimos con uno: ya nadie le roba a esa cuenta» |
| 5:30 | (Opcional) Una ronda de sala **¿REAL O ESTAFA?**: el monitor muestra qué porcentaje de la sala cayó en cada carta | «La mitad de la sala cayó. Así de fácil es en la vida real» |
| 6:00 | **🔥 Ola de 500 ataques** desde el panel *Resistencia*, encima de lo que esté jugando la gente | «Ahora lo saturamos a propósito» |
| 6:30 | El panel muestra la cola del modelo llena, cientos de casos en *modo degradado*, **0 errores** y los pagos legítimos pasando | «La IA se satura. El sistema no: decide igual con reglas + memoria, y el dinero sigue retenido» |
| 9:00 | Panel *Tracción y encuesta*: cuántos jugaron, de qué países, cuántos dicen que les pasó de verdad | «Esto no es teoría: lo dicen ustedes» |

## Números que se pueden decir (medidos el 18/10/2026)

Medido en la Mac (Apple M5, 24 GB) con qwen3.5:9b local:

- **500 ataques en ~13 s + 60 jugadores en una sala al mismo tiempo: 0 errores.** Las salas de LA BANDA (Ale) ponen 2 s entre golpes y 10 por jugador, así que un auditorio lleno queda muy por debajo de la ola. La sala respondió con p95 de 12 ms y el servidor tuvo 1 ms de retraso.
- El modelo atendió 7 llamadas y **321 se resolvieron en modo degradado**, sin colgar nada.
- **El 100% de los pagos legítimos pasó** (165/165): bajo carga no se bloquea a gente honesta.
- **La saturación no cambia las decisiones:** se retuvo el 60% de los ataques a mulas con el modelo saturado, contra 62% sin modelo.
- **Límite que decimos en voz alta:** el resto son montos chicos a cuentas nuevas sin señales de riesgo (regla P3). Es el hueco conocido que muestra LA BANDA, y es el mismo con o sin carga.

## Cómo resiste (para preguntas del jurado)

| Pieza | Qué hace |
|---|---|
| **Reglas primero** | La pausa preventiva no espera a la IA: es instantánea |
| **Limitador del modelo** (`lib/agents/limitador.ts`) | Pocas llamadas al modelo a la vez, una cola con tope y una espera máxima. Si no hay turno, el caso va **ya** a modo degradado en vez de hacer esperar |
| **Cortacircuitos** | Si el modelo empieza a fallar, se deja de llamarlo 15 s y después se prueba con un pedido |
| **Fallback por agente** | Cada agente tiene su respuesta determinista; la Policy decide con lo que haya |
| **Un solo proceso** | Salas, casos y memoria en RAM, sin base de datos en el camino crítico. Supabase guarda la encuesta en segundo plano |

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| El QR no abre en el celular | Probar con datos móviles. Si sigue sin abrir, pasar al **plan B** (Railway) |
| El monitor dice «agentes simulados» | Ollama está cerrado: abrirlo. Las decisiones siguen siendo las mismas |
| Se cerró la terminal | Volver a correr `npm run servidor …` y proyectar el **nuevo** QR (la URL cambió) |
| Una sala no avanza | Las rondas avanzan solas con el reloj del servidor. Si alguien se trabó, que salga con **≡ → VOLVER AL MENÚ** y vuelva a entrar con el código |
| Hay que reiniciar a mitad | Botón *Reiniciar demo* del monitor: borra casos y memoria, pero no las partidas ni la encuesta |

## Después del evento

- Datos de la encuesta y del ranking: `GET /api/juego/arcade?crudo=1`. También quedan en Supabase y en `.datos/`.
- Detener: `Ctrl+C` en la terminal (cierra también el túnel).
