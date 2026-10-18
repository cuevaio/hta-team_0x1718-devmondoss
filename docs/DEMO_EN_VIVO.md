# Demo en vivo: que la gente ataque y el sistema resista

> Para el equipo que presenta. Cómo se arma, qué se dice y qué hacer si algo falla. El detalle técnico está en [INFRA_Y_ORQUESTACION §6 y §8](context/tony_dev/INFRA_Y_ORQUESTACION.md) y en [DEMO_JUEGO](DEMO_JUEGO.md).

## La idea en una frase

**El público ataca al sistema desde su celular mientras lo proyectamos; después lo saturamos a propósito y se ve que igual frena los robos.**

## La presentación: slides → demo → juego

Son **tres pantallas en el proyector, en este orden**. Conviene abrirlas antes en tres pestañas.

| # | Pantalla | URL | Tiempo |
|---|---|---|---|
| 1 | **Slides** (portada, problema, solución) | `npm run pitch` → http://localhost:4000 | ~1:30 |
| 2 | **Demo de la solución**: el caso de Rosa de punta a punta | `https://web-production-be4c9.up.railway.app/demo?token=TOKEN` | ~2:00 |
| 3 | **Juego + monitor**: el público ataca | QR de la portada (`/play`) y `/monitor?token=TOKEN` | ~3:00 |
| 4 | **Slides**: la oportunidad (última diapositiva) | pestaña 1 | ~0:30 |

El token es el `DEMO_TOKEN` del servidor y se borra de la barra de direcciones al cargar. Sin token, el público puede ejecutar los actos de `/demo`; **confirmar la mula y reiniciar** son del presentador.

### Guion de `/demo` (2 minutos)

Antes de empezar: **Reiniciar demo**.

1. **Acto 1 · Rosa recibe una llamada** → *Ejecutar*. A la izquierda, el celular de Rosa: el dinero queda en **pausa preventiva** antes de que actúe la IA. A la derecha, la consola del banco: la línea de tiempo muestra Reglas → Coordinador → Detective → Guardián. En el celular de Rosa tocar **«Sí, el banco»**: el Guardián detecta que la están guiando y el caso pasa al analista con el expediente citado (E-01, E-03…).
   > «A Rosa no la hackearon: la convencieron. Por eso frenamos el dinero primero y preguntamos después.»
2. **Acto 2 · Revisión de M-01** → *Ejecutar* → **Confirmar mula**. Decide una persona, no la IA.
   > «El analista confirma la mula con el expediente que armaron los agentes.»
3. **Acto 3 · Jorge es la siguiente víctima** → *Ejecutar*. Resultado: **P1 · 0 llamadas de IA**, «Cuenta reconocida». El embudo muestra las llamadas evitadas por la memoria.
   > «Lo aprendimos con Rosa: Jorge está protegido al instante y sin gastar IA.»
4. (Si hay tiempo) **Control · Bodega Don Pepe**: un pago legítimo pasa. El sistema no bloquea todo.

Después: «Ahora ustedes son la banda» → pestaña 3 y el guion de abajo desde el minuto 0:00.

> El juego del público está en Vercel (`te-estan-robando.vercel.app/play`, el QR de los slides) y `/demo` en Railway. Usan el mismo Supabase, así que el ranking y la encuesta son los mismos. Los casos de `/demo` viven en Railway.

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
