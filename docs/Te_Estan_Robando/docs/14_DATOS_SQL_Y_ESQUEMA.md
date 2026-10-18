# 14 · Modelo de datos y SQL de referencia

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Principios
Sala = universo sintético aislado; `scenario_version` + seed = reproducibilidad; DB = fuente de verdad; verdad oculta = acceso exclusivo a evaluador; logs = append-only para auditoría. Lo siguiente es un **esquema orientativo**, no una migración probada en el código actual.

```sql
create table game_rooms (
 id uuid primary key default gen_random_uuid(),
 status text not null check (status in ('LOBBY','RUNNING','CLOSED')),
 scenario_set_version text not null,
 created_at timestamptz not null default now()
);
create table game_sessions (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 alias text not null, role text not null,
 treatment_arm text, consent_telemetry boolean not null default false,
 joined_at timestamptz not null default now()
);
create table scenario_runs (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 scenario_id text not null, scenario_version text not null,
 seed bigint not null, status text not null default 'RUNNING',
 started_at timestamptz not null default now()
);
create table synthetic_accounts (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 display_label text not null, profile_type text not null,
 opening_balance_pen numeric(16,2) not null default 0
);
create table simulated_transfers (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 run_id uuid not null references scenario_runs(id),
 sender uuid not null references synthetic_accounts(id),
 beneficiary uuid not null references synthetic_accounts(id),
 amount_pen numeric(16,2) not null check (amount_pen > 0),
 state text not null check(state in ('PENDING','HELD','RELEASED','REJECTED','FAILED')),
 idempotency_key text not null,
 accepted_at timestamptz not null default now(),
 held_committed_at timestamptz,
 executed_at timestamptz,
 unique(room_id,idempotency_key)
);
create table game_event_log (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 run_id uuid not null references scenario_runs(id),
 seq bigint not null,
 kind text not null,
 public_payload jsonb not null,
 created_at timestamptz not null default now(),
 unique(room_id,seq)
);
create table agent_calls (
 id uuid primary key default gen_random_uuid(),
 transfer_id uuid not null references simulated_transfers(id),
 agent text not null, started_at timestamptz, finished_at timestamptz,
 tokens_used integer, status text, failure_reason text
);
create table account_memory (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references game_rooms(id),
 account_id uuid not null references synthetic_accounts(id),
 status text not null check (status in ('SUSPECTED','CONFIRMED','DISMISSED','EXPIRED')),
 validated_by text, valid_until timestamptz,
 evidence_ids jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
```

## Tablas adicionales necesarias
`game_actions` (acciones y actor), `risk_signals` (valor, procedencia), `policy_decisions` (rule_id/version/antes/después), `case_files` (expedientes), `evidence` (valor computado, IDs de movimiento), `survey_responses` (encuesta voluntaria), `scenario_truth` (separada, acceso restringido), `outbox` (eventos no publicados aún), `ledger_entries` (doble entrada sintética si modeláis saldos).

## Reglas de integridad en base
- Asegurar aislamiento en todas las lecturas mediante `room_id`; usar políticas RLS, validación de servidor y pruebas cruzadas.
- Índices para `(room_id,seq)`, `simulated_transfers(beneficiary,accepted_at)` y movimientos usados en analytics.
- Nunca actualizar `game_event_log` por motivos estéticos; versión de eventos / correcciones como nuevos registros.
- Si necesitáis fan-in de la partida, calcular sobre transferencias **realmente ejecutadas en ledger simulado**, diferenciándolas de intentos retenidos. Para tipologías que cuentan intentos, registrar ambos como medidas separadas.
- Evitar almacenar balances como mutaciones no auditables. Usar entradas de ledger y snapshots de lectura.

## Semilla y ground truth
Conservar etiquetas verdaderas del diseño del escenario en un esquema privado, accesible sólo al evaluador del benchmark, **nunca** a Guardián/Detective o UI pública. No se puede calcular tasa de aciertos si la verdad se deduce del resultado del modelo.

## SQL no equivale a código final
Faltan explícitamente triggers, RLS completa, atomicidad de ledger, outbox publisher y migraciones; implementarlos conforme al backend elegido y cubrirlos con pruebas. Ver [20](20_PLAN_QA_PRUEBAS_Y_ACEPTACION.md).
