// Nur für Tests: Noten von Bad Touch direkt aus der MusicXML im Repository erzeugen, mit demselben
// Werkzeug wie in der Produktionsstrecke (tools/extract_notes.py). So gibt es nur eine Quelle.
// Braucht python3 (auf GitHub-Runnern vorhanden).

import { execFileSync } from 'node:child_process';
import type { NotesFile, RawPart } from '#lib/music/types.ts';

let cached: NotesFile | null = null;

export function badTouchNotes(): NotesFile {
	cached ??= JSON.parse(
		execFileSync('python3', ['tools/extract_notes.py', 'prototype/v7/badtouch.xml'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		})
	) as NotesFile;
	return cached;
}

export function badTouchPart(id: string): RawPart {
	const part = badTouchNotes().parts.find((p) => p.id === id);
	if (!part) throw new Error('Part fehlt: ' + id);
	return part;
}
