<script lang="ts">
	// Etappenprüfung eines Teils (?teil=1&etappe=2), portiert aus prototype/v7 (openExam, runQuiz,
	// runGrip, finishExam). Etappe 1 Quiz und 2 Griffe laufen hier; 3–5 auf der Bahn in /ueben.
	// Der Server prüft Reihenfolge und Dauer und vergibt die Punkte (start_exam, finish_exam).
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		finishExam,
		myAccount,
		myStages,
		startExam,
		type ExamResult,
		type MyGuugge
	} from '#lib/account/api.ts';
	import { BAD_TOUCH, BAD_TOUCH_NOTES } from '#lib/titles/bad-touch.ts';
	import { buildTrack } from '#lib/music/track.ts';
	import { fingeringLabel } from '#lib/music/fingering.ts';
	import { sectionLabel } from '#lib/music/timing.ts';
	import {
		encouragement,
		gripCorrect,
		gripItems,
		PRAISE,
		laneExamQuery,
		quizFor,
		type Question
	} from '#lib/exams/exams.ts';
	import { pauseSections, STAGES } from '#lib/plan/stand.ts';

	const sb = getSupabase();
	const title = BAD_TOUCH;
	const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

	let me = $state<MyGuugge | null>(null);
	let missing = $state(false);
	let best = $state(0);
	let loaded = $state(false);
	let phase = $state<'intro' | 'quiz' | 'grip' | 'result'>('intro');
	let attempt = '';
	let step = $state(0);
	let right = $state(0);
	let answers = $state<boolean[]>([]);
	let feedback = $state<{ ok: boolean; text: string } | null>(null);
	let chosen = $state<string | null>(null);
	let valves = $state<number[]>([]);
	let questions = $state<Question[]>([]);
	let result = $state<ExamResult | null>(null);
	let message = $state('');
	let busy = $state(false);
	let error = $state('');

	const id = $derived(page.params.id ?? '');
	const sectionIdx = $derived(Number(page.url.searchParams.get('teil')));
	const stage = $derived(Number(page.url.searchParams.get('etappe')));
	const section = $derived(
		Number.isInteger(sectionIdx) && sectionIdx >= 1 ? title.sections[sectionIdx] : undefined
	);
	const voice = $derived(title.voices.find((v) => v.id === me?.voice) ?? null);
	const kind = $derived(voice?.kind ?? 'valve');
	const notes = $derived(
		voice
			? buildTrack(BAD_TOUCH_NOTES.parts.find((p) => p.id === voice.part)?.notes ?? [], voice.kind)
					.notes
			: []
	);
	const items = $derived(section ? gripItems(notes, section) : []);
	const isPause = $derived(!!section && pauseSections(title.sections, notes).has(sectionIdx));
	const validStage = $derived(Number.isInteger(stage) && stage >= 1 && stage <= 5);
	const total = $derived(phase === 'quiz' ? questions.length : items.length);
	const label = $derived(section ? sectionLabel(section) : '');
	const gripWord = $derived(kind === 'slide' ? 'Zug' : 'Griff');

	onMount(() => watchAuth(sb));

	$effect(() => {
		// neu laden, wenn Teil oder Etappe in der Adresse wechseln (»Weiter zu Etappe …«)
		if (sb && auth.user && id && sectionIdx >= 0 && stage >= 0) void load(sectionIdx);
	});

	async function load(sec: number) {
		if (!sb) return;
		phase = 'intro';
		result = null;
		error = '';
		try {
			const acc = await myAccount(sb);
			me = acc.guuggen.find((g) => g.id === id) ?? null;
			missing = !me;
			if (!me) return;
			const rows = await myStages(sb, id, title.slug);
			best = rows.find((r) => r.voice === me?.voice && r.section === sec)?.stage ?? 0;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loaded = true;
		}
	}

	async function begin() {
		if (!sb || !section || busy) return;
		busy = true;
		error = '';
		try {
			attempt = await startExam(
				sb,
				id,
				title.slug,
				sectionIdx,
				stage,
				stage === 1 ? 'quiz' : 'grip'
			);
			step = 0;
			right = 0;
			answers = [];
			feedback = null;
			chosen = null;
			valves = [];
			if (stage === 1) {
				questions = quizFor(section, notes, kind, Math.random) ?? [];
				phase = 'quiz';
			} else {
				phase = 'grip';
				if (!items.length) await done(1);
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function answer(ok: boolean, correct: string, given: string | null = null) {
		if (feedback) return;
		chosen = given;
		answers = [...answers, ok];
		if (ok) right++;
		feedback = { ok, text: ok ? 'Richtig.' : `Richtig wäre: ${correct}.` };
		setTimeout(() => {
			feedback = null;
			chosen = null;
			valves = [];
			step++;
			if (step >= total) void done(total ? right / total : 1);
		}, 1000);
	}

	function answerQuiz(o: string) {
		const q = questions[step];
		answer(o === q.answer, q.answer, o);
	}

	function answerGrip(given: string) {
		const n = items[step];
		answer(gripCorrect(given, n, kind), fingeringLabel(n.fing, kind));
	}

	function toggleValve(v: number) {
		valves = valves.includes(v) ? valves.filter((x) => x !== v) : [...valves, v].sort();
	}

	async function done(score: number) {
		if (!sb) return;
		busy = true;
		try {
			result = await finishExam(sb, attempt, score);
			message = result.passed
				? result.points > 0
					? pick(PRAISE)
					: 'Wieder bestanden – das sitzt.'
				: encouragement(score, Math.random);
			if (result.passed) best = Math.max(best, stage);
			phase = 'result';
		} catch (e) {
			error = (e as Error).message;
			phase = 'intro';
		} finally {
			busy = false;
		}
	}

	const laneQuery = (via: 'mic' | 'rhythm') =>
		laneExamQuery({ guugge: id, section: sectionIdx, stage: stage as 3 | 4 | 5, via });
	const planHref = $derived(resolve('/guugge/[id]/plan', { id }));
</script>

<svelte:head>
	<title>Etappenprüfung · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<p><a class="back" href={planHref}>← Plan</a></p>

{#if !sb || (auth.ready && !auth.user)}
	<section class="card">
		<h1>Melde dich an.</h1>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	</section>
{:else if missing}
	<section class="card"><h1>Diese Guugge findest du hier nicht.</h1></section>
{:else if !loaded || !me}
	<p class="hint">Einen Moment …</p>
{:else if !section || !validStage}
	<section class="card"><h1>Diese Prüfung gibt es nicht.</h1></section>
{:else if !voice}
	<section class="card">
		<h1>Wähl zuerst deine Stimme.</h1>
		<p><a class="go" href={resolve('/guugge/[id]', { id })}>Zur Stimmwahl →</a></p>
	</section>
{:else if isPause}
	<section class="card">
		<h1>In {label} hast du Pause.</h1>
		<p><a class="go" href={planHref}>Zurück zum Plan →</a></p>
	</section>
{:else}
	<section class="card exam">
		<p class="label">Etappenprüfung · {label} · T. {section.from}–{section.to} · {voice.name}</p>
		<h1>Etappe {stage}: {STAGES[stage - 1].name}</h1>

		{#if phase === 'intro'}
			{#if stage > best + 1}
				<p>Zuerst Etappe {best + 1} für {label}.</p>
				<p>
					<a
						class="go"
						href="{resolve('/guugge/[id]/pruefung', { id })}?teil={sectionIdx}&etappe={best + 1}"
						>Zu Etappe {best + 1} →</a
					>
				</p>
			{:else if stage >= 3}
				<p>
					{stage === 3
						? `Spiel ${label} bei 80 % Tempo.`
						: stage === 4
							? `Jetzt ${label} im Originaltempo.`
							: `${label} auswendig: Die Bahn zeigt nur noch Takte und Einsätze.`}
					80 % sauber = bestanden.
				</p>
				<p>Ich zähle einen Takt ein. Die Prüfung läuft auf der Bahn, unter »Stück üben«.</p>
				{#if stage <= best}
					<p class="hint">Diese Etappe hast du schon. Wiederholen geht, gibt aber keine Punkte.</p>
				{/if}
				<div class="row">
					<a class="btn" href="{resolve('/ueben')}{laneQuery('mic')}">Vorspielen mit Mikrofon</a>
					<a class="btn ghost" href="{resolve('/ueben')}{laneQuery('rhythm')}"
						>Ohne Mikrofon: Rhythmus tippen</a
					>
				</div>
				<p class="hint">
					{stage === 3
						? 'Rhythmus tippen zählt bei dieser Etappe voll.'
						: 'Ohne Mikrofon zählt die Etappe, ist aber als »ohne Mikrofon« markiert und gibt halbe Punkte.'}
					Mikrofon nur mit Kopfhörer.
				</p>
			{:else}
				<p>
					{stage === 1
						? `Vier Fragen zu ${label}. Drei richtig, und die Etappe ist geschafft.`
						: `Ich zeige dir die Töne aus ${label} nacheinander. Du wählst jeweils den ${gripWord}. 80 % richtig = bestanden.`}
				</p>
				{#if stage <= best}
					<p class="hint">Diese Etappe hast du schon. Wiederholen geht, gibt aber keine Punkte.</p>
				{/if}
				<p><button class="btn" type="button" onclick={begin} disabled={busy}>Los</button></p>
			{/if}
		{:else if phase === 'quiz' || phase === 'grip'}
			<div class="prog" aria-hidden="true">
				{#each [...Array(total).keys()] as j (j)}
					<i class:ok={answers[j] === true} class:no={answers[j] === false} class:cur={j === step}
					></i>
				{/each}
			</div>
			{#if phase === 'quiz' && questions[step]}
				{@const q = questions[step]}
				<p class="q">{q.q}</p>
				<div class="opts">
					{#each q.options as o (o)}
						<button
							type="button"
							class="opt"
							class:right={feedback && o === q.answer}
							class:wrong={feedback && o === chosen && o !== q.answer}
							disabled={!!feedback}
							onclick={() => answerQuiz(o)}>{o}</button
						>
					{/each}
				</div>
			{:else if phase === 'grip' && items[step]}
				{@const n = items[step]}
				<p class="hint">Ton {step + 1} von {items.length}</p>
				<p class="big">{n.name}</p>
				<p>{kind === 'slide' ? 'Welcher Zug?' : 'Welche Ventile drückst du?'}</p>
				{#if kind === 'slide'}
					<div class="seg" role="group" aria-label="Zug">
						{#each [1, 2, 3, 4, 5, 6, 7] as p (p)}
							<button type="button" disabled={!!feedback} onclick={() => answerGrip(String(p))}
								>{p}</button
							>
						{/each}
					</div>
				{:else}
					<div class="seg" role="group" aria-label="Ventile">
						{#each [1, 2, 3] as v (v)}
							<button
								type="button"
								aria-pressed={valves.includes(v)}
								disabled={!!feedback}
								onclick={() => toggleValve(v)}>{v}</button
							>
						{/each}
					</div>
					<p>
						<button
							class="btn"
							type="button"
							disabled={!!feedback}
							onclick={() => answerGrip(valves.length ? valves.join('') : '0')}>Prüfen</button
						>
						<span class="hint">Kein Ventil gedrückt = offen</span>
					</p>
				{/if}
			{/if}
			<p class="say" class:ok={feedback?.ok} class:err={feedback && !feedback.ok} role="status">
				{feedback?.text ?? ''}
			</p>
		{:else if phase === 'result' && result}
			<p class="score" class:ok={result.passed} class:no={!result.passed}>
				{Math.round(result.score * 100)} %
			</p>
			<h2>{result.passed ? 'Bestanden' : 'Noch nicht ganz'}</h2>
			<p>{message}</p>
			{#if result.points}
				<p class="hint">+{result.points} Punkte · {result.reasons.join(' · ')}</p>
			{/if}
			{#if result.week_goal}
				<p class="hint">+{result.week_goal} Punkte · Wochenziel: an 3 Tagen geübt</p>
			{/if}
			<div class="row">
				{#if result.passed && stage < 5}
					<a
						class="btn"
						href="{resolve('/guugge/[id]/pruefung', { id })}?teil={sectionIdx}&etappe={stage + 1}"
						>Weiter zu Etappe {stage + 1}</a
					>
				{/if}
				{#if !result.passed}
					<button class="btn" type="button" onclick={() => (phase = 'intro')}>Nochmals</button>
				{/if}
				<a class="btn ghost" href={planHref}>Zurück zum Plan</a>
			</div>
		{/if}
	</section>
{/if}

{#if error}<p class="err" role="alert">{error}</p>{/if}

<style>
	.back {
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
	}
	.exam a.btn {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
	.prog {
		display: flex;
		gap: 4px;
	}
	.prog i {
		flex: 1;
		height: 6px;
		border-radius: 999px;
		background: var(--surface2);
		border: 1px solid var(--line);
	}
	.prog i.cur {
		border-color: var(--blau);
	}
	.prog i.ok {
		background: var(--gruen);
		border-color: var(--gruen);
	}
	.prog i.no {
		background: var(--rot);
		border-color: var(--rot);
	}
	.q {
		font-weight: 700;
		font-size: 18px;
	}
	.opts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}
	.opt {
		appearance: none;
		border: 1px solid var(--line);
		background: var(--surface2);
		color: var(--ink);
		font: 600 16px var(--font-body);
		border-radius: 12px;
		min-height: 48px;
		padding: 6px 12px;
		cursor: pointer;
	}
	.opt.right {
		border-color: var(--gruen);
		color: var(--gruen);
	}
	.opt.wrong {
		border-color: var(--rot);
		color: var(--rot);
	}
	.big {
		font-size: 40px;
		font-weight: 700;
		line-height: 1.1;
	}
	.say {
		min-height: 24px;
		font-weight: 700;
	}
	.say.ok {
		color: var(--gruen);
	}
	.score {
		font-size: 44px;
		font-weight: 700;
		line-height: 1;
	}
	.score.ok {
		color: var(--gruen);
	}
	.score.no {
		color: var(--rot);
	}
</style>
