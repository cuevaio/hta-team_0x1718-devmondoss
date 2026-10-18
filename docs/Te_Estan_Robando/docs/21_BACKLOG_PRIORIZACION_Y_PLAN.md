# 21 · Backlog, secuencia y dependencias

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Regla de enfoque
No confundir «hacer una locura visual» con necesidad técnica. Primero consolidar el motor verificable; después escena pixelada y arena social. P0 es imprescindible para contar la historia al jurado; P1 refuerza validación; P2 sólo si P0 completo.

## Backlog P0 — imprescindible
| ID | Entregable | Dependencia | Criterio de terminado |
|---|---|---|---|
| B01 | Ledger sintético `PENDING/HELD/RELEASED/REJECTED/FAILED` | DB | estado persistido y no ejecutable mientras HELD |
| B02 | Adaptador Game API → motor de protección | B01 | 1 acción produce 1 transferencia rastreable |
| B03 | Memoria antes del bypass por riesgo bajo | B02 | pago a M-01 confirmada entra P1, 0 IA |
| B04 | Casos S01, S03, S04 reproducibles | B01–B03 | logs/fixtures + evidencia de tests |
| B05 | Guardián + Detective → Policy con evidencia | B02 | decisión con regla y referencias existentes |
| B06 | Monitor con eventos persistidos | B01/B05 | ver ledger, pipeline y KPIs de una run |
| B07 | Modo demo URL pública/incógnito | B04/B06 | funciona sin laptop del equipo ni login personal |
| B08 | Métricas, encuesta 3 ítems, resultados | B01/B07 | n correcto, datos sintéticos y límites visibles |

## Backlog P1 — alto impacto
| ID | Entregable | Criterio |
|---|---|---|
| B09 | Bodega pixel-art Phaser | escena respondiendo a eventos reales |
| B10 | Multiusuario QR y 1–8 participantes | sala aislada, espectador, rate limits |
| B11 | Comparador baseline/defense | tratamiento controlado, seeds aislados |
| B12 | Casos S02 y S06 | un fallo conocido visible, autenticación atípica |
| B13 | Exportar datos y informe | CSV agregado + fichas de run |
| B14 | Ensayo de pitch y entrevista experta | links probados e insights verificables |

## P2 — sólo tiempo restante
Mapa urbano completo, sprites multijugador synchronizados, Lucía sin señal, narración doblada, 10+ escenarios, animación compleja de grafo, puntuación personalizada y arte final de zonas secundarias.

## Ruta crítica
`B01 → B02 → B04 → B05 → B06 → B07 → B08`, con `B03` antes de la validación completa de S03. `B09` se puede desarrollar con mocks **solo visuales**, pero no mostrar un resultado como real hasta conectarlo. Conservar branch de demo estable.

## Coordinación
Pistas sugeridas (no asignaciones reales): backend/ledger, reglas/agentes, frontend pixel-art/UX, evidencia/pitch. El equipo puede ser de 1–4 personas según guía; ajustar propietarios reales. Cada tarea requiere dueño, estado, PR, test y URL de evidencia.

## Definición global de terminado
Función implementada en repo, desplegada, comprobada en navegador limpio, trazable a CU/test, sin secretos, sin trampas narrativas y con fallo explicable.
