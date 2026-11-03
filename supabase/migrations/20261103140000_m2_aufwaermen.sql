-- M2 · »Einblasen« heisst jetzt »Aufwärmen« (Entscheid Matthias 03.11.2026). Die Punkteliste zeigt
-- den Grund so, wie die Datenbank ihn schreibt: neue Einträge »Aufwärmen: …«, bestehende werden
-- umbenannt, damit die Tagesgrenze (6 Übungen mit Punkten) weiter alle Einträge des Tages zählt.
-- finish_exercise sonst unverändert wie in 20261029210000_m2_einblasen.sql (Rechte bleiben beim
-- Ersetzen erhalten). Test: supabase/tests/points.spec.ts.

update public.points_ledger
set reason = 'Aufwärmen:' || substr(reason, length('Einblasen:') + 1)
where reason like 'Einblasen:%';

-- Übung abschliessen. Gibt {points, capped, week_goal} zurück; points pro Guugge.
create or replace function public.finish_exercise(p_attempt uuid, p_pct int, p_judged int) returns jsonb
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
      where l.user_id = me and l.guugge_id = m.guugge_id and l.reason like 'Aufwärmen:%'
        and (l.created_at at time zone 'Europe/Zurich')::date = public.today_zurich();
      if n < 6 then
        insert into public.points_ledger (user_id, guugge_id, points, reason, ref)
        values (me, m.guugge_id, pts, 'Aufwärmen: ' || public.exercise_name(a.exercise), a.id);
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
