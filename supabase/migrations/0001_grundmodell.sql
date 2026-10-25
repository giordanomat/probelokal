-- ENTWURF vom 25.10.2026 – ungeprüft. Vor dem ersten Einsatz mit der Supabase-CLI lokal anwenden,
-- RLS mit Tests pro Rolle prüfen (Mitglied, Registerchef, Leitung, fremde Person) und dann versionieren.
-- Grundsatz: Einzelwerte liest nur die Person selbst; die Leitung bekommt nur Aggregate über Funktionen.

create type role_in_guugge as enum ('leitung', 'registerchef', 'mitglied');
create type register_kind as enum ('trp', 'pos', 'tief', 'perc');
create type hint_kind as enum ('dyn', 'artik', 'atem', 'text');
create type exam_via as enum ('quiz', 'grip', 'mic', 'rhythm');

-- Personen ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Guuggen und Mitgliedschaften ------------------------------------------
create table guuggen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rangliste_enabled boolean not null default false,
  level_rewards jsonb not null default '{}',          -- {"2": "Getränk nach der Probe", ...}
  created_at timestamptz not null default now()
);

create table memberships (
  guugge_id uuid references guuggen on delete cascade,
  user_id uuid references profiles on delete cascade,
  role role_in_guugge not null default 'mitglied',
  voice text,                                          -- z. B. 'trp1'
  register register_kind,
  rangliste_opt_in boolean not null default false,     -- Standard aus
  primary key (guugge_id, user_id)
);

create table invites (
  token text primary key,
  guugge_id uuid references guuggen on delete cascade,
  role role_in_guugge not null default 'mitglied',
  expires_at timestamptz not null
);

-- Katalog ----------------------------------------------------------------
create table titles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                           -- 'bad-touch-2-0'
  name text not null,
  artist text,
  arranger text,
  version text not null,                               -- 'Schuegu27'
  bpm numeric not null,
  bars int not null,
  sections jsonb not null,                             -- [{from,to,name}]
  voices jsonb not null,                               -- [{id,name,part,kind,shift,register}]
  stem_offset_sec numeric not null default 0,          -- Versatz Einzelspuren zu Takt 0
  published boolean not null default false
);

create table title_assets (
  id uuid primary key default gen_random_uuid(),
  title_id uuid references titles on delete cascade,
  kind text not null check (kind in ('musicxml','notes_json','stem','minus','all')),
  voice text,
  storage_path text not null
);

create table licenses (
  guugge_id uuid references guuggen on delete cascade,
  title_id uuid references titles on delete cascade,
  purchased_at timestamptz not null default now(),
  stripe_session text,
  primary key (guugge_id, title_id)
);

-- Probe und Plan --------------------------------------------------------
create table plans (
  guugge_id uuid references guuggen on delete cascade,
  title_id uuid references titles on delete cascade,
  start_date date not null,
  perf_date date not null,
  gp_weekday int not null check (gp_weekday between 0 and 6),
  rp_weekday int check (rp_weekday between 0 and 6),
  minutes_per_week int not null default 60,
  updated_at timestamptz not null default now(),
  primary key (guugge_id, title_id)
);

create table hints (
  id uuid primary key default gen_random_uuid(),
  guugge_id uuid references guuggen on delete cascade,
  title_id uuid references titles on delete cascade,
  bar_from int not null,
  bar_to int not null,
  target text not null,                                -- 'alle' | register | voice
  kind hint_kind not null,
  dyn text,
  body text,
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

create table hint_reads (
  hint_id uuid references hints on delete cascade,
  user_id uuid references profiles on delete cascade,
  read_at timestamptz not null default now(),
  primary key (hint_id, user_id)
);

-- Fortschritt (nur über Edge Functions beschreibbar) --------------------
create table exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  guugge_id uuid references guuggen on delete cascade,
  title_id uuid references titles on delete cascade,
  voice text not null,
  section int not null,
  stage int not null check (stage between 1 and 5),
  score numeric not null,
  via exam_via not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  guugge_id uuid references guuggen on delete cascade,
  points int not null,
  reason text not null,
  ref uuid,
  created_at timestamptz not null default now()
);

create table practice_days (
  user_id uuid references profiles on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- Hilfsfunktionen ---------------------------------------------------------
create function is_member(g uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from memberships where guugge_id = g and user_id = auth.uid())
$$;
create function is_leitung(g uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from memberships where guugge_id = g and user_id = auth.uid() and role = 'leitung')
$$;

-- RLS ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table guuggen enable row level security;
alter table memberships enable row level security;
alter table invites enable row level security;
alter table titles enable row level security;
alter table title_assets enable row level security;
alter table licenses enable row level security;
alter table plans enable row level security;
alter table hints enable row level security;
alter table hint_reads enable row level security;
alter table exam_results enable row level security;
alter table points_ledger enable row level security;
alter table practice_days enable row level security;

create policy "eigenes Profil" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Guugge lesen" on guuggen for select using (is_member(id));
create policy "Guugge ändern (Leitung)" on guuggen for update using (is_leitung(id));
-- Mitgliedschaften: eigene Zeile lesen und eigene Stimme/Opt-in ändern; Leitung verwaltet Rollen.
-- Keine allgemeine Leseregel auf fremde Zeilen: Namen der Mitglieder kommen über eine Funktion, die nur Namen und Rollen liefert.
create policy "eigene Mitgliedschaft" on memberships for select using (user_id = auth.uid() or is_leitung(guugge_id));
create policy "eigene Stimme und Opt-in" on memberships for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Leitung verwaltet" on memberships for all using (is_leitung(guugge_id)) with check (is_leitung(guugge_id));
create policy "Titel lesen" on titles for select using (published);
create policy "Assets mit Lizenz" on title_assets for select using (
  exists(select 1 from licenses l join memberships m on m.guugge_id = l.guugge_id where l.title_id = title_assets.title_id and m.user_id = auth.uid()));
create policy "Lizenzen lesen" on licenses for select using (is_member(guugge_id));
create policy "Plan lesen" on plans for select using (is_member(guugge_id));
create policy "Plan schreiben (Leitung)" on plans for all using (is_leitung(guugge_id)) with check (is_leitung(guugge_id));
create policy "Hinweise lesen" on hints for select using (is_member(guugge_id));
create policy "Hinweise schreiben (Leitung)" on hints for all using (is_leitung(guugge_id)) with check (is_leitung(guugge_id));
create policy "eigene Lesebestätigung" on hint_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eigene Ergebnisse lesen" on exam_results for select using (user_id = auth.uid());
create policy "eigene Punkte lesen" on points_ledger for select using (user_id = auth.uid());
create policy "eigene Übetage lesen" on practice_days for select using (user_id = auth.uid());
-- Schreiben auf exam_results, points_ledger, practice_days nur mit Service-Rolle (Edge Functions).

-- Aggregate für die Leitung: nur Register mit mindestens 3 Personen --------
create function register_overview(g uuid, t uuid)
returns table(register register_kind, persons int, avg_stage_by_section jsonb, practiced_this_week int)
language sql stable security definer set search_path = public as $$
  -- ENTWURF: berechnet pro Register die durchschnittlich erreichte Etappe je Teil.
  with allowed as (select is_leitung(g) as ok),
  best as (
    select m.register, e.user_id, e.section, max(e.stage) filter (where e.passed) as stage
    from memberships m join exam_results e on e.user_id = m.user_id and e.guugge_id = m.guugge_id
    where m.guugge_id = g and e.title_id = t
    group by m.register, e.user_id, e.section
  ),
  per_reg as (
    select m.register, count(distinct m.user_id) as persons
    from memberships m where m.guugge_id = g and m.register is not null group by m.register
  )
  select p.register, p.persons::int,
    -- Achtung: Personen ohne jedes Ergebnis fehlen in »best« und ziehen den Schnitt nicht nach unten; beim Umsetzen mit 0 auffüllen.
    (select jsonb_object_agg(x.section, x.a) from (
       select b.section, round(avg(coalesce(b.stage,0))::numeric, 1) as a from best b where b.register = p.register group by b.section) x),
    (select count(distinct d.user_id)::int from practice_days d join memberships m2 on m2.user_id = d.user_id
       where m2.guugge_id = g and m2.register = p.register and d.day >= date_trunc('week', now())::date)
  from per_reg p, allowed a
  where a.ok and p.persons >= 3;
$$;

-- Rangliste: nur Personen mit Opt-in in Guuggen mit eingeschalteter Rangliste --
create function leaderboard(g uuid)
returns table(user_id uuid, display_name text, voice text, points bigint, week_points bigint)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.display_name, m.voice,
    coalesce(sum(l.points), 0),
    coalesce(sum(l.points) filter (where l.created_at >= date_trunc('week', now())), 0)
  from memberships m
  join guuggen gg on gg.id = m.guugge_id and gg.rangliste_enabled
  join profiles p on p.id = m.user_id
  left join points_ledger l on l.user_id = m.user_id and l.guugge_id = m.guugge_id
  where m.guugge_id = g and m.rangliste_opt_in and is_member(g)
  group by m.user_id, p.display_name, m.voice;
$$;
