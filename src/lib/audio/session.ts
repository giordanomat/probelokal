// iOS-Audio-Sitzung (Safari 17+, navigator.audioSession). Ohne Angabe behandelt iOS Ton aus Web
// Audio wie Spielgeräusche: Der Stummschalter schaltet ihn ab, Videos und Musik nicht. Fund aus der
// M2-Abnahme 03.11.2026 (»Play, aber kein Ton, keine Meldung«); dass das die Ursache war, ist
// ungeprüft. Prüfen: iPhone auf stumm, »Stück üben« abspielen – mit dieser Anmeldung muss die Band
// trotzdem klingen. Fürs Mikrofon braucht iOS »play-and-record«, danach zurück auf »playback«.
// Ältere Browser kennen audioSession nicht; dann passiert nichts.

export type AudioSessionKind = 'playback' | 'play-and-record';

interface NavigatorWithSession {
	audioSession?: { type: string };
}

export function setAudioSession(
	kind: AudioSessionKind,
	nav: NavigatorWithSession | undefined = typeof navigator === 'undefined'
		? undefined
		: (navigator as NavigatorWithSession)
): boolean {
	const session = nav?.audioSession;
	if (!session) return false;
	try {
		session.type = kind;
		return true;
	} catch {
		return false;
	}
}
