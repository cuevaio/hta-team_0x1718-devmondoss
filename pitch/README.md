# Pitch · Mule Zero

Portada y 3 diapositivas con animaciones, en HTML. No necesita build.

1. **Portada**: Mule Zero, el equipo y el QR del juego.
2. **El problema**: muchas víctimas, una sola cuenta.
3. **La solución**: frenar, investigar, recordar.
4. **La oportunidad**: una mula confirmada en un país, frenada en todos.

## Ejecutarla

```bash
npm run pitch          # sirve en http://localhost:4000
```

O sin servidor, abriendo el archivo directo:

```bash
open pitch/index.html  # macOS
```

## Presentar

| Tecla | Acción |
|---|---|
| → · espacio · Enter | siguiente |
| ← | anterior |
| F | pantalla completa |
| Inicio / Fin | primera / última |

En el celular se desliza. Las animaciones se reinician al entrar a cada diapositiva.

## Archivos

- `index.html`: las diapositivas y las escenas (SVG).
- `estilos.css`: estilo del juego (pixel, azul noche, ámbar).
- `presentacion.js`: navegación y animaciones.
- `servir.mjs`: servidor local sin dependencias.

Las cifras del problema tienen su fuente al pie; la escena es una simulación con los datos sintéticos del demo.
