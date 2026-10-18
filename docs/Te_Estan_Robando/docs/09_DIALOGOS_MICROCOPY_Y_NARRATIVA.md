# 09 · Guion narrativo, diálogos y microcopy

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Tono
Empático, claro, no infantilizar al cliente ni glorificar al estafador. Un toque de tensión basta. Nada de suplantar marcas reales ni usar guiones reutilizables de ingeniería social.

## Historia Rosa: 7 beats
1. Inicio: «Son las seis. La bodega está llena y el proveedor espera su pago».
2. Mensaje genérico de riesgo: «Recibiste una llamada que dice venir del banco».
3. Decisión: «¿Quieres continuar con la transferencia de prueba?».
4. Estado del motor: `Procesando...` con referencia de simulación.
5. Si `HELD`: «Pusimos esta operación en pausa mientras verificamos señales de riesgo. Aún no se ha ejecutado».
6. Si `RELEASED`: «La operación de prueba fue autorizada por el sistema»; si era fraude etiquetado, explicar posteriormente la limitación sin culpar al jugador.
7. Tarjeta: «¿Qué ocurrió? ¿Qué señales observó el motor? ¿Qué necesitó verificar?».

## Preguntas Guardián (ejemplos hipotéticos, no scripts productivos)
- «¿Alguien te está indicando ahora qué operación realizar?»
- «¿Reconoces al beneficiario de esta transferencia?»
- «¿Quieres detener temporalmente la operación y buscar un canal de ayuda?»

Nunca preguntar clave, OTP, PIN, CVV, fotos de DNI ni datos bancarios reales. Máximo 3 turnos en el diseño base. Si no contesta: `sin_respuesta`, no aprobación.

## Tarjetas de salida
- **Retenida:** «Esta operación sigue pendiente. El dinero ficticio no salió. Regla aplicada: [rule_id]».
- **Permitida:** «El pago de prueba fue permitido. Puedes inspeccionar la evaluación».
- **Escalada:** «Se generó un expediente. El caso necesita el paso [definido] antes de cerrarse».
- **Error:** «No fue posible completar la verificación. El caso mantiene el estado mostrado en el registro; no asumimos que está aprobado».
- **Provisional:** «Cuenta marcada para observación: aún no confirmada».
- **Confirmada sintética:** «Cuenta de prueba previamente validada por un analista de simulación».

## Voz del monitor
«CU-01 · operación TX-04 — HELD a las 20:31:04.112. Primer llamado de IA a las 20:31:04.380. Evidencia E-07: fan-in calculado por tool». Solo mostrar si los timestamps reales registrados lo sostienen.

## Encuesta de tres preguntas (opcional)
1. «¿Cuánta frustración sentiste en esta situación?» escala 1–5 con etiquetas.
2. «¿Te molestó la pausa de seguridad?» No / Un poco / Mucho.
3. «¿Activarías esta protección en tu banco si algunas operaciones tardaran más?» Sí / No / No sé.

## Narración de pitch sugerida
«Hace unas horas, Rosa estaba atendiendo su bodega. Recibió una llamada y trató de hacer una operación. En nuestro entorno simulado, el sistema no se limita a avisar: registra una pausa antes de ejecutar. Ahora vamos a repetirlo sin guion pregrabado, para que vean el resultado del motor». No afirmar que Rosa sea una persona real.

## Audio y accesibilidad
SFX sin voz obligatoria; vibración opcional; subtítulos de todas las llamadas. Los colores de advertencia nunca bastan por sí solos. Para suspenso, no usar cuenta atrás que impida completar la tarea y sesgue el estudio.
