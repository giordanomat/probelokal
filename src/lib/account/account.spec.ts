import { describe, expect, it } from 'vitest';
import { accountErrorText } from './api';
import {
	hasPendingInvite,
	inviteUrl,
	safeNext,
	savePendingInvite,
	takePendingInvite,
	tokenFromHash
} from './invite';

const TOKEN = 'ab'.repeat(32);

describe('Einladungslink', () => {
	it('Schlüssel hinter dem #, nur 64 Hex-Zeichen gelten', () => {
		expect(inviteUrl('https://probelokal.ch', TOKEN)).toBe(
			`https://probelokal.ch/einladung#${TOKEN}`
		);
		expect(tokenFromHash(`#${TOKEN}`)).toBe(TOKEN);
		expect(tokenFromHash(`#${TOKEN.toUpperCase()} `)).toBe(TOKEN);
		expect(tokenFromHash('#abc')).toBeNull();
		expect(tokenFromHash('')).toBeNull();
	});

	it('wartet über das Anmelden hinweg, genau einmal', () => {
		const m = new Map<string, string>();
		const store = {
			getItem: (k: string) => m.get(k) ?? null,
			setItem: (k: string, v: string) => void m.set(k, v),
			removeItem: (k: string) => void m.delete(k)
		};
		expect(hasPendingInvite(store)).toBe(false);
		savePendingInvite(store, TOKEN);
		expect(hasPendingInvite(store)).toBe(true);
		expect(takePendingInvite(store)).toBe(TOKEN);
		expect(hasPendingInvite(store)).toBe(false);
		expect(takePendingInvite(store)).toBeNull();
		const locked = {
			getItem: () => {
				throw new Error('gesperrt');
			},
			setItem: () => {
				throw new Error('gesperrt');
			},
			removeItem: () => {}
		};
		savePendingInvite(locked, TOKEN);
		expect(takePendingInvite(locked)).toBeNull();
	});

	it('Rücksprung nur innerhalb der App', () => {
		expect(safeNext('/einladung')).toBe('/einladung');
		expect(safeNext('//boese.ch/x')).toBe('/guugge');
		expect(safeNext('https://boese.ch')).toBe('/guugge');
		expect(safeNext('/\\boese.ch')).toBe('/guugge');
		expect(safeNext(null)).toBe('/guugge');
	});
});

describe('Fehlertexte', () => {
	it('eigene Meldungen der Datenbank kommen durch', () => {
		expect(accountErrorText({ code: '42501', message: 'Nur die Leitung kann einladen.' })).toBe(
			'Nur die Leitung kann einladen.'
		);
		expect(accountErrorText({ code: 'P0002', message: 'Diese Einladung gilt nicht mehr.' })).toBe(
			'Diese Einladung gilt nicht mehr.'
		);
	});

	it('Technisches wird übersetzt, nie roh gezeigt', () => {
		expect(accountErrorText({ code: '23514', message: 'violates check constraint' })).toBe(
			'Das ist zu lang oder leer.'
		);
		expect(accountErrorText({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(
			/noch nicht eingerichtet/
		);
		expect(accountErrorText(new TypeError('Failed to fetch'))).toMatch(/Keine Verbindung/);
		expect(accountErrorText({ status: 429, message: 'email rate limit exceeded' })).toMatch(
			/Zu viele Versuche/
		);
		expect(
			accountErrorText({ code: 'otp_expired', message: 'Token has expired or is invalid' })
		).toBe('Der Code stimmt nicht oder ist abgelaufen.');
		expect(accountErrorText({ code: 'XX000', message: 'internal' })).toBe(
			'Das hat nicht geklappt. Versuch es nochmal.'
		);
		expect(accountErrorText(undefined)).toBe('Das hat nicht geklappt. Versuch es nochmal.');
	});
});
