# 30 · Runbook de despliegue, demo y entrega

> **Te están robando — El barrio no duerme** · Especificación de diseño y validación · Corte documental: 17/10/2026 · Datos sintéticos. Los contratos y algoritmos propuestos requieren implementación y prueba.

## Restricción del evento
Hack The Andes 17–18/10/2026; jurado abre URLs desde ordenador propio de organización, sin conectar la laptop del equipo. Entregar app, slides, GitHub y descripción Markdown; demo 3 min pitch + 2 min Q&A. https://hacktheandes.com/guide

## Configuración sugerida
- Frontend Next.js/Phaser deploy con ruta `/demo` pública y `/monitor` de sólo lectura.
- Backend de orquestación y workers con estado en DB; no depender de variables en memoria de un proceso efímero para salas persistentes.
- PostgreSQL/Supabase (RLS y backups), Realtime Broadcast autorizado, rate limits y presupuesto de llamadas.
- Variables `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` cliente, claves secretas exclusivamente servidor, `MODEL_API_KEY` servidor (nombres indicativos, adecuar al código). No incluir valores ni `.env` en ZIP público.

## Preflight antes de que empiece la evaluación
1. Revisar despliegue en ventana incógnito sin sesiones previas ni links localhost.
2. URL `/demo` arranca nuevo run con seed trazable y 1 clic; status muestra `run_id`.
3. Crear una operación y observar `HELD` real, evidencia y políticas.
4. Pagar a M-01 confirmada sintética, confirmar 0 IA.
5. Pagar a Don Pepe legítimo, confirmar estado `RELEASED`.
6. Probar caída del modelo y latencia, mostrando degradación honesta.
7. Comprobar que monitor y juego comparten `run_id`, RLS, y no hay mezcolanza de sesiones.
8. Exportar reportes de pruebas anteriores para contingencia, etiquetados `REPLAY`.
9. Revisar consumo/cuotas, UI proyectada a 5 m, sonido opcional.
10. Asegurar links repo/slides/descripcion, comprobar nombres y derechos de assets.

## Datos que NO deben entrar en git ni en entregas
Credenciales, secretos, token de Discord, llaves de servicios, datos personales de participantes, logs con IPs, expedientes bancarios reales, resultados ficticios presentados como reales.

## Scripts / comandos de evento oficiales (ejemplos)
```bash
andes project update --message "Validamos el flujo de retención sintética con un escenario reproducible."
andes project submit --deployment-url https://TU-APP --presentation-url https://TUS-SLIDES --github-url https://github.com/TU-EQUIPO/TU-REPO --file ./ENTREGA_PROYECTO.md
andes project
```
**Nunca** ejecutar submit/update hasta tener evidencia y autorización del equipo. URLs anteriores son marcadores de posición, no enlaces existentes.

## Operación durante la demo
Presentador abre URL pública; 2 personas del equipo controlan demo y monitor si es necesario, pero el jurado no debe depender de sus cuentas. Ante fallo HTTP mostrar número de intento y explicación. Usar replay guardado solo como reserva, explicitándolo.

## Plan de reversión
Conservar último deploy probado (commit/versión), ruta pública estable y flag para desactivar features experimentales de juego sin comprometer flujo bancario. Si falla realtime, consultar `/events` en polling básico.
