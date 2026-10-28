// Echo-Ablauf und Lautstärke der eigenen Stimme, portiert aus prototype/v7 (tick, effectiveOwnVol).
// Echo: zwei Takte vorhören (eigene Stimme laut), dieselben zwei Takte selbst spielen (eigene
// Stimme stumm), dann die nächsten zwei; am Ende des Bereichs von vorn.

export type EchoPhase = 'hear' | 'play';

export interface EchoState {
	from: number;
	phase: EchoPhase;
}

export interface BarRange {
	from: number;
	/** einschliesslich */
	to: number;
}

/** Takte pro Echo-Häppchen. */
export const ECHO_BARS = 2;

export interface EchoStep {
	state: EchoState;
	/** Wohin springen (mit einem Takt Anlauf); null = weiterlaufen. */
	seekTo: number | null;
	/** Bereich einmal durch – Durchgang auswerten. */
	passDone: boolean;
}

/** Nächster Schritt beim aktuellen (krummen) Takt. */
export function echoStep(state: EchoState, bar: number, range: BarRange): EchoStep {
	const end = Math.min(state.from + ECHO_BARS, range.to + 1);
	if (bar < end) return { state, seekTo: null, passDone: false };
	if (state.phase === 'hear') {
		return { state: { from: state.from, phase: 'play' }, seekTo: state.from, passDone: false };
	}
	const wrap = end > range.to;
	const from = wrap ? range.from : end;
	return { state: { from, phase: 'hear' }, seekTo: from, passDone: wrap };
}

export type PracticeMode = 'play' | 'echo' | 'rhythm';

/**
 * Lautstärke der eigenen Stimme (0–1). Beim Mithören mit Mikrofon immer stumm (die Person spielt
 * selbst), beim Echo laut in »Hör zu« und stumm in »Jetzt du«, sonst die Wahl Aus/Leise/Laut.
 */
export function ownVoiceVolume(opts: {
	micListening: boolean;
	mode: PracticeMode;
	echoPhase: EchoPhase;
	chosen: number;
}): number {
	if (opts.micListening) return 0;
	if (opts.mode === 'echo') return opts.echoPhase === 'hear' ? 1 : 0;
	return opts.chosen;
}
