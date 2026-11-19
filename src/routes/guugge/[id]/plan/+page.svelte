<script lang="ts">
	// Plan für Bad Touch: »Mein Plan« (Stand der eigenen Stimme gegen den Plan) und »Gesamtplan«
	// (Zeitstrahl, diese Woche, für die Leitung »So steht die Guugge« und »Plan ändern«; Entwurf
	// Matthias 17.11.2026). Logik in src/lib/plan/.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { REGISTER_LABELS } from '#lib/music/registers.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		getPlan,
		leitungOverview,
		myAccount,
		myPoints,
		myStages,
		setPlan,
		type MyGuugge,
		type MyPoints,
		type RegisterRow,
		type StageRow,
		type StoredPlan
	} from '#lib/account/api.ts';
	import { BAD_TOUCH, BAD_TOUCH_NOTES } from '#lib/titles/bad-touch.ts';
	import {
		addDays,
		longDate,
		mondayOf,
		shortDate,
		todayInZurich,
		weekdayOf,
		WEEKDAYS,
		type Day
	} from '#lib/plan/dates.ts';
	import {
		buildPlan,
		dueOf,
		dueTable,
		expectedStage,
		phaseSpans,
		registerCell,
		sectionWeights,
		timelineAt,
		type Phase
	} from '#lib/plan/plan.ts';
	import { levelOf, levelShare, nextLevel } from '#lib/game/points.ts';
	import Mark from '#lib/brand/Mark.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { voiceQuery } from '#lib/practice/prefs.ts';
	import {
		countdown,
		nextExams,
		pauseSections,
		planStatus,
		playedSections,
		STAGES,
		statusText,
		todayFocus,
		type Stages
	} from '#lib/plan/stand.ts';

	const sb = getSupabase();
	const title = BAD_TOUCH;
	const weights = sectionWeights(
		title.sections,
		BAD_TOUCH_NOTES.parts.map((p) => p.notes)
	);
	const today = todayInZurich();

	let me = $state<MyGuugge | null>(null);
	let missing = $state(false);
	let stored = $state<StoredPlan | null>(null);
	let rows = $state<StageRow[]>([]);
	let points = $state<MyPoints | null>(null);
	/** Übersicht der Leitung: nur Register-Durchschnitte, erst ab drei Personen pro Register */
	let overview = $state<RegisterRow[] | null>(null);
	let view = $state<'mine' | 'all'>('mine');
	/** Blätter im Gesamtplan: alle Wochen (offen bei dieser Woche), Plan ändern */
	let weeksOpen = $state(false);
	let weeksFrom = $state(0);
	let editOpen = $state(false);
	let busy = $state(false);
	let error = $state('');
	/** Fehler beim Speichern, im Formular selbst (auch im Blatt sichtbar) */
	let formError = $state('');
	let notice = $state('');

	// Formular der Leitung
	let fStart = $state(today);
	let fPerf = $state(addDays(today, 105));
	let fGp = $state(3);
	let fRp = $state<number | null>(null);
	let fMin = $state(60);

	const id = $derived(page.params.id ?? '');
	const leitung = $derived(me?.role === 'leitung');
	const plan = $derived(
		stored
			? buildPlan(
					{
						start: stored.start,
						perf: stored.perf,
						gpWeekday: stored.gp_weekday,
						rpWeekday: stored.rp_weekday,
						minutesPerWeek: stored.minutes_per_week
					},
					title.sections,
					weights
				)
			: null
	);
	const voice = $derived(title.voices.find((v) => v.id === me?.voice) ?? null);
	const notes = $derived(
		voice ? (BAD_TOUCH_NOTES.parts.find((p) => p.id === voice.part)?.notes ?? []) : []
	);
	const pauses = $derived(pauseSections(title.sections, notes));
	const played = $derived(playedSections(title.sections, notes));
	const stages = $derived<Stages>(
		Object.fromEntries(rows.filter((r) => r.voice === voice?.id).map((r) => [r.section, r.stage]))
	);
	const rhythmOnly = $derived(
		new Map(rows.filter((r) => r.voice === voice?.id).map((r) => [r.section, r.rhythm_only]))
	);
	const status = $derived(planStatus(played, stages, plan, today));
	const next = $derived(nextExams(played, stages, plan));
	const monday = mondayOf(today);
	/** »Heute dran« (Entwurf Matthias 08.11.2026): eine Etappe, sonst »im Plan« oder »geschafft« */
	const focus = $derived(todayFocus(next, status, !!plan, today, addDays(monday, 6)));
	/** Countdown zum Auftritt; der Ring zeigt die verstrichene Planzeit, keinen Prozent-Stand */
	const cd = $derived(stored ? countdown(stored.start, stored.perf, today) : { days: 0, share: 0 });
	/** Teil, dessen Etappen im Blatt offen sind */
	let openSection = $state<number | null>(null);
	const sectionState = (i: number) =>
		pauses.has(i) ? 'Pause für dich' : stages[i] ? STAGES[stages[i] - 1].name : 'noch offen';
	// Gesamtplan: Zeitstrahl und die Woche, die ausführlich gezeigt wird
	const tl = $derived(plan ? timelineAt(plan, today) : null);
	const spans = $derived(plan ? phaseSpans(plan) : []);
	/** Vor dem Start die erste, nach dem Ende die letzte Woche */
	const shownWeek = $derived(
		plan && tl ? Math.max(0, Math.min(tl.week, plan.weeks.length - 1)) : 0
	);
	const PHASE_CLASS: Record<Phase, string> = {
		Lernen: 'ph-l',
		Tempo: 'ph-t',
		Auswendig: 'ph-a',
		Feinschliff: 'ph-f'
	};
	/** Farbe der Meilensteine in der Reihenfolge der Phasen */
	const MILESTONE_CLASS = ['ph-l', 'ph-t', 'ph-a', 'ph-f'];
	const weekdayShort = (d: Day) => WEEKDAYS[weekdayOf(d)].slice(0, 2);
	const dayNo = (d: Day) => `${Number(d.slice(8))}.`;
	/** Tage im Formular, Montag zuerst (Index wie WEEKDAYS, 0 = Sonntag) */
	const FORM_DAYS = [1, 2, 3, 4, 5, 6, 0];
	const minuteChoices = $derived([...new Set([30, 60, 90, 120, fMin])].sort((a, b) => a - b));

	const sectionName = (i: number) => title.sections[i].name;
	/** Teile ohne Vorzähler */
	const sectionNos = [...title.sections.keys()].slice(1);

	onMount(() => watchAuth(sb));

	$effect(() => {
		if (sb && auth.user && id) void load();
	});

	async function load() {
		if (!sb) return;
		try {
			const acc = await myAccount(sb);
			me = acc.guuggen.find((g) => g.id === id) ?? null;
			missing = !me;
			if (!me) return;
			[stored, rows, points] = await Promise.all([
				getPlan(sb, id, title.slug),
				myStages(sb, id, title.slug),
				myPoints(sb, id)
			]);
			overview = me.role === 'leitung' ? await leitungOverview(sb, id, title.slug) : null;
			if (stored) {
				fStart = stored.start;
				fPerf = stored.perf;
				fGp = stored.gp_weekday;
				fRp = stored.rp_weekday;
				fMin = stored.minutes_per_week;
			}
		} catch (e) {
			error = (e as Error).message;
		}
	}

	/** Blatt »Alle Wochen« öffnen und zur gewünschten Woche rollen */
	function openWeeks(i: number) {
		weeksFrom = i;
		weeksOpen = true;
	}
	function scrollToWeek(el: HTMLElement) {
		// erst nach showModal() im Blatt, sonst rollt nichts
		if (Number(el.dataset.week) === weeksFrom && weeksFrom > 0)
			requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
	}

	/** Blatt »Plan ändern« immer mit dem gespeicherten Stand öffnen */
	function openEdit() {
		if (stored) {
			fStart = stored.start;
			fPerf = stored.perf;
			fGp = stored.gp_weekday;
			fRp = stored.rp_weekday;
			fMin = stored.minutes_per_week;
		}
		formError = '';
		notice = '';
		editOpen = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!sb || busy) return;
		busy = true;
		formError = '';
		notice = '';
		try {
			const params = {
				start: fStart,
				perf: fPerf,
				gpWeekday: Number(fGp),
				rpWeekday: fRp === null ? null : Number(fRp),
				minutesPerWeek: Number(fMin)
			};
			// Fälligkeiten für den Bonus »rechtzeitig« (der Server prüft die Daten selbst)
			const due =
				fPerf > fStart
					? dueTable(buildPlan(params, title.sections, weights), title.sections.length)
					: {};
			await setPlan(
				sb,
				id,
				title.slug,
				{
					start: params.start,
					perf: params.perf,
					gp_weekday: params.gpWeekday,
					rp_weekday: params.rpWeekday,
					minutes_per_week: params.minutesPerWeek
				},
				due
			);
			await load();
			editOpen = false;
			notice = 'Gespeichert. Alle in der Guugge sehen den Plan.';
		} catch (err) {
			formError = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Plan · {title.name} · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="planpage">
	<header class="top">
		<Mark class="mark" />
		<a class="back" href={resolve('/guugge/[id]', { id })}>‹ {me?.name ?? 'Guugge'}</a>
		<h1>{title.name}</h1>
		{#if voice}
			<a
				class="chip"
				href={resolve('/guugge/[id]', { id })}
				aria-label="Stimme: {voice.short}, in der Guugge ändern">{voice.short}</a
			>
		{/if}
	</header>

	{#if !sb || (auth.ready && !auth.user)}
		<section class="card">
			<h2>Melde dich an.</h2>
			<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
		</section>
	{:else if missing}
		<section class="card">
			<h2>Diese Guugge findest du hier nicht.</h2>
		</section>
	{:else if !me}
		<p class="hint">Einen Moment …</p>
	{:else}
		<div class="tabs" role="group" aria-label="Ansicht">
			<button type="button" aria-pressed={view === 'mine'} onclick={() => (view = 'mine')}
				>Mein Plan</button
			>
			<button type="button" aria-pressed={view === 'all'} onclick={() => (view = 'all')}
				>Gesamtplan</button
			>
		</div>

		{#if notice}<p class="ok" role="status">{notice}</p>{/if}
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		{#if view === 'mine'}
			{#if !voice}
				<section class="card">
					<h2>Wähl zuerst deine Stimme.</h2>
					<p><a class="go" href={resolve('/guugge/[id]', { id })}>Zur Stimmwahl →</a></p>
				</section>
			{:else}
				<!-- Heute dran: eine Sache, ein grosser Knopf (Entwurf Matthias 08.11.2026) -->
				<section class="card today" class:calm={focus.kind !== 'exam'} data-testid="heute">
					<p class="label">Heute dran</p>
					{#if focus.kind === 'exam'}
						{@const x = focus.exam}
						<h2>Teil {sectionName(x.section)} · Etappe {x.stage}: {STAGES[x.stage - 1].name}</h2>
						{#if x.due}
							<p class="why" class:late={focus.late}>
								{focus.late
									? `überfällig seit ${shortDate(x.due)}`
									: `fällig bis ${shortDate(x.due)}`}
							</p>
						{/if}
						<div class="btns">
							<a
								class="btn ghost"
								href="{resolve('/ueben')}{voiceQuery(me.voice, title.sections[x.section].from)}"
								>Erst üben</a
							>
							<a
								class="btn"
								href="{resolve('/guugge/[id]/pruefung', {
									id
								})}?teil={x.section}&etappe={x.stage}"
								aria-label="Prüfung starten: Teil {sectionName(x.section)}, Etappe {x.stage}"
								>Prüfung starten</a
							>
						</div>
						{#if focus.then.length}
							<p class="then">
								Danach: <b
									>{focus.then
										.map((t) => `Teil ${sectionName(t.section)} · Etappe ${t.stage}`)
										.join('  ·  ')}</b
								>
							</p>
						{/if}
					{:else}
						<h2>{focus.kind === 'done' ? 'Alles geschafft' : 'Alles im Plan'}</h2>
						<p class="sub">
							{#if focus.kind === 'done'}
								Auftrittsreif – jetzt nur noch Spass.
							{:else}
								Nächste Etappe ab {shortDate(focus.next.due ?? today)}: Teil {sectionName(
									focus.next.section
								)} · Etappe {focus.next.stage}
							{/if}
						</p>
						<div class="btns">
							<a class="btn ghost" href={resolve('/aufwaermen')}>Aufwärmen</a>
							<a class="btn green" href="{resolve('/ueben')}{voiceQuery(me.voice)}"
								>Einmal durchs Stück</a
							>
						</div>
						{#if focus.kind === 'ahead'}
							<p class="then">
								<a
									class="go"
									href="{resolve('/guugge/[id]/pruefung', {
										id
									})}?teil={focus.next.section}&etappe={focus.next.stage}"
									>Schon jetzt prüfen: Teil {sectionName(focus.next.section)} · Etappe {focus.next
										.stage} →</a
								>
							</p>
						{/if}
					{/if}
				</section>

				<!-- Countdown zum Auftritt: Ring füllt sich mit der Zeit, kein Prozent-Stand -->
				<section class="card count">
					{#if plan && stored}
						<div class="ring" style:--share={cd.share} aria-hidden="true">
							<div><b>{shortDate(stored.perf)}</b><small>Auftritt</small></div>
						</div>
					{/if}
					<div>
						{#if plan && stored}
							<h2 class="days">{cd.days === 1 ? '1 Tag' : `${cd.days} Tage`}</h2>
							<p class="sub">bis zum Auftritt am {longDate(stored.perf)}</p>
						{:else}
							<h2 class="days">Noch kein Gesamtplan</h2>
							<p class="sub">Den legt die Leitung an. Üben kannst du trotzdem.</p>
						{/if}
						<p
							class="status"
							class:ahead={plan && status.diff > 0}
							class:behind={plan && status.diff < 0}
						>
							{statusText(status, !!plan)}{plan ? ` · ${status.sum} von ${status.max} Etappen` : ''}
						</p>
					</div>
				</section>

				{#if points}
					{@const lv = levelOf(points.points)}
					{@const nx = nextLevel(points.points)}
					{@const days = Math.min(3, points.days_this_week)}
					<div class="pair">
						<section class="card">
							<p class="label">Diese Woche</p>
							<div class="dots" aria-hidden="true">
								{#each [0, 1, 2] as d (d)}<i class:on={d < days}></i>{/each}
							</div>
							<p class="small">
								{days >= 3
									? 'Wochenziel geschafft · +25'
									: `${days} von 3 Übetagen · +25 Punkte bei 3`}
							</p>
						</section>
						<section class="card">
							<h2 class="lvl">
								<span class="label">Level {lv.n}</span><span class="sr"> · </span>{lv.name}
							</h2>
							<div class="pbar" aria-hidden="true">
								<i style:width="{Math.round(levelShare(points.points) * 100)}%"></i>
							</div>
							<p class="small">
								{points.points} Punkte{nx ? ` · noch ${nx.min - points.points} bis ${nx.name}` : ''}
							</p>
						</section>
					</div>
				{/if}

				<!-- Karte des Stücks: alle Teile, 5 Etappen übereinander; antippen zeigt Einzelheiten -->
				<section class="card">
					<p class="label">Dein Weg durchs Stück</p>
					<div class="map" style:--cols={sectionNos.length}>
						{#each sectionNos as i (i)}
							<button
								type="button"
								class="col"
								class:pause={pauses.has(i)}
								aria-haspopup="dialog"
								aria-label="Teil {sectionName(i)}: {sectionState(i)}"
								onclick={() => (openSection = i)}
							>
								{#each [5, 4, 3, 2, 1] as k (k)}
									{@const done = !pauses.has(i) && (stages[i] ?? 0) >= k}
									<span
										class:on={done}
										class:nomic={done && rhythmOnly.get(i)?.includes(k)}
										class:late={!done && !pauses.has(i) && plan && dueOf(plan, i, k) < today}
										class:exp={!pauses.has(i) && plan && expectedStage(plan, i, today) === k}
									></span>
								{/each}
								<b>{sectionName(i)}</b>
							</button>
						{/each}
					</div>
					<p class="legend">
						<span><i class="lg on"></i>geschafft</span>
						<span><i class="lg exp"></i>laut Plan bis heute</span>
						<span><i class="lg late"></i>überfällig</span>
						<span><i class="lg pause"></i>Pause für dich</span>
					</p>
				</section>

				<p class="golinks">
					<a class="go" href="{resolve('/ueben')}{voiceQuery(me.voice)}">Stück üben →</a>
					<a class="go" href={resolve('/aufwaermen')}>Aufwärmen →</a>
				</p>

				{#if openSection !== null}
					{@const i = openSection}
					{@const s = title.sections[i]}
					{@const nextK = (stages[i] ?? 0) + 1}
					<Sheet
						open
						label="Teil {s.name} · Takt {s.from}–{s.to}"
						onclose={() => (openSection = null)}
					>
						<h2 class="sheet-h">{sectionState(i)}</h2>
						{#if pauses.has(i)}
							<p class="hint">In diesem Teil spielt deine Stimme nicht.</p>
						{:else}
							<ul class="stagelist">
								{#each STAGES as st (st.k)}
									{@const done = (stages[i] ?? 0) >= st.k}
									{@const due = plan ? dueOf(plan, i, st.k) : null}
									<li class:done class:now={st.k === nextK}>
										<i>{done ? '✓' : st.k}</i>
										<span
											>{st.name}{#if !done && due}<small class:late={due < today}
													>{` · ${due < today ? 'überfällig seit' : 'fällig'} ${shortDate(due)}`}</small
												>{/if}</span
										>
									</li>
								{/each}
							</ul>
							<div class="btns">
								<a class="btn ghost" href="{resolve('/ueben')}{voiceQuery(me.voice, s.from)}"
									>Teil {s.name} üben</a
								>
								{#if nextK <= 5}
									<a
										class="btn"
										href="{resolve('/guugge/[id]/pruefung', { id })}?teil={i}&etappe={nextK}"
										aria-label="Prüfung Etappe {nextK}: Teil {s.name}">Prüfung Etappe {nextK}</a
									>
								{/if}
							</div>
						{/if}
					</Sheet>
				{/if}
			{/if}
		{:else}
			{#if plan && tl}
				{@const w = plan.weeks[shownWeek]}
				{@const nextW = plan.weeks[shownWeek + 1]}
				<!-- Zeitstrahl: Phasen als Balken, Strich »heute«, Meilensteine darunter -->
				<section class="card">
					<p class="label">
						{tl.week < 0
							? `Start am ${shortDate(plan.firstMonday)}`
							: tl.week >= plan.weeks.length
								? 'Plan abgeschlossen'
								: `Woche ${tl.week + 1} von ${plan.weeks.length} · ${plan.weeks[tl.week].phase}`}
					</p>
					<div class="tl">
						<div class="phases">
							{#each spans as sp (sp.phase)}
								<span
									class="ph {PHASE_CLASS[sp.phase]}"
									style:width="{(sp.weeks / plan.weeks.length) * 100}%"
									title="{sp.phase}: {sp.weeks} Wochen"
								></span>
							{/each}
						</div>
						{#if tl.week >= 0 && tl.week < plan.weeks.length}
							<div class="nowmark" style:left="{tl.pos * 100}%" aria-hidden="true">
								<b>heute</b>
							</div>
						{/if}
					</div>
					<p class="sr">
						Phasen: {spans.map((sp) => `${sp.phase} ${sp.weeks} Wochen`).join(', ')}.
					</p>
					<ul class="ms">
						{#each plan.milestones as m, i (m.text)}
							<li>
								<i class="dot {MILESTONE_CLASS[i]}" aria-hidden="true"></i>{m.text}<b
									>{shortDate(m.date)}</b
								>
							</li>
						{/each}
					</ul>
				</section>

				<!-- Diese Woche: Proben mit Wochentag, Etappen, Einzelüben -->
				<section class="card" data-testid="diese-woche">
					<p class="label">
						{tl.week < 0
							? 'Erste Woche'
							: tl.week >= plan.weeks.length
								? 'Letzte Woche'
								: 'Diese Woche'}
						· {shortDate(w.monday)}–{shortDate(w.sunday)}
					</p>
					<h2 class="wh">{w.headline}</h2>
					<ul class="items">
						{#if w.rp}
							<li>
								<span class="day rp"
									><span>{weekdayShort(w.rp.day)}</span><b>{dayNo(w.rp.day)}</b></span
								>
								<span>Registerprobe<small>{w.rp.text}</small></span>
							</li>
						{/if}
						<li>
							<span class="day gp"
								><span>{weekdayShort(w.gp.day)}</span><b>{dayNo(w.gp.day)}</b></span
							>
							<span>Gesamtprobe<small>{w.gp.text}</small></span>
						</li>
						{#if w.stages.length}
							<li>
								<span class="day"><span>bis So</span><b>{dayNo(w.sunday)}</b></span>
								<span
									>{w.phase === 'Feinschliff' ? 'Üben' : 'Etappen'}{#each w.stages as st (st)}<small
											>{st}</small
										>{/each}</span
								>
							</li>
						{/if}
						{#if w.solo}
							<li>
								<span class="day"><span>jede</span><b>Wo</b></span>
								<span>Einzeln üben<small>{w.solo}</small></span>
							</li>
						{/if}
					</ul>
				</section>

				<section class="card links">
					{#if nextW}
						<button
							type="button"
							class="more"
							aria-haspopup="dialog"
							onclick={() => openWeeks(shownWeek + 1)}
						>
							<span><b>Nächste Woche</b> · {nextW.headline}</span><span aria-hidden="true">›</span>
						</button>
					{/if}
					<button
						type="button"
						class="more"
						aria-haspopup="dialog"
						onclick={() => openWeeks(shownWeek)}
					>
						<span><b>Alle {plan.weeks.length} Wochen</b></span><span aria-hidden="true">›</span>
					</button>
				</section>

				{#if weeksOpen}
					<Sheet open label="Alle {plan.weeks.length} Wochen" onclose={() => (weeksOpen = false)}>
						<div class="weeks">
							{#each plan.weeks as wk, i (wk.monday)}
								<div class="week" class:now={i === tl.week} data-week={i} {@attach scrollToWeek}>
									<h3>
										Woche {i + 1} · {wk.phase}{i === tl.week ? ' · diese Woche' : ''}
										<small>{shortDate(wk.monday)}–{shortDate(wk.sunday)}</small>
									</h3>
									<ul>
										{#each wk.items as item (item)}<li>{item}</li>{/each}
									</ul>
								</div>
							{/each}
						</div>
					</Sheet>
				{/if}
			{:else if !leitung}
				<section class="card">
					<h2>Noch kein Gesamtplan.</h2>
					<p class="sub">Den legt die Leitung an. Bis dahin kannst du trotzdem üben.</p>
				</section>
			{/if}

			{#if leitung && !stored}
				<section class="card">
					<h2>Plan anlegen</h2>
					{@render planForm()}
				</section>
			{/if}

			{#if leitung && overview}
				<!-- Nur Leitung: Durchschnitte pro Register gegen den Plan, keine Prozent, keine Einzelwerte -->
				<section class="card">
					<h2 class="label reghead">So steht die Guugge · nur für die Leitung</h2>
					{#if overview.length}
						<div class="regs" style:--cols={sectionNos.length}>
							{#each overview as r (r.register)}
								<div class="reg">
									<div class="nm">
										{REGISTER_LABELS[r.register]}
										{#if r.persons <= 10}
											<span class="who" aria-hidden="true">
												{#each Array.from({ length: r.persons }, (_, k) => k) as k (k)}
													<i class:on={k < r.practiced_this_week}></i>
												{/each}
											</span>
										{:else}
											<small aria-hidden="true">{r.practiced_this_week}/{r.persons} geübt</small>
										{/if}
										<span class="sr"
											>{r.practiced_this_week} von {r.persons} haben diese Woche geübt</span
										>
									</div>
									{#if plan}
										<div class="cells" aria-hidden="true">
											{#each sectionNos as i (i)}
												<i
													class={registerCell(
														r.avg_stage_by_section?.[String(i)],
														expectedStage(plan, i, today)
													)}
												></i>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
							{#if plan}
								<div class="reg letters" aria-hidden="true">
									<span></span>
									<div class="cells">
										{#each sectionNos as i (i)}<span>{sectionName(i)}</span>{/each}
									</div>
								</div>
							{/if}
						</div>
						{#if plan}
							<p class="legend">
								<span><i class="lg ok"></i>im Plan</span>
								<span><i class="lg behind1"></i>1 Etappe hinterher</span>
								<span><i class="lg behind"></i>mehr hinterher</span>
								<span><i class="lg open"></i>noch nicht dran</span>
							</p>
						{:else}
							<p class="small">Farben pro Teil gibt es, sobald der Plan steht.</p>
						{/if}
						<p class="small">
							Punkte = diese Woche geübt. Nur Durchschnitte, erst ab 3 Personen pro Register. Pausen
							zählen als erledigt.
						</p>
					{:else}
						<p class="small">
							Noch kein Register hat drei Personen mit gewählter Stimme. So bleiben Einzelwerte
							verborgen.
						</p>
					{/if}
				</section>
			{/if}

			{#if leitung && stored}
				<button type="button" class="btn ghost wide" aria-haspopup="dialog" onclick={openEdit}
					>Plan ändern</button
				>
				{#if editOpen}
					<Sheet open label="Plan ändern" onclose={() => (editOpen = false)}>
						{@render planForm()}
					</Sheet>
				{/if}
			{/if}
		{/if}
	{/if}
</div>

{#snippet planForm()}
	<form class="planform" onsubmit={save}>
		<div class="two">
			<label class="field">
				Start
				<input type="date" required bind:value={fStart} />
			</label>
			<label class="field">
				Auftritt
				<input type="date" required bind:value={fPerf} />
			</label>
		</div>
		<fieldset class="field">
			<legend>Gesamtprobe</legend>
			<div class="daychips">
				{#each FORM_DAYS as d (d)}
					<button
						type="button"
						aria-label={WEEKDAYS[d]}
						aria-pressed={fGp === d}
						onclick={() => (fGp = d)}>{WEEKDAYS[d].slice(0, 2)}</button
					>
				{/each}
			</div>
		</fieldset>
		<fieldset class="field">
			<legend>Registerprobe</legend>
			<div class="daychips">
				{#each FORM_DAYS as d (d)}
					<button
						type="button"
						aria-label={WEEKDAYS[d]}
						aria-pressed={fRp === d}
						onclick={() => (fRp = d)}>{WEEKDAYS[d].slice(0, 2)}</button
					>
				{/each}
				<button type="button" class="none" aria-pressed={fRp === null} onclick={() => (fRp = null)}
					>keine</button
				>
			</div>
		</fieldset>
		<fieldset class="field">
			<legend>Einzeln üben pro Woche</legend>
			<div class="daychips">
				{#each minuteChoices as m (m)}
					<button
						type="button"
						aria-label="{m} Minuten"
						aria-pressed={fMin === m}
						onclick={() => (fMin = m)}>{m}</button
					>
				{/each}
			</div>
		</fieldset>
		<p class="small">
			Daraus entstehen die Wochen: etwa die Hälfte Lernen, dann Tempo, Auswendig, Feinschliff. Die
			Teile verteilen sich nach Schwierigkeit. Alle sehen den Plan sofort.
		</p>
		{#if formError}<p class="err" role="alert">{formError}</p>{/if}
		<div class="btns">
			<button class="btn" type="submit" disabled={busy}>Plan speichern</button>
		</div>
	</form>
{/snippet}

<style>
	/* Seite ohne globalen Kopf (wie »Stück üben«), schmal und mittig */
	.planpage {
		box-sizing: border-box;
		max-width: 620px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
			max(24px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.top :global(.mark) {
		width: 30px;
		height: 30px;
		flex: none;
	}
	.back {
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}
	.top h1 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 17px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chip {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		border-radius: 999px;
		padding: 7px 13px;
		font-weight: 600;
		font-size: 15px;
		text-decoration: none;
		white-space: nowrap;
	}
	.tabs {
		display: flex;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 3px;
	}
	.tabs button {
		flex: 1;
		appearance: none;
		border: 0;
		background: none;
		color: var(--muted);
		font: 600 15px var(--font-body);
		border-radius: 999px;
		min-height: 38px;
		cursor: pointer;
	}
	.tabs button[aria-pressed='true'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
	}
	.planpage .card {
		max-width: none;
		gap: 6px;
	}
	.card h2 {
		margin: 2px 0;
	}
	/* Heute dran */
	.today {
		border: 2px solid var(--gelb);
	}
	.today.calm {
		border-color: var(--gruen);
	}
	.today h2 {
		font-size: 22px;
		letter-spacing: -0.01em;
	}
	.why {
		margin: 0;
		font-weight: 600;
		font-size: 14px;
		color: var(--muted);
	}
	.why.late,
	small.late {
		color: var(--rot-text);
	}
	.btns {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.btns .btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		text-decoration: none;
		min-height: 48px;
		font-size: 16px;
	}
	/* Hauptknopf gelb wie im Entwurf; »ghost« und »green« behalten ihre Farbe */
	.btns .btn:not(.ghost):not(.green) {
		background: var(--gelb);
		color: #141619;
	}
	.btn.green {
		background: var(--gruen);
		border-color: var(--gruen);
		color: #141619;
	}
	.then {
		margin: 12px 0 0;
		font-size: 14px;
		color: var(--muted);
	}
	.then b {
		color: var(--ink);
		font-weight: 600;
	}
	.sub {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 14px;
	}
	/* Countdown */
	.card.count {
		flex-direction: row;
		align-items: center;
		gap: 16px;
	}
	.ring {
		--share: 0;
		width: 84px;
		height: 84px;
		flex: none;
		border-radius: 50%;
		background: conic-gradient(
			var(--gelb) calc(var(--share) * 360deg),
			var(--surface2) calc(var(--share) * 360deg)
		);
		display: grid;
		place-items: center;
	}
	.ring div {
		width: 66px;
		height: 66px;
		border-radius: 50%;
		background: var(--surface);
		display: grid;
		place-content: center;
		text-align: center;
		line-height: 1.1;
	}
	.ring b {
		font-size: 16px;
	}
	.ring small {
		font-size: 10px;
		color: var(--muted);
	}
	.days {
		font-size: 28px;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.status {
		margin: 4px 0 0;
		font-weight: 700;
		font-size: 14px;
	}
	.status.ahead {
		color: var(--gruen-text);
	}
	.status.behind {
		color: var(--rot-text);
	}
	/* Woche und Level */
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.pair .card {
		padding: 14px;
	}
	.dots {
		display: flex;
		gap: 6px;
		margin: 8px 0 4px;
	}
	.dots i {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--line);
	}
	.dots i.on {
		background: var(--gruen);
		border-color: var(--gruen);
	}
	.lvl {
		display: flex;
		flex-direction: column;
		font-size: 17px;
	}
	.pbar {
		height: 8px;
		border-radius: 4px;
		background: var(--surface2);
		margin: 8px 0 4px;
		overflow: hidden;
	}
	.pbar i {
		display: block;
		height: 100%;
		background: var(--gelb);
	}
	.small {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	/* Karte des Stücks */
	.map {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 3px;
		margin-top: 10px;
	}
	.col {
		appearance: none;
		border: 0;
		background: none;
		padding: 2px 0;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		cursor: pointer;
		min-width: 0;
	}
	.col:hover {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.col span {
		height: 14px;
		border-radius: 4px;
		background: var(--surface2);
	}
	.col span.on {
		background: var(--gruen);
	}
	.col span.nomic {
		background: linear-gradient(90deg, var(--gruen) 50%, var(--surface2) 50%);
	}
	.col span.late {
		background: color-mix(in srgb, var(--rot) 45%, var(--surface2));
	}
	.col span.exp {
		outline: 2px solid var(--blau);
		outline-offset: -2px;
	}
	.col.pause span {
		background: repeating-linear-gradient(
			45deg,
			var(--surface2) 0 3px,
			color-mix(in srgb, var(--ink) 8%, var(--surface2)) 3px 6px
		);
	}
	.col b {
		text-align: center;
		font-size: 11px;
		color: var(--muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--muted);
	}
	.lg {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		vertical-align: -2px;
		margin-right: 4px;
		background: var(--surface2);
	}
	.lg.on {
		background: var(--gruen);
	}
	.lg.exp {
		outline: 2px solid var(--blau);
		outline-offset: -2px;
	}
	.lg.late {
		background: color-mix(in srgb, var(--rot) 45%, var(--surface2));
	}
	.lg.pause {
		background: repeating-linear-gradient(
			45deg,
			var(--surface2) 0 3px,
			color-mix(in srgb, var(--ink) 8%, var(--surface2)) 3px 6px
		);
	}
	/* Blatt eines Teils */
	.sheet-h {
		margin: 4px 0 8px;
		font-size: 22px;
	}
	.stagelist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.stagelist li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
	}
	.stagelist i {
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-style: normal;
		font-weight: 700;
		font-size: 13px;
		border: 2px solid var(--line);
	}
	.stagelist li.done i {
		background: var(--gruen);
		border-color: var(--gruen);
		color: #141619;
	}
	.stagelist li.now i {
		border-color: var(--gelb);
		color: var(--akzent);
	}
	.stagelist small {
		color: var(--muted);
	}
	/* Gesamtplan: Zeitstrahl */
	.tl {
		position: relative;
		margin: 26px 0 4px;
	}
	.phases {
		display: flex;
		height: 14px;
		border-radius: 7px;
		overflow: hidden;
	}
	.ph {
		display: block;
		flex: none;
		height: 100%;
	}
	.ph-l {
		background: var(--blau);
	}
	.ph-t {
		background: var(--gelb);
	}
	.ph-a {
		background: var(--rot);
	}
	.ph-f {
		background: var(--gruen);
	}
	.nowmark {
		position: absolute;
		top: -6px;
		width: 3px;
		height: 26px;
		margin-left: -1px;
		background: var(--ink);
		border-radius: 2px;
	}
	.nowmark b {
		position: absolute;
		top: -18px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 11px;
		white-space: nowrap;
	}
	.ms {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.ms li {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.25;
	}
	.ms b {
		display: block;
		color: var(--ink);
		font-size: 13px;
	}
	.dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-bottom: 4px;
	}
	/* Diese Woche */
	.wh {
		font-size: 18px;
		margin: 2px 0 6px;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.items li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 7px 0;
		border-top: 1px solid var(--line);
		font-size: 15px;
	}
	.items li:first-child {
		border-top: 0;
	}
	.items small {
		display: block;
		color: var(--muted);
		font-size: 13px;
	}
	.day {
		flex: none;
		width: 46px;
		text-align: center;
		border-radius: 10px;
		background: var(--surface2);
		border: 1px solid var(--line);
		padding: 3px 0;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.2;
	}
	.day span,
	.day b {
		display: block;
	}
	.day b {
		font-size: 15px;
		color: var(--ink);
	}
	.day.gp {
		border-color: var(--gelb);
	}
	.day.rp {
		border-color: var(--blau);
	}
	/* Nächste Woche, alle Wochen */
	.card.links {
		gap: 0;
		padding-top: 6px;
		padding-bottom: 6px;
	}
	.more {
		appearance: none;
		border: 0;
		background: none;
		color: var(--ink);
		font: 400 15px var(--font-body);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		padding: 0;
		text-align: left;
		cursor: pointer;
	}
	.more + .more {
		border-top: 1px solid var(--line);
	}
	.more > span:last-child {
		color: var(--muted);
		font-size: 20px;
	}
	.weeks {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.week {
		border-top: 1px solid var(--line);
		padding-top: 8px;
		/* Platz für den stehenden Kopf des Blatts */
		scroll-margin-top: 64px;
	}
	.week:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.week h3 {
		margin: 0;
		font-size: 15px;
	}
	.week h3 small {
		font-weight: 400;
		color: var(--muted);
		margin-left: 4px;
	}
	.week.now h3 {
		color: var(--akzent);
	}
	.week ul {
		margin: 4px 0 0;
		padding-left: 18px;
		font-size: 14px;
	}
	/* So steht die Guugge (nur Leitung) */
	.card h2.reghead {
		font-size: 11px;
		margin: 0;
	}
	.regs {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 6px;
	}
	.reg {
		display: grid;
		grid-template-columns: 86px 1fr;
		gap: 8px;
		align-items: center;
	}
	.nm {
		font-size: 14px;
		font-weight: 600;
		min-width: 0;
	}
	.nm small {
		display: block;
		font-weight: 400;
		color: var(--muted);
		font-size: 11px;
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin-top: 3px;
	}
	.who i {
		width: 9px;
		height: 9px;
		box-sizing: border-box;
		border-radius: 50%;
		border: 1.5px solid var(--line);
	}
	.who i.on {
		background: var(--gruen);
		border-color: var(--gruen);
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 2px;
	}
	.cells i,
	.lg.open {
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.cells i {
		height: 18px;
		border-radius: 3px;
		background: var(--surface2);
	}
	.cells i.ok,
	.lg.ok {
		background: var(--gruen);
	}
	.cells i.behind1,
	.lg.behind1 {
		background: var(--gelb);
	}
	.cells i.behind,
	.lg.behind {
		background: color-mix(in srgb, var(--rot) 80%, var(--surface2));
	}
	.cells i.none {
		background: repeating-linear-gradient(
			45deg,
			var(--surface2) 0 3px,
			color-mix(in srgb, var(--ink) 8%, var(--surface2)) 3px 6px
		);
	}
	.letters .cells span {
		font-size: 10px;
		color: var(--muted);
		text-align: center;
	}
	.btn.wide {
		width: 100%;
		min-height: 48px;
	}
	/* Formular der Leitung */
	.planform {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.planform .field {
		flex: none;
	}
	fieldset.field {
		border: 0;
		margin: 0;
		padding: 0;
	}
	fieldset.field legend {
		padding: 0;
		margin-bottom: 6px;
	}
	.daychips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.daychips button {
		flex: 1;
		min-width: 34px;
		appearance: none;
		border: 1px solid var(--line);
		background: none;
		color: var(--ink);
		border-radius: 999px;
		min-height: 38px;
		font: 600 14px var(--font-body);
		cursor: pointer;
	}
	.daychips button.none {
		flex: 1.5;
	}
	.daychips button[aria-pressed='true'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
		border-color: var(--chip-on-bg);
	}
	.planform .btns {
		margin-top: 0;
	}
</style>
