<script lang="ts">
	// Stück üben, Stand M1: Bahn und Griff-Anzeige für Bad Touch mit Ton (Band ohne mich und eigene
	// Stimme, docs/02-architektur.md »Audio«). Die Band ist die Uhr der Bahn. Ohne Testzugang oder
	// ohne Aufnahmen läuft die Bahn mit einer eigenen Uhr weiter, und ein Hinweis sagt warum.
	// Modi Mitspielen, Echo und Rhythmus tippen: Ablauf in #lib/practice/session.ts.
	// Mithören: AudioWorklet mit der Tonerkennung (#lib/audio/listen.ts), Bewertung in der session.
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		AUDIO_NOTICE,
		audioStatusOf,
		audioUrl,
		probeAudio,
		stemUrls,
		type AudioStatus
	} from '#lib/audio/access.ts';
	import {
		defaultRoundTrip,
		latencyWarning,
		loadLatency,
		saveLatency
	} from '#lib/audio/latency.ts';
	import { Listener, measureRoundTrip, micErrorText } from '#lib/audio/listen.ts';
	import { StemPlayer } from '#lib/audio/stems.ts';
	import type { TrackerMessage } from '#lib/pitch/tracker.ts';
	import GripPanel from '#lib/lane/GripPanel.svelte';
	import Lane from '#lib/lane/Lane.svelte';
	import { HELP_LABELS, zoomStep, type HelpLevel } from '#lib/lane/geometry.ts';
	import { panelState } from '#lib/lane/panel.ts';
	import {
		beatAtTime,
		countIn,
		sectionIndexOf,
		secondsPerBeat,
		sectionLabel,
		timeForBar
	} from '#lib/music/timing.ts';
	import { buildTrack } from '#lib/music/track.ts';
	import {
		BAUSTELLE_TEMPO,
		baustellenKey,
		loadBarStats,
		recordPass,
		saveBarStats,
		topBaustellen,
		type BarStats
	} from '#lib/practice/baustellen.ts';
	import ScoreView from '#lib/score/ScoreView.svelte';
	import { cachedFile, storeFile, titleCacheName } from '#lib/offline/title-cache.ts';
	import { FreeClock, type PracticeClock } from '#lib/practice/clock.ts';
	import type { EchoPhase, PracticeMode } from '#lib/practice/echo.ts';
	import { TEMPO_MAX, TEMPO_MIN } from '#lib/practice/pass.ts';
	import {
		DEFAULT_PREFS,
		OWN_LEVELS,
		loadPrefs,
		savePrefs,
		type LanePrefs
	} from '#lib/practice/prefs.ts';
	import { tapFeedback } from '#lib/practice/rhythm.ts';
	import {
		MODE_HINTS,
		MODE_LABELS,
		PracticeSession,
		type FrameInfo,
		type Listening,
		type PassReport
	} from '#lib/practice/session.ts';
	import type { Tone } from '#lib/pitch/coach.ts';
	import type { NoteVerdict } from '#lib/pitch/classify.ts';
	import { BAD_TOUCH, BAD_TOUCH_NOTES } from '#lib/titles/bad-touch.ts';

	const title = BAD_TOUCH;
	const voiceIds = title.voices.map((v) => v.id);
	let clock: PracticeClock = new FreeClock();
	let stems: StemPlayer | null = null;
	let bandEl: HTMLAudioElement;
	let ownEl: HTMLAudioElement;
	let audio = $state<AudioStatus | 'loading'>('loading');

	let prefs = $state<LanePrefs>({ ...DEFAULT_PREFS });
	let time = $state(0);
	let playing = $state(false);
	let tempo = $state(100);
	let loop = $state(false);
	let sectionIndex = $state(1);
	/** Sprungziel mit einem Takt Anlauf (Einzählen), sonst null */
	let target = $state<number | null>(null);
	// Spiegel des Übe-Ablaufs für die Anzeige (session selbst ist nicht reaktiv)
	let mode = $state<PracticeMode>('play');
	let echoPhase = $state<EchoPhase>('hear');
	let judged = $state.raw<ReadonlyMap<number, NoteVerdict>>(new Map());
	let report = $state<PassReport | null>(null);
	let feedback = $state<{ text: string; tone: Tone } | null>(null);
	let flash = $state(false);
	// Mithören
	let listening = $state<Listening>('off');
	let listener: Listener | null = null;
	let listenCtx: AudioContext | null = null;
	/** Eigener AudioContext fürs Mithören, wenn es keinen Ton gibt (ohne Testzugang) */
	let spareCtx: AudioContext | null = null;
	let current = $state<number | null>(null);
	let deviation = $state<number | null>(null);
	/** Gehörte Tonhöhe, notiert und gerundet (für die Anzeige) */
	let heard = $state<number | null>(null);
	let lastCoach = 0;
	/** Gemessene Verzögerung dieses Geräts (s) oder null */
	let measured = $state<number | null>(null);
	let calibration = $state<'idle' | 'running' | 'failed'>('idle');
	let calibrationError = $state('');
	/** Mikrofon liess sich nicht starten */
	let listenError = $state('');
	// Notenansicht, Vollbild, Baustellen
	let view = $state<'bahn' | 'noten'>('bahn');
	let fingering = $state(true);
	let scoreXml = $state<string | null>(null);
	let scoreStatus = $state<AudioStatus | 'idle' | 'loading'>('idle');
	let fokus = $state(false);
	let innerHeight = $state(800);
	/** Übebereich aus der Baustellen-Liste statt eines Teils */
	let customRange = $state<{ from: number; to: number } | null>(null);
	let bauStats = $state<BarStats>({});
	const baustellen = $derived(topBaustellen(bauStats));

	const rangeOf = (i: number) => ({ from: title.sections[i].from, to: title.sections[i].to });
	// Ablauf des Übens (nicht reaktiv; sync() spiegelt ihn in die Anzeige)
	const session = new PracticeSession([], secondsPerBeat(title), rangeOf(1));

	const voice = $derived(title.voices.find((v) => v.id === prefs.voice) ?? title.voices[0]);
	const track = $derived.by(() => {
		const part = BAD_TOUCH_NOTES.parts.find((p) => p.id === voice.part);
		return buildTrack(part?.notes ?? [], voice.kind);
	});
	const beat = $derived(beatAtTime(title, time));
	const bar = $derived(Math.max(0, beat / 4));
	const section = $derived(title.sections[sectionIndex]);
	const counting = $derived(countIn(beat, target));
	const phaseText = $derived(
		mode === 'echo' ? (echoPhase === 'hear' ? 'Hör zu' : 'Jetzt du') : null
	);
	const panel = $derived(
		panelState({
			notes: track.notes,
			beat,
			kind: voice.kind,
			help: prefs.help,
			countIn: counting,
			phaseText
		})
	);
	const scene = $derived({
		track,
		beat,
		kind: voice.kind,
		help: prefs.help,
		names: prefs.names,
		staff: prefs.staff,
		sections: title.sections,
		countIn: counting,
		judged,
		trace: listening !== 'off' ? session.trace : null,
		current: listening !== 'off' ? current : null,
		overlay:
			mode === 'echo'
				? echoPhase === 'hear'
					? { text: 'HÖR ZU', tone: 'blau' as const }
					: { text: 'JETZT DU', tone: 'gelb' as const }
				: null
	});

	/** Anzeige und Lautstärke der eigenen Stimme nach jeder Änderung am Übe-Ablauf nachziehen. */
	function sync() {
		mode = session.mode;
		echoPhase = session.echo.phase;
		judged = new Map(session.judged);
		if (stems) stems.ownGain = session.ownVolume(prefs.own);
	}

	function frameInfo(atBeat = beat): FrameInfo {
		// Ohne Ton gibt es keine Ausgabe-Latenz: getippt wird nach der Bahn.
		return { beat: atBeat, latency: stems?.latency() ?? 0, rate: tempo / 100, target };
	}

	/** Verzögerung beim Mithören mit Mikrofon: gemessen oder wie im Prototyp geschätzt. */
	const roundTrip = $derived(measured ?? defaultRoundTrip(audio === 'ok' ? 0.02 : 0));

	/** AudioContext fürs Mithören: der der Wiedergabe, sonst ein eigener. Nur aus einer Berührung. */
	function audioContextForListening(): AudioContext | null {
		const ctx = stems?.audioContext();
		if (ctx) return ctx;
		if (!spareCtx && typeof AudioContext !== 'undefined') spareCtx = new AudioContext();
		void spareCtx?.resume();
		return spareCtx;
	}

	async function toggleListening(kind: Exclude<Listening, 'off'>) {
		if (listening === kind) {
			stopListening();
			return;
		}
		stopListening(true);
		const ctx = audioContextForListening();
		const input = kind === 'mic' ? 'mic' : stems?.ownSource();
		listenError = '';
		if (!ctx || !input) {
			listenError = micErrorText({ name: 'NoMedia' });
			return;
		}
		try {
			listener = await Listener.start(ctx, input, { instrument: voice.instrument });
		} catch (e) {
			listenError = micErrorText(e);
			return;
		}
		listenCtx = ctx;
		listener.onmessage = onTracker;
		session.setListening(kind);
		listening = kind;
		report = null;
		feedback = {
			text:
				kind === 'mic'
					? 'Ich höre zu. Play drücken und mitspielen.'
					: 'Vorführung: Die Aufnahme deiner Stimme spielt, das Mithören bewertet sie.',
			tone: ''
		};
		sync();
		if (kind === 'demo' && !clock.playing) togglePlay();
	}

	function stopListening(silent = false) {
		listener?.stop();
		listener = null;
		if (listening === 'off') return;
		session.setListening('off');
		listening = 'off';
		current = null;
		deviation = null;
		heard = null;
		sync();
		if (!silent) feedback = { text: 'Mithören ist aus.', tone: '' };
	}

	function onTracker(m: TrackerMessage) {
		if (m.type !== 'pitch' || !listenCtx) return;
		const written = m.midi === null ? null : m.midi - voice.shift;
		heard = written === null ? null : Math.round(written);
		if (!clock.playing) return;
		// Alter der Meldung plus Verzögerung des Geräts (bei der Vorführung kommt der Ton direkt)
		const age = Math.max(0, listenCtx.currentTime - m.t);
		const delay = age + (listening === 'mic' ? roundTrip : 0);
		const changed = session.hear(written, frameInfo(beatAtTime(title, clock.time())), delay);
		current = session.current;
		deviation = session.lastDeviation;
		if (changed) sync();
		const now = performance.now();
		if (now - lastCoach >= 350) {
			lastCoach = now;
			const msg = session.coach(voice.kind, clock.playing, tempo / 100);
			if (msg) feedback = msg;
		}
	}

	async function calibrate() {
		stopListening(true);
		if (clock.playing) togglePlay();
		const ctx = audioContextForListening();
		if (!ctx) return;
		calibration = 'running';
		calibrationError = '';
		try {
			const est = await measureRoundTrip(ctx, voice.instrument);
			if (est) {
				measured = est.sec;
				saveLatency(localStorage, est.sec);
				calibration = 'idle';
			} else {
				calibration = 'failed';
			}
		} catch (e) {
			calibration = 'failed';
			calibrationError = micErrorText(e);
		}
	}

	const SCORE_NOTICE: Record<AudioStatus, string> = {
		ok: '',
		locked: 'Für die Noten brauchst du den Testzugang.',
		missing: 'Die Noten sind noch nicht hochgeladen.',
		unavailable: 'Die Noten sind gerade nicht erreichbar.'
	};

	const listenHint = $derived(
		listening === 'mic'
			? 'Deine Stimme ist beim Mithören stumm, du spielst sie selbst. Kopfhörer empfohlen.'
			: listening === 'demo'
				? 'So sieht es aus, wenn jemand die Stimme fehlerfrei spielt.'
				: 'Das Mikrofon hört, ob du die Töne triffst. Mit Kopfhörer, sonst hört es die Band mit.'
	);

	const latencyText = $derived.by(() => {
		if (calibration === 'running')
			return 'Kopfhörer ab, Lautsprecher an. Gleich kommen acht Klicks …';
		if (calibration === 'failed') {
			return (
				calibrationError ||
				'Das hat nicht geklappt. Lauter stellen, Kopfhörer ab und nochmals versuchen.'
			);
		}
		const ms = Math.round(roundTrip * 1000);
		if (measured === null)
			return `Verzögerung ${ms} ms, geschätzt. Abgleichen macht die Bewertung genauer.`;
		return [`Verzögerung ${ms} ms, gemessen.`, latencyWarning(measured)].filter(Boolean).join(' ');
	});

	/** keepPass: Sprung innerhalb eines Durchgangs (Echo); sonst beginnt die Bewertung neu. */
	function jumpTo(toBar: number, preroll = true, keepPass = false) {
		if (!keepPass) session.resetPass();
		const b = Math.max(0, Math.min(title.bars - 0.01, toBar));
		target = preroll && b >= 1 ? b : null;
		clock.seek(timeForBar(title, target !== null ? b - 1 : b));
		time = clock.time();
	}

	function chooseSection(i: number) {
		sectionIndex = i;
		customRange = null;
		session.setRange(rangeOf(i));
		jumpTo(title.sections[i].from);
		sync();
	}

	function chooseMode(m: PracticeMode) {
		if (m === 'rhythm') stopListening(true);
		session.setMode(m);
		report = null;
		feedback = null;
		if (m === 'echo' && clock.playing) {
			const from = session.startEcho();
			if (from !== null) jumpTo(from);
		}
		sync();
	}

	function toggleLoop() {
		loop = !loop;
		session.loop = loop;
		if (!loop && customRange) {
			customRange = null;
			session.setRange(rangeOf(sectionIndex));
		}
		session.resetPass();
		sync();
	}

	function showReport(r: PassReport) {
		report = r;
		if (!r.final || !r.judged.length) return;
		// Baustellen pro Titel und Stimme, nur auf dem Gerät (Liste kommt mit M1 Punkt 5)
		const key = baustellenKey(title.slug, voice.id);
		bauStats = recordPass(loadBarStats(localStorage, key), r.judged, track.notes);
		saveBarStats(localStorage, key, bauStats);
	}

	function loadBaustellen() {
		bauStats = loadBarStats(localStorage, baustellenKey(title.slug, voice.id));
	}

	function resetBaustellen() {
		bauStats = {};
		saveBarStats(localStorage, baustellenKey(title.slug, voice.id), {});
	}

	/** Baustelle üben: zwei Takte in der Schleife bei 70 % (wie im Prototyp, practiceBars). */
	function practiceBars(from: number) {
		const to = Math.min(title.bars - 1, from + 1);
		customRange = { from, to };
		session.setRange(customRange);
		loop = true;
		session.loop = true;
		tempo = BAUSTELLE_TEMPO;
		view = 'bahn';
		jumpTo(from);
		sync();
		document.querySelector('.stage')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	function chooseView(v: 'bahn' | 'noten') {
		view = v;
		if (v === 'noten') {
			setFokus(false);
			void loadScore();
		}
	}

	/** MusicXML aus dem Bucket, hinter dem Testzugang wie das Audio. */
	async function loadScore() {
		if (scoreStatus === 'loading' || scoreStatus === 'ok') return;
		scoreStatus = 'loading';
		const path = audioUrl(title.slug, title.version, 'score.musicxml');
		// Gespeichert oder jetzt speichern (einmal laden), sonst direkt laden, um den Grund zu erfahren
		if (await storeFile(cacheStorage(), offlineCache, path)) {
			const blob = await cachedFile(cacheStorage(), offlineCache, path);
			if (blob) {
				scoreXml = await blob.text();
				scoreStatus = 'ok';
				return;
			}
		}
		try {
			const res = await fetch(path);
			if (!res.ok) {
				scoreStatus = audioStatusOf(res);
				return;
			}
			scoreXml = await res.text();
			scoreStatus = 'ok';
		} catch {
			// auch, wenn Supabase nach der Weiterleitung keine CORS-Kopfzeilen schickt
			scoreStatus = 'unavailable';
		}
	}

	function setFokus(on: boolean) {
		fokus = on;
		document.documentElement.classList.toggle('fokus', on);
		if (on) window.scrollTo(0, 0);
	}

	function doTap() {
		if (!clock.playing) return;
		const fb = tapFeedback(session.tap(frameInfo()));
		if (fb) feedback = fb;
		flash = true;
		setTimeout(() => (flash = false), 90);
		sync();
	}

	/** Uhr wechseln (eigene Uhr ↔ Band) und an derselben Stelle im gleichen Tempo weitermachen. */
	function useClock(next: PracticeClock) {
		const t = clock.time();
		const was = clock.playing;
		clock.pause();
		next.rate = tempo / 100;
		next.seek(t);
		clock = next;
		if (was) next.play();
		playing = next.playing;
		time = t;
	}

	// Offline (M1 Punkt 6): gespeicherte Dateien dieses Titels, siehe #lib/offline/title-cache.ts
	const offlineCache = titleCacheName(title.slug, title.version);
	const cacheStorage = () => (typeof caches === 'undefined' ? undefined : caches);
	/** blob:-Adressen der gespeicherten Spuren, die gerade spielen (freigeben beim Wechsel) */
	let blobUrls: string[] = [];
	/** Die Spuren der gewählten Stimme sind gespeichert und laufen ohne Netz */
	let saved = $state(false);
	/** Messwerte für die Abnahme (docs/testprotokolle), sichtbar mit ?diag */
	let diag = $state(false);
	let driftMs = $state(0);
	let resyncs = $state(0);
	let outputMs = $state(0);

	/** Gespeicherte Spuren einer Stimme als blob:-Adressen, oder null. */
	async function localStems(id: string): Promise<{ band: string; own: string } | null> {
		const urls = stemUrls(title, id);
		const [band, own] = await Promise.all([
			cachedFile(cacheStorage(), offlineCache, urls.band),
			cachedFile(cacheStorage(), offlineCache, urls.own)
		]);
		if (!band || !own) return null;
		return { band: URL.createObjectURL(band), own: URL.createObjectURL(own) };
	}

	/** Spuren laden; die vorherigen blob:-Adressen erst danach freigeben. */
	function loadStems(player: StemPlayer, urls: { band: string; own: string }, at?: number) {
		const old = blobUrls;
		player.load(urls, at);
		blobUrls = [urls.band, urls.own].filter((u) => u.startsWith('blob:'));
		old.forEach((u) => URL.revokeObjectURL(u));
	}

	/** Spuren einer Stimme im Hintergrund speichern (einmal ganz laden, zusätzlich zum Abspielen). */
	async function saveStems(id: string) {
		const urls = stemUrls(title, id);
		const ok = (
			await Promise.all([
				storeFile(cacheStorage(), offlineCache, urls.band),
				storeFile(cacheStorage(), offlineCache, urls.own)
			])
		).every(Boolean);
		if (id === voice.id) saved = ok;
		// Bitte, den Speicher nicht aufzuräumen (Safari tut es sonst eigenmächtig); ungeprüft, ob iOS zusagt
		if (ok) void navigator.storage?.persist?.().catch(() => {});
	}

	async function startAudio() {
		const id = voice.id;
		const local = await localStems(id);
		if (!local) {
			const status = await probeAudio(stemUrls(title, id).band);
			if (status !== 'ok') {
				audio = status;
				return;
			}
		}
		const player = new StemPlayer(bandEl, ownEl);
		player.ownGain = session.ownVolume(prefs.own);
		player.onerror = () => {
			if (stems !== player) return;
			stems = null;
			audio = 'unavailable';
			useClock(new FreeClock());
			player.destroy();
		};
		// Stimme neu lesen: Sie kann während der Vorabprüfung gewechselt haben.
		const current = voice.id === id ? local : null;
		loadStems(player, current ?? stemUrls(title, voice.id), clock.time());
		useClock(player);
		stems = player;
		audio = 'ok';
		saved = current !== null;
		if (!current) void saveStems(voice.id);
	}

	function chooseVoice(id: string) {
		setPrefs({ voice: id });
		session.setNotes(track.notes);
		loadBaustellen();
		listener?.setInstrument(voice.instrument);
		sync();
		saved = false;
		if (stems) void switchStems(stems, id);
	}

	async function switchStems(player: StemPlayer, id: string) {
		const local = await localStems(id);
		if (stems !== player || voice.id !== id) {
			if (local) [local.band, local.own].forEach((u) => URL.revokeObjectURL(u));
			return;
		}
		loadStems(player, local ?? stemUrls(title, id));
		saved = local !== null;
		if (!local) void saveStems(id);
	}

	function chooseOwn(level: number) {
		setPrefs({ own: level });
		sync();
	}

	function togglePlay() {
		if (clock.playing) {
			clock.pause();
			const r = session.finish(false, tempo);
			if (r) report = r;
		} else {
			if (bar >= title.bars - 0.01) jumpTo(section.from);
			const echoFrom = session.startEcho();
			if (echoFrom !== null) jumpTo(echoFrom);
			sync();
			clock.play();
		}
		playing = clock.playing;
	}

	function tick() {
		stems?.maybeSync(performance.now());
		if (diag && stems) {
			driftMs = Math.round(stems.maxDriftSec * 1000);
			resyncs = stems.resyncs;
			outputMs = Math.round(stems.latency() * 1000);
		}
		time = clock.time();
		if (clock.playing) {
			const step = session.advance(frameInfo(), tempo);
			if (step.seekTo !== null) jumpTo(step.seekTo, true, true);
			if (step.report) showReport(step.report);
			if (step.seekTo !== null || step.report) sync();
		}
		const b = beat / 4;
		if (b >= title.bars) clock.pause();
		// Band zu Ende, von aussen angehalten oder Abspielen abgelehnt
		if (!clock.playing) playing = false;
		const free = !loop && mode !== 'echo';
		if (target !== null && free && b > target + 0.5) target = null;
		if (free) {
			const i = sectionIndexOf(title.sections, target ?? b);
			if (i !== sectionIndex) {
				sectionIndex = i;
				session.setRange(rangeOf(i));
			}
		}
		if (clock.playing && session.catchMisses(frameInfo())) sync();
	}

	$effect(() => {
		clock.rate = tempo / 100;
	});

	$effect(() => {
		if (!playing) return;
		let raf = requestAnimationFrame(function frame() {
			tick();
			raf = requestAnimationFrame(frame);
		});
		return () => cancelAnimationFrame(raf);
	});

	function setPrefs(patch: Partial<LanePrefs>) {
		prefs = { ...prefs, ...patch };
		savePrefs(localStorage, prefs);
	}

	function onKey(e: KeyboardEvent) {
		if (e.code === 'Escape' && fokus) {
			setFokus(false);
			return;
		}
		const t = e.target as HTMLElement | null;
		if (t && /INPUT|SELECT|TEXTAREA|BUTTON/.test(t.tagName)) return;
		if (e.code === 'Space') {
			e.preventDefault();
			if (e.repeat) return;
			if (mode === 'rhythm' && clock.playing) doTap();
			else togglePlay();
		}
	}

	onMount(() => {
		prefs = loadPrefs(localStorage, voiceIds);
		measured = loadLatency(localStorage);
		diag = new URLSearchParams(location.search).has('diag');
		session.setNotes(track.notes);
		loadBaustellen();
		jumpTo(title.sections[1].from);
		void startAudio();
		// Vollbild nicht auf andere Seiten mitnehmen (nur im Browser, darum hier statt in onDestroy)
		return () => document.documentElement.classList.remove('fokus');
	});

	onDestroy(() => {
		stopListening(true);
		stems?.destroy();
		blobUrls.forEach((u) => URL.revokeObjectURL(u));
		void spareCtx?.close();
	});
</script>

<svelte:head>
	<title>{title.name} üben · giordanomat PROBELOKAL</title>
</svelte:head>

<svelte:window onkeydown={onKey} bind:innerHeight />

<section class="head">
	<p class="label">Stück üben</p>
	<h1>{title.name}</h1>
	<p class="hint">
		Fassung {title.version} · ♩ {title.bpm}. Du hörst die Band ohne deine Stimme. Deine Stimme
		kannst du laut, leise oder gar nicht dazunehmen.
	</p>
	{#if diag}
		<p class="hint diag" data-testid="diag">
			Messung: eigene Spur max. {driftMs} ms neben der Band ({resyncs} × nachgeführt) · Ausgabe-Latenz
			{outputMs} ms · Verzögerung Mithören {Math.round(roundTrip * 1000)} ms{measured === null
				? ' (geschätzt)'
				: ''}
		</p>
	{/if}
	{#if saved}
		<p class="hint" data-testid="offline">Diese Stimme ist gespeichert und läuft auch ohne Netz.</p>
	{/if}
	{#if audio !== 'ok' && audio !== 'loading'}
		<p class="notice" role="status" data-testid="ton-hinweis">
			{AUDIO_NOTICE[audio]}
			{#if audio === 'locked'}<a href={resolve('/zugang')}>Code eingeben</a>{/if}
		</p>
	{/if}
</section>

<section class="row">
	<div class="seg" role="group" aria-label="Stimme">
		{#each title.voices as v (v.id)}
			<button type="button" aria-pressed={v.id === voice.id} onclick={() => chooseVoice(v.id)}
				>{v.short}</button
			>
		{/each}
	</div>
</section>

<section class="row">
	<div class="seg" role="group" aria-label="Übe-Modus">
		{#each Object.entries(MODE_LABELS) as [m, label] (m)}
			<button type="button" aria-pressed={m === mode} onclick={() => chooseMode(m as PracticeMode)}
				>{label}</button
			>
		{/each}
	</div>
	<span class="hint" data-testid="modus-hinweis">{MODE_HINTS[mode]}</span>
</section>

<section class="row">
	<span class="toggle">Meine Stimme</span>
	<div class="seg" role="group" aria-label="Meine Stimme im Kopfhörer">
		{#each OWN_LEVELS as l (l.value)}
			<button
				type="button"
				aria-pressed={l.value === prefs.own}
				disabled={audio !== 'ok'}
				onclick={() => chooseOwn(l.value)}>{l.label}</button
			>
		{/each}
	</div>
	<span class="hint">»Aus« heisst: Du spielst deine Stimme selbst.</span>
</section>

<section class="row listen">
	<button
		type="button"
		class="micbtn"
		aria-pressed={listening === 'mic'}
		disabled={mode === 'rhythm' || calibration === 'running'}
		onclick={() => toggleListening('mic')}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><path
				d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12z"
			/></svg
		>
		Mithören
	</button>
	<button
		type="button"
		class="mini"
		aria-pressed={listening === 'demo'}
		disabled={audio !== 'ok' || mode === 'rhythm' || calibration === 'running'}
		onclick={() => toggleListening('demo')}
		>{listening === 'demo' ? 'Vorführung beenden' : 'Vorführung mit Aufnahme'}</button
	>
	<button type="button" class="mini" disabled={calibration === 'running'} onclick={calibrate}
		>Verzögerung abgleichen</button
	>
	{#if listenError}
		<span class="say" data-tone="bad" role="alert">{listenError}</span>
	{:else}
		<span class="hint">{listenHint}</span>
	{/if}
	<span class="hint" data-testid="verzoegerung">{latencyText}</span>
</section>

<section class="row opts">
	<div class="seg" role="group" aria-label="Ansicht">
		<button type="button" aria-pressed={view === 'bahn'} onclick={() => chooseView('bahn')}
			>Bahn</button
		>
		<button type="button" aria-pressed={view === 'noten'} onclick={() => chooseView('noten')}
			>Noten</button
		>
	</div>
	{#if view === 'noten'}
		<label class="toggle"
			><input type="checkbox" bind:checked={fingering} /> Griffe und Zugpositionen</label
		>
	{:else}
		<label class="toggle"
			><input
				type="checkbox"
				checked={prefs.names}
				onchange={(e) => setPrefs({ names: e.currentTarget.checked })}
			/> Notennamen</label
		>
		<label class="toggle"
			><input
				type="checkbox"
				checked={prefs.staff}
				onchange={(e) => setPrefs({ staff: e.currentTarget.checked })}
			/> Notenlinien</label
		>
		<label class="toggle"
			>Hilfen
			<select
				value={prefs.help}
				onchange={(e) => setPrefs({ help: e.currentTarget.value as HelpLevel })}
			>
				{#each Object.entries(HELP_LABELS) as [k, label] (k)}
					<option value={k}>{label}</option>
				{/each}
			</select>
		</label>
		<span class="toggle">
			Abstand
			<button
				type="button"
				class="mini"
				aria-label="Enger"
				onclick={() => setPrefs({ zoom: zoomStep(prefs.zoom, -1) })}>−</button
			>
			<button
				type="button"
				class="mini"
				aria-label="Weiter"
				onclick={() => setPrefs({ zoom: zoomStep(prefs.zoom, 1) })}>+</button
			>
		</span>
		<button type="button" class="mini" aria-pressed={fokus} onclick={() => setFokus(!fokus)}
			>Vollbild</button
		>
	{/if}
</section>

{#if fokus}
	<button type="button" class="mini fokusexit" onclick={() => setFokus(false)}
		>Vollbild beenden</button
	>
{/if}

<section class="stage">
	{#if view === 'noten'}
		{#if scoreStatus === 'ok' && scoreXml}
			<ScoreView
				xml={scoreXml}
				partId={voice.part}
				bar={Math.min(title.bars - 1, Math.floor(bar))}
				{fingering}
				onpick={(b) => {
					if (mode === 'echo') session.echoFrom(b);
					jumpTo(b);
					sync();
				}}
			/>
		{:else}
			<p class="notice scoremsg" data-testid="noten-hinweis">
				{scoreStatus === 'loading' || scoreStatus === 'idle'
					? 'Noten werden geladen …'
					: SCORE_NOTICE[scoreStatus]}
				{#if scoreStatus === 'locked'}<a href={resolve('/zugang')}>Code eingeben</a>{/if}
			</p>
		{/if}
	{:else}
		<Lane
			{scene}
			zoom={prefs.zoom}
			height={fokus ? Math.max(240, innerHeight - 190) : undefined}
			onpick={(b) => {
				if (clock.playing) return;
				const toBar = Math.max(0, Math.floor(b / 4));
				if (mode === 'echo') session.echoFrom(toBar);
				jumpTo(toBar);
				sync();
			}}
			onpress={() => {
				if (mode !== 'rhythm' || !clock.playing) return false;
				doTap();
				return true;
			}}
		/>
	{/if}
	<div class="side">
		<GripPanel state={panel} />
		{#if mode === 'rhythm'}
			<div class="tapbox">
				<button
					type="button"
					class="tapbtn"
					class:flash
					onpointerdown={(e) => {
						e.preventDefault();
						doTap();
					}}
					onkeydown={(e) => {
						if (e.code !== 'Space' && e.code !== 'Enter') return;
						e.preventDefault();
						if (!e.repeat) doTap();
					}}>Tippen</button
				>
				<p class="hint">oder auf die Bahn tippen · Leertaste</p>
				<p
					class="say"
					data-tone={feedback?.tone ?? ''}
					aria-live="polite"
					data-testid="tipp-rueckmeldung"
				>
					{feedback?.text ?? 'Tippe bei jedem Ton. Grün heisst: genau im Takt.'}
				</p>
			</div>
		{:else if listening !== 'off'}
			<div class="feedback" data-testid="mithoeren" data-heard={heard ?? ''}>
				<p class="label">Rückmeldung</p>
				<div class="tuner" aria-hidden="true">
					<span class="lo">tief</span><span class="hi">hoch</span>
					<div class="zero"></div>
					{#if deviation !== null}
						<div
							class="needle"
							style:left="{50 + Math.max(-100, Math.min(100, deviation * 100)) / 2}%"
						></div>
					{/if}
				</div>
				<p class="say" data-tone={feedback?.tone ?? ''} aria-live="polite">
					{feedback?.text ?? ''}
				</p>
			</div>
		{/if}
	</div>
</section>

{#if report}
	<section class="result" role="status" data-testid="ergebnis">
		<b>{report.headline}</b>
		{#if report.detail}<span class="detail">{report.detail}</span>{/if}
		{#if report.advice?.kind === 'faster' || report.advice?.kind === 'slower'}
			{@const next = report.advice.tempo}
			<button
				type="button"
				class="mini"
				onclick={() => {
					tempo = next;
					report = null;
				}}
				>{report.advice.kind === 'faster' ? `Tempo auf ${next} %` : `Langsamer: ${next} %`}</button
			>
		{:else if report.advice?.kind === 'done'}
			<span>Originaltempo sitzt.</span>
		{/if}
	</section>
{/if}

<section class="bau" aria-labelledby="bau-titel">
	<p class="label" id="bau-titel">Baustellen</p>
	{#if baustellen.length}
		<ul>
			{#each baustellen as b (b.bar)}
				<li>
					<div>
						<b>Takt {b.bar}–{Math.min(title.bars - 1, b.bar + 1)}</b>
						<span
							>{sectionLabel(title.sections[sectionIndexOf(title.sections, b.bar)])} · {Math.round(
								b.ratio * 100
							)} % der Töne wackeln ({b.tries} Versuche)</span
						>
					</div>
					<button type="button" class="mini" onclick={() => practiceBars(b.bar)}
						>Üben bei {BAUSTELLE_TEMPO} %</button
					>
				</li>
			{/each}
		</ul>
		<button type="button" class="link" onclick={resetBaustellen}>Baustellen zurücksetzen</button>
	{:else}
		<p class="hint">
			Noch keine. Nach Durchgängen mit »Rhythmus tippen« oder Mithören sammelt das Probelokal hier
			die Takte, die noch wackeln.
		</p>
	{/if}
</section>

<section class="transport" aria-label="Wiedergabe">
	<button
		type="button"
		class="play"
		onclick={togglePlay}
		aria-label={playing ? 'Anhalten' : 'Abspielen'}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{#if playing}<path d="M6 4h4v16H6zM14 4h4v16h-4z" />{:else}<path d="M7 4v16l13-8z" />{/if}
		</svg>
	</button>
	<div class="pos">
		<b>Takt {Math.min(title.bars - 1, Math.floor(bar))}</b>
		<span>{sectionLabel(section)}</span>
	</div>
	<label class="toggle">
		<span class="sr">Teil</span>
		<select
			value={customRange ? 'c' : String(sectionIndex)}
			onchange={(e) => {
				if (e.currentTarget.value !== 'c') chooseSection(Number(e.currentTarget.value));
			}}
		>
			{#each title.sections as s, i (i)}
				<option value={String(i)}
					>{sectionLabel(s)} · T. {s.from}{s.to > s.from ? '–' + s.to : ''}</option
				>
			{/each}
			{#if customRange}
				<option value="c">Baustelle · T. {customRange.from}–{customRange.to}</option>
			{/if}
		</select>
	</label>
	<button type="button" class="mini" aria-pressed={loop} onclick={toggleLoop}>Schleife</button>
	<label class="tempo">
		Tempo
		<input type="range" min={TEMPO_MIN} max={TEMPO_MAX} step="5" bind:value={tempo} />
		<output>{tempo} % · ♩ {Math.round((title.bpm * tempo) / 100)}</output>
	</label>
</section>

<!-- Band ohne mich und eigene Stimme; Quelle setzt StemPlayer. crossorigin, weil /audio/ auf
	 Supabase weiterleitet: Ohne CORS liefert MediaElementSource nur Stille. -->
<audio bind:this={bandEl} data-stem="band" crossorigin="anonymous" preload="auto"></audio>
<audio bind:this={ownEl} data-stem="own" crossorigin="anonymous" preload="auto"></audio>

<style>
	.head h1 {
		margin: 2px 0 4px;
		font-size: clamp(22px, 5vw, 30px);
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
		max-width: 62ch;
	}
	.diag {
		font: 500 12px var(--font-mono);
	}
	.scoremsg {
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
	}
	.bau ul {
		list-style: none;
		margin: 6px 0 8px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.bau li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 10px 14px;
	}
	.bau li div {
		display: flex;
		flex-direction: column;
		font-size: 14px;
	}
	.bau li span {
		color: var(--muted);
	}
	.link {
		appearance: none;
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font: 600 13px var(--font-body);
		text-decoration: underline;
		cursor: pointer;
	}
	.fokusexit {
		position: fixed;
		top: max(10px, env(safe-area-inset-top, 0px));
		right: max(12px, env(safe-area-inset-right, 0px));
		z-index: 20;
	}
	/* Vollbild: nur Bahn (mit Griff-Anzeige) und Wiedergabe */
	:global(html.fokus .topbar),
	:global(html.fokus) .head,
	:global(html.fokus) .row,
	:global(html.fokus) .result,
	:global(html.fokus) .bau {
		display: none;
	}
	@media (max-width: 760px) {
		:global(html.fokus) .side {
			display: none;
		}
	}
	.notice {
		margin: 8px 0 0;
		font-size: 14px;
		font-weight: 600;
		max-width: 62ch;
	}
	.notice a {
		color: inherit;
		margin-left: 4px;
	}
	.seg button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		align-items: center;
	}
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.seg button,
	.mini {
		appearance: none;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: 600 14px var(--font-body);
		border-radius: 999px;
		min-height: 40px;
		padding: 6px 14px;
		cursor: pointer;
	}
	.seg button[aria-pressed='true'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
		border-color: var(--chip-on-bg);
	}
	.mini {
		min-height: 36px;
		min-width: 36px;
		padding: 4px 10px;
	}
	.mini[aria-pressed='true'] {
		border-color: var(--rot);
		color: var(--rot);
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
	}
	select {
		font: 600 14px var(--font-body);
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 999px;
		min-height: 40px;
		padding: 0 12px;
		max-width: 100%;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.tapbox {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.tapbox .hint {
		text-align: center;
		font-size: 13px;
	}
	.tapbtn {
		appearance: none;
		width: 100%;
		min-height: 72px;
		border-radius: 14px;
		border: 2px solid var(--ink);
		background: var(--surface);
		color: var(--ink);
		font: 700 20px var(--font-body);
		cursor: pointer;
		touch-action: manipulation;
		user-select: none;
	}
	.tapbtn:active,
	.tapbtn.flash {
		background: var(--blau);
		border-color: var(--blau);
		color: #141619;
	}
	.micbtn {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 2px solid var(--ink);
		background: var(--surface);
		color: var(--ink);
		font: 700 15px var(--font-body);
		border-radius: 999px;
		min-height: 44px;
		padding: 6px 16px;
		cursor: pointer;
	}
	.micbtn svg {
		width: 20px;
		height: 20px;
		fill: currentColor;
	}
	.micbtn[aria-pressed='true'] {
		background: var(--rot);
		border-color: var(--rot);
		color: #fff;
	}
	.micbtn:disabled,
	.mini:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.feedback {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.feedback .label {
		margin: 0;
	}
	.tuner {
		position: relative;
		height: 28px;
		border-radius: 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		font: 500 11px var(--font-mono);
		color: var(--muted);
	}
	.tuner .lo,
	.tuner .hi {
		position: absolute;
		top: 6px;
	}
	.tuner .lo {
		left: 10px;
	}
	.tuner .hi {
		right: 10px;
	}
	.tuner .zero {
		position: absolute;
		left: 50%;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: var(--gruen);
	}
	.tuner .needle {
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 6px;
		margin-left: -3px;
		border-radius: 3px;
		background: var(--blau);
	}
	.say {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		min-height: 1.4em;
	}
	.say[data-tone='ok'] {
		color: var(--gruen);
	}
	.say[data-tone='warn'] {
		color: var(--akzent);
	}
	.say[data-tone='bad'] {
		color: var(--rot);
	}
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 12px 14px;
		font-size: 14px;
	}
	.result .detail {
		color: var(--muted);
	}
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 272px;
		gap: 14px;
	}
	@media (max-width: 760px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.transport {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 10px 12px;
	}
	.play {
		appearance: none;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: 0;
		background: var(--ink);
		color: var(--bg);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.play svg {
		width: 24px;
		height: 24px;
		fill: currentColor;
	}
	.pos {
		display: flex;
		flex-direction: column;
		font-size: 13px;
		color: var(--muted);
		min-width: 70px;
	}
	.pos b {
		color: var(--ink);
		font-size: 15px;
	}
	.tempo {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		flex: 1 1 220px;
	}
	.tempo input {
		flex: 1;
		accent-color: var(--rot);
	}
	.tempo output {
		font: 500 12px var(--font-mono);
		color: var(--muted);
		white-space: nowrap;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
