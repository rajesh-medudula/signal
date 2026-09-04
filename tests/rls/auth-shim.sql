-- Minimal, faithful shim of the pieces of Supabase's `auth` schema that
-- RLS policies actually depend on: the `auth.users` table (for the FK
-- target) and `auth.uid()` (reads the same session GUC Supabase sets
-- per-request: request.jwt.claims). Roles mirror Supabase's real ones.
-- This is test-only scaffolding — never part of a real migration.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant anon to postgres;
grant authenticated to postgres;
grant service_role to postgres;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;

create schema if not exists private;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
