# Pitch · Mule Zero

Presentación de 7 diapositivas con animaciones, en HTML. No necesita build.

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

Las cifras de la diapositiva 3 tienen su fuente al pie. La escena de la diapositiva 2 es una simulación con los datos sintéticos del demo.
