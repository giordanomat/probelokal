-- M2 · Punkte für bewertete Durchgänge ausserhalb von Prüfungen (Schleife oder Echo mit Mithören
-- bzw. Rhythmus tippen), wie passPoints im Prototyp: ab 50 % ein Punkt pro 10 %, höchstens 10,
-- im Originaltempo × 1,5; höchstens 15 Durchgänge mit Punkten pro Tag und Guugge.
-- Muster wie bei den Prüfungen: start_pass beim Beginn, finish_pass am Ende; die Datenbank prüft
-- Dauer und Wertebereich. Ein Durchgang gehört zu keiner Guugge (»Stück üben« ist für alle
-- gleich); die Punkte gehen an jede Guugge, in der die Person Mitglied ist.
-- Die Punkteregel steht auch in src/lib/game/points.ts (passAward); supabase/tests/points.spec.ts
-- vergleicht beide. Gegen das echte Projekt ungeprüft, bis die Migration angewendet ist.

create table public.pass_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title_id uuid not null references public.titles on delete cascade,
  bar_from int not null,
  bar_to int not null,
  tempo int not null check (tempo between 50 and 100),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.pass_attempts enable row level security;
revoke all on public.pass_attempts from anon, authenticated;

-- Punkte für einen Durchgang (rein), wie passAward.
create function public.pass_points(p_pct int, p_tempo int) returns int
language sql immutable set search_path = '' as $$
  select case when p_pct < 50 then 0
    else round(least(10, round(p_pct / 10.0)) * case when p_tempo >= 100 then 1.5 else 1 end)::int
  end
$$;

create function public.start_pass(p_slug text, p_from int, p_to int, p_tempo int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  t public.titles;
  a uuid;
begin
  select * into t from public.titles where slug = p_slug and published;
  if not found then
    raise exception 'Diesen Titel gibt es nicht.' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_from < 0 or p_to < p_from or p_to > t.bars - 1 then
    raise exception 'Diese Takte gibt es nicht.' using errcode = '22023';
  end if;
  if p_tempo is null or p_tempo not between 50 and 100 then
    raise exception 'Tempo 50 bis 100 %%.' using errcode = '22023';
  end if;
  insert into public.pass_attempts (user_id, title_id, bar_from, bar_to, tempo)
  values (me, t.id, p_from, p_to, p_tempo)
  returning id into a;
  return a;
end
$$;

-- Durchgang abschliessen. p_judged: Anzahl bewerteter Töne (unter 3 gibt es keine Punkte, wie
-- summarizePass). Gibt {points, capped, week_goal} zurück; points pro Guugge.
create function public.finish_pass(p_attempt uuid, p_pct int, p_judged int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  a public.pass_attempts;
  t public.titles;
  pts int;
  capped boolean := false;
  week int := 0;
  w int;
  m record;
  n int;
begin
  select * into a from public.pass_attempts where id = p_attempt and user_id = me for update;
  if not found then
    raise exception 'Diesen Durchgang gibt es nicht.' using errcode = 'P0002';
  end if;
  if a.finished_at is not null then
    raise exception 'Dieser Durchgang ist schon abgeschlossen.' using errcode = '22023';
  end if;
  if now() - a.started_at > interval '2 hours' then
    raise exception 'Dieser Durchgang ist abgelaufen.' using errcode = '22023';
  end if;
  if p_pct is null or p_pct not between 0 and 100 or p_judged is null or p_judged < 0 then
    raise exception 'Ungültiges Ergebnis.' using errcode = '22023';
  end if;
  select * into t from public.titles where id = a.title_id;
  if extract(epoch from now() - a.started_at)
     < 0.9 * (a.bar_to - a.bar_from + 1) * 4 * 60 / t.bpm / (a.tempo / 100.0) then
    raise exception 'Das ging schneller, als es dauern kann.' using errcode = '22023';
  end if;
  update public.pass_attempts set finished_at = now() where id = a.id;

  pts := case when p_judged < 3 then 0 else public.pass_points(p_pct, a.tempo) end;
  for m in select guugge_id from public.memberships where user_id = me loop
    if pts > 0 then
      select count(*) into n from public.points_ledger l
      where l.user_id = me and l.guugge_id = m.guugge_id and l.reason like 'Durchgang %'
        and (l.created_at at time zone 'Europe/Zurich')::date = public.today_zurich();
      if n < 15 then
        insert into public.points_ledger (user_id, guugge_id, points, reason, ref)
        values (me, m.guugge_id, pts,
                format('Durchgang T. %s–%s · %s %%', a.bar_from, a.bar_to, p_pct), a.id);
      else
        capped := true;
      end if;
    end if;
    -- Übetag erst ab einem getroffenen Ton: Nichtstun bringt kein Wochenziel
    if p_pct > 0 and p_judged >= 3 then
      w := public.note_practice_day(me, m.guugge_id);
      week := greatest(week, w);
    end if;
  end loop;
  return jsonb_build_object('points', case when capped then 0 else pts end, 'capped', capped, 'week_goal', week);
end
$$;

revoke all on function
  public.pass_points(int, int), public.start_pass(text, int, int, int), public.finish_pass(uuid, int, int)
from public, anon;
grant execute on function
  public.pass_points(int, int), public.start_pass(text, int, int, int), public.finish_pass(uuid, int, int)
to authenticated;
