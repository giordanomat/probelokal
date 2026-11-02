-- M2 · Hinweise ohne Neuladen: Supabase Realtime (Postgres Changes) meldet neue und gelöschte
-- Hinweise; die App holt dann die Liste neu über list_hints (src/lib/hints/live.ts).
-- Neue Hinweise bekommt nur, wer sie nach RLS lesen darf (»Hinweise lesen«: Mitglieder der Guugge).
-- Löschungen lassen sich laut Supabase-Doku nicht filtern und nicht nach RLS prüfen; sie gehen an
-- alle, die zuhören, aber nur mit der ID des Hinweises (replica identity full + RLS = nur der
-- Primärschlüssel). Inhalt oder Guugge gelöschter Hinweise verrät das nicht.
-- Gegen das echte Projekt ungeprüft, bis die Migration angewendet ist (docs/03 »Anwenden«); zu prüfen
-- im Dashboard unter Database → Publications → supabase_realtime.

alter table public.hints replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hints'
  ) then
    alter publication supabase_realtime add table public.hints;
  end if;
end
$$;
