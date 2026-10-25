-- Anmeldungen »Benachrichtige mich« von der Landingpage arrangements.giordanomat.de.
-- Angewendet am 25.10.2026 von Hand im Supabase-SQL-Editor (Projekt qieunfhizsxsyzmrrvci, Zürich),
-- in zwei Schritten (zuerst mit direktem INSERT für anon, dann auf diese Funktion umgestellt); Endstand = diese Datei.
-- Sobald die Supabase-CLI eingerichtet ist: `supabase migration repair --status applied 20261025140000`.
--
-- Regeln:
-- - Die Seite (Rolle anon, publishable key) darf nur die Funktion signup() aufrufen. Nichts lesen,
--   nichts ändern, nichts löschen. Ansehen nur im Supabase-Dashboard (Table Editor).
-- - Jede Adresse nur einmal; Doppelte werden still übergangen (verrät nicht, wer eingetragen ist).
-- - confirmed_at bleibt leer, bis das Double-Opt-in gebaut ist. Vorher an niemanden schreiben.

create table public.signups (
  id bigint generated always as identity primary key,
  email text not null unique
    check (email = lower(email) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  consent boolean not null check (consent),
  source text check (source is null or length(source) <= 100),
  consented_at timestamptz not null default now(),
  confirmed_at timestamptz
);

comment on table public.signups is
  'Benachrichtigung zum Start (Landingpage). Einfügen nur über public.signup(). Double-Opt-in fehlt noch: confirmed_at leer = nicht anschreiben.';

alter table public.signups enable row level security;

-- Keine Rechte für anon/authenticated auf der Tabelle; RLS ohne Policy = alles gesperrt.
revoke all on table public.signups from anon, authenticated;

-- Eintragen nur über diese Funktion: Doppelte werden still übergangen, damit niemand über die
-- Antwort herausfinden kann, ob eine Adresse schon eingetragen ist (direktes INSERT gäbe 409).
create function public.signup(p_email text, p_consent boolean, p_source text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.signups (email, consent, source)
  values (lower(trim(p_email)), p_consent, left(p_source, 100))
  on conflict (email) do nothing;
$$;

revoke all on function public.signup(text, boolean, text) from public, anon, authenticated;
grant execute on function public.signup(text, boolean, text) to anon;
