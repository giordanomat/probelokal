<script lang="ts">
	// Punkte, Rang, Belohnungen und Rangliste einer Guugge, portiert aus prototype/v7 (renderRang).
	// Rangliste nur, wenn die Leitung sie eingeschaltet hat, und nur mit Personen, die selbst
	// mitmachen (Standard: aus, docs/01). Die Datenbank liefert nur diese (leaderboard).
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { REGISTER_LABELS } from '#lib/music/registers.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		guuggeSettings,
		leaderboard,
		myAccount,
		myPoints,
		myPointsLog,
		setLevelRewards,
		setRanglisteEnabled,
		setRanglisteOptIn,
		type BoardRow,
		type GuuggeSettings,
		type MyGuugge,
		type MyPoints,
		type PointsEntry,
		type Register
	} from '#lib/account/api.ts';
	import { LEVELS, levelOf, nextLevel, rewardText } from '#lib/game/points.ts';
	import { BAD_TOUCH_VOICES } from '#lib/titles/bad-touch-voices.ts';

	const sb = getSupabase();

	let me = $state<MyGuugge | null>(null);
	let missing = $state(false);
	let points = $state<MyPoints | null>(null);
	let log = $state<PointsEntry[]>([]);
	let settings = $state<GuuggeSettings | null>(null);
	let board = $state<BoardRow[]>([]);
	let sort = $state<'all' | 'week'>('all');
	let rewards = $state<Record<string, string>>({});
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	const id = $derived(page.params.id ?? '');
	const leitung = $derived(me?.role === 'leitung');
	const level = $derived(levelOf(points?.points ?? 0));
	const next = $derived(nextLevel(points?.points ?? 0));
	const progress = $derived(
		next ? Math.round((((points?.points ?? 0) - level.min) / (next.min - level.min)) * 100) : 100
	);
	const rows = $derived(
		[...board].sort((a, b) =>
			sort === 'week' ? b.week_points - a.week_points : b.points - a.points
		)
	);
	const voiceOf = (v: string | null) => BAD_TOUCH_VOICES.find((x) => x.id === v);
	/** Register-Wertung: Punkte dieser Woche im Schnitt, nur aus den Teilnehmenden */
	const registers = $derived.by(() => {
		const g: Partial<Record<Register, { n: number; sum: number }>> = {};
		for (const r of board) {
			const reg = voiceOf(r.voice)?.register;
			if (!reg) continue;
			const e = (g[reg] ??= { n: 0, sum: 0 });
			e.n++;
			e.sum += r.week_points;
		}
		const max = Math.max(1, ...Object.values(g).map((e) => e.sum / e.n));
		return (Object.keys(REGISTER_LABELS) as Register[])
			.filter((k) => k !== 'perc' || g[k])
			.map((k) => {
				const e = g[k];
				const avg = e ? Math.round(e.sum / e.n) : 0;
				return {
					k,
					label: REGISTER_LABELS[k],
					n: e?.n ?? 0,
					avg,
					width: Math.round((avg / max) * 100)
				};
			});
	});

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
			[points, log, settings, board] = await Promise.all([
				myPoints(sb, id),
				myPointsLog(sb, id),
				guuggeSettings(sb, id),
				leaderboard(sb, id)
			]);
			rewards = { ...(settings?.level_rewards ?? {}) };
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function run(action: () => Promise<void>, done = '') {
		if (!sb || busy) return;
		busy = true;
		error = '';
		notice = '';
		try {
			await action();
			await load();
			notice = done;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function saveRewards(e: SubmitEvent) {
		e.preventDefault();
		const clean = Object.fromEntries(
			Object.entries(rewards)
				.map(([k, v]) => [k, v.trim()])
				.filter(([, v]) => v)
		);
		void run(() => setLevelRewards(sb!, id, clean), 'Belohnungen gespeichert.');
	}
</script>

<svelte:head>
	<title>Punkte und Rangliste · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<p><a class="back" href={resolve('/guugge/[id]', { id })}>← {me?.name ?? 'Guugge'}</a></p>

{#if !sb || (auth.ready && !auth.user)}
	<section class="card">
		<h1>Melde dich an.</h1>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	</section>
{:else if missing}
	<section class="card"><h1>Diese Guugge findest du hier nicht.</h1></section>
{:else if !me || !points}
	<p class="hint">Einen Moment …</p>
{:else}
	<div class="stack">
		<section class="card">
			<p class="label">Dein Rang</p>
			<div class="lvl">
				<span class="badge" aria-hidden="true">{level.n}</span>
				<div>
					<h1>Level {level.n} · {level.name}</h1>
					<p>{points.points} Punkte · diese Woche {points.week_points}</p>
				</div>
			</div>
			<div class="bar" aria-hidden="true"><i style:width="{progress}%"></i></div>
			<p class="hint">
				{next
					? `Noch ${next.min - points.points} Punkte bis Level ${next.n} (${next.name})${next.reward ? ` · Belohnung: ${rewardText(next)}` : ''}`
					: 'Höchster Rang erreicht.'}
			</p>
			<p class="hint">
				Punkte gibt es für bestandene Etappen und das Wochenziel (an 3 Tagen geübt), nicht für Zeit.
				Wer eine Woche nicht übt, verliert nichts.
			</p>
		</section>

		{#if notice}<p class="ok" role="status">{notice}</p>{/if}
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		<section class="card">
			<h2>Belohnungen</h2>
			<ul class="list">
				{#each LEVELS.slice(1) as l (l.n)}
					{@const own = settings?.level_rewards?.[String(l.n)]}
					<li>
						<span class="what">
							<strong>Level {l.n} · {l.name}</strong>
							<span class="hint"
								>{[rewardText(l), own ? `Von deiner Guugge: ${own}` : '']
									.filter(Boolean)
									.join(' · ')}</span
							>
						</span>
						{#if level.n >= l.n}<span class="ok">freigeschaltet</span>{:else}<span class="hint"
								>ab {l.min} P</span
							>{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="card">
			<h2>Letzte Punkte</h2>
			{#if log.length}
				<ul class="list">
					{#each log as e (e.created_at + e.reason)}
						<li>
							<span class="what"
								><strong>+{e.points} Punkte</strong><span class="hint"
									>{e.reason} · {new Date(e.created_at).toLocaleDateString('de-CH')}</span
								></span
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">Noch keine Punkte. Leg im Plan eine Etappe ab.</p>
			{/if}
		</section>

		<section class="card">
			<h2>Rangliste</h2>
			<label class="toggle">
				<input
					type="checkbox"
					checked={me.rangliste_opt_in}
					disabled={busy || !settings?.rangliste_enabled}
					onchange={(e) =>
						run(
							() => setRanglisteOptIn(sb!, id, e.currentTarget.checked),
							e.currentTarget.checked
								? 'Du erscheinst in der Rangliste.'
								: 'Du erscheinst nicht in der Rangliste.'
						)}
				/>
				Ich mache mit
			</label>
			<p class="hint">
				{#if !settings?.rangliste_enabled}
					Die Rangliste ist für die Guugge ausgeschaltet.{leitung
						? ' Du kannst sie unten einschalten.'
						: ' Die Leitung kann sie einschalten.'}
				{:else if me.rangliste_opt_in}
					Du erscheinst mit Namen, Stimme, Level und Punkten. Ausschalten geht jederzeit.
				{:else}
					Du erscheinst nicht. Andere sehen dich erst, wenn du mitmachst.
				{/if}
				Freiwillig, Standard ist aus. Die Leitung sieht sonst nur Durchschnitte pro Register, nie deine
				Einzelwerte.
			</p>
			{#if settings?.rangliste_enabled}
				<div class="seg" role="group" aria-label="Sortierung">
					<button type="button" aria-pressed={sort === 'all'} onclick={() => (sort = 'all')}
						>Gesamt</button
					>
					<button type="button" aria-pressed={sort === 'week'} onclick={() => (sort = 'week')}
						>Diese Woche</button
					>
				</div>
				<ol class="board">
					{#each rows as r, i (r.user_id)}
						{@const lv = levelOf(r.points)}
						<li class:mine={r.user_id === auth.user?.id}>
							<span class="pl">{i + 1}</span>
							<span class="what">
								<strong class:gold={lv.n >= 5}
									>{r.user_id === auth.user?.id ? 'Du' : r.display_name || 'Ohne Namen'}</strong
								>
								<span class="hint"
									>{voiceOf(r.voice)?.name ?? 'ohne Stimme'} · Level {lv.n} {lv.name}</span
								>
							</span>
							<span class="pt">{sort === 'week' ? r.week_points : r.points}</span>
						</li>
					{:else}
						<li><span class="hint">Noch niemand in der Rangliste.</span></li>
					{/each}
				</ol>
				{#if rows.length}
					<h3>Register diese Woche</h3>
					<div class="regs">
						{#each registers as g (g.k)}
							<div class="reg">
								<strong>{g.label}</strong>
								<div class="bar" aria-hidden="true">
									<i class="gelb" style:width="{g.width}%"></i>
								</div>
								<span class="hint"
									>{g.n
										? `${g.avg} Punkte im Schnitt · ${g.n} ${g.n === 1 ? 'Person' : 'Personen'}`
										: 'niemand dabei'}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</section>

		{#if leitung}
			<section class="card">
				<h2>Für die Leitung</h2>
				<label class="toggle">
					<input
						type="checkbox"
						checked={settings?.rangliste_enabled ?? false}
						disabled={busy}
						onchange={(e) => run(() => setRanglisteEnabled(sb!, id, e.currentTarget.checked))}
					/>
					Rangliste für die Guugge einschalten
				</label>
				<p class="hint">
					Eigene Belohnungen pro Level, z. B. »Getränk nach der Probe«. Alle sehen sie hier.
				</p>
				<form class="rewards" onsubmit={saveRewards}>
					{#each LEVELS.slice(1) as l (l.n)}
						<label class="field">
							Level {l.n} · {l.name}
							<input maxlength="80" bind:value={rewards[String(l.n)]} />
						</label>
					{/each}
					<button class="btn" type="submit" disabled={busy}>Belohnungen speichern</button>
				</form>
			</section>
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
	.lvl {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.badge {
		display: inline-grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--gelb);
		color: #141619;
		font: 700 24px var(--font-body);
		flex: none;
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
	.bar i.gelb {
		background: var(--gelb);
	}
	.list,
	.board {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.list li,
	.board li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.what {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.board .pl {
		width: 24px;
		font-weight: 700;
		color: var(--muted);
	}
	.board .pt {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.board li.mine strong {
		color: var(--akzent);
	}
	.gold {
		color: #d4a62a;
	}
	h3 {
		margin: 8px 0 0;
		font-size: 15px;
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
	.rewards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 10px;
		align-items: end;
	}
</style>
