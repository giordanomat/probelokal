import { describe, expect, it } from 'vitest';
import { siteForHost } from './host';

describe('siteForHost', () => {
	it('erkennt den Shop', () => {
		expect(siteForHost('arrangements.giordanomat.de')).toBe('arrangements');
		expect(siteForHost('ARRANGEMENTS.giordanomat.de')).toBe('arrangements');
		expect(siteForHost('arrangements.localhost:4173')).toBe('arrangements');
	});

	it('alles andere ist das Probelokal', () => {
		expect(siteForHost('probelokal.giordanomat.de')).toBe('probelokal');
		expect(siteForHost('probelokal.giordanomat.workers.dev')).toBe('probelokal');
		expect(siteForHost('localhost:4173')).toBe('probelokal');
		expect(siteForHost('giordanomat.de')).toBe('probelokal');
	});
});
