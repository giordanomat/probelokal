-- Wochen-Rangliste in Schweizer Zeit (18.11.2026). leaderboard stammt aus 0001 und schnitt die Woche
-- am Montag 0 Uhr in der Zeitzone der Datenbank (bei Supabase UTC) ab: Punkte aus der ersten Stunde
-- am Montag (Sommerzeit zwei Stunden) zählten zur Vorwoche. Jetzt wie register_overview, my_points und
-- die Übetage: Woche ab Montag nach public.today_zurich(). Sonst unverändert (Rückgabe, Regeln,
-- Rechte bleiben; create or replace behält die Freigaben).
create or replace function public.leaderboard(g uuid)
returns table(user_id uuid, display_name text, voice text, points bigint, week_points bigint)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, m.voice,
    coalesce(sum(l.points), 0),
    coalesce(sum(l.points) filter (
      where (l.created_at at time zone 'Europe/Zurich')::date
            >= date_trunc('week', public.today_zurich())::date), 0)
  from public.memberships m
  join public.guuggen gg on gg.id = m.guugge_id and gg.rangliste_enabled
  join public.profiles p on p.id = m.user_id
  left join public.points_ledger l on l.user_id = m.user_id and l.guugge_id = m.guugge_id
  where m.guugge_id = g and m.rangliste_opt_in and public.is_member(g)
  group by m.user_id, p.display_name, m.voice;
$$;
