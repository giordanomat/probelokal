// Darstellung Dunkel/Hell, pro Gerät gespeichert. Dunkel ist Standard (Entscheid Matthias, 25.10.2026).
//
// Die erste Auswahl passiert schon vor dem ersten Zeichnen in src/app.html (Inline-Skript), damit
// beim Laden nichts aufblitzt. Das Skript dort muss dieselbe Regel befolgen wie resolveTheme().

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'probelokal.theme';
export const DEFAULT_THEME: Theme = 'dark';

/** Gespeicherten Wert lesen; alles Unbekannte ergibt den Standard. */
export function resolveTheme(stored: string | null | undefined): Theme {
	return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
}

/** Hintergrundfarbe für <meta name="theme-color">, passend zur Darstellung. */
export function themeColor(theme: Theme): string {
	return theme === 'light' ? '#F2EFE9' : '#141619';
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Liest die Darstellung; Speicher kann fehlen oder werfen (privates Fenster, gesperrt). */
export function loadTheme(storage: StorageLike | undefined): Theme {
	try {
		return resolveTheme(storage?.getItem(THEME_STORAGE_KEY));
	} catch {
		return DEFAULT_THEME;
	}
}

/** Speichert die Darstellung; Fehler beim Speichern sind egal, die Auswahl gilt dann nur bis zum Neuladen. */
export function saveTheme(storage: StorageLike | undefined, theme: Theme): void {
	try {
		storage?.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// absichtlich leer
	}
}

/** Setzt die Darstellung am Dokument und die Browserleisten-Farbe. */
export function applyTheme(doc: Document, theme: Theme): void {
	doc.documentElement.dataset.theme = theme;
	doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme));
}
