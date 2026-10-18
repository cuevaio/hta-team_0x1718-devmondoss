# 18 · Ética, protección de datos y consentimiento

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Protección al jugador
Aviso inicial: «Esta experiencia simula un intento de estafa con dinero y cuentas ficticias. Puede generar tensión. Puedes salir cuando quieras». Evitar culpa a víctimas; no presentar una respuesta equivocada como incompetencia. No simular llamadas con nombres de bancos reales. Sin violencia explícita ni intimidación excesiva.

## Datos permitidos vs prohibidos
| Permitidos, minimizados | Evitar por completo |
|---|---|
| Alias efímero inventado, rol, taps, timestamps, respuestas opcionales, métricas sintéticas | DNI, celular, mail, cuentas reales, claves, OTP, pantalla del teléfono real, audio real, geolocalización |
| ID técnico de dispositivo efímero si estrictamente necesario | Fingerprint persistente para unir sesiones/personas sin consentimiento |
| Señales sintéticas declaradas y versión | Suposiciones sobre atributos protegidos del jugador |

## Consentimiento para encuestas
Encuesta voluntaria y separada del juego; ofrecer «Omitir». El texto debe decir para qué se recogen datos, cuánto se conservarán, quién los verá y cómo contactar al equipo. Si hay menores, aplicar requisitos pertinentes según normativa y organización; no prometer anonimato fuerte si se registran IP/identificadores externos.

## Flujo de tratamiento
Usuario → API de juego (pseudónimo efímero) → DB por `room_id` → consultas agregadas. El jurado accede a métrica agregada; no a historia individual de una víctima real, porque todas son ficticias. Implementar expiración/depuración. Documentar responsable de conservación y plazo definido por el equipo antes de desplegar.

## Seguridad de la aplicación
- HTTPS, validación server-side, secretos solo en servidor, rotación si hay exposición.
- RLS y aislamiento de sala para objetos y canales Realtime.
- URLs de monitor no deben autorizar acciones mutantes.
- Moderar alias: eliminar insultos y contenido identificable.
- Límites de solicitudes, de acciones por minuto y de gasto en modelos.
- Logs públicos redactados, no prompts completos ni herramientas internas.
- Auditoría de acciones de admin y de analista simulado.

## Seguridad del contenido adversarial
No entregar scripts reutilizables para estafar, robo de claves, malware o suplantación. Los jugadores eligen **categorías abstractas** de situaciones y parámetros sintéticos permitidos; el motor no acepta instrucciones arbitrarias. No se enseña cómo eludir bancos reales.

## Transparencia para el jurado
Etiqueta visible: «ENTORNO DE PRUEBAS · Cuentas y montos ficticios». Resultados acompañados de `run_id` y escenarios utilizados. Referencias jurídicas o sectoriales separadas de la mecánica de juego. No afirmar certificación bancaria, reducción comprobada de pérdidas, ni despliegues que no existan.
