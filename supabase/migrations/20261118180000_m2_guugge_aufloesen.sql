-- Guugge auflösen (Entscheid Matthias 18.11.2026, nach Entwurf; docs/01 »Guugge auflösen«).
-- Jede Leitung kann auflösen; bestätigt wird mit dem Namen der Guugge (gross/klein egal). An der
-- Guugge hängt per on delete cascade alles Guugge-Bezogene: Mitgliedschaften, Einladungen, Plan,
-- Hinweise (und wer sie gelesen hat), Etappen, Prüfungsversuche, Punkte, Lizenzen. Damit niemand aus
-- Versehen einen Kauf verliert, ist das Auflösen gesperrt, solange die Guugge eine Lizenz hat.
-- Übetage hängen an keiner Guugge und bleiben beim Konto. Mitglieder werden nicht benachrichtigt.
create function public.dissolve_guugge(p_guugge uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann die Guugge auflösen.' using errcode = '42501';
  end if;
  select g.name into v_name from public.guuggen g where g.id = p_guugge;
  if v_name is null or lower(btrim(coalesce(p_name, ''))) <> lower(btrim(v_name)) then
    raise exception 'Zum Bestätigen den Namen der Guugge eintippen.' using errcode = '22023';
  end if;
  if exists (select 1 from public.licenses l where l.guugge_id = p_guugge) then
    raise exception 'Diese Guugge hat gekaufte Arrangements. Schreib uns an hallo@probelokal.ch, bevor du sie auflöst.'
      using errcode = '22023';
  end if;
  delete from public.guuggen g where g.id = p_guugge;
end
$$;
revoke all on function public.dissolve_guugge(uuid, text) from public, anon;
grant execute on function public.dissolve_guugge(uuid, text) to authenticated;
