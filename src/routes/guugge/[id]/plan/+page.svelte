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
	import { levelOf, nextLevel } from '#lib/game/points.ts';
	import {
		nextExams,
		pauseSections,
		planStatus,
		playedSections,
		STAGES,
		standPercent,
		statusText,
		weekGoals,
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
	const pct = $derived(standPercent(played, stages));
	const next = $derived(nextExams(played, stages, plan).slice(0, 5));
	const monday = mondayOf(today);
	const goals = $derived(plan ? weekGoals(played, stages, plan, monday, addDays(monday, 6)) : []);
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

<p><a class="back" href={resolve('/guugge/[id]', { id })}>← {me?.name ?? 'Guugge'}</a></p>

{#if !sb || (auth.ready && !auth.user)}
	<section class="card">
		<h1>Melde dich an.</h1>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	</section>
{:else if missing}
	<section class="card">
		<h1>Diese Guugge findest du hier nicht.</h1>
	</section>
{:else if !me}
	<p class="hint">Einen Moment …</p>
{:else}
	<div class="stack">
		<section class="card">
			<p class="label">Plan</p>
			<h1>{title.name}</h1>
			<div class="seg" role="group" aria-label="Ansicht">
				<button type="button" aria-pressed={view === 'mine'} onclick={() => (view = 'mine')}
					>Mein Plan</button
				>
				<button type="button" aria-pressed={view === 'all'} onclick={() => (view = 'all')}
					>Gesamtplan</button
				>
			</div>
		</section>

		{#if notice}<p class="ok" role="status">{notice}</p>{/if}
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		{#if view === 'mine'}
			{#if !voice}
				<section class="card">
					<h2>Wähl zuerst deine Stimme.</h2>
					<p><a class="go" href={resolve('/guugge/[id]', { id })}>Zur Stimmwahl →</a></p>
				</section>
			{:else}
				<section class="card">
					<p class="label">{voice.name}</p>
					<h2
						class="big"
						class:ahead={plan && status.diff > 0}
						class:behind={plan && status.diff < 0}
					>
						{statusText(status, !!plan)}
					</h2>
					{#if plan}
						<p class="hint">
							Erwartet bis heute: {status.expected} von {status.max} Etappen · geschafft: {status.sum}
						</p>
					{:else}
						<p class="hint">Noch kein Gesamtplan. Den legt die Leitung an.</p>
					{/if}
					<div class="bar" aria-hidden="true"><i style:width="{pct}%"></i></div>
					<p class="hint">
						{pct} % bis auftrittsreif{stored ? ` · Auftritt am ${longDate(stored.perf)}` : ''}
					</p>
				</section>

				{#if points}
					{@const lv = levelOf(points.points)}
					{@const nx = nextLevel(points.points)}
					<section class="card">
						<p class="label">Punkte</p>
						<h2>Level {lv.n} · {lv.name}</h2>
						<p>
							{points.points} Punkte · diese Woche {points.week_points}{nx
								? ` · noch ${nx.min - points.points} bis ${nx.name}`
								: ''}
						</p>
						<p class="hint">
							An {Math.min(points.days_this_week, 3)} von 3 Tagen geübt diese Woche{points.days_this_week >=
							3
								? ' – Wochenziel erreicht.'
								: '.'} Punkte gibt es nur für bestandene Etappen und das Wochenziel, nicht für Zeit.
						</p>
					</section>
				{/if}

				<section class="card">
					<h2>Als Nächstes</h2>
					{#if next.length}
						<ul class="list">
							{#each next as x (x.section)}
								<li class="next">
									<span class="what">
										<strong
											>Teil {sectionName(x.section)} · Etappe {x.stage}: {STAGES[x.stage - 1]
												.name}</strong
										>
										<span class:over={x.due && x.due < today}>
											{#if !x.due}ohne Termin{:else if x.due < today}überfällig seit {shortDate(
													x.due
												)}{:else}fällig bis {shortDate(x.due)}{/if}
										</span>
									</span>
									<a
										class="btn ghost small"
										href="{resolve('/guugge/[id]/pruefung', {
											id
										})}?teil={x.section}&etappe={x.stage}"
										aria-label="Prüfung Teil {sectionName(x.section)}, Etappe {x.stage}">Prüfung</a
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p><strong>Alles geschafft.</strong> Auftrittsreif – jetzt nur noch Spass.</p>
					{/if}
				</section>

				{#if plan}
					<section class="card">
						<h2>
							Diese Woche <span class="hint"
								>{shortDate(monday)}–{shortDate(addDays(monday, 6))}</span
							>
						</h2>
						{#if goals.length}
							<ul class="list">
								{#each goals as g (`${g.section}-${g.stage}`)}
									<li class:done={g.done}>
										Teil {sectionName(g.section)}: Etappe {g.stage} ({STAGES[g.stage - 1].name})
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">Diese Woche wird keine Etappe fällig.</p>
						{/if}
					</section>
				{/if}

				<section class="card">
					<h2>Alle Teile</h2>
					<div class="grid">
						{#each title.sections as s, i (i)}
							{#if i > 0}
								<div class="sec" class:pause={pauses.has(i)}>
									<strong>Teil {s.name}</strong>
									<small>
										{#if pauses.has(i)}Pause für dich{:else if stages[i]}{STAGES[stages[i] - 1]
												.name}{:else}noch offen{/if}
									</small>
									<div class="steps" aria-label="Etappen Teil {s.name}">
										{#each STAGES as st (st.k)}
											{@const done = pauses.has(i) || (stages[i] ?? 0) >= st.k}
											<span
												class:on={done}
												class:nomic={done && rhythmOnly.get(i)?.includes(st.k)}
												class:late={!done && plan && dueOf(plan, i, st.k) < today}
												class:exp={!pauses.has(i) && plan && expectedStage(plan, i, today) === st.k}
												title="Etappe {st.k}: {st.name}"
											></span>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
					<p class="hint">
						Gefüllt = geschafft · Rand = laut Plan bis heute · rot = überfällig · halb = ohne
						Mikrofon
					</p>
				</section>
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
	</div>
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.back {
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
	}
	.big {
		font-size: 24px;
	}
	.big.ahead {
		color: var(--gruen);
	}
	.big.behind {
		color: var(--rot);
	}
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
	.list li {
		display: flex;
		flex-direction: column;
	}
	.list.plain li {
		display: list-item;
	}
	.list li.next {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.what {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.small {
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		font-size: 14px;
	}
	.list .over {
		color: var(--rot);
		font-weight: 600;
	}
	.list li.done {
		color: var(--muted);
		text-decoration: line-through;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 8px;
	}
	.sec {
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.sec small {
		color: var(--muted);
	}
	.sec.pause {
		opacity: 0.6;
	}
	.steps {
		display: flex;
		gap: 4px;
		margin-top: 4px;
	}
	.steps span {
		width: 16px;
		height: 10px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface2);
	}
	.steps span.on {
		background: var(--gruen);
		border-color: var(--gruen);
	}
	.steps span.nomic {
		background: linear-gradient(90deg, var(--gruen) 50%, var(--surface2) 50%);
	}
	.steps span.late {
		border-color: var(--rot);
	}
	.steps span.exp {
		outline: 2px solid var(--blau);
		outline-offset: 1px;
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
