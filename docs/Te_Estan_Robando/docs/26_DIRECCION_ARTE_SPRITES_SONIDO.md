# 26 · Dirección de arte y guía para assets pixel art

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Mood
«RPG limeño cálido que cambia a alerta sistémica». Top-down 2D pixel art, tiles de 16×16 o 32×32, personajes de 24–32 px en grilla, UI con marcos de 9-slice y tipografía pixel sólo para títulos breves; textos principales en fuente accesible.

## Paleta propuesta, no marca definitiva
Navy HUD `#10243D`, azul `#285EA8`, azul claro `#79C7E8`, crema `#F6EBD7`, verde éxito `#65BE83`, ámbar pausa `#F1B35B`, rojo rechazo `#E66565`, tinta `#19283B`. Ajustar contraste con WCAG y validar en proyector.

## Ambientes
- Bodega Rosa: mostrador, estantes, caja, teléfono, dos clientes, sonido de calle; elemento interactivo `POS`.
- Banco Andino ficticio: mostrador y terminal simplificados; no logos bancarios reales.
- Mercado Don Pepe: cajas, bolsas, letrero genérico y alto volumen cotidiano.
- Plaza/lobby: banco del parque, mapa de sala, guía de roles.
- Hotel/viaje Lucía: puerta, señal de red ausente y factura recurrente.
- Monitor: estética de consola ciberseguridad minimalista, no pixelar datos numéricos importantes hasta hacerlos ilegibles.

## Sprites mínimos P0
Rosa idle/andar 4 direcciones (4 cuadros/dirección basta), terminal, teléfono, cliente de bodega, billete simbólico *ficticio* sin diseño de moneda real, pantalla de protección, pequeño escudo animado, candado, señal de alerta, tarjeta de cuenta M-01. **El dinero se visualiza como número abstracto, no como extracción de una billetera real.**

## Animaciones y audio
- `transfer.requested`: línea punteada gris, sin movimiento monetario completado.
- `transfer.held`: candado ámbar e interrupción antes de cuenta destino, sólo si evento canónico recibido.
- `transfer.released`: línea completa verde, sólo después de commit.
- `memory.hit`: rastro azul conectando cuenta a antecedente con evidencia.
- `agent.failed`: pulso neutro + texto «análisis pendiente»; nunca éxito falso.
- Sonidos cortos opcionales, silenciables y subtitulados.

## Pipeline de assets
Original propio o licencia verificable; `assets_manifest.csv` con ruta, licencia, autor, procedencia y atribución. Export PNG spritesheet y tileset + JSON atlas. Evitar replicar Among Us como propiedad intelectual: la referencia es dinámica social, no estética, personajes ni sonidos.

## Brief para ilustración
«Barrio peruano top-down, pixel art 16 bit, bodega pequeña y casas de concreto pintadas de colores suaves, señalización genérica, iluminación cálida, siluetas legibles, tiles repetibles, espacio para HUD, sin texto ni marcas registradas».
