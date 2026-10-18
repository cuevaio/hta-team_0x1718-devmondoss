# 11 · Agentes, herramientas, políticas y autonomía

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Componentes del sistema original
| Componente | Responsabilidad | Lo que no debe hacer |
|---|---|---|
| Reglas nivel 0 | puntuar señales tipadas, determinar retención inmediata | inventar señales no observables |
| Coordinador | orquestar agentes necesarios según evento | emitir veredicto financiero fuera de Policy |
| Guardián | verificar riesgo de manipulación con respuestas del cliente por canal confiable | pedir OTP, aprobar operaciones |
| Detective | investigar cuenta receptora con tools y construir evidencia | crear montos, cuentas o porcentajes no calculados |
| Policy Engine | emitir decisión final determinista con rule ID y versión | basarse solo en prosa no tipada del LLM |
| Auditor | verificar soportes E-XX y ensamblar expediente | afirmar 100% cobertura si faltan citas |
| Memoria | reutilizar cuentas validadas y veredictos vigentes | elevar sospecha temporal a certeza permanente |

## Dos entradas
**Puerta A / transferencia**: evaluar operaciones antes de desembolso. **Puerta B / alerta AML**: iniciar investigación del destino y expediente sin requerir conversación con cliente. Las dos pueden generar evidencia; la consulta a Memoria confirmada debe preceder a cualquier autorización por bajo score.

## Autonomía honesta
- Automáticos: retención de riesgo alto, coordinación, análisis, decisión por política en escenarios previstos y presentación.
- Humano según base: confirmación definitiva de cuenta mula (CU-02 → CU-03). Esto **sí es human-in-the-loop en la gobernanza de Memoria**, aunque no en la prevención inmediata.
- Modo «sin humano en la demo»: memoria confirmada precargada mediante seed etiquetada; así nadie pulsa nada en la partida y P1 funciona sola.
- Variante de ingeniería pendiente: estados provisionales autoexpirables, no activar consecuencias reservadas a cuentas confirmadas.

## Mapa CU a reglas de los MD (sujeto a cotejo con código)
| CU | Reglas documentadas | Resultado esperado |
|---|---|---|
| CU-01 Rosa | score 7, P4/P5/P6 | pausa/escalamiento según riesgo |
| CU-02 M-01 | fan-in + reenvío rápido; Auditor | expediente con evidencias |
| CU-03 Jorge→M-01 | P1, 0 llamadas IA | pausa por memoria vigente |
| CU-05 Don Pepe | score 4; P8 | permitir legítima |
| CU-04 Lucía | score 6; P7; hotel P2 | pausar anómalo, dejar recurrente |

## Salidas tipadas sugeridas
```json
{"agent":"detective","transfer_id":"tx_synth_1","risk_level":"high","typologies":["fan_in","rapid_forwarding"],"evidence_ids":["E-07","E-08"],"confidence_label":"indicative","version":"v1"}
```
No usar `confidence_label` como probabilidad real sin calibración. Policy evalúa `typologies`, `risk_level`, evidencia verificada y permisos de acción.

## Guardián
Si el canal original está comprometido, no se presume canal alternativo. El juego puede emularlo, pero se marca `source_type=simulated`. No respuesta devuelve `NO_RESPONSE`, no autorización. Máximo tres preguntas según doc base.

## Herramientas deterministas
- `fan_in(account, window)` → `unique_senders`, IDs consultados, ventana y E-ID.
- `rapid_forwarding(account, window)` → entradas/salidas, ratio y subgrafo; prevenir doble conteo.
- `follow_chain(account, depth_limit)` → nodos/edges observados con control de profundidad.
- `get_memory(account)` → `confirmed/provisional`, validez y proveniencia.

## Auditor y evidencia
Todo número viene de datos. Cada afirmación verificable del expediente debe tener `evidence_id` existente. Auditor rechaza soporte ausente y genera `needs_review`. LLM no puede fabricar una E-XX válida.
