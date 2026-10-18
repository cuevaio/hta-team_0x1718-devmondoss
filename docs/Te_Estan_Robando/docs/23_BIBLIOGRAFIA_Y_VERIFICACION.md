# 23 · Bibliografía, verificación y afirmaciones permitidas

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Jerarquía de fuentes
1. Fuentes estatales y regulatorias → para resoluciones, derechos y pautas.
2. Investigación de SBS/CGAP → muestras y exposición en Perú.
3. Reportes privados / industria → señales de LATAM, siempre atribuidas al proveedor y a su muestra.
4. Documentación oficial de frameworks → capacidades y limitaciones técnicas.
5. Los MD originales del equipo → decisiones internas, **no confirmaciones de código**.

## Fuentes verificadas hasta 17/10/2026
| Tipo | Referencia | Información utilizable |
|---|---|---|
| Hackathon | https://hacktheandes.com/guide | cronograma, tracción 30%, técnica 40%, pitch 30%, 3+2 min, enlaces de entrega |
| Hackathon | https://hacktheandes.com/participation-terms | presentación desde enlaces de organización y autoría, actualizado 16/10/2026 |
| Institucional | https://www.gob.pe/institucion/indecopi/noticias/1418542-indecopi-sanciona-a-banco-por-no-adoptar-medidas-de-seguridad-para-evitar-una-operacion-no-reconocida | Puno, 14/07/2026, S/10,000, deber de monitoreo eficaz |
| Institucional | https://www.gob.pe/institucion/indecopi/noticias/1396052-indecopi-sanciona-a-dos-bancos-y-un-restaurante-en-chimbote-por-consumos-no-reconocidos | Chimbote, 22/05/2026; casos y autenticación reforzada |
| Investigación | https://www.cgap.org/research/publication/solutions-to-protect-consumers-fraud-in-digital-finance | encuesta SBS–CGAP, Perú, usuarios digitales; verificar texto exacto de denominadores |
| Privado regional | https://www.biocatch.com/press-release/latin-american-banks-see-155-increase-in-scam-attempts | muestra clientes BioCatch 36 instituciones LATAM; +155% intentos sociales; +42% mulas reportadas |
| Phaser | https://docs.phaser.io/phaser/getting-started/installation | framework y configuración web 2D |
| Supabase | https://supabase.com/docs/guides/realtime/broadcast | Broadcast (WebSocket / cliente / DB) |
| Supabase | https://supabase.com/docs/guides/realtime/presence | Presence, presencia de miembros |
| Supabase | https://supabase.com/docs/guides/database/postgres/row-level-security | RLS y restricciones de acceso |

## Cómo no presentar la evidencia
- **Incorrecto:** «El 47% de todos los peruanos sufre fraude». **Correcto:** «47% de usuarios encuestados de servicios financieros digitales estuvieron expuestos en el último año».
- **Incorrecto:** «El 25% de víctimas de fraude abandonó banca móvil». **Correcto:** vincular porcentajes de abandono/reducción a riesgos digitales según denominador publicado.
- **Incorrecto:** «En Perú crecieron las cuentas mula 42%». **Correcto:** «BioCatch reporta +42% en su muestra LATAM».
- **Incorrecto:** «Indecopi validó nuestros agentes». **Correcto:** «Indecopi acreditó que autenticación no sustituye monitoreo eficaz en caso Puno».
- **Incorrecto:** «Nuestro modelo detiene 100% de fraudes». **Correcto:** «En N pruebas sintéticas, TP/total = X, con estos fallos».

## Registro de verificación
| Afirmación | Fuente abierta | Estado | Advertencia |
|---|---|---|---|
| Pesos rúbrica Hack the Andes | Guía oficial | VERIFICADO | podría haber cambios organizativos; revisar en evento |
| Caso Puno | Comunicado oficial | VERIFICADO | no trasplantar detalles no incluidos |
| Caso Chimbote | Comunicado oficial | VERIFICADO | distinguir debit/credit y cada sanción |
| +155% estafas LATAM | BioCatch | VERIFICADO como afirmación del proveedor | dato sectorial no nacional |
| Rutas `/api/*` y existencia de agentes | MD internos | DESCRITO, NO AUDITADO | revisar código y deployment |
| `P4`/`P1` en cada resultado | MD internos | INTENCIÓN | comprobar ejecución real |
| Reducción de pérdidas del prototipo | — | NO DEMOSTRADA | solo sintético hasta pruebas externas |

## Licencias
Sprites, audio y tipografías deben ser propios o de licencias claras. Inspirarse en juegos existentes sin copiar avatares, mapas, interfaz ni branding protegido.
