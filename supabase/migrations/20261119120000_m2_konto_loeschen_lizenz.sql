-- Konto löschen: Guuggen mit gekauften Arrangements nicht stillschweigend mitlöschen (Code-Durchsicht
-- 19.11.2026). Bisher löschte delete_my_account jede Guugge, in der die Person allein ist, samt
-- Lizenz; »Guugge auflösen« sperrt das bereits. Jetzt gilt dieselbe Sperre: Ist die Person allein in
-- einer Guugge mit Lizenz, geht Konto löschen nicht, mit Hinweis auf hallo@probelokal.ch.
-- my_account_deletion meldet diese Guuggen zusätzlich als »licensed«.

create or replace function public.my_account_deletion() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
begin
  return jsonb_build_object(
    'blocking', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name))
                          from public.guuggen_blocking_deletion(me) b), '[]'::jsonb),
    'alone', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name))
                       from public.guuggen_alone(me) a), '[]'::jsonb),
    'licensed', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name))
                          from public.guuggen_alone(me) a
                          where exists (select 1 from public.licenses l where l.guugge_id = a.id)),
                         '[]'::jsonb)
  );
end
$$;

create or replace function public.delete_my_account(p_confirm text) returns void
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
  select string_agg('»' || a.name || '«', ', ') into v_block
    from public.guuggen_alone(me) a
    where exists (select 1 from public.licenses l where l.guugge_id = a.id);
  if v_block is not null then
    raise exception '% hat gekaufte Arrangements. Schreib uns an hallo@probelokal.ch, bevor du dein Konto löschst.', v_block
      using errcode = '22023';
  end if;

  delete from public.guuggen g where g.id in (select a.id from public.guuggen_alone(me) a);
  select u.email into v_email from auth.users u where u.id = me;
  if v_email is not null then
    delete from public.signups s where s.email = lower(v_email);
  end if;
  delete from auth.users u where u.id = me;
end
$$;
