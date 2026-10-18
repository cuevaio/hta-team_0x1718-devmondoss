# 25 · Accesibilidad, rendimiento y UX en móviles

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Mínimos operativos
- Ajustar a anchos 320–430 px para celular; canvas pixel art escalado a factor entero cuando se pueda, UI de lectura en DOM accesible.
- Interacciones de uno o dos toques, sin necesidad de precisión de joystick; ofrecer click/tap en puntos de interés.
- Tipografías legibles en burbujas, contraste suficiente, subtítulos siempre visibles, opción de reducir movimiento; audio no obligatorio.
- Indicadores dobles (texto + icono), no utilizar sólo rojo/verde para definir estado.
- Textos de pantalla víctima humanos; códigos P4/P1 solo en inspector.
- Teclado en web desktop: Tab, Enter/Espacio; controles ARIA mediante DOM en las capas no Canvas.

## Latencia percibida
Mostrar `PENDING` hasta confirmación; al retener mostrar solo cuando llega evento `HELD`. Para investigaciones largas, barra de etapas basada en eventos recibidos, nunca porcentaje inventado. Timeout de red: mostrar error y reconectar; el usuario puede ver el último estado persistido.

## Rendimiento
Atlas de sprites pequeño, pixel art con `image-rendering: pixelated`, animación local desacoplada de red, precargar sólo mapa inicial y audio opcional. Mantener 30–60 FPS objetivo en equipos de muestra, pero si hay caída priorizar accesibilidad de acciones y eventos.

## Evaluación rápida
Probar tres dispositivos (gama media Android, iOS Safari, desktop con proyector), redes móviles y Wi-Fi, navegador privado, pantalla horizontal/vertical. Observar si personas desconocidas completan flujo sin instrucción oral.
