-- Nachbau der Teile von Supabase, auf die unsere Migrationen und RLS-Regeln bauen, für die Tests
-- mit PGlite (supabase/tests/db.ts). Nicht für das echte Projekt.
--
-- Wie bei Supabase: Rollen anon, authenticated, service_role; auth.uid() liest die Person aus den
-- JWT-Angaben der Anfrage; Tabellen und Funktionen im Schema public sind standardmässig für alle drei
-- Rollen freigegeben – geschützt wird allein über RLS und ausdrückliches Entziehen. Abweichungen zum
-- echten Supabase (Version, Erweiterungen, Auth) sind möglich; die Tests ersetzen nicht die Prüfung
-- mit den Supabase Advisors nach dem Anwenden.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
