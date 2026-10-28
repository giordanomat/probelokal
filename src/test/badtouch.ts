// Nur für Tests: Noten von Bad Touch aus der eingecheckten Ausgabe von tools/extract_notes.py.
// Dass diese Datei zur MusicXML passt, prüft src/lib/titles/bad-touch.spec.ts.

import type { NotesFile, RawPart } from '#lib/music/types.ts';
import { BAD_TOUCH_NOTES } from '#lib/titles/bad-touch.ts';

export function badTouchNotes(): NotesFile {
	return BAD_TOUCH_NOTES;
}

export function badTouchPart(id: string): RawPart {
	const part = BAD_TOUCH_NOTES.parts.find((p) => p.id === id);
	if (!part) throw new Error('Part fehlt: ' + id);
	return part;
}
