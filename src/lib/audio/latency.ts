// Verzögerung beim Mithören, pro Gerät abgeglichen (docs/02-architektur.md »Audio«).
// Gemeint ist der ganze Weg: Ton raus (Ausgabe-Latenz), durch die Luft, Mikrofon rein
// (Eingabe-Latenz). Wer zur Band spielt, spielt um genau diese Zeit »zu spät« im Mikrofon.
//
// Abgleich: Klicks zu bekannten Zeiten abspielen, das Mikrofon meldet die Einsätze (PitchTracker
// mit onsets). Geht nur über den Lautsprecher; mit Kopfhörern hört das Mikrofon die Klicks nicht.

/** Klicks beim Abgleich */
export const CALIBRATION_CLICKS = 8;
export const CALIBRATION_GAP_SEC = 0.5;
/** Ein Einsatz gehört zu einem Klick, wenn er höchstens so viel später kommt. */
const MAX_DELAY_SEC = 0.45;
/** So viele Klicks müssen gehört werden … */
const MIN_MATCHED = 5;
/** … und höchstens so weit vom Median entfernt liegen; weiter weg zählt als Ausreisser. */
const MAX_OFF_SEC = 0.03;
/** Streuung (Median der Abweichungen vom Median), ab der die Messung nicht taugt. */
const MAX_SPREAD_SEC = 0.015;

/** Ohne Abgleich wie im Prototyp: 80 ms plus die Ausgabe-Latenz, die das Gerät meldet. */
export function defaultRoundTrip(outputLatencySec: number): number {
	return 0.08 + outputLatencySec;
}

export interface LatencyEstimate {
	sec: number;
	/** Median der Abweichungen der einzelnen Messungen vom Median */
	spreadSec: number;
	matched: number;
}

function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Verzögerung aus geplanten Klickzeiten und gemeldeten Einsätzen (beides AudioContext-Zeit).
 * null, wenn zu wenige Klicks gehört wurden oder die Messungen zu stark streuen. Einzelne
 * Ausreisser (Husten, Türe) fallen weg.
 */
export function estimateRoundTrip(
	clicks: readonly number[],
	onsets: readonly number[]
): LatencyEstimate | null {
	const deltas: number[] = [];
	for (const c of clicks) {
		const hit = onsets.find((o) => o >= c && o - c <= MAX_DELAY_SEC);
		if (hit !== undefined) deltas.push(hit - c);
	}
	if (deltas.length < MIN_MATCHED) return null;
	const rough = median(deltas);
	const inliers = deltas.filter((d) => Math.abs(d - rough) <= MAX_OFF_SEC);
	if (inliers.length < MIN_MATCHED) return null;
	const sec = median(inliers);
	const spreadSec = median(inliers.map((d) => Math.abs(d - sec)));
	if (spreadSec > MAX_SPREAD_SEC) return null;
	return { sec, spreadSec, matched: inliers.length };
}

/** Warnung bei grosser Verzögerung (typisch Bluetooth). */
export function latencyWarning(sec: number): string | null {
	return sec > 0.15
		? 'Das ist viel. Bluetooth-Kopfhörer verzögern stark, mit Kabel geht es besser.'
		: null;
}

export const LATENCY_KEY = 'probelokal.latenz';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Gemessene Verzögerung dieses Geräts in Sekunden, oder null. */
export function loadLatency(storage: StorageLike | undefined): number | null {
	try {
		const v = Number(storage?.getItem(LATENCY_KEY));
		return Number.isFinite(v) && v > 0 && v < 1 ? v : null;
	} catch {
		return null;
	}
}

export function saveLatency(storage: StorageLike | undefined, sec: number | null) {
	try {
		if (sec === null) storage?.removeItem(LATENCY_KEY);
		else storage?.setItem(LATENCY_KEY, sec.toFixed(4));
	} catch {
		// absichtlich leer: gilt dann nur bis zum Neuladen
	}
}
