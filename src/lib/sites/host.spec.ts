import { describe, expect, it } from 'vitest';
import { canonicalRedirect, siteForHost } from './host';

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

describe('canonicalRedirect', () => {
	const u = (s: string) => new URL(s);

	it('ohne gesetzte Hauptadresse leitet nichts um', () => {
		expect(
			canonicalRedirect(u('https://probelokal.giordanomat.de/ueben'), 'GET', undefined)
		).toBeNull();
		expect(canonicalRedirect(u('https://probelokal.giordanomat.de/ueben'), 'GET', ' ')).toBeNull();
	});

	it('alte Adressen und www leiten mit Pfad und Suche dauerhaft um', () => {
		expect(
			canonicalRedirect(u('https://probelokal.giordanomat.de/ueben?x=1'), 'GET', 'probelokal.ch')
		).toEqual({ location: 'https://probelokal.ch/ueben?x=1', status: 301 });
		expect(
			canonicalRedirect(u('https://probelokal.giordanomat.workers.dev/'), 'HEAD', 'probelokal.ch')
		).toEqual({ location: 'https://probelokal.ch/', status: 301 });
		expect(
			canonicalRedirect(u('https://www.probelokal.ch/zugang'), 'GET', 'probelokal.ch')
		).toEqual({ location: 'https://probelokal.ch/zugang', status: 301 });
	});

	it('Formulare werden mit 308 umgeleitet (bleiben POST)', () => {
		expect(
			canonicalRedirect(u('https://probelokal.giordanomat.de/zugang'), 'POST', 'probelokal.ch')
				?.status
		).toBe(308);
	});

	it('Hauptadresse, localhost, Shop und fremde Adressen bleiben', () => {
		for (const s of [
			'https://probelokal.ch/ueben',
			'http://localhost:4173/',
			'https://arrangements.giordanomat.de/',
			'https://abc123-probelokal.giordanomat.workers.dev/'
		]) {
			expect(canonicalRedirect(u(s), 'GET', 'probelokal.ch'), s).toBeNull();
		}
	});
});
