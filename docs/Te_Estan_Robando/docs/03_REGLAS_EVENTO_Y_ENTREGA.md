# 03 · Reglas oficiales Hack The Andes y entrega

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Hechos oficiales revisados (17/10/2026)
- Hack The Andes: 17 y 18 de octubre de 2026, Lima, Perú.
- Pitch: **3 minutos**; preguntas: **2 minutos**.
- Rúbrica: **Tracción 30%**, **Esfuerzo técnico 40%**, **Pitch 30%**.
- Cada criterio recibe una nota entera de 1 a 5; nota por jurado: `tracción×6 + esfuerzo×8 + pitch×6`.
- URL del despliegue, URL de la presentación, URL del repositorio y descripción Markdown del proyecto.
- **No conectar laptop propia** al equipo de presentación. Organizador abre URLs suministradas desde su equipo; comprobar en incógnito, sin sesión o recursos locales.
- Bitácoras/entregas pueden volverse públicas: no poner credenciales, claves o datos personales.

Fuente principal: https://hacktheandes.com/guide
Condiciones: https://hacktheandes.com/participation-terms (actualizadas 16/10/2026).

## Traducir rúbrica en tareas
| Criterio | Evidencia demostrable | Dueño sugerido |
|---|---|---|
| Tracción | pruebas externas, n, entrevista, observaciones de uso y aprendizajes; si hay, interés de área bancaria | UX + quien presenta |
| Técnica | transición `HELD` previa a IA, escenarios adversariales, idempotencia, citas E-XX, Policy determinista, logs | Backend/IA |
| Pitch | narrativa de caso peruano, demo de 60–90 s, marcador con resultados, límites honestos | Presentación |

## Modo evaluación
Ruta `/demo` con selector de caso y botón `Ejecutar prueba`, todos los efectos generados en un `run_id` nuevo; `/monitor?room=...` refleja sus eventos. Acceso público sólo a datos sintéticos con permisos limitados. El reset reproduce un escenario nuevo, nunca reescribe eventos históricos.

## Comprobación antes de entregar
1. Abrir URL de demo con navegador privado y red distinta.
2. Asegurar que la URL de slides no requiere cuenta de editor.
3. Confirmar que el backend funciona sin ordenador del equipo.
4. Prueba completa de Rosa, M-01, Don Pepe; fallo explícito si IA no responde.
5. Ver que métricas no mezclen sesiones previas ni escenarios de desarrollo.
6. El README muestra qué está implementado, qué no y cómo reproducir.
7. Registrar cambios en bitácora `andes project update` cuando sean verdaderos.
8. Entregar enlaces con `andes project submit` y revisar la respuesta; no insertar URLs inventadas.

## Pitch y Q&A
El pitch de tres minutos no puede esperar a que 8 personas se registren. Diseñar recorrido desde un navegador, máximo 90 segundos. El juego multijugador sirve para atraer asistentes y producir telemetría, no como única forma de demostrar la solución.
