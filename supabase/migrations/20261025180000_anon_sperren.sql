-- Grundmodell (0001) für nicht angemeldete Besucher sperren.
-- Anlass: Supabase Security Advisor, 25.10.2026 – vier SECURITY-DEFINER-Funktionen waren für »anon«
-- aufrufbar. Sie prüfen intern auth.uid() und gaben ohne Anmeldung nichts preis; trotzdem gilt:
-- Wer nicht angemeldet ist, hat im Probelokal-Modell nichts zu suchen. Ausnahme: public.signup()
-- (Landingpage, eigene Migration 20261025140000).
--
-- Die Warnungen »Signed-In Users Can Execute SECURITY DEFINER Function« für is_member, is_leitung,
-- register_overview und leaderboard bleiben absichtlich: Die RLS-Regeln und die Oberfläche brauchen
-- sie für angemeldete Personen. Die Funktionen prüfen selbst Mitgliedschaft bzw. Leitung.
--
-- Angewendet am 25.10.2026 von Hand im Supabase-SQL-Editor; im Migrationsverlauf nachtragen mit
-- `supabase migration repair --status applied 20261025180000`.

revoke all on table
  public.profiles, public.guuggen, public.memberships, public.invites, public.titles,
  public.title_assets, public.licenses, public.plans, public.hints, public.hint_reads,
  public.exam_results, public.points_ledger, public.practice_days
from anon;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_leitung(uuid) from public, anon;
revoke execute on function public.register_overview(uuid, uuid) from public, anon;
revoke execute on function public.leaderboard(uuid) from public, anon;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_leitung(uuid) to authenticated;
grant execute on function public.register_overview(uuid, uuid) to authenticated;
grant execute on function public.leaderboard(uuid) to authenticated;
