-- M2 · Funktionen für die Konto- und Guugge-Seiten (/guugge). Die Oberfläche liest und schreibt
-- Konten nur über Funktionen (rpc), nie direkt über Tabellen – so bleibt jede Regel an einem Ort.
-- Getestet mit supabase/tests/rls.spec.ts und e2e/guugge.e2e.ts; gegen das echte Projekt
-- ungeprüft, bis die Migration angewendet ist (docs/03 »Anwenden«).

-- Eigenes Konto auf einen Blick: Name und Guuggen mit eigener Rolle, Stimme und Opt-in.
create function public.my_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'display_name', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'guuggen', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'role', m.role, 'voice', m.voice, 'register', m.register,
          'rangliste_opt_in', m.rangliste_opt_in, 'rangliste_enabled', g.rangliste_enabled
        ) order by g.name)
      from public.memberships m join public.guuggen g on g.id = m.guugge_id
      where m.user_id = auth.uid()
    ), '[]'::jsonb)
  )
  where public.require_user() is not null
$$;

create function public.set_my_name(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  update public.profiles set display_name = trim(coalesce(p_name, '')) where id = me;
end
$$;

-- Rangliste für die Guugge ein- oder ausschalten (nur Leitung). Wer erscheint, entscheidet weiter
-- jede Person selbst (set_rangliste_opt_in).
create function public.set_rangliste_enabled(p_guugge uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann die Rangliste ein- und ausschalten.' using errcode = '42501';
  end if;
  update public.guuggen set rangliste_enabled = coalesce(p_on, false) where id = p_guugge;
end
$$;

revoke all on function public.my_account(), public.set_my_name(text), public.set_rangliste_enabled(uuid, boolean)
  from public, anon;
grant execute on function public.my_account(), public.set_my_name(text), public.set_rangliste_enabled(uuid, boolean)
  to authenticated;
