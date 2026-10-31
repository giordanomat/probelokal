// Einladungslink und Rücksprung nach dem Anmelden.
//
// Der Schlüssel steht hinter dem # (`/einladung#<schlüssel>`): Der Teil nach # geht nie an einen
// Server, landet also weder in Logs noch im Referer. Wer noch nicht angemeldet ist, meldet sich
// zuerst an; bis dahin liegt der Schlüssel im Speicher des Geräts.

const TOKEN = /^[0-9a-f]{64}$/;
const PENDING_KEY = 'probelokal.einladung';

export function inviteUrl(origin: string, token: string): string {
	return `${origin}/einladung#${token}`;
}

/** Schlüssel aus `location.hash`, oder null, wenn er nicht wie ein Schlüssel aussieht. */
export function tokenFromHash(hash: string): string | null {
	const t = hash.replace(/^#/, '').trim().toLowerCase();
	return TOKEN.test(t) ? t : null;
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage, oder ein leerer Ersatz, wenn schon der Zugriff darauf scheitert (Safari mit gesperrten Website-Daten). */
export function deviceStore(): KeyStore {
	try {
		return localStorage;
	} catch {
		return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
	}
}

export function savePendingInvite(store: KeyStore, token: string) {
	try {
		store.setItem(PENDING_KEY, token);
	} catch {
		// Speicher gesperrt (privates Surfen): dann muss der Link nach dem Anmelden nochmals geöffnet werden
	}
}

export function hasPendingInvite(store: KeyStore): boolean {
	try {
		return TOKEN.test(store.getItem(PENDING_KEY) ?? '');
	} catch {
		return false;
	}
}

export function takePendingInvite(store: KeyStore): string | null {
	try {
		const t = store.getItem(PENDING_KEY);
		store.removeItem(PENDING_KEY);
		return t && TOKEN.test(t) ? t : null;
	} catch {
		return null;
	}
}

/** Nur Pfade dieser App als Rücksprung zulassen (kein `//andere-seite.ch`, kein `https://…`). */
export function safeNext(next: string | null | undefined, fallback = '/guugge'): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
		return fallback;
	}
	return next;
}
