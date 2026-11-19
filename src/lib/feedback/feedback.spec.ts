import { describe, expect, it } from 'vitest';
import { contextLine, deviceLabel, FEEDBACK_KINDS } from './feedback';

describe('Rückmeldung: Gerät kurz und ohne Kennung', () => {
	it('iPhone, iPad, Android, Mac, Windows mit Browser und Hauptversion', () => {
		expect(
			deviceLabel(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
			)
		).toBe('iPhone · Safari 18');
		expect(
			deviceLabel(
				'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
			)
		).toBe('iPad · Safari 17');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
			)
		).toBe('Android · Chrome 131');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
			)
		).toBe('Mac · Edge 131');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
			)
		).toBe('Windows · Firefox 133');
		// Chrome auf dem iPhone heisst CriOS
		expect(
			deviceLabel(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1'
			)
		).toBe('iPhone · Chrome 131');
		expect(deviceLabel('')).toBe('unbekannt');
	});

	it('Zeile für die Vorschau im Blatt, ohne leere Teile', () => {
		expect(
			contextLine({
				page: 'Stück üben',
				where: 'Teil G · Takt 31',
				voice: 'Trp 1',
				device: 'iPhone · Safari 18'
			})
		).toBe('Stück üben · Teil G · Takt 31 · Trp 1 · iPhone · Safari 18');
		expect(contextLine({ page: 'Meine Guuggen', device: 'Mac · Safari 18' })).toBe(
			'Meine Guuggen · Mac · Safari 18'
		);
	});

	it('drei Arten in dieser Reihenfolge', () => {
		expect(FEEDBACK_KINDS.map((k) => k.label)).toEqual(['Fehler', 'Idee', 'Lob']);
	});
});
