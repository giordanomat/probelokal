-- Austritt löscht die Daten in dieser Guugge (Entscheid Matthias 18.11.2026). Gilt beim Austreten
-- und beim Entfernen durch die Leitung: Etappen, Prüfungsversuche, Punkte und gelesene Hinweise
-- dieser Guugge. Übetage, Durchgänge und Aufwärm-Versuche hängen an keiner Guugge und gehören zum
-- Konto; sie gehen erst mit dem Konto (delete_my_account). Wer später wieder beitritt, fängt neu an.
-- Sonst wie bisher (20261028150000_m2_konten_guuggen): Leitung entfernt, man selbst tritt aus,
-- die letzte Leitung kann nicht gehen. create or replace behält die Rechte.
create or replace function public.remove_member(p_guugge uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  if p_user <> me and not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Mitglieder entfernen.' using errcode = '42501';
  end if;
  if public.other_leitung(p_guugge, p_user) = 0 and exists (
    select 1 from public.memberships where guugge_id = p_guugge and user_id = p_user and role = 'leitung') then
    raise exception 'Die Guugge braucht mindestens eine Leitung. Gib die Leitung zuerst ab.' using errcode = '22023';
  end if;
  delete from public.memberships where guugge_id = p_guugge and user_id = p_user;
  if not found then
    raise exception 'Diese Person ist nicht in der Guugge.' using errcode = 'P0002';
  end if;

  delete from public.exam_results where guugge_id = p_guugge and user_id = p_user;
  delete from public.exam_attempts where guugge_id = p_guugge and user_id = p_user;
  delete from public.points_ledger where guugge_id = p_guugge and user_id = p_user;
  delete from public.hint_reads r
    using public.hints h
    where h.id = r.hint_id and h.guugge_id = p_guugge and r.user_id = p_user;
end
$$;
