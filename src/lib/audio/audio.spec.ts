import { describe, expect, it } from 'vitest';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { audioStatusOf, probeAudio, stemUrls } from './access';
import {
	FALLBACK_LATENCY_SEC,
	MAX_DRIFT_SEC,
	needsResync,
	StemPlayer,
	type AudioGraph,
	type MediaLike
} from './stems';

/** Nachgebautes <audio>: Metadaten kommen erst, wenn der Test es sagt. */
class FakeMedia extends EventTarget {
	currentTime = 0;
	paused = true;
	playbackRate = 1;
	defaultPlaybackRate = 1;
	preservesPitch = false;
	readyState = 0;
	src = '';
	volume = 1;
	muted = false;
	loads = 0;
	reject = false;

	play() {
		if (this.reject) return Promise.reject(new DOMException('nein', 'NotAllowedError'));
		this.paused = false;
		return Promise.resolve();
	}
	pause() {
		if (this.paused) return;
		this.paused = true;
		this.dispatchEvent(new Event('pause'));
	}
	load() {
		this.loads++;
		this.readyState = 0;
		this.currentTime = 0;
		this.playbackRate = this.defaultPlaybackRate;
	}
	meta() {
		this.readyState = 1;
		this.dispatchEvent(new Event('loadedmetadata'));
	}
}

function setup(opts: { graphThrows?: boolean } = {}) {
	const band = new FakeMedia();
	const own = new FakeMedia();
	const gains: number[] = [];
	let graphs = 0;
	let resumes = 0;
	const player = new StemPlayer(band as unknown as MediaLike, own as unknown as MediaLike, () => {
		graphs++;
		if (opts.graphThrows) throw new Error('kein AudioContext');
		return {
			resume: () => resumes++,
			setOwnGain: (v) => gains.push(v),
			latency: () => 0.04
		} satisfies AudioGraph;
	});
	return { band, own, player, gains, graphs: () => graphs, resumes: () => resumes };
}

describe('Adressen und Vorabprüfung', () => {
	it('Band ohne mich und eigene Stimme pro Stimme, Fassung klein geschrieben', () => {
		expect(stemUrls(BAD_TOUCH, 'pos2')).toEqual({
			band: '/audio/bad-touch-2-0/schuegu27/minus_pos2.mp3',
			own: '/audio/bad-touch-2-0/schuegu27/pos2.mp3'
		});
	});

	it('liest den Status aus der Antwort von /audio/…', () => {
		expect(audioStatusOf({ type: 'opaqueredirect', status: 0, ok: false })).toBe('ok');
		expect(audioStatusOf({ type: 'basic', status: 200, ok: true })).toBe('ok');
		expect(audioStatusOf({ type: 'basic', status: 401, ok: false })).toBe('locked');
		expect(audioStatusOf({ type: 'basic', status: 404, ok: false })).toBe('missing');
		expect(audioStatusOf({ type: 'basic', status: 503, ok: false })).toBe('unavailable');
		expect(audioStatusOf({ type: 'basic', status: 502, ok: false })).toBe('unavailable');
	});

	it('folgt der Weiterleitung nicht und gilt bei Netzfehler als nicht erreichbar', async () => {
		const seen: RequestInit[] = [];
		const ok = (async (_u: RequestInfo | URL, init?: RequestInit) => {
			seen.push(init ?? {});
			return new Response(null, { status: 401 });
		}) as typeof fetch;
		expect(await probeAudio('/audio/x', ok)).toBe('locked');
		expect(seen[0].redirect).toBe('manual');
		const down = (async () => {
			throw new TypeError('offline');
		}) as typeof fetch;
		expect(await probeAudio('/audio/x', down)).toBe('unavailable');
	});
});

describe('Band und eigene Stimme', () => {
	it('die Band ist die Uhr; vor den Metadaten gilt das Sprungziel', () => {
		const { band, own, player } = setup();
		player.load({ band: '/b.mp3', own: '/o.mp3' }, 8.3);
		expect(band.src).toBe('/b.mp3');
		expect(own.src).toBe('/o.mp3');
		expect(player.time()).toBe(8.3);
		player.seek(10);
		expect(player.time()).toBe(10);
		band.meta();
		own.meta();
		expect(band.currentTime).toBe(10);
		expect(own.currentTime).toBe(10);
		band.currentTime = 12.5;
		expect(player.time()).toBe(12.5);
	});

	it('Tempo auf beiden Spuren, Tonhöhe bleibt, auch nach neuem Laden', () => {
		const { band, own, player } = setup();
		player.rate = 0.8;
		for (const el of [band, own]) {
			expect(el.playbackRate).toBe(0.8);
			expect(el.preservesPitch).toBe(true);
		}
		player.load({ band: '/b2.mp3', own: '/o2.mp3' });
		band.meta();
		expect(band.playbackRate).toBe(0.8);
	});

	it('Graph erst beim ersten Abspielen, einmal; Lautstärke über GainNode', async () => {
		const { band, own, player, gains, graphs, resumes } = setup();
		player.ownGain = 0.35;
		expect(graphs()).toBe(0);
		expect(player.latency()).toBe(FALLBACK_LATENCY_SEC);
		band.meta();
		own.meta();
		band.currentTime = 20;
		own.currentTime = 19;
		await player.play();
		expect(graphs()).toBe(1);
		expect(player.latency()).toBe(0.04);
		expect(gains).toEqual([0.35]);
		expect(own.currentTime).toBe(20);
		expect(player.playing).toBe(true);
		expect(own.paused).toBe(false);
		player.pause();
		await player.play();
		expect(graphs()).toBe(1);
		expect(resumes()).toBe(2);
		player.ownGain = 0;
		expect(gains).toEqual([0.35, 0]);
		expect(own.volume).toBe(1);
	});

	it('ohne AudioContext über element.volume', async () => {
		const { own, player } = setup({ graphThrows: true });
		player.ownGain = 0;
		await player.play();
		expect(own.muted).toBe(true);
		player.ownGain = 0.35;
		expect(own.volume).toBe(0.35);
		expect(own.muted).toBe(false);
	});

	it('führt die eigene Spur nach, wenn sie mehr als 50 ms abweicht, höchstens alle 500 ms', async () => {
		expect(needsResync(10, 10 + MAX_DRIFT_SEC - 0.001)).toBe(false);
		expect(needsResync(10, 10.051)).toBe(true);
		expect(needsResync(10, 9.9)).toBe(true);

		const { band, own, player } = setup();
		band.meta();
		own.meta();
		await player.play();
		band.currentTime = 30;
		own.currentTime = 30.04;
		expect(player.maybeSync(1000)).toBe(false);
		expect(own.currentTime).toBe(30.04);
		own.currentTime = 30.2;
		expect(player.maybeSync(1200)).toBe(false); // zu früh
		expect(player.maybeSync(1500)).toBe(true);
		expect(own.currentTime).toBe(30);
		player.pause();
		own.currentTime = 31;
		expect(player.maybeSync(5000)).toBe(false);
	});

	it('Anhalten von aussen hält auch die eigene Spur an', async () => {
		const { band, own, player } = setup();
		await player.play();
		band.pause();
		expect(own.paused).toBe(true);
		expect(player.playing).toBe(false);
	});

	it('abgelehntes Abspielen lässt beide stehen', async () => {
		const { band, own, player } = setup();
		band.reject = true;
		await player.play();
		expect(player.playing).toBe(false);
		expect(own.paused).toBe(true);
	});

	it('Ladefehler meldet sich und hält an', async () => {
		const { band, own, player } = setup();
		let errors = 0;
		player.onerror = () => errors++;
		await player.play();
		own.dispatchEvent(new Event('error'));
		expect(errors).toBe(1);
		expect(band.paused).toBe(true);
	});

	it('Stimme wechseln während des Spiels: neu laden, an derselben Stelle weiter', async () => {
		const { band, own, player } = setup();
		band.meta();
		own.meta();
		band.currentTime = 42;
		await player.play();
		player.load({ band: '/minus_pos1.mp3', own: '/pos1.mp3' });
		expect(band.loads).toBe(1);
		expect(player.playing).toBe(true);
		band.meta();
		own.meta();
		expect(band.currentTime).toBe(42);
		expect(own.currentTime).toBe(42);
	});
});
