-- M2 · Konten und Guuggen: Profile, Guugge anlegen, Einladung per Link, Stimme, Rollen, Opt-in.
-- Getestet mit supabase/tests/rls.spec.ts (PGlite mit nachgebautem Supabase-Rahmen, siehe dort);
-- gegen das echte Projekt ungeprüft, bis die Migration über den Ablauf »Supabase-Migrationen«
-- angewendet ist (docs/03).
--
-- Grundsatz: Mitgliedschaften, Einladungen und Fortschritt ändert der Browser nie direkt, nur über
-- Funktionen, die selbst prüfen, wer was darf. Behebt eine Lücke aus 0001: Die Regel »eigene Stimme
-- und Opt-in« erlaubte das Ändern der ganzen eigenen Zeile, also auch der Rolle – ein Mitglied
-- hätte sich selbst zur Leitung machen können. Umgekehrt konnte die Leitung das Opt-in für die
-- Rangliste anderer setzen.

-- Profile ------------------------------------------------------------------
-- Jedes Konto bekommt beim Anlegen ein Profil (Name kommt optional aus den Metadaten der Anmeldung).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40))
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Konten, die es vor dieser Migration schon gab
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

alter table public.profiles add constraint profiles_display_name_len check (length(display_name) <= 40);

drop policy "eigenes Profil" on public.profiles;
create policy "eigenes Profil lesen" on public.profiles for select using (id = auth.uid());
create policy "eigenen Namen ändern" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, delete on public.profiles from authenticated;

-- Guuggen ------------------------------------------------------------------
alter table public.guuggen add constraint guuggen_name_len check (length(trim(name)) between 1 and 60);

-- Mitgliedschaften: lesen wie bisher (eigene Zeile, Leitung alle), schreiben nur über Funktionen.
drop policy "eigene Stimme und Opt-in" on public.memberships;
drop policy "Leitung verwaltet" on public.memberships;
revoke insert, update, delete on public.memberships from authenticated;

-- Einladungen: Im Link steht der Schlüssel, gespeichert wird nur sein SHA-256. Wer die Tabelle
-- liest (nur Service-Rolle), kann damit niemanden einladen. Eine Einladung gilt für mehrere
-- Personen, bis sie abläuft oder die Leitung alle Einladungen zurückzieht.
delete from public.invites;
alter table public.invites rename column token to token_hash;
alter table public.invites
  add column created_by uuid references public.profiles on delete set null,
  add column created_at timestamptz not null default now();
revoke all on public.invites from authenticated;

-- Fortschritt, Katalog und Lizenzen: auch ohne RLS-Regel ausdrücklich keine Schreibrechte.
revoke insert, update, delete on
  public.exam_results, public.points_ledger, public.practice_days,
  public.titles, public.title_assets, public.licenses
from authenticated;

-- Hinweise -----------------------------------------------------------------
alter table public.hints
  add constraint hints_bars check (bar_from >= 0 and bar_to >= bar_from),
  add constraint hints_target check (target ~ '^[a-z]{2,8}[0-9]?$'),
  add constraint hints_body_len check (body is null or length(body) <= 500);

-- Lesebestätigung nur für Hinweise der eigenen Guugge
drop policy "eigene Lesebestätigung" on public.hint_reads;
create policy "eigene Lesebestätigung" on public.hint_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.hints h where h.id = hint_id and public.is_member(h.guugge_id)));

-- Stimme → Register ----------------------------------------------------------
-- Stimmen heissen wie in titles.voices (trp1, pos2, euph, sous …). Unbekannte Stimmen haben kein
-- Register und werden abgelehnt.
create function public.voice_register(p_voice text) returns public.register_kind
language sql immutable set search_path = '' as $$
  select case
    when p_voice ~ '^trp[0-9]?$' then 'trp'
    when p_voice ~ '^pos[0-9]?$' then 'pos'
    when p_voice ~ '^(euph|bari|tuba|sous)[0-9]?$' then 'tief'
    when p_voice ~ '^(perc|drum|pauke)[0-9]?$' then 'perc'
  end::public.register_kind
$$;

-- Funktionen für die Oberfläche --------------------------------------------
create function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.' using errcode = '42501';
  end if;
  return auth.uid();
end
$$;

-- Neue Guugge; wer sie anlegt, ist Leitung.
create function public.create_guugge(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  g uuid;
begin
  insert into public.guuggen (name) values (trim(p_name)) returning id into g;
  insert into public.memberships (guugge_id, user_id, role) values (g, me, 'leitung');
  return g;
end
$$;

-- Einladung erstellen (nur Leitung). Gibt den Schlüssel einmalig zurück.
create function public.create_invite(p_guugge uuid, p_role public.role_in_guugge default 'mitglied', p_days int default 14)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann einladen.' using errcode = '42501';
  end if;
  if p_days not between 1 and 60 then
    raise exception 'Eine Einladung gilt 1 bis 60 Tage.' using errcode = '22023';
  end if;
  insert into public.invites (token_hash, guugge_id, role, expires_at, created_by)
  values (encode(sha256(convert_to(token, 'UTF8')), 'hex'), p_guugge, p_role, now() + make_interval(days => p_days), me);
  return token;
end
$$;

-- Alle offenen Einladungen einer Guugge zurückziehen (nur Leitung).
create function public.revoke_invites(p_guugge uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Einladungen zurückziehen.' using errcode = '42501';
  end if;
  delete from public.invites where guugge_id = p_guugge;
end
$$;

-- Einladung annehmen. Wer schon Mitglied ist, behält seine Rolle.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  inv public.invites;
begin
  select * into inv from public.invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if inv is null or inv.expires_at < now() then
    raise exception 'Diese Einladung gilt nicht mehr. Frag die Leitung nach einem neuen Link.' using errcode = 'P0002';
  end if;
  insert into public.memberships (guugge_id, user_id, role) values (inv.guugge_id, me, inv.role)
  on conflict (guugge_id, user_id) do nothing;
  return inv.guugge_id;
end
$$;

-- Eigene Stimme wählen; das Register folgt aus der Stimme.
create function public.set_my_voice(p_guugge uuid, p_voice text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  reg public.register_kind := public.voice_register(p_voice);
begin
  if reg is null then
    raise exception 'Unbekannte Stimme.' using errcode = '22023';
  end if;
  update public.memberships set voice = p_voice, register = reg
  where guugge_id = p_guugge and user_id = me;
  if not found then
    raise exception 'Du bist nicht in dieser Guugge.' using errcode = '42501';
  end if;
end
$$;

-- In der Rangliste erscheinen: entscheidet nur die Person selbst (Standard aus).
create function public.set_rangliste_opt_in(p_guugge uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  update public.memberships set rangliste_opt_in = coalesce(p_on, false)
  where guugge_id = p_guugge and user_id = me;
  if not found then
    raise exception 'Du bist nicht in dieser Guugge.' using errcode = '42501';
  end if;
end
$$;

-- Zählt die Leitung einer Guugge ohne eine bestimmte Person.
create function public.other_leitung(p_guugge uuid, p_user uuid) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from public.memberships
  where guugge_id = p_guugge and role = 'leitung' and user_id <> p_user
$$;
revoke all on function public.other_leitung(uuid, uuid) from public, anon, authenticated;

-- Rolle ändern (nur Leitung). Die letzte Leitung bleibt Leitung.
create function public.set_member_role(p_guugge uuid, p_user uuid, p_role public.role_in_guugge) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Rollen ändern.' using errcode = '42501';
  end if;
  if p_role <> 'leitung' and public.other_leitung(p_guugge, p_user) = 0 then
    raise exception 'Die Guugge braucht mindestens eine Leitung.' using errcode = '22023';
  end if;
  update public.memberships set role = p_role where guugge_id = p_guugge and user_id = p_user;
  if not found then
    raise exception 'Diese Person ist nicht in der Guugge.' using errcode = 'P0002';
  end if;
end
$$;

-- Mitglied entfernen (Leitung) bzw. selbst austreten. Die letzte Leitung kann nicht gehen.
-- Etappen, Punkte und Übetage gehören der Person und bleiben bei ihr (Löschkonzept offen, docs/03).
create function public.remove_member(p_guugge uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  if p_user <> me and not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Mitglieder entfernen.' using errcode = '42501';
  end if;
  if public.other_leitung(p_guugge, p_user) = 0 and exists (
    select 1 from public.memberships where guugge_id = p_guugge and user_id = p_user and role = 'leitung') then
    raise exception 'Die Guugge braucht mindestens eine Leitung. Gib die Leitung zuerst ab.' using errcode = '22023';
  end if;
  delete from public.memberships where guugge_id = p_guugge and user_id = p_user;
  if not found then
    raise exception 'Diese Person ist nicht in der Guugge.' using errcode = 'P0002';
  end if;
end
$$;

-- Mitgliederliste für alle Mitglieder: nur Name, Rolle und Stimme, keine Werte.
create function public.guugge_members(p_guugge uuid)
returns table (user_id uuid, display_name text, role public.role_in_guugge, voice text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, m.role, m.voice
  from public.memberships m join public.profiles p on p.id = m.user_id
  where m.guugge_id = p_guugge and public.is_member(p_guugge)
  order by m.role, p.display_name
$$;

-- Übersicht der Leitung --------------------------------------------------------
-- Neu: Personen ohne Ergebnis zählen mit Etappe 0, sonst wäre bei drei Personen und nur einem
-- Ergebnis der Einzelwert ablesbar. Teile kommen aus titles.sections (Index ab 0 = exam_results.section).
-- Grenze: Wer eigene Zweitkonten in die Guugge einlädt, kann Register künstlich auf drei bringen
-- und Einzelwerte zurückrechnen. Das verhindern Datenbankregeln nicht (docs/02).
create or replace function public.register_overview(g uuid, t uuid)
returns table (register public.register_kind, persons int, avg_stage_by_section jsonb, practiced_this_week int)
language sql stable security definer set search_path = '' as $$
  with members as (
    select m.user_id, m.register from public.memberships m
    where m.guugge_id = g and m.register is not null and public.is_leitung(g)
  ),
  regs as (
    select m.register, count(*)::int as persons from members m group by m.register having count(*) >= 3
  ),
  sections as (
    select generate_series(0, jsonb_array_length(ti.sections) - 1) as section from public.titles ti where ti.id = t
  ),
  best as (
    select m.register, m.user_id, s.section,
      coalesce(max(e.stage) filter (where e.passed), 0) as stage
    from members m
    join regs r on r.register = m.register
    cross join sections s
    left join public.exam_results e
      on e.user_id = m.user_id and e.guugge_id = g and e.title_id = t and e.section = s.section
    group by m.register, m.user_id, s.section
  )
  select r.register, r.persons,
    (select jsonb_object_agg(x.section, x.a) from (
       select b.section, round(avg(b.stage)::numeric, 1) as a
       from best b where b.register = r.register group by b.section) x),
    (select count(distinct d.user_id)::int from public.practice_days d
       join members m2 on m2.user_id = d.user_id and m2.register = r.register
       where d.day >= date_trunc('week', now())::date)
  from regs r
$$;

-- Rechte der Funktionen: nur für angemeldete Personen ----------------------------
revoke all on function
  public.voice_register(text), public.require_user(), public.create_guugge(text),
  public.create_invite(uuid, public.role_in_guugge, int), public.revoke_invites(uuid),
  public.accept_invite(text), public.set_my_voice(uuid, text), public.set_rangliste_opt_in(uuid, boolean),
  public.set_member_role(uuid, uuid, public.role_in_guugge), public.remove_member(uuid, uuid),
  public.guugge_members(uuid)
from public, anon;
grant execute on function
  public.voice_register(text), public.require_user(), public.create_guugge(text),
  public.create_invite(uuid, public.role_in_guugge, int), public.revoke_invites(uuid),
  public.accept_invite(text), public.set_my_voice(uuid, text), public.set_rangliste_opt_in(uuid, boolean),
  public.set_member_role(uuid, uuid, public.role_in_guugge), public.remove_member(uuid, uuid),
  public.guugge_members(uuid)
to authenticated;
