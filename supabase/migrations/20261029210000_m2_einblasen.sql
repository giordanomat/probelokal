-- M2 · Punkte fürs Einblasen (docs/01): 5 Punkte pro Übung, höchstens 6 Übungen mit Punkten pro Tag
-- und Guugge, wie im Prototyp. Anders als dort nur mit »Mithören« und ab 50 % getroffen, sonst gäbe
-- es Punkte für Zeit (Vorschlag 29.10.2026). Muster wie bei den Durchgängen: start_exercise beim
-- Start, finish_exercise am Ende; die Datenbank prüft Übung, Stufe, Tempo, Dauer und Wertebereich.
-- Länge und Namen der Übungen stehen auch in src/lib/warmup/exercises.ts, die Punkteregel in
-- src/lib/game/points.ts (exerciseAward); supabase/tests/points.spec.ts vergleicht beide.
-- Der Schränz-Groove gibt erst ab Level 3 Punkte (250, wie LEVELS in points.ts).
-- Gegen das echte Projekt ungeprüft, bis die Migration angewendet ist (docs/03 »Anwenden«).

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  exercise text not null,
  level int not null check (level in (0, 1)),
  bpm int not null check (bpm between 50 and 120),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.exercise_attempts enable row level security;
revoke all on public.exercise_attempts from anon, authenticated;

-- Runden pro Übung und Stufe (null = gibt es nicht). Ein Takt Einzählen, dann pro Runde ein Takt
-- vorspielen und einer nachspielen.
create function public.exercise_beats(p_exercise text, p_level int) returns int
language sql immutable set search_path = '' as $$
  select 4 + 8 * case p_exercise || ':' || p_level
    when 'lang:0' then 8 when 'lang:1' then 15
    when 'bind:0' then 4 when 'bind:1' then 7
    when 'zunge:0' then 3 when 'zunge:1' then 5
    when 'leiter:0' then 4 when 'leiter:1' then 4
    when 'groove:0' then 3 when 'groove:1' then 5
  end
$$;

create function public.exercise_name(p_exercise text) returns text
language sql immutable set search_path = '' as $$
  select case p_exercise
    when 'lang' then 'Lange Töne' when 'bind' then 'Lippenbindungen'
    when 'zunge' then 'Zungenstoss' when 'leiter' then 'Tonleiter-Häppchen'
    when 'groove' then 'Schränz-Groove'
  end
$$;

-- Punkte für eine Übung (rein), wie exerciseAward. p_judged: bewertete Töne (unter 3 nichts).
create function public.exercise_points(p_pct int, p_judged int) returns int
language sql immutable set search_path = '' as $$
  select case when p_judged >= 3 and p_pct >= 50 then 5 else 0 end
$$;

create function public.start_exercise(p_exercise text, p_level int, p_bpm int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  a uuid;
begin
  if public.exercise_beats(p_exercise, p_level) is null then
    raise exception 'Diese Übung gibt es nicht.' using errcode = '22023';
  end if;
  if p_bpm is null or p_bpm not between 50 and 120 then
    raise exception 'Tempo 50 bis 120.' using errcode = '22023';
  end if;
  if p_exercise = 'groove' and public.my_best_points() < 250 then
    raise exception 'Der Schränz-Groove kommt mit Level 3.' using errcode = '42501';
  end if;
  insert into public.exercise_attempts (user_id, exercise, level, bpm)
  values (me, p_exercise, p_level, p_bpm)
  returning id into a;
  return a;
end
$$;

-- Übung abschliessen. Gibt {points, capped, week_goal} zurück; points pro Guugge.
create function public.finish_exercise(p_attempt uuid, p_pct int, p_judged int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  a public.exercise_attempts;
  pts int;
  capped boolean := false;
  week int := 0;
  w int;
  m record;
  n int;
begin
  select * into a from public.exercise_attempts where id = p_attempt and user_id = me for update;
  if not found then
    raise exception 'Diese Übung gibt es nicht.' using errcode = 'P0002';
  end if;
  if a.finished_at is not null then
    raise exception 'Diese Übung ist schon abgeschlossen.' using errcode = '22023';
  end if;
  if now() - a.started_at > interval '2 hours' then
    raise exception 'Diese Übung ist abgelaufen.' using errcode = '22023';
  end if;
  if p_pct is null or p_pct not between 0 and 100 or p_judged is null or p_judged < 0 then
    raise exception 'Ungültiges Ergebnis.' using errcode = '22023';
  end if;
  if extract(epoch from now() - a.started_at)
     < 0.9 * public.exercise_beats(a.exercise, a.level) * 60.0 / a.bpm then
    raise exception 'Das ging schneller, als es dauern kann.' using errcode = '22023';
  end if;
  update public.exercise_attempts set finished_at = now() where id = a.id;

  pts := public.exercise_points(p_pct, p_judged);
  for m in select guugge_id from public.memberships where user_id = me loop
    if pts > 0 then
      select count(*) into n from public.points_ledger l
      where l.user_id = me and l.guugge_id = m.guugge_id and l.reason like 'Einblasen:%'
        and (l.created_at at time zone 'Europe/Zurich')::date = public.today_zurich();
      if n < 6 then
        insert into public.points_ledger (user_id, guugge_id, points, reason, ref)
        values (me, m.guugge_id, pts, 'Einblasen: ' || public.exercise_name(a.exercise), a.id);
      else
        capped := true;
      end if;
    end if;
    -- Übetag erst ab einem getroffenen Ton, wie bei Prüfungen und Durchgängen
    if p_pct > 0 and p_judged >= 3 then
      w := public.note_practice_day(me, m.guugge_id);
      week := greatest(week, w);
    end if;
  end loop;
  return jsonb_build_object('points', case when capped then 0 else pts end, 'capped', capped, 'week_goal', week);
end
$$;

revoke all on function
  public.exercise_beats(text, int), public.exercise_name(text), public.exercise_points(int, int),
  public.start_exercise(text, int, int), public.finish_exercise(uuid, int, int)
from public, anon;
grant execute on function
  public.exercise_beats(text, int), public.exercise_name(text), public.exercise_points(int, int),
  public.start_exercise(text, int, int), public.finish_exercise(uuid, int, int)
to authenticated;
