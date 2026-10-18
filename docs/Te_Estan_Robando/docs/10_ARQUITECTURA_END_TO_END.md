# 10 · Arquitectura general y límites de confianza

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Objetivo técnico
Llevar una acción del juego a una **operación sintética duradera**, usar el motor descrito por el equipo para decidir, persistir la decisión y sólo entonces publicar un evento visible. Phaser no decide si hay fraude y React no modifica el ledger.

```mermaid
flowchart TB
subgraph CLIENTE[Interfaces]
 P[Phaser /play /arena] --> NX[React/Next.js]
 MON[/monitor/] --> NX
end
NX --> GA[Game API / permisos / idempotencia]
GA --> GS[Escenario / generador de eventos]
GS --> TX[Adaptador de transferencias]
TX --> DB[(Postgres: ledger + casos + outbox)]
TX --> R{Memoria confirmada + Reglas L0}
R -->|bajo seguro| POL[Policy determinista]
R -->|riesgoso| HOLD[Persistir HELD antes IA]
HOLD --> CO[Coordinador]
CO --> G[Guardián]
CO --> D[Detective]
G --> POL
D --> POL
POL --> DB
POL --> AUD[Auditor de evidencias]
AUD --> DB
DB --> OUT[Outbox / publicador]
OUT --> RT[Supabase Broadcast]
RT --> NX
end
```

## Fronteras de confianza
1. **Navegador**: no confiable; acciones lúdicas y presentación. Un usuario puede modificar requests; no debe conseguir score arbitrario ni extraer etiquetas.
2. **Game API**: valida sala, rol, lista de acciones y cupos; aplica rate limit; decide qué simulación crear.
3. **Adaptador**: traduce al esquema actual del motor. Mapear a endpoints existentes **después de inspeccionar repositorio**; los MD no demuestran que todos funcionen.
4. **Motor**: reglas, agentes y Policy son fuente de decisiones.
5. **DB**: fuente de estado y orden canónico de eventos; Broadcast sólo difusión efímera.
6. **Monitor**: lectura de datos sanitizados; no entra a tablas de verdad oculta.

## Orden seguro de operación
Crear intento con estado `PENDING`; evaluar Memoria confirmada y reglas; si el caso requiere pausa, **confirmar DB/ledger como `HELD` antes de iniciar IA**. No prometer protección si la base de datos no confirmó estado.

## Multiagentes
Coordinador decide qué agente se invoca; Guardián verifica contexto (si canal fiable), Detective consulta herramientas deterministas (fan-in/reenvío/cadena); Auditor valida que afirmaciones citan evidencia; Policy resuelve usando entradas tipadas y reglas versionadas. Los agentes **no pueden aprobar ni transferir dinero directamente**.

## Privacidad e integridad
La `scenario_truth` nunca entra en el prompt ni en respuesta del motor. Evidence stores separadas de análisis humano. Las citas E-XX enlazan a cálculos reproducibles, no a textos fabricados por el modelo.

## Entorno y deploy
Next.js + Phaser para experiencia; backend API y DB compartidos; Broadcast por sala; token temporal y control de acceso. No confiar en estado en memoria de instancia serverless. Diseño operable desde enlaces públicos del evento. Phaser documenta plantilla oficial Next.js: https://docs.phaser.io/phaser/getting-started/project-templates.

## Disponibilidad y recuperación
Timeout Guardián: no liberar `HELD` por defecto. Reintento de broadcast: UI recupera estado desde DB. Doble request: idempotencia. Caída en modo demo: registrar fallo real y mostrarlo. Ver [34](28_OBSERVABILIDAD_Y_AUDITORIA.md).
