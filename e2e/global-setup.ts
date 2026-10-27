// Künstliches Mikrofon für die Abläufe: Chromium spielt diese Datei als Mikrofon ab (in Schleife).
// Sägezahn auf klingendem G4 = notiert A4 für Trompete (shift −2). Wird bei jedem Lauf neu erzeugt,
// weil Audiodateien nicht ins Repository gehören.
import { writeFileSync } from 'node:fs';
import { sawWav } from './audio';
import { FAKE_MIC_WAV } from './fake-mic';

export default function globalSetup() {
	writeFileSync(FAKE_MIC_WAV, sawWav(392, 4));
}
