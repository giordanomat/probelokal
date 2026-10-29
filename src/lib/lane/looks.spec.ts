import { describe, expect, it } from 'vitest';
import { GOLD, activeLook, lookFill, lookUnlocked } from './looks';

describe('Bahn-Looks', () => {
	it('Fasnacht färbt jeden Griff und jede Zugposition eigen', () => {
		expect(lookFill('fasnacht', '0', 'valve')).toBe('#F5C242');
		expect(lookFill('fasnacht', '13', 'valve')).toBe('#F08A3C');
		// gleichwertige Griffe gleich
		expect(lookFill('fasnacht', '12', 'valve')).toBe(lookFill('fasnacht', '3', 'valve'));
		expect(lookFill('fasnacht', '1', 'slide')).toBe('#F5C242');
		expect(lookFill('fasnacht', '7', 'slide')).toBe('#E46FA8');
		// unbekannt: Standardfarbe
		expect(lookFill('fasnacht', '', 'valve')).toBeNull();
		expect(lookFill('fasnacht', '9', 'slide')).toBeNull();
	});

	it('Gold färbt alles gleich, Standard nichts', () => {
		expect(lookFill('gold', '1', 'valve')).toBe(GOLD);
		expect(lookFill('gold', '4', 'slide')).toBe(GOLD);
		expect(lookFill('std', '1', 'valve')).toBeNull();
	});

	it('gilt erst ab dem Level der Belohnung', () => {
		expect(lookUnlocked('std', 0)).toBe(true);
		expect(lookUnlocked('fasnacht', 99)).toBe(false);
		expect(lookUnlocked('fasnacht', 100)).toBe(true);
		expect(lookUnlocked('gold', 499)).toBe(false);
		expect(activeLook('gold', 499)).toBe('std');
		expect(activeLook('gold', 500)).toBe('gold');
	});
});
