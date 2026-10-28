// Datenformen für Noten und Titel. Das Noten-JSON erzeugt tools/extract_notes.py (siehe
// docs/06-produktionsstrecke.md); die Titel-Angaben entsprechen den Spalten von `titles` in
// supabase/migrations/0001_grundmodell.sql.

/** Ventil-Instrument (Trompete, Euphonium, Sousaphon) oder Zug (Posaune). */
export type InstrumentKind = 'valve' | 'slide';

/** Notenname ohne Vorzeichen, englisch wie in MusicXML (B = deutsches H). */
export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Eine Note, wie sie tools/extract_notes.py schreibt. Alle Tonhöhen notiert, nicht klingend. */
export interface RawNote {
	/** Beginn in Schlägen ab Takt 0 (4/4: Takt n beginnt bei Schlag 4n). */
	b: number;
	/** Dauer in Schlägen, übergebundene Noten zusammengeführt. */
	d: number;
	/** Notierte Tonhöhe als MIDI-Nummer. */
	m: number;
	/** Diatonische Stufe (Oktave × 7 + Stufe), bestimmt die Höhe auf der Bahn. */
	dia: number;
	/** Vorzeichen in Halbtönen (−1, 0, 1). */
	acc: number;
	step: Step;
	/** Griff aus dem Liedtext: Ventile wie '0', '12', '123' oder Zugposition '1'–'7'; '' = fehlt. */
	fing: string;
	/** Griff fehlte in der MusicXML und wurde aus der Standardtabelle ergänzt (--fill-missing). */
	fing_auto?: boolean;
	/** Einblasen: spielt der Dirigent vor; wird gestrichelt gezeigt und nicht bewertet. */
	call?: boolean;
}

export interface RawPart {
	id: string;
	name: string;
	kind: InstrumentKind;
	notes: RawNote[];
}

/** Ganze Ausgabe von tools/extract_notes.py. */
export interface NotesFile {
	source: string;
	bars: number;
	sections_from_barlines: number[];
	parts: RawPart[];
}

/** Note mit abgeleiteten Angaben für Anzeige und Bewertung. */
export interface Note extends RawNote {
	/** Deutscher Notenname (H und B, Cis, Es …). */
	name: string;
	/** Absenkung durch den Griff in Halbtönen (Ventile) bzw. Zugposition − 1; null, wenn kein Griff. */
	lower: number | null;
}

/** Eine Stimme, aufbereitet für Bahn und Griff-Anzeige. */
export interface Track {
	notes: Note[];
	/** Schlag, an dem eine Pause von mindestens ¾ Schlag beginnt (Atemzeichen). */
	rests: number[];
	/** Schläge, an denen nach mindestens einem Schlag Pause ein Einsatz kommt (für »Auswendig«). */
	entries: number[];
	/** Tiefste und höchste diatonische Stufe, für die Höhe der Bahn. */
	diaMin: number;
	diaMax: number;
}

export type Register = 'trp' | 'pos' | 'tief' | 'perc';

export type Instrument = 'trumpet' | 'trombone' | 'euphonium' | 'sousaphone';

/** Eine Stimme eines Titels (Eintrag in `titles.voices`). */
export interface Voice {
	/** Kurzname, auch in Dateinamen der Mischungen: 'trp1', 'pos1', 'sous' … */
	id: string;
	/** Anzeige kurz, z. B. »Trp 1«. */
	short: string;
	/** Anzeige lang, z. B. »Trompete 1«. */
	name: string;
	/** Part-ID in der MusicXML bzw. im Noten-JSON, z. B. 'P1'. */
	part: string;
	kind: InstrumentKind;
	instrument: Instrument;
	/** Klang = notiert + shift (Halbtöne). Alle Stimmen sind im Violinschlüssel in B notiert. */
	shift: number;
	register: Register;
}

/** Ein Teil des Stücks, Takte einschliesslich. */
export interface Section {
	from: number;
	to: number;
	/** 'Vorzähler', 'A', 'B' … */
	name: string;
}

/** Ein übbarer Titel in einer Fassung (Zeile in `titles`). */
export interface Title {
	slug: string;
	name: string;
	version: string;
	bpm: number;
	/** Anzahl Takte einschliesslich Takt 0 (Vorzähler). */
	bars: number;
	sections: Section[];
	voices: Voice[];
	/** Sekunden in den Audiodateien vor Takt 0 (Versatz Einzelspuren/Mischungen). */
	stem_offset_sec: number;
}
