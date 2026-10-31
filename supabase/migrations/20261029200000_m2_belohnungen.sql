-- M2 · Belohnungen, die nicht zu einer Guugge gehören: Bahn-Looks und Schränz-Groove gelten auf
-- dem Gerät, in »Stück üben« und beim Einblasen. Massgeblich ist der höchste Rang über alle eigenen
-- Guuggen (Punkte aus Durchgängen gehen an jede Guugge, eine Summe zählte sie mehrfach).
-- Die Freischaltung ist nur Anzeige; wer sie im Browser erzwingt, gewinnt nichts.
-- Getestet mit supabase/tests/rls.spec.ts; gegen das echte Projekt ungeprüft, bis die Migration
-- angewendet ist (docs/03 »Anwenden«).

create function public.my_best_points() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max(s.total), 0)::int from (
    select sum(l.points) as total from public.points_ledger l
    join public.memberships m on m.user_id = l.user_id and m.guugge_id = l.guugge_id
    where l.user_id = public.require_user()
    group by l.guugge_id
  ) s
$$;

revoke all on function public.my_best_points() from public, anon;
grant execute on function public.my_best_points() to authenticated;
