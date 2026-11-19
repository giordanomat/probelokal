-- Pilot: Zahlen pro Woche, nur gesamt, ohne Namen (Entscheid Matthias 19.11.2026, docs/pilot.md).
-- Im Supabase-Dashboard → SQL Editor ausführen; vorher den Namen der Guugge unten anpassen.
-- Zählt nur Mitglieder ohne die Leitung. Übetage gelten für die ganze Person (auch Üben in einer
-- anderen Guugge zählt mit), Etappen nur in dieser Guugge. Woche ab Montag, Schweizer Zeit.
-- Liest nur, ändert nichts.
with g as (
  select id from public.guuggen where name = 'Schuegu Pilot'
),
mem as (
  select m.user_id from public.memberships m join g on g.id = m.guugge_id
  where m.role <> 'leitung'
),
days as (
  select d.user_id, d.day from public.practice_days d join mem using (user_id)
),
passed as (
  select (e.created_at at time zone 'Europe/Zurich')::date as day
  from public.exam_results e join g on g.id = e.guugge_id join mem using (user_id)
  where e.passed
),
weeks as (
  select generate_series(
    date_trunc('week', least((select min(day) from days), (select min(day) from passed)))::date,
    date_trunc('week', public.today_zurich())::date,
    interval '7 days'
  )::date as monday
)
select
  w.monday as woche_ab,
  (select count(*) from mem)::int as personen,
  (select count(distinct d.user_id) from days d where d.day between w.monday and w.monday + 6)::int as haben_geuebt,
  round(
    (select count(*) from days d where d.day between w.monday and w.monday + 6)::numeric
      / nullif((select count(*) from mem), 0),
    1
  ) as uebetage_im_schnitt,
  (select count(*) from passed p where p.day between w.monday and w.monday + 6)::int as etappen_bestanden
from weeks w
order by w.monday;
