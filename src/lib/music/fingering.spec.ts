import { describe, expect, it } from 'vitest';
import {
	NATURAL_SERIES,
	STANDARD_SLIDE,
	STANDARD_VALVE,
	VALVE_BY_LOWERING,
	fingeringLabel,
	isNaturalTone,
	loweringOf,
	pressedValves,
	sameFingering,
	standardFingering
} from './fingering';

describe('Griffe', () => {
	it('rechnet die Absenkung je Ventilkombination', () => {
		expect(loweringOf('0', 'valve')).toBe(0);
		expect(loweringOf('2', 'valve')).toBe(1);
		expect(loweringOf('1', 'valve')).toBe(2);
		expect(loweringOf('13', 'valve')).toBe(5);
		expect(loweringOf('123', 'valve')).toBe(6);
		expect(loweringOf('', 'valve')).toBeNull();
		expect(loweringOf('4', 'valve')).toBeNull();
	});

	it('behandelt 3 und 12 als gleichwertig', () => {
		expect(loweringOf('3', 'valve')).toBe(loweringOf('12', 'valve'));
		expect(sameFingering('3', '12', 'valve')).toBe(true);
		expect(sameFingering('12', '3', 'valve')).toBe(true);
		expect(sameFingering('2', '1', 'valve')).toBe(false);
		expect(sameFingering('', '0', 'valve')).toBe(false);
	});

	it('vergleicht Zugpositionen nach Position', () => {
		// Zug 1 = keine Absenkung – nicht mit Ventil 1 verwechseln
		expect(loweringOf('1', 'slide')).toBe(0);
		expect(loweringOf('3', 'slide')).toBe(2);
		expect(loweringOf('4', 'slide')).toBe(3);
		expect(loweringOf('7', 'slide')).toBe(6);
		expect(loweringOf('8', 'slide')).toBeNull();
		expect(loweringOf('', 'slide')).toBeNull();
		expect(sameFingering('4', '4', 'slide')).toBe(true);
		expect(sameFingering('3', '4', 'slide')).toBe(false);
		expect(sameFingering('x', '4', 'slide')).toBe(false);
	});

	it('beschriftet Griffe für die Anzeige', () => {
		expect(fingeringLabel('0', 'valve')).toBe('offen');
		expect(fingeringLabel('123', 'valve')).toBe('1 + 2 + 3');
		expect(fingeringLabel('3', 'slide')).toBe('Zug 3');
		expect(fingeringLabel('', 'valve')).toBe('–');
		expect(pressedValves('13')).toEqual([1, 3]);
		expect(pressedValves('0')).toEqual([]);
	});

	it('Standardtabellen: jeder Ton = Naturton + Absenkung', () => {
		for (const [midi, fing] of Object.entries(STANDARD_VALVE)) {
			expect(isNaturalTone(+midi + (loweringOf(fing, 'valve') as number)), `${midi} ${fing}`).toBe(
				true
			);
		}
		for (const [midi, pos] of Object.entries(STANDARD_SLIDE)) {
			const lower = loweringOf(String(pos), 'slide') as number;
			expect(isNaturalTone(+midi + lower), `${midi} Zug ${pos}`).toBe(true);
		}
		VALVE_BY_LOWERING.forEach((fing, i) => expect(loweringOf(fing, 'valve')).toBe(i));
		expect(NATURAL_SERIES[1]).toBe(60);
	});

	it('liefert Standardgriffe nur im Tabellenbereich', () => {
		expect(standardFingering(69, 'valve')).toBe('12');
		expect(standardFingering(69, 'slide')).toBe('4');
		expect(standardFingering(40, 'valve')).toBe('');
		expect(standardFingering(40, 'slide')).toBe('');
	});
});
