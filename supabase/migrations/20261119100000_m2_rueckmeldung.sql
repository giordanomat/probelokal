-- Rückmeldung aus der App (Entscheid Matthias 19.11.2026, nach Entwurf; docs/01 »Rückmeldung«).
-- Pilot-Leute melden Fehler, Ideen und Lob. Nur mit Konto, höchstens 10 pro Person und Tag.
-- Lesen nur Matthias und Hans im Supabase-Dashboard (Table Editor, Tabelle »feedback«), weder
-- Leitung noch Mitglieder: RLS an, keine Regel, keine Rechte für anon und authenticated.
-- Kontext (Seite, Stelle, Stimme, Gerät) nur, wenn die Person ihn mitschickt; die E-Mail-Adresse nur,
-- wenn sie »Ihr dürft mir antworten« ankreuzt. Geht mit dem Konto (on delete cascade).

create type public.feedback_kind as enum ('fehler', 'idee', 'lob');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind public.feedback_kind not null,
  body text not null check (length(body) between 1 and 2000),
  context jsonb,
  reply_ok boolean not null default false,
  email text,
  created_at timestamptz not null default now()
);
create index feedback_user_day on public.feedback (user_id, created_at);

alter table public.feedback enable row level security;
revoke all on table public.feedback from public, anon, authenticated;

create function public.send_feedback(
  p_kind public.feedback_kind, p_body text, p_context jsonb, p_reply_ok boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  v_body text := btrim(coalesce(p_body, ''));
  v_ctx jsonb := '{}'::jsonb;
  k text;
  n int;
begin
  if v_body = '' then
    raise exception 'Schreib ein paar Worte.' using errcode = '22023';
  end if;
  if length(v_body) > 2000 then
    raise exception 'Das ist zu lang (höchstens 2000 Zeichen).' using errcode = '22023';
  end if;
  select count(*) into n from public.feedback f
   where f.user_id = me and (f.created_at at time zone 'Europe/Zurich')::date = public.today_zurich();
  if n >= 10 then
    raise exception 'Für heute reicht es, danke! Morgen geht es wieder.' using errcode = '22023';
  end if;
  -- nur bekannte Felder, nur Text, gekürzt
  if jsonb_typeof(p_context) = 'object' then
    foreach k in array array['page', 'where', 'voice', 'device'] loop
      if jsonb_typeof(p_context -> k) = 'string' then
        v_ctx := v_ctx || jsonb_build_object(k, left(p_context ->> k, 120));
      end if;
    end loop;
  end if;
  insert into public.feedback (user_id, kind, body, context, reply_ok, email)
  values (
    me, p_kind, v_body,
    nullif(v_ctx, '{}'::jsonb),
    coalesce(p_reply_ok, false),
    case when coalesce(p_reply_ok, false)
      then (select u.email from auth.users u where u.id = me) end
  );
end
$$;
revoke all on function public.send_feedback(public.feedback_kind, text, jsonb, boolean) from public, anon;
grant execute on function public.send_feedback(public.feedback_kind, text, jsonb, boolean) to authenticated;
