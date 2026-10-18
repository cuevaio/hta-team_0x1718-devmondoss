# 15 · Salas, multijugador y eventos realtime

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Propuesta
Salas de hasta ocho personas; el modo demo de jurado opera con un solo navegador. Mantener independencia por `room_id` (saldos, cuentas, memoria, eventos, encuestas). Crear sala especial de exhibición sólo si se controla el aislamiento y se informa que reutiliza información.

## Lo que sí se sincroniza
`join/leave`, fase de ronda, reloj canónico, acciones de transferencia, estados confirmados por motor, evidencia pública, marcador y cierre. **No** sincronizar posición de sprite cada frame para el MVP.

## Servicios
- `Presence`: presencia de participantes, join/leave y rol visible; uso de baja frecuencia.
- `Broadcast`: envío de hechos ya persistidos. Recomendado para actualizaciones de estado por sala.
- `Postgres`: verdad canónica, replay, cálculo de métricas. Las publicaciones realtime no son almacenamiento duradero.

Fuentes oficiales: https://supabase.com/docs/guides/realtime/broadcast ; https://supabase.com/docs/guides/realtime/presence ; https://supabase.com/docs/guides/realtime/subscribing-to-database-changes

## Contrato de topic propuesto
`room:{roomId}:events` para jugadores; `room:{roomId}:monitor` para inspector; `room:{roomId}:presence` para participantes; separar permisos, no esconder sólo campos en frontend. Ideal usar canales privados + auth e instrumentar RLS.

## Orden y reconexión
1. Cliente recibe snapshot `{last_seq}` al ingresar.
2. Se suscribe a eventos.
3. Al reconectar solicita `/events?after_seq=last_seq`.
4. Descarta duplicados por `event_id`, reordena por `seq`, revisa huecos.
5. Nunca concluye pago ejecutado por una animación del cliente.

## Simultaneidad y fairness
Servidores asignan `scenario_run_id`, `room_id`, `event_id`, actor y versión. Las cartas adversariales tienen rate limit y cooldown. Un intento del adversario debe disparar un evento real aunque el motor falle; registrarlo como error, no «bloqueado» ficticio.

## Sin red / fallback
El jugador ve último estado persistido como «sincronización interrumpida». El monitor puede refrescar manualmente por API. No simular progreso nuevo cuando no hay conectividad.

## No mezclar universos
Al cerrar sala de prueba borrar **o archivar con anonimización** los alias según política declarada. No dejar que la muestra del día anterior altere la próxima ronda, salvo pruebas específicamente etiquetadas de aprendizaje acumulativo.
