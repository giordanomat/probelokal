<script lang="ts">
	// Plan für Bad Touch: »Mein Plan« (Stand der eigenen Stimme gegen den Plan) und »Gesamtplan«
	// (Wochen und Meilensteine; die Leitung legt ihn an). Logik in src/lib/plan/.
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
		WEEKDAYS
	} from '#lib/plan/dates.ts';
	import { buildPlan, dueOf, dueTable, expectedStage, sectionWeights } from '#lib/plan/plan.ts';
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
	let showAll = $state(false);
	let busy = $state(false);
	let error = $state('');
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
	const nowWeek = $derived(plan ? plan.weeks.findIndex((w) => w.monday === monday) : -1);
	const firstShown = $derived(
		plan ? Math.max(0, Math.min(nowWeek < 0 ? 0 : nowWeek, plan.weeks.length - 3)) : 0
	);

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

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!sb || busy) return;
		busy = true;
		error = '';
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
			notice = 'Gespeichert. Alle in der Guugge sehen den Plan.';
		} catch (err) {
			error = (err as Error).message;
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
			{#if plan}
				<section class="card">
					<h2>Meilensteine</h2>
					<ul class="list plain">
						{#each plan.milestones as m (m.text)}
							<li>{m.text} bis <strong>{shortDate(m.date)}</strong></li>
						{/each}
					</ul>
				</section>
				<section class="card">
					<h2>Wochen</h2>
					{#each plan.weeks as w, i (w.monday)}
						{#if showAll || (i >= firstShown && i < firstShown + 3)}
							<div class="week" class:now={i === nowWeek}>
								<h3>
									Woche {i + 1} · {w.phase}{i === nowWeek ? ' · diese Woche' : ''}
									<span class="hint">{shortDate(w.monday)}–{shortDate(w.sunday)}</span>
								</h3>
								<ul>
									{#each w.items as item (item)}<li>{item}</li>{/each}
								</ul>
							</div>
						{/if}
					{/each}
					<p>
						<button class="btn ghost" type="button" onclick={() => (showAll = !showAll)}>
							{showAll
								? 'Nur die nächsten Wochen zeigen'
								: `Alle ${plan.weeks.length} Wochen zeigen`}
						</button>
					</p>
				</section>
			{:else if !leitung}
				<section class="card">
					<h2>Noch kein Gesamtplan.</h2>
					<p>Den legt die Leitung an. Bis dahin kannst du trotzdem üben.</p>
				</section>
			{/if}

			{#if leitung && overview}
				<section class="card">
					<h2>Übersicht der Register</h2>
					<p class="hint">
						Nur Durchschnitte pro Register und erst ab drei Personen mit gewählter Stimme.
						Einzelwerte siehst du nicht. Pausen zählen als erledigt.
					</p>
					{#if overview.length}
						<div class="regs">
							{#each overview as r (r.register)}
								{@const vals = Object.values(r.avg_stage_by_section ?? {})}
								{@const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0}
								<div class="reg">
									<strong>{REGISTER_LABELS[r.register]}</strong>
									<div class="bar" aria-hidden="true">
										<i style:width="{Math.round((avg / 5) * 100)}%"></i>
									</div>
									<span class="hint"
										>{Math.round((avg / 5) * 100)} % im Schnitt · {r.practiced_this_week} von {r.persons}
										haben diese Woche geübt</span
									>
								</div>
							{/each}
						</div>
						<div class="heatwrap">
							<table class="heat">
								<thead>
									<tr>
										<th></th>
										{#each title.sections as s, i (i)}{#if i > 0}<th>{s.name}</th>{/if}{/each}
									</tr>
								</thead>
								<tbody>
									{#if plan}
										<tr>
											<th class="hint">Plan</th>
											{#each sectionNos as i (i)}<td class="exp">{expectedStage(plan, i, today)}</td
												>{/each}
										</tr>
									{/if}
									{#each overview as r (r.register)}
										<tr>
											<th>{REGISTER_LABELS[r.register]}</th>
											{#each sectionNos as i (i)}
												{@const v = r.avg_stage_by_section?.[String(i)]}
												<td
													style:background={v === undefined
														? 'var(--surface2)'
														: `color-mix(in srgb, var(--gruen) ${Math.round((v / 5) * 85 + 10)}%, var(--surface))`}
													>{v === undefined ? '–' : String(v).replace('.', ',')}</td
												>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="hint">Zahl = durchschnittlich erreichte Etappe (0–5) pro Teil.</p>
					{:else}
						<p class="hint">
							Noch kein Register hat drei Personen mit gewählter Stimme. So bleiben Einzelwerte
							verborgen.
						</p>
					{/if}
				</section>
			{/if}

			{#if leitung}
				<section class="card">
					<h2>{stored ? 'Plan ändern' : 'Plan anlegen'}</h2>
					<p class="hint">
						Aus diesen Angaben entstehen die Wochen: etwa die Hälfte Lernen, dann Tempo, Auswendig
						und Feinschliff. Die Teile verteilen sich nach Schwierigkeit.
					</p>
					<form class="planform" onsubmit={save}>
						<label class="field">
							Start
							<input type="date" required bind:value={fStart} />
						</label>
						<label class="field">
							Auftritt
							<input type="date" required bind:value={fPerf} />
						</label>
						<label class="field">
							Gesamtprobe
							<select bind:value={fGp}>
								{#each WEEKDAYS as d, i (d)}<option value={i}>{d}</option>{/each}
							</select>
						</label>
						<label class="field">
							Registerprobe
							<select bind:value={fRp}>
								<option value={null}>keine</option>
								{#each WEEKDAYS as d, i (d)}<option value={i}>{d}</option>{/each}
							</select>
						</label>
						<label class="field">
							Einzeln üben pro Woche (Minuten)
							<input type="number" min="0" max="600" step="5" required bind:value={fMin} />
						</label>
						<button class="btn" type="submit" disabled={busy}
							>{stored ? 'Plan aktualisieren' : 'Plan speichern'}</button
						>
					</form>
				</section>
			{/if}
		{/if}
	{/if}
</div>

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
		color: var(--rot);
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
		color: var(--gruen);
	}
	.status.behind {
		color: var(--rot);
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
		color: var(--gelb);
	}
	.stagelist small {
		color: var(--muted);
	}
	/* Gesamtplan */
	.bar {
		height: 8px;
		border-radius: 999px;
		background: var(--surface2);
		border: 1px solid var(--line);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		background: var(--gruen);
	}
	.list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.list.plain li {
		display: list-item;
	}
	.week {
		border-top: 1px solid var(--line);
		padding-top: 8px;
	}
	.week.now h3 {
		color: var(--akzent);
	}
	.week h3 {
		margin: 0;
		font-size: 15px;
	}
	.week ul {
		margin: 4px 0 0;
		padding-left: 18px;
	}
	.regs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 8px;
	}
	.reg {
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.heatwrap {
		overflow-x: auto;
	}
	.heat {
		border-collapse: separate;
		border-spacing: 3px;
		font-size: 13px;
	}
	.heat th {
		text-align: left;
		font-weight: 600;
		padding: 2px 6px;
		white-space: nowrap;
	}
	.heat td {
		min-width: 28px;
		text-align: center;
		border-radius: 6px;
		padding: 3px 2px;
		font-variant-numeric: tabular-nums;
	}
	.heat td.exp {
		color: var(--muted);
	}
	.planform {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 10px;
		align-items: end;
	}
</style>
