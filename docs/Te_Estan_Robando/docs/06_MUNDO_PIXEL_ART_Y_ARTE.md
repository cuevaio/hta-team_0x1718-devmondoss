# 06 · Mundo 2D pixel art, mapa y guía visual

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Dirección artística
Top-down RPG urbano peruano, pixel art propio de 16/32px, con detalles reconocibles de barrios de Lima/Chimbote sin reproducir personas reales. Mezclar calles cálidas y espacios comerciales cotidianos con una interfaz bancaria fría y legible. El arte comunica vida normal; los overlays comunican protección financiera.

## Mapa mínimo
```text
╔════════════════════════════════════════════════════╗
║ CASA ROSA       │ BODEGA ROSA      │ BANCO ANDINO ║
║ casa/llamada    │ caja/proveedor   │ terminal     ║
╠════════════════╪══════════════════╪══════════════╣
║ MERCADO DON PEPE│ PLAZA / LOBBY    │ HOTEL LUCÍA  ║
║ pago legítimo   │ entrada + QR     │ sin señal    ║
╚════════════════════════════════════════════════════╝
```
En MVP solo son necesarias bodega, terminal de transferencia y monitor; el resto son «puntos de interés» que pueden agregarse.

## Tileset y assets propuestos
- Tile 16×16 o 32×32; escala entera 2×/3×; `pixelArt=true` y `roundPixels=true` si procede.
- Sprites 4 direcciones, caminar + idle; mínimo Rosa, Jorge, Don Pepe, Lucía y avatar genérico.
- Props: caja, productos de bodega, teléfono, terminal bancaria, caja registradora, cartel de proveedor, icono de documento, reloj y candado.
- HUD: alias, temporizador de ronda, saldo sintético, estado de última operación, contador de tareas.
- **No** recrear el impostor ni usar los iconos oficiales de Among Us.

## Atmósfera por escena
| Zona | Paleta | Sonido y emoción | Interacción principal |
|---|---|---|---|
| Bodega | crema, terracota, verde oliva | monedas/puerta, familiaridad | pagar proveedor |
| Banco/terminal | navy/azul, blanco | pitidos suaves | iniciar operación |
| Casa | sepia/nocturno | vibración/mensaje | evento sin respuesta |
| Plaza | verdes/celeste | ambiente social | lobby |
| Hotel | violeta/noche | interferencia ligera | conectividad ausente |
| Monitor técnico | navy, amarillo alerta, verde resultado | silencioso | explicar causales |

## Estados expresados visualmente
`PENDING` reloj, `HELD` candado, `RELEASED` comprobante, `REJECTED` X, `ESCALATED` expediente, `ERROR` triángulo. Nunca usar sólo color: etiqueta y símbolo.

## UX móvil
- Portrait preferente 9:16, viewport adaptable, UI HTML/React superpuesta a canvas.
- Tap en estación para interactuar; joystick **opcional**, teclado y menú de acciones alternativo.
- Evitar minijuegos de reflejos: distorsionan medición de protección y perjudican accesibilidad.
- Objetivo visual de 60 FPS cuando sea posible; no convertirlo en requisito de negocio.

## Prompt de dirección de arte (no arte generado)
«Original 16-bit inspired top-down pixel art urban Peruvian neighborhood, warm two-story concrete houses and neighborhood bodega, street market, tiny bank terminal, friendly expressive human-scale sprites, readable high contrast UI, crisp pixel grid, no logos, no copyrighted game characters, production-ready consistent tile proportions».

## Checklist assets
[ ] hoja de sprites original; [ ] tiles sin copyright; [ ] exportación PNG atlas; [ ] textos HTML separados; [ ] paleta documentada; [ ] compatibilidad dark/light en HUD; [ ] compresión WebP de ilustraciones sin perder pixel geometry; [ ] loading/errores.
