-- PsiAgenda — schema do banco de dados no Supabase.
-- Rode este script inteiro em: Supabase → seu projeto → SQL Editor → New query → Run.

create table if not exists profissionais (
  id text primary key,
  nome text not null
);

create table if not exists usuarios (
  username text primary key,
  nome text not null,
  senha_hash text not null,
  role text not null,             -- 'admin' | 'profissional' | 'recepcao'
  profissional_id text references profissionais(id)
);

-- Cada linha é um horário de sessão concreto (início, fim, paciente, observações).
-- Não existe uma grade fixa de horários: a recepção (ou o admin) cria e edita
-- os horários livremente, dia a dia. O(a) profissional só preenche/edita o
-- paciente e as observações dos horários já criados.
create table if not exists agendamentos (
  id bigint generated always as identity primary key,
  profissional_id text not null references profissionais(id),
  data text not null,             -- formato 'AAAA-MM-DD'
  horario_inicio text not null,   -- formato 'HH:MM'
  horario_fim text not null,      -- formato 'HH:MM'
  paciente text default '',
  obs text default ''
);

-- Como o app já valida login/permissão sozinho (JWT) e acessa o Supabase com a
-- Service Role Key (só o servidor tem essa chave), não é preciso Row Level
-- Security aqui.
alter table profissionais disable row level security;
alter table usuarios disable row level security;
alter table agendamentos disable row level security;

-- Não é preciso semear nenhum usuário: enquanto não existir um "admin" real na
-- tabela "usuarios", o login de primeiro acesso funciona com usuário "admin" e
-- senha "admin123" (veja o README).
