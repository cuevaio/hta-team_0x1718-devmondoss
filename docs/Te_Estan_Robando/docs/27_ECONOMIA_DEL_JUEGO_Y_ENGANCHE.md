# 27 · Mecánicas sociales, progresión y scoring

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Por qué jugarían
Una historia tensa de 1–2 minutos, consecuencias visibles, colaboración involuntaria entre partidas, comparación de decisiones, desafío de encontrar huecos del sistema y revelación final de cómo actuaron los agentes. La curiosidad debe conducir a **pruebas**, no a explotar usuarios.

## Loop de 60 segundos
Seleccionar rol → objetivo cotidiano → evento narrativo → decisión táctil → API → resultado visual verificado → feedback → siguiente paso. Máx. 2–3 interacciones por beat, sin tutorial largo.

## Roles
Ciudadanos: completar tareas económicas de la ciudad, con pagos legítimos y situaciones de presión. Adversarios: elegir cartas abstractas de escenarios autorizados con límite de intentos. Espectador: leer monitor y hechos, nunca editar eventos.

## Scoring lúdico (separado de KPI técnico)
- Ciudadano gana `tarea_completada` por ventas/pagos finalizados; ningún punto por culpar a víctimas.
- Adversario obtiene «descubrimiento» por una limitación real del motor en escenarios preautorizados. No recompensa montos de robo monetario simulados ni da instrucciones operativas.
- Bonus de equipo por detectar falsos positivos: reconocer que el comercio legítimo merece pasar.
- Monitor muestra métricas de seguridad basadas en ledger con números separados del juego. **La puntuación de jugadores NO entra en tasas TPR/FPR.**

## Cartas de adversario
Categorías abstractas: «autoridad aparente», «mensaje impostor», «dispositivo inusual», «beneficiario nuevo», «horario atípico», «bajo monto», «cuenta destino sin historial». El servidor elige un template. No incluir guiones de ingeniería social, instrucciones sobre clonación de SIM, herramientas de malware o optimización para evadir filtros reales.

## Desbloqueo narrativo
Una cuenta sintética M-01 aparece en más de una sesión; el investigador encuentra patrón; se consulta Memoria; el barrio observa que la segunda operación se protege sin repetición de IA. El hallazgo sólo se activa cuando el backend lo confirma. Si no ocurre, mostrar investigación en curso.

## Mantener justo el experimento
Orden aleatorio de tareas, pero estratificar por escenario; registrar quién recibió cada condición. No modificar scores del motor según identidad/nivel del jugador. No convertir un falso negativo en «victoria bancaria» por conveniencia narrativa.
