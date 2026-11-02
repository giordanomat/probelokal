-- M2 · Hinweise der Leitung: Takte markieren mit Dynamik, Artikulation, Atemstelle oder freiem
-- Hinweis, für alle, ein Register oder eine Stimme (docs/01 »Hinweise der Leitung«). Anlegen und
-- löschen nur durch die Leitung; lesen alle Mitglieder; »neu«, bis die Person ihn gelesen hat.
-- Registerchefs schreiben (noch) keine Hinweise, offen in docs/03.
-- Getestet mit supabase/tests/rls.spec.ts; gegen das echte Projekt ungeprüft, bis die Migration
-- angewendet ist (docs/03 »Anwenden«).

create function public.add_hint(
  p_guugge uuid, p_slug text, p_from int, p_to int, p_target text,
  p_kind public.hint_kind, p_dyn text default null, p_body text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  t public.titles;
  body text := nullif(trim(coalesce(p_body, '')), '');
  h uuid;
begin
  if not public.is_leitung(p_guugge) then
    raise exception 'Nur die Leitung kann Hinweise eintragen.' using errcode = '42501';
  end if;
  select * into t from public.titles where slug = p_slug and published;
  if not found then
    raise exception 'Diesen Titel gibt es nicht.' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_from < 1 or p_to < p_from or p_to > t.bars - 1 then
    raise exception 'Takte von 1 bis %, »bis« nicht vor »ab«.', t.bars - 1 using errcode = '22023';
  end if;
  if p_target is null or not (
    p_target = 'alle'
    or p_target in ('trp', 'pos', 'tief', 'perc')
    or exists (select 1 from jsonb_array_elements(t.voices) v where v ->> 'id' = p_target)
  ) then
    raise exception 'Für wen ist der Hinweis?' using errcode = '22023';
  end if;
  if p_kind = 'dyn' and (p_dyn is null or p_dyn not in ('pp', 'p', 'mp', 'mf', 'f', 'ff', 'cresc.', 'decresc.')) then
    raise exception 'Bitte eine Stärke wählen.' using errcode = '22023';
  end if;
  if p_kind in ('artik', 'text') and body is null then
    raise exception 'Bitte einen kurzen Text eingeben.' using errcode = '22023';
  end if;
  if length(body) > 160 then
    raise exception 'Der Text ist zu lang (höchstens 160 Zeichen).' using errcode = '22023';
  end if;
  insert into public.hints (guugge_id, title_id, bar_from, bar_to, target, kind, dyn, body, created_by)
  values (p_guugge, t.id, p_from, p_to, p_target, p_kind,
          case when p_kind = 'dyn' then p_dyn end, body, me)
  returning id into h;
  -- Wer einträgt, hat den Hinweis gelesen
  insert into public.hint_reads (hint_id, user_id) values (h, me);
  return h;
end
$$;

create function public.delete_hint(p_hint uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g uuid;
begin
  perform public.require_user();
  select guugge_id into g from public.hints where id = p_hint;
  if g is null or not public.is_leitung(g) then
    raise exception 'Diesen Hinweis kannst du nicht löschen.' using errcode = '42501';
  end if;
  delete from public.hints where id = p_hint;
end
$$;

-- Alle Hinweise einer Guugge für einen Titel (Mitglieder), mit »gelesen« für mich.
create function public.list_hints(p_guugge uuid, p_slug text)
returns table (id uuid, bar_from int, bar_to int, target text, kind public.hint_kind,
               dyn text, body text, created_at timestamptz, is_read boolean)
language sql stable security definer set search_path = '' as $$
  select h.id, h.bar_from, h.bar_to, h.target, h.kind, h.dyn, h.body, h.created_at,
    exists (select 1 from public.hint_reads r where r.hint_id = h.id and r.user_id = public.require_user())
  from public.hints h
  where h.guugge_id = p_guugge and h.title_id = public.title_by_slug(p_slug) and public.is_member(p_guugge)
  order by h.bar_from, h.created_at
$$;

-- Als gelesen markieren (nur Hinweise aus eigenen Guuggen). Gibt die Anzahl neu markierter zurück.
create function public.mark_hints_read(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  n int;
begin
  insert into public.hint_reads (hint_id, user_id)
  select h.id, me from public.hints h
  where h.id = any (p_ids) and public.is_member(h.guugge_id)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function
  public.add_hint(uuid, text, int, int, text, public.hint_kind, text, text), public.delete_hint(uuid),
  public.list_hints(uuid, text), public.mark_hints_read(uuid[])
from public, anon;
grant execute on function
  public.add_hint(uuid, text, int, int, text, public.hint_kind, text, text), public.delete_hint(uuid),
  public.list_hints(uuid, text), public.mark_hints_read(uuid[])
to authenticated;
