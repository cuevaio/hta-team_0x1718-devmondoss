-- Partidas del demo jugable (rondas A/B contra el motor) y jugadas arcade.
-- Cada fila guarda el registro completo en `data`; alias/tipo/t son columnas
-- para consultar y agrupar sin abrir el JSON.

create table if not exists public.partidas (
  id    text primary key,
  t     timestamptz not null,
  alias text not null,
  tipo  text not null,         -- 'victima' | 'atacante'
  data  jsonb not null
);

create table if not exists public.jugadas_arcade (
  id    text primary key,
  t     timestamptz not null,
  alias text not null,
  tipo  text not null,         -- 'real_o_estafa' | 'sigue_el_dinero'
  data  jsonb not null
);

create index if not exists partidas_alias_idx on public.partidas (lower(alias));
create index if not exists jugadas_arcade_alias_idx on public.jugadas_arcade (lower(alias));
create index if not exists jugadas_arcade_tipo_idx on public.jugadas_arcade (tipo);

-- Solo el servidor (service_role, que se salta RLS) lee y escribe.
alter table public.partidas enable row level security;
alter table public.jugadas_arcade enable row level security;
