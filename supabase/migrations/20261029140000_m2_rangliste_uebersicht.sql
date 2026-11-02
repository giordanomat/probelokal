-- M2 · Übersicht der Leitung, Rangliste und Belohnungen der Guugge.
-- Getestet mit supabase/tests/rls.spec.ts; gegen das echte Projekt ungeprüft, bis die Migration
-- angewendet ist (docs/03 »Anwenden«).

-- Übersicht der Leitung: wie 20261028150000, aber Teile, in denen die Stimme einer Person Pause
-- hat (titles.voices[].rests), zählen als erledigt (Etappe 5) wie in »Mein Plan«. Sonst sähe ein
-- Register in seinen Pausen aus, als wäre es im Rückstand. Teil 0 (Vorzähler) fehlt, und nur
-- Ergebnisse der aktuellen Stimme zählen.
create or replace function public.register_overview(g uuid, t uuid)
returns table (register public.register_kind, persons int, avg_stage_by_section jsonb, practiced_this_week int)
language sql stable security definer set search_path = '' as $$
  with members as (
    select m.user_id, m.register, m.voice from public.memberships m
    where m.guugge_id = g and m.register is not null and public.is_leitung(g)
  ),
  regs as (
    select m.register, count(*)::int as persons from members m group by m.register having count(*) >= 3
  ),
  ti as (select * from public.titles where id = t),
  sections as (
    select generate_series(1, jsonb_array_length(ti.sections) - 1) as section from ti
  ),
  rests as (
    select v ->> 'id' as voice, r::int as section
    from ti, jsonb_array_elements(ti.voices) v,
         jsonb_array_elements_text(coalesce(v -> 'rests', '[]'::jsonb)) r
  ),
  best as (
    select m.register, m.user_id, s.section,
      case
        when exists (select 1 from rests r where r.voice = m.voice and r.section = s.section) then 5
        else coalesce(max(e.stage) filter (where e.passed), 0)
      end as stage
    from members m
    join regs r on r.register = m.register
    cross join sections s
    left join public.exam_results e
      on e.user_id = m.user_id and e.guugge_id = g and e.title_id = t
     and e.section = s.section and e.voice = m.voice
    group by m.register, m.user_id, m.voice, s.section
  )
  select r.register, r.persons,
    (select jsonb_object_agg(x.section, x.a) from (
       select b.section, round(avg(b.stage)::numeric, 1) as a
       from best b where b.register = r.register group by b.section) x),
    (select count(distinct d.user_id)::int from public.practice_days d
       join members m2 on m2.user_id = d.user_id and m2.register = r.register
       where d.day >= date_trunc('week', public.today_zurich())::date)
  from regs r
$$;

-- Für die Oberfläche: Titel über den Kurznamen statt über die id.
create function public.leitung_overview(p_guugge uuid, p_slug text)
returns table (register public.register_kind, persons int, avg_stage_by_section jsonb, practiced_this_week int)
language sql stable security definer set search_path = '' as $$
  select * from public.register_overview(p_guugge, public.title_by_slug(p_slug))
$$;

-- Einstellungen der Guugge für alle Mitglieder: Rangliste an/aus, eigene Belohnungen pro Level.
create function public.guugge_settings(p_guugge uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('rangliste_enabled', g.rangliste_enabled, 'level_rewards', g.level_rewards)
  from public.guuggen g
  where g.id = p_guugge and public.is_member(p_guugge)
$$;

-- Eigene Belohnungen der Leitung pro Level (2–7), z. B. {"2": "Getränk nach der Probe"}.
create function public.set_level_rewards(p_guugge uuid, p_rewards jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v jsonb;
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Belohnungen festlegen.' using errcode = '42501';
  end if;
  if p_rewards is null or jsonb_typeof(p_rewards) <> 'object' then
    raise exception 'Belohnungen im falschen Format.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(p_rewards) loop
    if k not in ('2', '3', '4', '5', '6', '7') or jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 80 then
      raise exception 'Belohnung pro Level 2 bis 7, höchstens 80 Zeichen.' using errcode = '22023';
    end if;
  end loop;
  update public.guuggen set level_rewards = p_rewards where id = p_guugge;
end
$$;

-- Die letzten eigenen Punkte in einer Guugge.
create function public.my_points_log(p_guugge uuid)
returns table (points int, reason text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.points, l.reason, l.created_at from public.points_ledger l
  where l.user_id = public.require_user() and l.guugge_id = p_guugge
  order by l.created_at desc
  limit 10
$$;

revoke all on function
  public.leitung_overview(uuid, text), public.guugge_settings(uuid),
  public.set_level_rewards(uuid, jsonb), public.my_points_log(uuid)
from public, anon;
grant execute on function
  public.leitung_overview(uuid, text), public.guugge_settings(uuid),
  public.set_level_rewards(uuid, jsonb), public.my_points_log(uuid)
to authenticated;
