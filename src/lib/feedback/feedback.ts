// Rückmeldung aus der App (Entscheid Matthias 19.11.2026, nach Entwurf). Speichern über die
// Datenbank-Funktion send_feedback (supabase/migrations/20261119100000_m2_rueckmeldung.sql); hier nur,
// was mitgeschickt wird. Das Gerät nur als Kurzform, ohne Kennung.

export type FeedbackKind = 'fehler' | 'idee' | 'lob';

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
	{ id: 'fehler', label: 'Fehler' },
	{ id: 'idee', label: 'Idee' },
	{ id: 'lob', label: 'Lob' }
];

/** Wo man gerade war; die Datenbank behält nur diese vier Felder, je höchstens 120 Zeichen. */
export interface FeedbackContext {
	page: string;
	/** z. B. »Teil G · Takt 31« */
	where?: string;
	/** z. B. »Trp 1« */
	voice?: string;
	device?: string;
}

/** »iPhone · Safari 18« aus der Browser-Kennung, oder »unbekannt«. */
export function deviceLabel(ua: string): string {
	const os = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Macintosh|Mac OS X/.test(ua)
					? 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
	const browsers: [string, RegExp][] = [
		['Edge', /Edg\/(\d+)/],
		['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
		['Chrome', /(?:CriOS|Chrome)\/(\d+)/],
		['Safari', /Version\/(\d+).*Safari/]
	];
	let browser = '';
	for (const [name, re] of browsers) {
		const m = re.exec(ua);
		if (m) {
			browser = `${name} ${m[1]}`;
			break;
		}
	}
	return [os, browser].filter(Boolean).join(' · ') || 'unbekannt';
}

/** Vorschau im Blatt: alles, was mitgeht, in einer Zeile. */
export function contextLine(c: FeedbackContext): string {
	return [c.page, c.where, c.voice, c.device].filter(Boolean).join(' · ');
}
