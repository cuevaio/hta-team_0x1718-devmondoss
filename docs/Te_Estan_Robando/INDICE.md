# Índice general — Te están robando / El barrio no duerme

> Paquete de diseño: **34 MD de producto/ingeniería**, **10 MD de escenarios**, **3 MD originales preservados** y plantillas. Estado: propuesta/documentación; NO supone código implementado ni validación bancaria real. Corte 17/10/2026.

## Cómo leer según tu función

- **Pitch/jurado:** 01 → 02 → 03 → 22 → 32 → S01 / S03 / S04.
- **UX y juego:** 05 → 06 → 07 → 08 → 09 → 26 → 27 → escenarios.
- **Backend/agentes:** 10 → 11 → 12 → 13 → 14 → 15 → 20 → 34.
- **Investigación/tracción:** 16 → 17 → 18 → 23 → 31.
- **Operación:** 19 → 21 → 25 → 28 → 30.

## Documentos modulares

### Producto y contexto

- [01 · Visión, objetivo y alcance](docs/01_VISION_OBJETIVO_Y_ALCANCE.md)
- [02 · Evidencia verificada y contextualización Perú / LATAM](docs/02_PROBLEMA_EVIDENCIA_Y_CASOS_PERU.md)
- [03 · Reglas oficiales Hack The Andes y entrega](docs/03_REGLAS_EVENTO_Y_ENTREGA.md)
- [04 · Personas, roles y permisos](docs/04_PERSONAS_ROLES_Y_PERMISOS.md)

### Juego, UX y escenarios

- [05 · Game Design Document: loop, rondas y mecánicas](docs/05_GDD_CORE_LOOP_Y_REGLAS.md)
- [06 · Mundo 2D pixel art, mapa y guía visual](docs/06_MUNDO_PIXEL_ART_Y_ARTE.md)
- [07 · UX: recorridos, pantallas y estados](docs/07_UX_JOURNEYS_Y_PANTALLAS.md)
- [08 · Catálogo de escenarios y fichas jugables](docs/08_ESCENARIOS_COMPLETOS_Y_CASOS_DE_USO.md)
- [09 · Guion narrativo, diálogos y microcopy](docs/09_DIALOGOS_MICROCOPY_Y_NARRATIVA.md)

### Backend y flujo técnico

- [10 · Arquitectura general y límites de confianza](docs/10_ARQUITECTURA_END_TO_END.md)
- [11 · Agentes, herramientas, políticas y autonomía](docs/11_MULTIAGENTES_POLICY_Y_AUTONOMIA.md)
- [12 · Ledger sintético, estados e invariantes](docs/12_ESTADOS_LEDGER_Y_CONSISTENCIA.md)
- [13 · API propuesta, contratos y eventos canónicos](docs/13_API_CONTRATOS_Y_EVENTOS.md)
- [14 · Modelo de datos y SQL de referencia](docs/14_DATOS_SQL_Y_ESQUEMA.md)
- [15 · Salas, multijugador y eventos realtime](docs/15_REALTIME_SALAS_Y_SINCRONIZACION.md)

### Medición, privacidad y pruebas

- [16 · Telemetría y analítica de partidas](docs/16_TELEMETRIA_EVENTOS_Y_ANALITICA.md)
- [17 · Diseño experimental, hipótesis y métricas](docs/17_EXPERIMENTOS_HIPOTESIS_Y_METRICAS.md)
- [18 · Ética, protección de datos y consentimiento](docs/18_PRIVACIDAD_SEGURIDAD_Y_ETICA.md)
- [19 · Amenazas, límites técnicos y mitigaciones](docs/19_MODELO_DE_AMENAZAS_Y_LIMITACIONES.md)
- [20 · Matriz de QA, aceptación y regresión](docs/20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md)

### Entrega, negocio y operación

- [21 · Backlog, secuencia y dependencias](docs/21_BACKLOG_PRIORIZACION_Y_PLAN.md)
- [22 · Pitch, demo corta y defensa técnica](docs/22_PITCH_3_MINUTOS_Y_QA.md)
- [23 · Bibliografía, verificación y afirmaciones permitidas](docs/23_BIBLIOGRAFIA_Y_VERIFICACION.md)
- [24 · Glosario y decisiones de arquitectura (ADR)](docs/24_GLOSARIO_Y_DECISIONES_ARQUITECTONICAS.md)
- [25 · Accesibilidad, rendimiento y UX en móviles](docs/25_ACCESIBILIDAD_Y_PERFORMANCE.md)
- [26 · Dirección de arte y guía para assets pixel art](docs/26_DIRECCION_ARTE_SPRITES_SONIDO.md)
- [27 · Mecánicas sociales, progresión y scoring](docs/27_ECONOMIA_DEL_JUEGO_Y_ENGANCHE.md)
- [28 · Observabilidad, auditoría y visualización del pipeline](docs/28_OBSERVABILIDAD_Y_AUDITORIA.md)
- [29 · Futuro de integración bancaria y límites de cobertura](docs/29_INTEGRACION_BANCARIA_Y_LIMITES_DEL_PRODUCTO.md)
- [30 · Runbook de despliegue, demo y entrega](docs/30_DESPLIEGUE_RUNBOOK_Y_ENTREGA.md)
- [31 · Protocolo de pruebas con personas y especialistas](docs/31_FACILITACION_ENTREVISTAS_Y_VALIDACION.md)
- [32 · Plantillas finales de evidencia, resultados y entrega](docs/32_FORMATOS_DE_RESULTADOS_Y_ENTREGA.md)
- [33 · Competencia, diferenciación y posicionamiento](docs/33_COMPETENCIA_Y_POSICIONAMIENTO.md)
- [34 · Handoff para desarrolladores y orden de integración](docs/34_HANDOFF_A_EQUIPO_DESARROLLO.md)

## Fichas individuales de escenarios

- [S01 · La llamada de las seis](escenarios/S01_ROSA_FALSO_BANCO.md)
- [S02 · Autenticación correcta ≠ operación segura](escenarios/S02_JORGE_AUTENTICADO.md)
- [S03 · La cuenta que recibe de muchos](escenarios/S03_M01_RED_DE_CUENTAS.md)
- [S04 · El comerciante inocente](escenarios/S04_DON_PEPE_COMERCIO.md)
- [S05 · Sin señal durante 72 horas](escenarios/S05_LUCIA_SIN_SENAL.md)
- [S06 · El pequeño intento que pasó](escenarios/S06_MONTO_CHICO.md)
- [S07 · Doble clic, un pago](escenarios/S07_REINTENTO_DOBLE_CLIC.md)
- [S08 · El Guardián se queda sin respuesta](escenarios/S08_CAIDA_DE_IA.md)
- [S09 · Dos transferencias y una memoria cambiante](escenarios/S09_CONCURRENCIA_MEMORIA.md)
- [S10 · Lo que el banco no sabe](escenarios/S10_SENAL_INEXISTENTE.md)

## Documentos originales (copias byte a byte)

- [Definición original: problema, casos de uso y solución](originales/PROBLEMA_CASOS_SOLUCION_ORIGINAL.md)
- [Demo jugable original](originales/DEMO_JUGABLE_ORIGINAL.md)
- [GDD/arquitectura elaborado antes](originales/GDD_ARQUITECTURA_ANTERIOR.md)

## Plantillas y ejemplos

- [EJEMPLO_EVENTO.json](plantillas/EJEMPLO_EVENTO.json)
- [PLANTILLA_CATALOGO_ASSETS.csv](plantillas/PLANTILLA_CATALOGO_ASSETS.csv)
- [PLANTILLA_DEMO_CHECKLIST.md](plantillas/PLANTILLA_DEMO_CHECKLIST.md)
- [PLANTILLA_RESULTADOS.csv](plantillas/PLANTILLA_RESULTADOS.csv)
- [PLANTILLA_SESION_TEST.md](plantillas/PLANTILLA_SESION_TEST.md)

## Distinción obligatoria entre hechos y planes

- **Fuente oficial externa**: ver 02 y 23; sólo afirmaciones respaldadas en su ámbito.
- **Descrito por los MD base**: arquitectura y APIs declaradas por el equipo; no significa que se haya auditado el repositorio.
- **Propuesta nueva**: UX, rutas de juego, eventos, estructura de datos y arte; requiere desarrollo.
- **Resultado real del sandbox**: sólo cuando exista `run_id`, logs, versión y pruebas.
- **Validación de personas**: no equivale a demanda bancaria ni eficacia en producción.

## Regla central

> El juego provoca eventos y muestra consecuencias. **La decisión financiera pertenece al motor, no a la interfaz.**

## Fuentes oficiales importantes

- [Guía oficial del evento](https://hacktheandes.com/guide)
- [Condiciones de entrega](https://hacktheandes.com/participation-terms)
- [SBS/CGAP](https://www.cgap.org/research/publication/solutions-to-protect-consumers-fraud-in-digital-finance)
- [Indecopi Puno](https://www.gob.pe/institucion/indecopi/noticias/1418542-indecopi-sanciona-a-banco-por-no-adoptar-medidas-de-seguridad-para-evitar-una-operacion-no-reconocida)
- [Indecopi Chimbote](https://www.gob.pe/institucion/indecopi/noticias/1396052-indecopi-sanciona-a-dos-bancos-y-un-restaurante-en-chimbote-por-consumos-no-reconocidos)

