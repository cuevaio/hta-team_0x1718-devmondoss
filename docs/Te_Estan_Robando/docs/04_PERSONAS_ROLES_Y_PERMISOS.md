# 04 · Personas, roles y permisos

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Personas y sus tensiones
**Rosa**: dueña de bodega que atiende y paga a proveedores; no debería asumir la función de analista de fraude. **Jorge**: cliente con una operación atípica autenticada. **Lucía**: sin conectividad durante un viaje; silencio no es permiso. **Don Pepe**: comerciante legítimo con muchos compradores; volumen no equivale a fraude. **Analista de fraude**: necesita evidencia y trazabilidad; en diseño base confirma cuentas para Memoria. **Entidad financiera**: comprador potencial; exige seguridad, integración, reducción de fricción y explicabilidad.

## Roles de la aplicación
| Rol | Capacidades | Prohibiciones |
|---|---|---|
| Ciudadano | moverse, interactuar, efectuar pagos sintéticos, responder preguntas, optar por encuesta | editar resultado, etiquetas de verdad o score |
| Adversario | seleccionar desafíos abstractos y destinos sintéticos de catálogo | introducir instrucciones operativas de estafa, manipular saldo o etiquetar mulas |
| Presentador | iniciar sala, elegir escenario, reiniciar con run nuevo | modificar estado financiero o publicar falsos resultados |
| Observador/jurado | consultar monitor y evidencia pública redactada | leer ground truth antes de decidir, cambiar casos, ver tokens |
| Analista de prueba | confirmar/descartar **en un entorno simulado** con acción auditada | hacerlo en silencio o modificar backdated logs |
| Evaluador de verdad | gestionar ground truth y calcular matriz de confusión fuera del motor | alimentar directamente señales de IA |
| Backend/Policy | validar y confirmar transiciones financieras | aceptar estados impuestos por UI |

## Autonomía: precisión fundamental
- **Automático:** pausa preventiva, enrutamiento de consultas, verificación contextual automatizada si el canal existe, análisis de cuentas, policy y auditoría.
- **No automático en los MD suministrados:** confirmación duradera de una cuenta como mula exige analista humano.
- **Demo sin humano:** o bien precargar `confirmed_mule` de prueba con origen declarado, o usar `suspected_account` temporal (no equivalente a confirmación).
- **No convertir por UX** una acción del espectador en un veredicto bancario real. Etiquetar «analista de simulación».

## Permisos y visibilidad
- Públicos: cuenta sintética anonimizada, importe de juego, estado, regla publicada, evidencia apta para demo, agregados.
- Privados operacionales: detalles de seguridad interna, prompt completo, tokens, registros de agentes, ground truth de escenario.
- Server-only: semillas completas, autorización a modificar Memoria, firma de eventos y políticas.

## Consentimiento
Antes de comenzar: «Juego con dinero y personajes ficticios. Recopilamos elecciones y tiempos para mejorar la demo. No pedimos nombre, DNI ni información bancaria». Encuesta voluntaria. Recolección identificada por alias anónimo. Ver [19](18_PRIVACIDAD_SEGURIDAD_Y_ETICA.md).
