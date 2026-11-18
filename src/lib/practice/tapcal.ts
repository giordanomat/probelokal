// Tippen abgleichen (Entwurf Matthias 18.11.2026): Jedes Gerät meldet einen Tipp etwas verspätet
// (Ausgabe des Tons, Bildschirm, Touch) und jede Person tippt etwas anders zum Klick. Einmal pro
// Gerät zu Klicks mittippen; der Median der Abweichungen ersetzt beim Rhythmus die pauschale
// Annahme »Ausgabe-Latenz + 15 ms« (src/lib/practice/rhythm.ts). Gilt auch für Etappenprüfungen
// mit Tippen. Der Wert enthält, wie die Person selbst zum Klick tippt; das lässt sich nicht trennen.
// Ungeprüft auf echten Geräten: ob 12 Tipps und ±40 ms Streuung für echte Finger passen.

/** Tempo 100: 0,6 s zwischen den Klicks */
export const TAPCAL_GAP_SEC = 0.6;
/** Klicks zum Zuhören (zählen nicht) */
export const TAPCAL_COUNT_IN = 4;
/** Klicks zum Mittippen */
export const TAPCAL_MEASURED = 12;
/** Ein Tipp gehört zu einem Klick, wenn er höchstens so weit davon liegt */
export const TAPCAL_MAX_DIST_SEC = 0.25;
/** So viele Tipps braucht es … */
export const TAPCAL_MIN_TAPS = 8;
/** … und höchstens so viel Streuung (Median der Abweichungen vom Median) */
export const TAPCAL_MAX_SPREAD_SEC = 0.04;

export const TAP_OFFSET_KEY = 'probelokal.tippen';

/** Zeiten aller Klicks (Zuhören und Mittippen) ab start, in Sekunden der Audio-Uhr. */
export function clickTimes(start: number): number[] {
	return Array.from(
		{ length: TAPCAL_COUNT_IN + TAPCAL_MEASURED },
		(_, i) => start + i * TAPCAL_GAP_SEC
	);
}

export interface TapOffset {
	/** Versatz Tipp minus Klick in Sekunden (positiv = nach dem Klick) */
	sec: number;
	spreadSec: number;
	matched: number;
}

function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Versatz aus allen Klickzeiten (Zuhören zuerst) und den Tippzeiten (gleiche Uhr). Jeder Klick zum
 * Mittippen bekommt höchstens einen Tipp, den nächsten innerhalb von 0,25 s. null bei zu wenigen
 * Tipps oder zu viel Streuung.
 */
export function estimateTapOffset(
	clicks: readonly number[],
	taps: readonly number[]
): TapOffset | null {
	const measured = clicks.slice(TAPCAL_COUNT_IN);
	const used = new Set<number>();
	const offsets: number[] = [];
	for (const c of measured) {
		let best = -1;
		let dist = Infinity;
		taps.forEach((t, i) => {
			const d = Math.abs(t - c);
			if (!used.has(i) && d <= TAPCAL_MAX_DIST_SEC && d < dist) {
				best = i;
				dist = d;
			}
		});
		if (best >= 0) {
			used.add(best);
			offsets.push(taps[best] - c);
		}
	}
	if (offsets.length < TAPCAL_MIN_TAPS) return null;
	const sec = median(offsets);
	const spreadSec = median(offsets.map((o) => Math.abs(o - sec)));
	if (spreadSec > TAPCAL_MAX_SPREAD_SEC) return null;
	return { sec, spreadSec, matched: offsets.length };
}

export type TapcalOutcome =
	| { kind: 'ok'; offset: TapOffset }
	/** weniger als 8 Tipps nahe an einem Klick */
	| { kind: 'few' }
	/** genug Tipps, aber zu stark gestreut */
	| { kind: 'uneven' };

/** Ergebnis für die Oberfläche: Versatz oder warum es keinen gibt. */
export function tapcalOutcome(clicks: readonly number[], taps: readonly number[]): TapcalOutcome {
	const offset = estimateTapOffset(clicks, taps);
	if (offset) return { kind: 'ok', offset };
	const near = clicks
		.slice(TAPCAL_COUNT_IN)
		.filter((c) => taps.some((t) => Math.abs(t - c) <= TAPCAL_MAX_DIST_SEC)).length;
	return near < TAPCAL_MIN_TAPS ? { kind: 'few' } : { kind: 'uneven' };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Gemessener Versatz dieses Geräts in Sekunden, oder null (nicht abgeglichen, Unsinn). */
export function loadTapOffset(storage: StorageLike | undefined): number | null {
	try {
		const raw = storage?.getItem(TAP_OFFSET_KEY);
		if (raw === null || raw === undefined) return null;
		const v = Number(raw);
		return Number.isFinite(v) && Math.abs(v) < 0.5 ? v : null;
	} catch {
		return null;
	}
}

export function saveTapOffset(storage: StorageLike | undefined, sec: number) {
	try {
		storage?.setItem(TAP_OFFSET_KEY, sec.toFixed(4));
	} catch {
		// gilt dann nur bis zum Neuladen
	}
}

/** »Du tippst 45 ms nach dem Klick.« */
export function tapOffsetText(sec: number): string {
	const ms = Math.round(Math.abs(sec) * 1000);
	if (ms === 0) return 'Du tippst genau auf den Klick.';
	return `Du tippst ${ms} ms ${sec > 0 ? 'nach' : 'vor'} dem Klick.`;
}
