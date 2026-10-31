// Hinweise ohne Neuladen über Supabase Realtime (Postgres Changes, Migration 20261029220000).
// Die Meldung selbst ist nur ein Anstoss: Danach holt die Seite die Liste neu über list_hints, die
// auch »gelesen« kennt. Neue Hinweise kommen gefiltert nach den eigenen Guuggen; Löschungen lassen
// sich nicht filtern und kommen mit der ID, gezählt werden nur bekannte (has).
// Wird die Seite wieder sichtbar (App aus dem Hintergrund, Netz zurück), wird ebenfalls neu
// geholt, falls unterwegs eine Meldung verloren ging.
// Gegen das echte Realtime ungeprüft; der Browser-Test läuft gegen e2e/fake-supabase.ts.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Realtime filtert mit »in« höchstens 100 Werte (Supabase-Doku). */
const MAX_FILTER_VALUES = 100;

export interface LiveHints {
	/** Hinweise neu holen */
	onChange: () => void;
	/** Ist dieser Hinweis gerade in der Liste? (für Löschungen) */
	has: (id: string) => boolean;
	/** Meldungen kurz sammeln, bevor neu geholt wird */
	delayMs?: number;
	/** Für Tests; sonst document */
	doc?: VisibilityTarget;
}

/** Was von document gebraucht wird (Sichtbarkeit) */
export interface VisibilityTarget {
	visibilityState: DocumentVisibilityState;
	addEventListener(type: 'visibilitychange', listener: () => void): void;
	removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** Filter für die eigenen Guuggen, z. B. »guugge_id=eq.…« oder »guugge_id=in.(…,…)«. */
export function guuggeFilter(guuggen: readonly string[]): string {
	const ids = guuggen.slice(0, MAX_FILTER_VALUES);
	return ids.length === 1 ? `guugge_id=eq.${ids[0]}` : `guugge_id=in.(${ids.join(',')})`;
}

/** Zuhören; gibt eine Funktion zum Aufhören zurück. Ohne Guuggen passiert nichts. */
export function watchHints(
	sb: Pick<SupabaseClient, 'channel' | 'removeChannel'>,
	guuggen: readonly string[],
	opts: LiveHints
): () => void {
	if (!guuggen.length) return () => {};
	const doc = opts.doc ?? document;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const poke = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			opts.onChange();
		}, opts.delayMs ?? 300);
	};
	const channel = sb
		.channel(`hinweise-${Math.random().toString(36).slice(2)}`)
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'hints', filter: guuggeFilter(guuggen) },
			poke
		)
		.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hints' }, (p) => {
			const id = (p.old as { id?: string } | undefined)?.id;
			if (id && opts.has(id)) poke();
		})
		.subscribe();
	const visible = () => {
		if (doc.visibilityState === 'visible') poke();
	};
	doc.addEventListener('visibilitychange', visible);
	return () => {
		if (timer) clearTimeout(timer);
		doc.removeEventListener('visibilitychange', visible);
		void sb.removeChannel(channel);
	};
}
