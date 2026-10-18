# 22 · Pitch, demo corta y defensa técnica

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Posicionamiento
No estamos vendiendo un videojuego. «Te están robando» es el laboratorio pixel-art que demuestra una capa de protección financiera: **Pausa → Verifica → Investiga → Decide → Reutiliza evidencia**. La solución bancaria es el motor; el juego es la prueba.

## Pitch de 3 minutos (propuesta, adaptar a resultados reales)
- **0:00–0:25 — El problema:** autenticación correcta no implica intención segura. Citar el caso Indecopi Puno S/10,000 (2026), sin decir que el prototipo resuelve el expediente real.
- **0:25–0:45 — Propuesta:** antes del pago, reglas retienen transacciones riesgosas; Guardián y Detective aportan contexto; Policy decide, Auditor comprueba evidencia.
- **0:45–1:25 — S01 Rosa:** desde URL `/demo`, iniciar, enviar transferencia simulada de S/4,800 y observar `HELD` persistido antes de IA. Mostrar tiempo y `transfer_id`.
- **1:25–1:50 — S03 M-01:** abrir expediente + Memoria; reproducir segundo intento. Mostrar `0 IA` con `memory_hit` si la cuenta de fixture ya está confirmada.
- **1:50–2:10 — S04 Don Pepe:** pago legítimo que pasa. No bloquear todo es clave.
- **2:10–2:40 — Evidencia:** resultados de runs reales en sandbox, `n` por escenario, fallos, personas encuestadas (si existen). Nunca llenar métricas con datos ficticios del mockup.
- **2:40–3:00 — Valor y límites:** integración preejecución hipotética para bancos, tecnología propia; sin core real ni historial interbancario, siguiente paso entrevista/piloto con institución.

## Si la red falla
Mostrar explícitamente error de conectividad y el último run persistido (`run_id`, hora, log y captura) como **replay de una prueba anterior**, no como ejecución en vivo. Si hay vídeo, etiquetar «grabación». No prometer demo ficticia.

## Q&A difícil
**¿Qué habéis construido que BioCatch no hace?** No atribuir exclusividad. Diferencia defendible: pipeline modular explicable y demostración de reuso de decisiones con evidencias; aún por verificar ventaja comparativa en producción.

**¿Por qué IA y no reglas?** Reglas en camino crítico; IA para contextualizar, investigar e interpretar evidencia; si las reglas bastan, no llamar al LLM. Mostrar `agent_calls`.

**¿Qué pasa si el modelo alucina?** Tools computan hechos, Auditor comprueba IDs y Policy determinista; si no hay evidencia fiable, revisión en vez de autorización arbitraria.

**¿Y sin internet?** Retenciones basadas en reglas permanecen seguras en backend; degradación y fallback según política. En prototipo no afirmar resiliencia no probada.

**¿Cómo conocen que alguien está en llamada?** En ese escenario es una señal simulada. En producción haría falta fuente autorizada; motor puede usar otras señales sin ella.

**¿Quién decide que una cuenta es mula?** Documentos originales: revisión humana para confirmación persistente. Una señal sospechosa sólo habilita controles provisionales, no sentencia penal.

**¿Protege cuentas de otros bancos?** Sólo el universo que cubre la integración; los datos interbancarios están fuera del MVP.

**¿Cómo justifican las tasas?** Etiquetas predefinidas en test sintético, segregadas del motor. Resultados sólo para ese conjunto, con denominadores y fallos.

**¿Dónde está la tracción?** Traer entrevistas, uso observado y feedback verificables; preferencia de asistentes ≠ disposición de compra bancaria.

## Métricas del jurado
Guía oficial: 30% tracción, 40% esfuerzo técnico, 30% pitch; 3 min exposición + 2 min preguntas. https://hacktheandes.com/guide. Priorizar pruebas replicables sobre arte adicional.
