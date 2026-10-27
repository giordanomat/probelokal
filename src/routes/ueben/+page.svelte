<script lang="ts">
	// Stück üben, Stand M1: Bahn und Griff-Anzeige für Bad Touch mit Ton (Band ohne mich und eigene
	// Stimme, docs/02-architektur.md »Audio«). Die Band ist die Uhr der Bahn. Ohne Testzugang oder
	// ohne Aufnahmen läuft die Bahn mit einer eigenen Uhr weiter, und ein Hinweis sagt warum.
	// Modi Mitspielen, Echo und Rhythmus tippen: Ablauf in #lib/practice/session.ts.
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { AUDIO_NOTICE, probeAudio, stemUrls, type AudioStatus } from '#lib/audio/access.ts';
	import { StemPlayer } from '#lib/audio/stems.ts';
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
		baustellenKey,
		loadBarStats,
		recordPass,
		saveBarStats
	} from '#lib/practice/baustellen.ts';
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
		overlay:
			mode === 'echo'
				? echoPhase === 'hear'
					? { text: 'HÖR ZU', tone: 'blau' as const }
					: { text: 'JETZT DU', tone: 'gelb' as const }
				: null
	});

	const rangeOf = (i: number) => ({ from: title.sections[i].from, to: title.sections[i].to });
	const session = new PracticeSession([], secondsPerBeat(title), rangeOf(1));

	/** Anzeige und Lautstärke der eigenen Stimme nach jeder Änderung am Übe-Ablauf nachziehen. */
	function sync() {
		mode = session.mode;
		echoPhase = session.echo.phase;
		judged = new Map(session.judged);
		if (stems) stems.ownGain = session.ownVolume(prefs.own);
	}

	function frameInfo(): FrameInfo {
		// Ohne Ton gibt es keine Ausgabe-Latenz: getippt wird nach der Bahn.
		return { beat, latency: stems?.latency() ?? 0, rate: tempo / 100, target };
	}

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
		session.setRange(rangeOf(i));
		jumpTo(title.sections[i].from);
		sync();
	}

	function chooseMode(m: PracticeMode) {
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
		session.resetPass();
		sync();
	}

	function showReport(r: PassReport) {
		report = r;
		if (!r.final || !r.judged.length) return;
		// Baustellen pro Titel und Stimme, nur auf dem Gerät (Liste kommt mit M1 Punkt 5)
		const key = baustellenKey(title.slug, voice.id);
		saveBarStats(
			localStorage,
			key,
			recordPass(loadBarStats(localStorage, key), r.judged, track.notes)
		);
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

	async function startAudio() {
		const status = await probeAudio(stemUrls(title, voice.id).band);
		if (status !== 'ok') {
			audio = status;
			return;
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
		player.load(stemUrls(title, voice.id), clock.time());
		useClock(player);
		stems = player;
		audio = 'ok';
	}

	function chooseVoice(id: string) {
		setPrefs({ voice: id });
		session.setNotes(track.notes);
		stems?.load(stemUrls(title, id));
		sync();
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
		session.setNotes(track.notes);
		jumpTo(title.sections[1].from);
		void startAudio();
	});

	onDestroy(() => {
		stems?.destroy();
	});
</script>

<svelte:head>
	<title>{title.name} üben · giordanomat PROBELOKAL</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<section class="head">
	<p class="label">Stück üben</p>
	<h1>{title.name}</h1>
	<p class="hint">
		Fassung {title.version} · ♩ {title.bpm}. Du hörst die Band ohne deine Stimme. Deine Stimme
		kannst du laut, leise oder gar nicht dazunehmen.
	</p>
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

<section class="row opts">
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
</section>

<section class="stage">
	<Lane
		{scene}
		zoom={prefs.zoom}
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
		<select value={sectionIndex} onchange={(e) => chooseSection(Number(e.currentTarget.value))}>
			{#each title.sections as s, i (i)}
				<option value={i}>{sectionLabel(s)} · T. {s.from}{s.to > s.from ? '–' + s.to : ''}</option>
			{/each}
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
