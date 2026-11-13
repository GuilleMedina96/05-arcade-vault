-- SPEC 06: catálogo de juegos y puntuaciones

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text,
  created_at  timestamptz not null default now()
);

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  alias      text not null check (alias ~ '^[A-Za-z0-9_-]{3,12}$'),
  score      integer not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);

create index scores_game_ranking_idx
  on public.scores (game_id, score desc, created_at asc);

-- RLS
alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "scores_select_public"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- Semilla
insert into public.games (slug, name, description)
values (
  'asteroids',
  'Asteroids',
  'Pilota tu nave, destruye las rocas y sobrevive en el espacio.'
);
