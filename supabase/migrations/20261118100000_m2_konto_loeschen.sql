-- Konto löschen (Entscheid Matthias 18.11.2026, nach Entwurf; docs/01 »Konto löschen«, docs/03).
-- Die Person löscht ihr Konto selbst, sofort und ohne Bedenkzeit. Mit auth.users fällt das Profil und
-- daran hängt alles Persönliche (on delete cascade): Mitgliedschaften, Etappen, Versuche, Punkte,
-- Übetage, gelesene Hinweise, Rangliste. Guuggen, in denen sie allein ist, gehen mit. Wer in einer
-- Guugge mit anderen die einzige Leitung ist, muss die Leitung zuerst abgeben. Hinweise, die sie als
-- Leitung geschrieben hat, bleiben ohne Verfasser. Der Eintrag in der Startliste der Landingpage mit
-- derselben E-Mail geht ebenfalls.

-- Hinweise: Verfasser darf verschwinden (bisher ohne Regel, das Löschen wäre daran gescheitert)
alter table public.hints drop constraint hints_created_by_fkey;
alter table public.hints
  add constraint hints_created_by_fkey foreign key (created_by)
  references public.profiles on delete set null;

-- Guuggen, in denen die Person die einzige Leitung ist und andere Mitglieder hat
create function public.guuggen_blocking_deletion(p_user uuid)
returns table (id uuid, name text)
language sql stable set search_path = '' as $$
  select g.id, g.name
  from public.memberships m
  join public.guuggen g on g.id = m.guugge_id
  where m.user_id = p_user
    and m.role = 'leitung'
    and public.other_leitung(m.guugge_id, p_user) = 0
    and exists (
      select 1 from public.memberships o where o.guugge_id = m.guugge_id and o.user_id <> p_user)
  order by g.name
$$;
revoke all on function public.guuggen_blocking_deletion(uuid) from public, anon, authenticated;

-- Guuggen, in denen die Person allein ist (werden mitgelöscht)
create function public.guuggen_alone(p_user uuid)
returns table (id uuid, name text)
language sql stable set search_path = '' as $$
  select g.id, g.name
  from public.memberships m
  join public.guuggen g on g.id = m.guugge_id
  where m.user_id = p_user
    and not exists (
      select 1 from public.memberships o where o.guugge_id = m.guugge_id and o.user_id <> p_user)
  order by g.name
$$;
revoke all on function public.guuggen_alone(uuid) from public, anon, authenticated;

-- Für das Blatt »Konto löschen«: was sperrt, was mitgeht
create function public.my_account_deletion() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  return jsonb_build_object(
    'blocking', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name))
                          from public.guuggen_blocking_deletion(me) b), '[]'::jsonb),
    'alone', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name))
                       from public.guuggen_alone(me) a), '[]'::jsonb)
  );
end
$$;
revoke all on function public.my_account_deletion() from public, anon;
grant execute on function public.my_account_deletion() to authenticated;

-- Löschen. p_confirm muss »löschen« sein (dieselbe Prüfung wie in der Oberfläche).
-- Ungeprüft gegen das echte Projekt: ob die Rolle, der die Funktion gehört (postgres), in auth.users
-- löschen darf. Prüfen mit einem Wegwerf-Konto (Testprotokoll M2, Abschnitt 10).
create function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  v_block text;
  v_email text;
begin
  if lower(btrim(coalesce(p_confirm, ''))) <> 'löschen' then
    raise exception 'Zum Bestätigen »löschen« eintippen.' using errcode = '22023';
  end if;
  select string_agg('»' || b.name || '«', ', ') into v_block from public.guuggen_blocking_deletion(me) b;
  if v_block is not null then
    raise exception 'Gib zuerst die Leitung ab: %', v_block using errcode = '22023';
  end if;

  delete from public.guuggen g where g.id in (select a.id from public.guuggen_alone(me) a);
  select u.email into v_email from auth.users u where u.id = me;
  if v_email is not null then
    delete from public.signups s where s.email = lower(v_email);
  end if;
  delete from auth.users u where u.id = me;
end
$$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
