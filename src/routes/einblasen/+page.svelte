<script lang="ts">
	// Einblasen mit dem giordanomat-Dirigenten (Übungen in #lib/warmup/exercises.ts), portiert aus
	// prototype/v7 (Reiter »Einblasen«). Der Dirigent spielt einen Takt vor, du spielst ihn nach.
	// Mit Mithören wird jeder nachgespielte Ton bewertet (Abnahme M1: Lange Töne ≥ 90 %).
	// Der Schränz-Groove ist ab Level 3 freigeschaltet (höchster Rang über alle Guuggen, auf dem
	// Gerät gemerkt, #lib/game/unlocks.ts); der Bahn-Look aus »Stück üben« gilt auch hier.
	// Punkte: Mit Mithören meldet der Start die Übung beim Server an (start_exercise), das Ende
	// schickt das Ergebnis (finish_exercise); 5 Punkte ab 50 % getroffen, höchstens 6 pro Tag.
	// Noch nicht hier: Tagesvorschlag, Fragen an den Dirigenten (KI).
	import { onDestroy, onMount } from 'svelte';
	import { defaultRoundTrip, loadLatency } from '#lib/audio/latency.ts';
	import { Listener, micErrorText } from '#lib/audio/listen.ts';
	import GripPanel from '#lib/lane/GripPanel.svelte';
	import Lane from '#lib/lane/Lane.svelte';
	import { panelState } from '#lib/lane/panel.ts';
	import { buildTrack, nextNoteIndex, noteIndexAt } from '#lib/music/track.ts';
	import PracticeNav from '#lib/nav/PracticeNav.svelte';
	import type { NoteVerdict } from '#lib/pitch/classify.ts';
	import type { Tone } from '#lib/pitch/coach.ts';
	import type { TrackerMessage } from '#lib/pitch/tracker.ts';
	import { DEFAULT_PREFS, loadPrefs, savePrefs, type LanePrefs } from '#lib/practice/prefs.ts';
	import { PracticeSession, type PassReport } from '#lib/practice/session.ts';
	import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
	import {
		buildExercise,
		COUNT_IN_BEATS,
		EXERCISES,
		LEVEL_LABELS,
		type ExerciseLevel
	} from '#lib/warmup/exercises.ts';
	import { WarmupPlayer } from '#lib/warmup/player.ts';
	import { accountLoader, maybeSignedIn } from '#lib/account/lazy.ts';
	import { hasUnlock, POINTS, DAILY_CAP, unlockLevel } from '#lib/game/points.ts';
	import { summarizePass } from '#lib/practice/pass.ts';
	import { loadBestPoints, refreshBestPoints } from '#lib/game/unlocks.ts';
	import { activeLook } from '#lib/lane/looks.ts';

	// Stimmen wie beim Stück (gleiche Einstellung pro Gerät)
	const voices = BAD_TOUCH.voices;
	const TEMPO_MIN = 50;
	const TEMPO_MAX = 120;

	let prefs = $state<LanePrefs>({ ...DEFAULT_PREFS });
	let exId = $state(EXERCISES[0].id);
	let level = $state<ExerciseLevel>(0);
	// Regler in Fünferschritten ab 50; der Prototyp nahm 72, das rastet ohnehin auf 70 ein
	let bpm = $state(70);
	let clickOn = $state(true);
	let beat = $state(0);
	let playing = $state(false);
	let done = $state(false);
	let judged = $state.raw<ReadonlyMap<number, NoteVerdict>>(new Map());
	let report = $state<PassReport | null>(null);
	let listening = $state(false);
	let listenError = $state('');
	let feedback = $state<{ text: string; tone: Tone } | null>(null);
	let current = $state<number | null>(null);
	let deviation = $state<number | null>(null);
	/** Höchster Rang über alle Guuggen, für Schränz-Groove und Bahn-Look */
	let bestPoints = $state(0);
	let lockNote = $state('');
	/** Angemeldet: dann gibt es mit Mithören Punkte */
	let signedIn = $state(false);
	let exPoints = $state('');
	let attempt: Promise<string | null> | null = null;
	const loadAccountApi = accountLoader();

	let ctx: AudioContext | null = null;
	let player: WarmupPlayer | null = null;
	let listener: Listener | null = null;
	let session = null as PracticeSession | null;
	let lastCoach = 0;

	const voice = $derived(voices.find((v) => v.id === prefs.voice) ?? voices[0]);
	const exercise = $derived(EXERCISES.find((e) => e.id === exId) ?? EXERCISES[0]);
	const built = $derived(buildExercise(exercise, level, voice.kind));
	const track = $derived(buildTrack(built.notes, voice.kind));

	/** Takt vorspielen oder nachspielen, beim Einzählen null */
	const phase = $derived.by(() => {
		if (!playing || beat < COUNT_IN_BEATS) return null;
		const i = noteIndexAt(track.notes, beat);
		const n = track.notes[i >= 0 ? i : nextNoteIndex(track.notes, beat)];
		return n ? (n.call ? 'hear' : 'play') : null;
	});
	const counting = $derived(
		playing && beat >= 0 && beat < COUNT_IN_BEATS ? Math.floor(beat) + 1 : null
	);
	const panel = $derived.by(() => {
		const p = panelState({
			notes: track.notes,
			beat,
			kind: voice.kind,
			help: 'all',
			countIn: counting,
			phaseText: phase === 'hear' ? 'Hör zu' : phase === 'play' ? 'Jetzt du' : null
		});
		if (done)
			return {
				...p,
				kicker: 'Gut gemacht',
				big: 'Fertig',
				sub: 'Nochmals, oder die nächste Übung?'
			};
		if (!playing && beat === 0) return { ...p, sub: 'Start drücken. Der Dirigent zählt ein.' };
		return p;
	});
	const scene = $derived({
		track,
		beat,
		kind: voice.kind,
		help: 'all' as const,
		names: prefs.names,
		staff: prefs.staff,
		look: activeLook(prefs.look, bestPoints),
		sections: [],
		countIn: counting,
		judged,
		trace: listening && session ? session.trace : null,
		current: listening ? current : null,
		overlay:
			phase === 'hear'
				? { text: 'HÖR ZU', tone: 'blau' as const }
				: phase === 'play'
					? { text: 'JETZT DU', tone: 'gelb' as const }
					: null
	});

	/** Verzögerung beim Mithören: gemessen (unter »Stück üben«) oder wie im Prototyp geschätzt */
	const roundTrip = () => loadLatency(localStorage) ?? defaultRoundTrip(0.02);

	function audio(): AudioContext | null {
		if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext();
		if (ctx?.state === 'suspended') void ctx.resume();
		return ctx;
	}

	/** Neuer Durchgang: Bewertung leeren, Player auf Anfang */
	function reset() {
		player?.seek(0);
		beat = 0;
		playing = false;
		done = false;
		report = null;
		attempt = null;
		exPoints = '';
		session = new PracticeSession(track.notes, 60 / bpm, { from: 0, to: built.total / 4 - 1 });
		session.setListening(listening ? 'mic' : 'off');
		judged = new Map();
	}

	const locked = (e: (typeof EXERCISES)[number]) => !!e.unlock && !hasUnlock(bestPoints, e.unlock);

	function choose(patch: { ex?: string; lvl?: ExerciseLevel; voice?: string }) {
		lockNote = '';
		const e = EXERCISES.find((x) => x.id === patch.ex);
		if (e?.unlock && locked(e)) {
			const l = unlockLevel(e.unlock);
			lockNote = `${e.name} wird mit Level ${l.n} (${l.name}) freigeschaltet. Punkte sammelst du in deiner Guugge, z. B. mit Etappen und beim Einblasen mit Mithören.`;
			return;
		}
		if (patch.ex) exId = patch.ex;
		if (patch.lvl !== undefined) level = patch.lvl;
		if (patch.voice) {
			prefs = { ...prefs, voice: patch.voice };
			savePrefs(localStorage, prefs);
			listener?.setInstrument(voice.instrument);
		}
		reset();
	}

	function togglePlay() {
		const c = audio();
		if (!c) return;
		player ??= new WarmupPlayer(c);
		if (player.playing) {
			player.stop();
			playing = false;
			return;
		}
		if (done || !session) reset();
		player.notes = built.notes;
		player.total = built.total;
		player.bpm = bpm;
		player.click = clickOn;
		player.shift = voice.shift;
		player.start();
		playing = true;
		done = false;
		if (!attempt && listening && signedIn) beginAttempt();
	}

	/** Übung beim Server anmelden; Punkte sind eine Zugabe, Fehler bleiben still. */
	function beginAttempt() {
		const [ex, lvl, tempo] = [exId, level, bpm];
		attempt = loadAccountApi()
			.then((a) => (a ? a.api.startExercise(a.sb, ex, lvl, tempo) : null))
			.catch(() => null);
	}

	async function finishAttempt(r: PassReport) {
		const pending = attempt;
		const run = session;
		attempt = null;
		const summary = summarizePass(r.judged.map(([, v]) => v));
		const id = await pending;
		const a = await loadAccountApi().catch(() => null);
		if (!id || !a || !summary) return;
		try {
			const res = await a.api.finishExercise(a.sb, id, summary.pct, summary.total);
			// Schon die nächste Übung gestartet: die Antwort gehört nicht mehr dazu
			if (session !== run) return;
			exPoints = res.points
				? `+${res.points} Punkte${res.week_goal ? ` · +${res.week_goal} Wochenziel` : ''}`
				: res.capped
					? 'Heute gibt es fürs Einblasen keine Punkte mehr.'
					: summary.pct < 50
						? 'Punkte gibt es ab 50 % getroffen.'
						: '';
		} catch {
			exPoints = '';
		}
	}

	function finish() {
		player?.stop();
		playing = false;
		done = true;
		beat = built.total;
		if (session && listening) {
			session.closeHeard(built.total);
			judged = new Map(session.judged);
			report = session.finish(true, 100);
			if (attempt && report) void finishAttempt(report);
		}
	}

	$effect(() => {
		if (!playing) return;
		let raf = requestAnimationFrame(function frame() {
			beat = player?.beat() ?? 0;
			if (beat >= built.total) {
				finish();
				return;
			}
			raf = requestAnimationFrame(frame);
		});
		return () => cancelAnimationFrame(raf);
	});

	async function toggleListening() {
		if (listening) {
			stopListening();
			return;
		}
		listenError = '';
		const c = audio();
		if (!c) {
			listenError = micErrorText({ name: 'NoMedia' });
			return;
		}
		try {
			listener = await Listener.start(c, 'mic', { instrument: voice.instrument });
		} catch (e) {
			listenError = micErrorText(e);
			return;
		}
		listener.onmessage = onTracker;
		listening = true;
		session?.setListening('mic');
		feedback = { text: 'Ich höre zu. Start drücken, zuhören, nachspielen.', tone: '' };
	}

	function stopListening() {
		listener?.stop();
		listener = null;
		listening = false;
		session?.setListening('off');
		current = null;
		deviation = null;
		judged = new Map();
	}

	function onTracker(m: TrackerMessage) {
		if (m.type !== 'pitch' || !ctx || !session || !player?.playing) return;
		const written = m.midi === null ? null : m.midi - voice.shift;
		const age = Math.max(0, ctx.currentTime - m.t);
		const f = { beat: player.beat(), latency: 0, rate: 1, target: null };
		if (session.hear(written, f, age + roundTrip())) judged = new Map(session.judged);
		current = session.current;
		deviation = session.lastDeviation;
		const now = performance.now();
		if (now - lastCoach >= 350) {
			lastCoach = now;
			// Beim Vorspielen hört das Mikrofon den Dirigenten mit; dann nur »Hör zu«.
			const msg =
				phase === 'hear'
					? { text: 'Hör zu – gleich bist du dran.', tone: '' as Tone }
					: session.coach(voice.kind, true, 1);
			if (msg) feedback = msg;
		}
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && /INPUT|SELECT|TEXTAREA|BUTTON/.test(t.tagName)) return;
		if (e.code === 'Space') {
			e.preventDefault();
			if (!e.repeat) togglePlay();
		}
	}

	onMount(() => {
		prefs = loadPrefs(
			localStorage,
			voices.map((v) => v.id)
		);
		bestPoints = loadBestPoints(localStorage);
		reset();
		if (maybeSignedIn())
			void loadAccountApi()
				.then((a) => {
					signedIn = !!a;
					return a ? refreshBestPoints(a, localStorage) : bestPoints;
				})
				.then((p) => (bestPoints = p))
				.catch(() => {});
	});

	onDestroy(() => {
		player?.stop();
		listener?.stop();
		void ctx?.close();
	});
</script>

<svelte:head>
	<title>Einblasen · giordanomat PROBELOKAL</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<PracticeNav />

<section class="head">
	<p class="label">Einblasen</p>
	<h1>Mit dem giordanomat-Dirigenten</h1>
	<p class="hint">
		Der Dirigent spielt einen Takt vor (gestrichelt), du spielst ihn nach. Mit »Mithören« sagt er
		dir, ob jeder Ton sitzt.
	</p>
</section>

<section class="row">
	<div class="seg" role="group" aria-label="Stimme">
		{#each voices as v (v.id)}
			<button type="button" aria-pressed={v.id === voice.id} onclick={() => choose({ voice: v.id })}
				>{v.short}</button
			>
		{/each}
	</div>
</section>

<section class="row">
	<div class="seg" role="group" aria-label="Übung">
		{#each EXERCISES as e (e.id)}
			<button
				type="button"
				aria-pressed={e.id === exId}
				class:locked={locked(e)}
				onclick={() => choose({ ex: e.id })}
				>{e.name}{#if e.unlock && locked(e)}<span class="lock"
						>ab Level {unlockLevel(e.unlock).n}</span
					>{/if}</button
			>
		{/each}
	</div>
	<div class="seg" role="group" aria-label="Stufe">
		{#each LEVEL_LABELS as label, i (label)}
			<button
				type="button"
				aria-pressed={i === level}
				onclick={() => choose({ lvl: i as ExerciseLevel })}>{label}</button
			>
		{/each}
	</div>
</section>

{#if lockNote}<p class="hint" role="status">{lockNote}</p>{/if}

<section class="row listen">
	<button type="button" class="micbtn" aria-pressed={listening} onclick={toggleListening}>
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><path
				d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12z"
			/></svg
		>
		Mithören
	</button>
	{#if listenError}
		<span class="say" data-tone="bad" role="alert">{listenError}</span>
	{:else}
		<span class="hint"
			>Mit Kopfhörer, sonst hört das Mikrofon den Dirigenten mit. Die Verzögerung gleichst du unter
			»Stück üben« ab.{signedIn
				? ` Mit Mithören gibt es ${POINTS.exercise} Punkte pro Übung ab 50 % getroffen, höchstens ${DAILY_CAP.exercise} Übungen pro Tag.`
				: ''}</span
		>
	{/if}
</section>

<section class="stage">
	<Lane {scene} zoom={prefs.zoom} />
	<div class="side">
		<GripPanel state={panel} />
		{#if listening}
			<div class="feedback" data-testid="mithoeren">
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
		<b>{report.headline.replace(/^Durchgang \d+: /, 'Geschafft: ')}</b>
		{#if report.detail}<span class="detail">{report.detail}</span>{/if}
		{#if exPoints}<span class="detail" data-testid="einblasen-punkte">{exPoints}</span>{/if}
	</section>
{/if}

<section class="tip">
	<h2>{exercise.name}</h2>
	<p>{exercise.intro}</p>
	<ul>
		{#each exercise.tips as t (t)}
			<li>{t}</li>
		{/each}
	</ul>
</section>

<section class="transport" aria-label="Wiedergabe">
	<button
		type="button"
		class="play"
		onclick={togglePlay}
		aria-label={playing ? 'Übung anhalten' : 'Übung starten'}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{#if playing}<path d="M6 4h4v16H6zM14 4h4v16h-4z" />{:else}<path d="M7 4v16l13-8z" />{/if}
		</svg>
	</button>
	<label class="tempo">
		Tempo
		<input
			type="range"
			min={TEMPO_MIN}
			max={TEMPO_MAX}
			step="5"
			bind:value={bpm}
			disabled={playing}
			onchange={reset}
		/>
		<output>♩ {bpm}</output>
	</label>
	<label class="toggle"
		><input type="checkbox" bind:checked={clickOn} disabled={playing} /> Klick</label
	>
</section>

<style>
	.locked {
		opacity: 0.7;
	}
	.lock {
		margin-left: 6px;
		font: 500 11px var(--font-mono);
		color: var(--muted);
	}
	.head h1 {
		margin: 2px 0 4px;
		font-size: clamp(22px, 5vw, 30px);
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.tip {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 14px 16px;
		font-size: 14px;
	}
	.tip h2 {
		margin: 0 0 4px;
		font-size: 17px;
	}
	.tip p {
		margin: 0 0 6px;
	}
	.tip ul {
		margin: 0;
		padding-left: 18px;
		color: var(--muted);
	}
</style>
