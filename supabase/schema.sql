-- Jhon Fit — esquema do banco (PostgreSQL / Supabase)
-- Rode este arquivo uma vez em: Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem medo: tudo aqui é idempotente.

-- 1) Uma linha por usuário, com todos os dados do app em JSON.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        bigint      not null default 1,          -- contador de versão (controle de concorrência)
  updated_at timestamptz not null default now()
);

comment on table  public.user_data     is 'Dados do Jhon Fit: uma linha por usuário.';
comment on column public.user_data.rev is 'Incrementado a cada gravação; o app só grava se a rev for a que ele conhece.';

-- 2) Row Level Security: sem isto, qualquer pessoa com a chave pública leria tudo.
--    Com isto, cada usuário logado só enxerga e altera a PRÓPRIA linha.
alter table public.user_data enable row level security;

drop policy if exists "ler os próprios dados"       on public.user_data;
drop policy if exists "criar os próprios dados"     on public.user_data;
drop policy if exists "atualizar os próprios dados" on public.user_data;
drop policy if exists "apagar os próprios dados"    on public.user_data;

create policy "ler os próprios dados" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "criar os próprios dados" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "atualizar os próprios dados" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "apagar os próprios dados" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3) Permissões: visitantes anônimos não têm acesso algum à tabela.
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- ---------------------------------------------------------------------------
-- Consultas úteis para explorar seus dados no SQL Editor (lá você é administrador
-- e enxerga todas as linhas; no app, cada usuário só vê a sua).
--
-- Treinos por usuário:
--   select u.email, jsonb_array_length(d.data->'sessions') as treinos, d.rev, d.updated_at
--   from public.user_data d join auth.users u on u.id = d.user_id;
--
-- "Explodir" o JSON em uma linha por série (peso × repetições):
--   select u.email,
--          to_timestamp((s->>'start')::bigint / 1000)::date as dia,
--          s->>'name'            as treino,
--          i->>'exId'            as exercicio,
--          nullif(replace(st->>'w', ',', '.'), '')::numeric as peso,   -- o app aceita vírgula decimal
--          nullif(replace(st->>'r', ',', '.'), '')::numeric as reps
--   from public.user_data d
--   join auth.users u on u.id = d.user_id,
--        jsonb_array_elements(d.data->'sessions') s,
--        jsonb_array_elements(s->'items')         i,
--        jsonb_array_elements(i->'sets')          st
--   order by dia desc;
-- ---------------------------------------------------------------------------
