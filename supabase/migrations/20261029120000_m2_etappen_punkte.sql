-- M2 · Etappenprüfungen und Punkte auf dem Server. Entscheid Matthias (29.10.2026):
-- Datenbankfunktionen statt Edge Functions (docs/02 »Sicherheit«). Der Browser startet eine
-- Prüfung (start_exam) und meldet das Ergebnis (finish_exam); die Datenbank prüft Reihenfolge,
-- Dauer und Wertebereich und schreibt Ergebnis, Punkte und Übetag. Clients haben weiterhin keine
-- Schreibrechte auf exam_results, points_ledger und practice_days.
--
-- Ehrlich (docs/02): Die Bewertung entsteht im Browser. Wer will, kann ein Ergebnis fälschen;
-- die Prüfungen hier erschweren das nur. Die Anzahl Töne eines Teils kennt der Server nicht
-- (die Noten liegen nicht in der Datenbank), sie wird nicht geprüft.
--
-- Die Punkteregeln stehen auch in src/lib/game/points.ts (Anzeige). supabase/tests/points.spec.ts
-- vergleicht beide Fall für Fall.
-- Getestet mit PGlite; gegen das echte Projekt ungeprüft, bis die Migration angewendet ist.

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  guugge_id uuid not null references public.guuggen on delete cascade,
  title_id uuid not null references public.titles on delete cascade,
  voice text not null,
  section int not null,
  stage int not null check (stage between 1 and 5),
  via public.exam_via not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.exam_attempts enable row level security;
revoke all on public.exam_attempts from anon, authenticated;

-- Regeln (rein, ohne Daten) ---------------------------------------------------

-- Bestanden ab: Etappe 1 drei von vier, sonst 80 %.
create function public.exam_pass_mark(p_stage int) returns numeric
language sql immutable set search_path = '' as $$
  select case when p_stage = 1 then 0.75 else 0.8 end
$$;

-- Punkte für eine Etappe, wie examAward in src/lib/game/points.ts: nur das erste Bestehen der
-- nächsten Etappe; 40, +20 ab 95 %, +15 bis zur Fälligkeit; Etappe 4/5 mit Rhythmus tippen halbiert.
create function public.exam_points(
  p_stage int, p_previous int, p_score numeric, p_passed boolean, p_via public.exam_via, p_on_time boolean
) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  pts int;
  reasons text[] := array['Etappe bestanden'];
begin
  if not p_passed or p_stage <> p_previous + 1 then
    return jsonb_build_object('points', 0, 'reasons', '[]'::jsonb);
  end if;
  pts := 40;
  if p_score >= 0.95 then
    pts := pts + 20;
    reasons := array_append(reasons, 'mit Glanz');
  end if;
  if p_on_time then
    pts := pts + 15;
    reasons := array_append(reasons, 'rechtzeitig');
  end if;
  if p_via = 'rhythm' and p_stage >= 4 then
    pts := round(pts / 2.0);
    reasons := array_append(reasons, 'ohne Mikrofon: halbe Punkte');
  end if;
  return jsonb_build_object('points', pts, 'reasons', to_jsonb(reasons));
end
$$;

-- Mindestdauer einer Prüfung in Sekunden (Vorschlag): Quiz 4 s, Griffe 3 s (die Oberfläche wartet
-- nach jeder Antwort rund eine Sekunde), auf der Bahn 90 % der Spieldauer des Teils (Etappe 3 bei
-- 80 % Tempo).
create function public.exam_min_seconds(p_stage int, p_bars int, p_bpm numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p_stage = 1 then 4
    when p_stage = 2 then 3
    when p_stage = 3 then 0.9 * p_bars * 4 * 60 / p_bpm / 0.8
    else 0.9 * p_bars * 4 * 60 / p_bpm
  end
$$;

-- Heute in der Schweiz (ein Übetag endet um Mitternacht Ortszeit).
create function public.today_zurich() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Zurich')::date
$$;

-- Übetag eintragen; ist es der dritte Tag dieser Woche (Montag–Sonntag), gibt es das Wochenziel.
-- Gibt die Punkte für das Wochenziel zurück (0 oder 25).
create function public.note_practice_day(p_user uuid, p_guugge uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  d date := public.today_zurich();
  n int;
begin
  insert into public.practice_days (user_id, day) values (p_user, d) on conflict do nothing;
  if not found then
    return 0;
  end if;
  select count(*) into n from public.practice_days
  where user_id = p_user and day >= date_trunc('week', d)::date and day < date_trunc('week', d)::date + 7;
  if n = 3 then
    insert into public.points_ledger (user_id, guugge_id, points, reason)
    values (p_user, p_guugge, 25, 'Wochenziel: an 3 Tagen geübt');
    return 25;
  end if;
  return 0;
end
$$;

-- Höchste bestandene Etappe einer Person in einem Teil.
create function public.best_stage(p_user uuid, p_guugge uuid, p_title uuid, p_voice text, p_section int)
returns int
language sql stable set search_path = '' as $$
  select coalesce(max(stage), 0)::int from public.exam_results
  where user_id = p_user and guugge_id = p_guugge and title_id = p_title
    and voice = p_voice and section = p_section and passed
$$;

-- Prüfung starten -------------------------------------------------------------
create function public.start_exam(
  p_guugge uuid, p_slug text, p_section int, p_stage int, p_via public.exam_via
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  m public.memberships;
  t public.titles;
  prev int;
  a uuid;
begin
  select * into m from public.memberships where guugge_id = p_guugge and user_id = me;
  if not found then
    raise exception 'Du bist nicht in dieser Guugge.' using errcode = '42501';
  end if;
  if m.voice is null then
    raise exception 'Wähl zuerst deine Stimme.' using errcode = '22023';
  end if;
  select * into t from public.titles where slug = p_slug and published;
  if not found then
    raise exception 'Diesen Titel gibt es nicht.' using errcode = 'P0002';
  end if;
  if p_section is null or p_section < 1 or p_section >= jsonb_array_length(t.sections) then
    raise exception 'Diesen Teil gibt es nicht.' using errcode = '22023';
  end if;
  if p_stage is null or p_stage not between 1 and 5 then
    raise exception 'Diese Etappe gibt es nicht.' using errcode = '22023';
  end if;
  if (p_stage = 1 and p_via <> 'quiz') or (p_stage = 2 and p_via <> 'grip')
     or (p_stage >= 3 and p_via not in ('mic', 'rhythm')) then
    raise exception 'Diese Prüfungsart passt nicht zur Etappe.' using errcode = '22023';
  end if;
  prev := public.best_stage(me, p_guugge, t.id, m.voice, p_section);
  if p_stage > prev + 1 then
    raise exception 'Zuerst Etappe %.', prev + 1 using errcode = '22023';
  end if;
  insert into public.exam_attempts (user_id, guugge_id, title_id, voice, section, stage, via)
  values (me, p_guugge, t.id, m.voice, p_section, p_stage, p_via)
  returning id into a;
  return a;
end
$$;

-- Prüfung abschliessen: Ergebnis, Punkte, Übetag ---------------------------------
create function public.finish_exam(p_attempt uuid, p_score numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  a public.exam_attempts;
  t public.titles;
  sec jsonb;
  bars int;
  prev int;
  ok boolean;
  due date;
  award jsonb;
  pts int;
  week int;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = me for update;
  if not found then
    raise exception 'Diese Prüfung gibt es nicht.' using errcode = 'P0002';
  end if;
  if a.finished_at is not null then
    raise exception 'Diese Prüfung ist schon abgeschlossen.' using errcode = '22023';
  end if;
  if now() - a.started_at > interval '2 hours' then
    raise exception 'Diese Prüfung ist abgelaufen. Starte sie nochmals.' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 1 then
    raise exception 'Ungültiges Ergebnis.' using errcode = '22023';
  end if;
  select * into t from public.titles where id = a.title_id;
  sec := t.sections -> a.section;
  bars := (sec ->> 'to')::int - (sec ->> 'from')::int + 1;
  if extract(epoch from now() - a.started_at) < public.exam_min_seconds(a.stage, bars, t.bpm) then
    raise exception 'Das ging schneller, als es dauern kann. Bitte nochmals.' using errcode = '22023';
  end if;

  update public.exam_attempts set finished_at = now() where id = a.id;
  prev := public.best_stage(me, a.guugge_id, a.title_id, a.voice, a.section);
  ok := p_score >= public.exam_pass_mark(a.stage);
  insert into public.exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
  values (me, a.guugge_id, a.title_id, a.voice, a.section, a.stage, p_score, a.via, ok);

  select (p.due -> (a.section::text) ->> (a.stage - 1))::date into due
  from public.plans p where p.guugge_id = a.guugge_id and p.title_id = a.title_id;
  award := public.exam_points(a.stage, prev, p_score, ok, a.via, due is not null and public.today_zurich() <= due);
  pts := (award ->> 'points')::int;
  if pts > 0 then
    insert into public.points_ledger (user_id, guugge_id, points, reason, ref)
    values (me, a.guugge_id, pts, format('Etappe %s · Teil %s', a.stage, sec ->> 'name'), a.id);
  end if;
  -- Übetag erst ab einem getroffenen Ton: Nichtstun bringt kein Wochenziel
  week := case when p_score > 0 then public.note_practice_day(me, a.guugge_id) else 0 end;

  return jsonb_build_object(
    'passed', ok, 'score', p_score, 'stage', a.stage, 'section', a.section,
    'points', pts, 'reasons', award -> 'reasons', 'week_goal', week);
end
$$;

-- Eigene Punkte in einer Guugge (gesamt, diese Woche) und Übetage dieser Woche.
create function public.my_points(p_guugge uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'points', coalesce((select sum(points) from public.points_ledger
                        where user_id = public.require_user() and guugge_id = p_guugge), 0),
    'week_points', coalesce((select sum(points) from public.points_ledger
                             where user_id = public.require_user() and guugge_id = p_guugge
                               and (created_at at time zone 'Europe/Zurich')::date
                                   >= date_trunc('week', public.today_zurich())::date), 0),
    'days_this_week', (select count(*) from public.practice_days
                       where user_id = public.require_user()
                         and day >= date_trunc('week', public.today_zurich())::date))
$$;

-- Rechte ------------------------------------------------------------------------
revoke all on function
  public.exam_pass_mark(int), public.exam_points(int, int, numeric, boolean, public.exam_via, boolean),
  public.exam_min_seconds(int, int, numeric), public.today_zurich(), public.note_practice_day(uuid, uuid),
  public.best_stage(uuid, uuid, uuid, text, int), public.start_exam(uuid, text, int, int, public.exam_via),
  public.finish_exam(uuid, numeric), public.my_points(uuid)
from public, anon, authenticated;
grant execute on function
  public.start_exam(uuid, text, int, int, public.exam_via), public.finish_exam(uuid, numeric),
  public.my_points(uuid), public.exam_pass_mark(int),
  public.exam_points(int, int, numeric, boolean, public.exam_via, boolean)
to authenticated;
