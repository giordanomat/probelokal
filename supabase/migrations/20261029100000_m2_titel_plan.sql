-- M2 · Testtitel im Katalog, Gesamtplan lesen und schreiben, eigener Stand.
-- Getestet mit supabase/tests/rls.spec.ts und catalog.spec.ts; gegen das echte Projekt ungeprüft,
-- bis die Migration angewendet ist (docs/03 »Anwenden«).

-- Bad Touch 2.0, Fassung Schuegu27. Teile und Stimmen wie src/lib/titles/bad-touch.ts;
-- supabase/tests/catalog.spec.ts prüft, dass beide gleich sind. `rests` pro Stimme: Teile ohne
-- Ton (»Pause für dich«), aus den Noten abgeleitet; die Datenbank kennt die Noten nicht und
-- braucht die Pausen für die Übersicht der Leitung (register_overview). Später legt die
-- Produktionsstrecke Titel an (docs/06), nicht eine Migration.
insert into public.titles (slug, name, version, bpm, bars, sections, voices, stem_offset_sec, published)
values (
  'bad-touch-2-0', 'Bad Touch 2.0', 'Schuegu27', 115, 93,
  '[{"from":0,"to":0,"name":"Vorzähler"},{"from":1,"to":8,"name":"A"},{"from":9,"to":12,"name":"B"},{"from":13,"to":16,"name":"C"},{"from":17,"to":20,"name":"D"},{"from":21,"to":24,"name":"E"},{"from":25,"to":28,"name":"F"},{"from":29,"to":36,"name":"G"},{"from":37,"to":44,"name":"H"},{"from":45,"to":52,"name":"I"},{"from":53,"to":54,"name":"J"},{"from":55,"to":58,"name":"K"},{"from":59,"to":62,"name":"L"},{"from":63,"to":66,"name":"M"},{"from":67,"to":70,"name":"N"},{"from":71,"to":74,"name":"O"},{"from":75,"to":87,"name":"P"},{"from":88,"to":92,"name":"Q"}]',
  '[{"id":"trp1","short":"Trp 1","name":"Trompete 1","part":"P1","kind":"valve","instrument":"trumpet","shift":-2,"register":"trp","rests":[10,11,12,13]},{"id":"trp2","short":"Trp 2","name":"Trompete 2","part":"P2","kind":"valve","instrument":"trumpet","shift":-2,"register":"trp","rests":[10,11,12,13,14]},{"id":"pos1","short":"Pos 1","name":"Posaune 1","part":"P3","kind":"slide","instrument":"trombone","shift":-14,"register":"pos","rests":[10,11]},{"id":"pos2","short":"Pos 2","name":"Posaune 2","part":"P4","kind":"slide","instrument":"trombone","shift":-14,"register":"pos","rests":[10,11,12,13]},{"id":"euph","short":"Euph","name":"Euphonium","part":"P5","kind":"valve","instrument":"euphonium","shift":-14,"register":"tief","rests":[10,11,12]},{"id":"sous","short":"Sous","name":"Sousaphon","part":"P6","kind":"valve","instrument":"sousaphone","shift":-26,"register":"tief","rests":[10]}]',
  6.260869565217392, true
)
on conflict (slug) do nothing;

comment on column public.plans.gp_weekday is 'Wochentag der Gesamtprobe, 0 = Sonntag … 6 = Samstag (wie JavaScript getDay)';
comment on column public.plans.rp_weekday is 'Wochentag der Registerprobe oder null, 0 = Sonntag … 6 = Samstag';

-- Fälligkeit jeder Etappe pro Teil, {"1": ["2026-11-08", …5 Tage], …}. Berechnet der Browser der
-- Leitung beim Speichern (src/lib/plan/plan.ts, dueTable): Die Gewichtung der Teile braucht die
-- Noten aller Stimmen, und die liegen nicht in der Datenbank. Der Server liest daraus nur den Bonus
-- »rechtzeitig« (finish_exam). Die Leitung bestimmt den Plan ohnehin; neue Rechte entstehen so nicht.
alter table public.plans add column due jsonb;

create function public.title_by_slug(p_slug text) returns uuid
language sql stable set search_path = '' as $$
  select id from public.titles where slug = p_slug and published
$$;

-- Gesamtplan einer Guugge für einen Titel (Mitglieder); null, wenn es keinen gibt.
create function public.get_plan(p_guugge uuid, p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.plans;
begin
  perform public.require_user();
  if not public.is_member(p_guugge) then
    raise exception 'Du bist nicht in dieser Guugge.' using errcode = '42501';
  end if;
  select * into r from public.plans where guugge_id = p_guugge and title_id = public.title_by_slug(p_slug);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'start', r.start_date, 'perf', r.perf_date, 'gp_weekday', r.gp_weekday,
    'rp_weekday', r.rp_weekday, 'minutes_per_week', r.minutes_per_week, 'updated_at', r.updated_at);
end
$$;

-- Gesamtplan anlegen oder ändern (nur Leitung).
create function public.set_plan(
  p_guugge uuid, p_slug text, p_start date, p_perf date,
  p_gp_weekday int, p_rp_weekday int, p_minutes int, p_due jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t uuid := public.title_by_slug(p_slug);
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann den Plan ändern.' using errcode = '42501';
  end if;
  if t is null then
    raise exception 'Diesen Titel gibt es nicht.' using errcode = 'P0002';
  end if;
  if p_start is null or p_perf is null or p_perf <= p_start then
    raise exception 'Der Auftritt muss nach dem Start liegen.' using errcode = '22023';
  end if;
  if p_perf - p_start > 366 then
    raise exception 'Ein Plan geht höchstens ein Jahr.' using errcode = '22023';
  end if;
  if p_gp_weekday is null or p_gp_weekday not between 0 and 6
     or (p_rp_weekday is not null and p_rp_weekday not between 0 and 6) then
    raise exception 'Unbekannter Wochentag.' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes not between 0 and 600 then
    raise exception 'Übezeit pro Woche: 0 bis 600 Minuten.' using errcode = '22023';
  end if;
  if p_due is not null and (jsonb_typeof(p_due) <> 'object' or length(p_due::text) > 20000) then
    raise exception 'Fälligkeiten im falschen Format.' using errcode = '22023';
  end if;
  insert into public.plans (guugge_id, title_id, start_date, perf_date, gp_weekday, rp_weekday, minutes_per_week, due, updated_at)
  values (p_guugge, t, p_start, p_perf, p_gp_weekday, p_rp_weekday, p_minutes, p_due, now())
  on conflict (guugge_id, title_id) do update set
    start_date = excluded.start_date, perf_date = excluded.perf_date,
    gp_weekday = excluded.gp_weekday, rp_weekday = excluded.rp_weekday,
    minutes_per_week = excluded.minutes_per_week, due = excluded.due, updated_at = now();
end
$$;

-- Eigener Stand: höchste bestandene Etappe pro Teil und Stimme. rhythm_only: Etappen 4/5, die
-- nur mit Rhythmus tippen bestanden sind (»ohne Mikrofon«, docs/01).
create function public.my_stages(p_guugge uuid, p_slug text)
returns table (voice text, section int, stage int, rhythm_only int[])
language sql stable security definer set search_path = '' as $$
  select e.voice, e.section, max(e.stage)::int,
    coalesce(array_agg(distinct e.stage) filter (
      where e.stage >= 4 and not exists (
        select 1 from public.exam_results x
        where x.user_id = e.user_id and x.guugge_id = e.guugge_id and x.title_id = e.title_id
          and x.voice = e.voice and x.section = e.section and x.stage = e.stage
          and x.passed and x.via = 'mic')), '{}')
  from public.exam_results e
  where e.user_id = public.require_user() and e.guugge_id = p_guugge
    and e.title_id = public.title_by_slug(p_slug) and e.passed
  group by e.voice, e.section
$$;

revoke all on function
  public.title_by_slug(text), public.get_plan(uuid, text),
  public.set_plan(uuid, text, date, date, int, int, int, jsonb), public.my_stages(uuid, text)
from public, anon;
grant execute on function
  public.title_by_slug(text), public.get_plan(uuid, text),
  public.set_plan(uuid, text, date, date, int, int, int, jsonb), public.my_stages(uuid, text)
to authenticated;
