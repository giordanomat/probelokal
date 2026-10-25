<script lang="ts">
	// Stück üben, Stand M1: Bahn und Griff-Anzeige für Bad Touch. Noch ohne Ton – die Bahn läuft
	// mit einer eigenen Uhr, bis die Mischungen im Storage liegen (docs/05-roadmap.md, M1).
	import { onMount } from 'svelte';
	import GripPanel from '#lib/lane/GripPanel.svelte';
	import Lane from '#lib/lane/Lane.svelte';
	import { HELP_LABELS, zoomStep, type HelpLevel } from '#lib/lane/geometry.ts';
	import { panelState } from '#lib/lane/panel.ts';
	import {
		beatAtTime,
		countIn,
		sectionIndexOf,
		sectionLabel,
		timeForBar
	} from '#lib/music/timing.ts';
	import { buildTrack } from '#lib/music/track.ts';
	import { FreeClock } from '#lib/practice/clock.ts';
	import { TEMPO_MAX, TEMPO_MIN } from '#lib/practice/pass.ts';
	import { DEFAULT_PREFS, loadPrefs, savePrefs, type LanePrefs } from '#lib/practice/prefs.ts';
	import { BAD_TOUCH, BAD_TOUCH_NOTES } from '#lib/titles/bad-touch.ts';

	const title = BAD_TOUCH;
	const voiceIds = title.voices.map((v) => v.id);
	const clock = new FreeClock();

	let prefs = $state<LanePrefs>({ ...DEFAULT_PREFS });
	let time = $state(0);
	let playing = $state(false);
	let tempo = $state(100);
	let loop = $state(false);
	let sectionIndex = $state(1);
	/** Sprungziel mit einem Takt Anlauf (Einzählen), sonst null */
	let target = $state<number | null>(null);

	const voice = $derived(title.voices.find((v) => v.id === prefs.voice) ?? title.voices[0]);
	const track = $derived.by(() => {
		const part = BAD_TOUCH_NOTES.parts.find((p) => p.id === voice.part);
		return buildTrack(part?.notes ?? [], voice.kind);
	});
	const beat = $derived(beatAtTime(title, time));
	const bar = $derived(Math.max(0, beat / 4));
	const section = $derived(title.sections[sectionIndex]);
	const counting = $derived(countIn(beat, target));
	const panel = $derived(
		panelState({ notes: track.notes, beat, kind: voice.kind, help: prefs.help, countIn: counting })
	);
	const scene = $derived({
		track,
		beat,
		kind: voice.kind,
		help: prefs.help,
		names: prefs.names,
		staff: prefs.staff,
		sections: title.sections,
		countIn: counting
	});

	function jumpTo(toBar: number, preroll = true) {
		const b = Math.max(0, Math.min(title.bars - 0.01, toBar));
		target = preroll && b >= 1 ? b : null;
		clock.seek(timeForBar(title, target !== null ? b - 1 : b));
		time = clock.time();
	}

	function chooseSection(i: number) {
		sectionIndex = i;
		jumpTo(title.sections[i].from);
	}

	function togglePlay() {
		if (clock.playing) {
			clock.pause();
		} else {
			if (bar >= title.bars - 0.01) jumpTo(section.from);
			clock.play();
		}
		playing = clock.playing;
	}

	function tick() {
		time = clock.time();
		const b = beat / 4;
		if (loop && b >= section.to + 1) {
			jumpTo(section.from);
		} else if (b >= title.bars) {
			clock.pause();
			playing = false;
		}
		if (target !== null && !loop && b > target + 0.5) target = null;
		if (!loop) {
			const i = sectionIndexOf(title.sections, target ?? b);
			if (i !== sectionIndex) sectionIndex = i;
		}
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
			togglePlay();
		}
	}

	onMount(() => {
		prefs = loadPrefs(localStorage, voiceIds);
		jumpTo(title.sections[1].from);
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
		Fassung {title.version} · ♩ {title.bpm}. Noch ohne Ton: Band und eigene Stimme kommen, sobald
		die Aufnahmen bereit sind. Die Bahn läuft schon im gewählten Tempo.
	</p>
</section>

<section class="row">
	<div class="seg" role="group" aria-label="Stimme">
		{#each title.voices as v (v.id)}
			<button
				type="button"
				aria-pressed={v.id === voice.id}
				onclick={() => setPrefs({ voice: v.id })}>{v.short}</button
			>
		{/each}
	</div>
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
			if (!clock.playing) jumpTo(Math.floor(b / 4));
		}}
	/>
	<GripPanel state={panel} />
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
		<select value={sectionIndex} onchange={(e) => chooseSection(Number(e.currentTarget.value))}>
			{#each title.sections as s, i (i)}
				<option value={i}>{sectionLabel(s)} · T. {s.from}{s.to > s.from ? '–' + s.to : ''}</option>
			{/each}
		</select>
	</label>
	<button type="button" class="mini" aria-pressed={loop} onclick={() => (loop = !loop)}
		>Schleife</button
	>
	<label class="tempo">
		Tempo
		<input type="range" min={TEMPO_MIN} max={TEMPO_MAX} step="5" bind:value={tempo} />
		<output>{tempo} % · ♩ {Math.round((title.bpm * tempo) / 100)}</output>
	</label>
</section>

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
