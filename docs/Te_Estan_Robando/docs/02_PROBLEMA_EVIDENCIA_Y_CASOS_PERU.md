# 02 · Evidencia verificada y contextualización Perú / LATAM

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Regla editorial
Separar **fuente institucional**, **dato sectorial de un proveedor** y **escenario ficticio**. No convertir cifras regionales en cifras peruanas, ni extrapolar resultados de un videojuego a los bancos.

## Evidencia confirmada en web (17/10/2026)
| Afirmación precisa | Alcance, cautela | Fuente |
|---|---|---|
| 47% de los usuarios encuestados de servicios financieros digitales estuvo expuesto a estafas/fraude durante el año anterior; 21% de los expuestos perdió dinero | Perú, encuesta SBS–CGAP a 1,007 usuarios realizada en 2025; publicación CGAP en 2026 | https://www.cgap.org/research/publication/solutions-to-protect-consumers-fraud-in-digital-finance |
| 25% disminuyó uso, 11% lo dejó y 17% cambió proveedor | **Entre usuarios expuestos a varios riesgos digitales**: fraude, mal uso de datos, fallas de red y falta de transparencia; NO atribuir exclusivamente al fraude | Misma fuente CGAP |
| Intentos de estafa por ingeniería social +155% en 2025 | Datos propietarios de 36 instituciones de LATAM; NO es la tasa de delitos de Perú | https://www.biocatch.com/press-release/latin-american-banks-see-155-increase-in-scam-attempts |
| Cuentas mula reportadas +42% | Mismo análisis sectorial LATAM; indicador reportado, no universo estadístico nacional | Misma fuente BioCatch |
| Caso Puno: transferencia inusual de S/10,000, sanción de 3.78 UIT | Indecopi, 14/07/2026. El banco alegó autenticación conforme; autoridad exigió controles eficaces de monitoreo | https://www.gob.pe/institucion/indecopi/noticias/1418542-indecopi-sanciona-a-banco-por-no-adoptar-medidas-de-seguridad-para-evitar-una-operacion-no-reconocida |
| Caso Chimbote: sanción por cuatro operaciones no reconocidas, pese a alegación de uso de token digital | Indecopi, 22/05/2026. El pronunciamiento cuestionó la falta de autenticación reforzada; evita atribuir al comunicado detalles técnicos no mencionados | https://www.gob.pe/institucion/indecopi/noticias/1396052-indecopi-sanciona-a-dos-bancos-y-un-restaurante-en-chimbote-por-consumos-no-reconocidos |
| Indecopi recomienda bloquear tarjetas y canales ante operaciones no reconocidas | Material de orientación institucional, 02/06/2026 | https://www.gob.pe/institucion/indecopi/noticias/1400495-indecopi-conoce-como-proteger-tu-dinero-ante-consumos-no-reconocidos |

## Tesis que se puede defender
Una operación autenticada no es automáticamente coherente con el comportamiento o voluntad segura del cliente. Los casos de Puno y Chimbote respaldan preocupación por mecanismos de seguridad, pero **no demuestran por sí mismos** que el pipeline multiagente propuesto sea mejor que sistemas existentes.

## Casos con trazabilidad narrativa
| Escenario | Inspiración | Qué NO afirmar |
|---|---|---|
| S01 Bodega Rosa | Modalidad general de falso banco + hipótesis del equipo | Que Rosa exista o que el monto S/4,800 proceda de una sentencia |
| S02 Operación de Jorge | Puno, Indecopi, S/10,000 | Que el juego reproduzca literalmente el expediente |
| S03 Cuenta M-01 | Patrones sintéticos fan-in/reenvío rápido; evidencia sectorial sobre mulas | Que contar remitentes convierta automáticamente una cuenta en criminal |
| S04 Don Pepe | Control diseñado por el equipo de falsos positivos | Que sea un caso real denunciado |
| S05 Lucía viajando | Hipótesis de riesgo sin respuesta del titular | Que existan métricas nacionales de personas sin señal tomadas de este escenario |
| S06 Monto pequeño | Hueco esperado de reglas de nivel 0 | Que el sistema real de todos los bancos deje pasar igual |

## Guía del discurso
- Fuente institucional: «En julio de 2026, Indecopi sancionó a un banco por una transferencia inusual de S/10,000. La autenticación no eximía al banco de monitorear».
- Fuente sectorial: «En una muestra de instituciones financieras de LATAM, BioCatch reportó un aumento de intentos de estafa».
- Demo: «Nuestro entorno sintético evaluó N operaciones; X terminaron retenidas antes de ejecutarse».
- Nunca: «el 90% de los bancos peruanos son vulnerables» o «protegimos S/100,000 reales».

## Fuentes adicionales de equipo aún sin validación independiente aquí
El archivo original enumera Ministerio Público enero–julio 2026, Tarapoto, Trujillo y reglas SBS. Se **conservan textualmente en `/originales`**; este paquete prioriza arriba las afirmaciones confirmadas. Las demás deben verificarse antes de proyectarse en el pitch. Ver [28](23_BIBLIOGRAFIA_Y_VERIFICACION.md).
