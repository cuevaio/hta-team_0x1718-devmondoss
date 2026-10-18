# Demo en vivo: que la gente ataque y el sistema resista

> Para el equipo que presenta. Cómo se arma, qué se dice y qué hacer si algo falla. El detalle técnico está en [INFRA_Y_ORQUESTACION §6 y §8](context/tony_dev/INFRA_Y_ORQUESTACION.md) y en [DEMO_JUEGO](DEMO_JUEGO.md).

## La idea en una frase

**El público ataca al sistema desde su celular mientras lo proyectamos; después lo saturamos a propósito y se ve que igual frena los robos.**

## Las 3 pantallas

| Pantalla | Dónde | Quién la mira |
|---|---|---|
| **Juego** `/play` | El celular de cada persona (QR) | El público |
| **Monitor** `/monitor?token=…` | Proyector | Todos; lo maneja el presentador |
| **Terminal** `npm run servidor` | La Mac, enchufada | Solo el técnico |

## 30 minutos antes

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
| 3:00 | El presentador crea una sala **EN VIVO** desde su celular y proyecta el QR de la sala. Todos juegan la misma carta | «Ahora todos contra todos: ¿real o estafa?» |
| 5:00 | Al revelar cada carta, el monitor muestra qué porcentaje de la sala cayó | «La mitad de la sala cayó. Así de fácil es en la vida real» |
| 6:00 | **🔥 Ola de 500 ataques** desde el panel *Resistencia* | «Ahora lo saturamos a propósito» |
| 6:30 | El panel muestra la cola del modelo llena, cientos de casos en *modo degradado*, **0 errores** y los pagos legítimos pasando | «La IA se satura. El sistema no: decide igual con reglas + memoria, y el dinero sigue retenido» |
| 8:00 | Confirmar una mula en el expediente: el siguiente intento a esa cuenta cae al instante, con 0 IA | «Lo que aprende con uno protege al siguiente» |
| 9:00 | Panel *Tracción y encuesta*: cuántos jugaron, de qué países, cuántos dicen que les pasó de verdad | «Esto no es teoría: lo dicen ustedes» |

## Números que se pueden decir (medidos el 18/10/2026)

Medido en la Mac (Apple M5, 24 GB) con qwen3.5:9b local:

- **500 ataques en ~13 s + 60 jugadores en una sala al mismo tiempo: 0 errores.** La sala respondió con p95 de 12 ms y el servidor tuvo 1 ms de retraso.
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
