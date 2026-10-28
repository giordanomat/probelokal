import { describe, expect, it } from 'vitest';
import { diaFromMidi, durationName, germanName, midiOf, spell } from './notation';

describe('Notennamen', () => {
	it('schreibt deutsche Namen mit H und B', () => {
		expect(germanName('B', 0)).toBe('H');
		expect(germanName('B', -1)).toBe('B');
		expect(germanName('E', -1)).toBe('Es');
		expect(germanName('A', -1)).toBe('As');
		expect(germanName('F', 1)).toBe('Fis');
		expect(germanName('C', 0)).toBe('C');
	});

	it('rechnet MIDI aus Stammton, Oktave und Vorzeichen', () => {
		expect(midiOf('C', 4, 0)).toBe(60);
		expect(midiOf('A', 4, 0)).toBe(69);
		expect(midiOf('B', 3, -1)).toBe(58);
	});

	it('schreibt MIDI-Nummern mit Kreuz für Cis/Fis/Gis, B für Es/B', () => {
		expect(spell(61)).toEqual({ step: 'C', acc: 1, dia: 4 * 7 + 0 });
		expect(spell(63)).toEqual({ step: 'E', acc: -1, dia: 4 * 7 + 2 });
		expect(spell(70)).toEqual({ step: 'B', acc: -1, dia: 4 * 7 + 6 });
		expect(spell(72)).toEqual({ step: 'C', acc: 0, dia: 5 * 7 + 0 });
	});

	it('legt krumme Tonhöhen zwischen die Stammtöne', () => {
		expect(diaFromMidi(60)).toBe(28);
		expect(diaFromMidi(62)).toBe(29);
		expect(diaFromMidi(61)).toBe(28.5);
		expect(diaFromMidi(64.5)).toBeCloseTo(30.5);
		expect(diaFromMidi(71)).toBe(34);
	});

	it('benennt Notenwerte, Übergebundenes mit Komma', () => {
		expect(durationName(1)).toBe('Viertel');
		expect(durationName(0.75)).toBe('punktierte Achtel');
		expect(durationName(2.5)).toBe('2,5 Schläge (übergebunden)');
	});
});
