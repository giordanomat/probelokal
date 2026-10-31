<script lang="ts">
	// Hinweise der Leitung für Bad Touch, portiert aus prototype/v7 (renderHints, saveHint).
	// Die Leitung trägt sie ein und löscht sie; alle sehen sie hier und in »Stück üben« auf der
	// Bahn und in den Noten. »neu«, bis die Person sie gelesen hat (»Hinhören« oder »Alle gelesen«).
	// Neue und gelöschte Hinweise erscheinen ohne Neuladen (#lib/hints/live.ts).
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		addHint,
		deleteHint,
		listHints,
		markHintsRead,
		myAccount,
		type MyGuugge
	} from '#lib/account/api.ts';
	import {
		barsLabel,
		bodyRequired,
		DYNAMICS,
		DYN_TEXT,
		HINT_BODY_MAX,
		HINT_KINDS,
		hintLong,
		hintsFor,
		targetLabel,
		type Hint,
		type HintKind
	} from '#lib/hints/hints.ts';
	import { watchHints } from '#lib/hints/live.ts';
	import { REGISTER_LABELS } from '#lib/music/registers.ts';
	import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';

	const sb = getSupabase();
	const title = BAD_TOUCH;

	let me = $state<MyGuugge | null>(null);
	let missing = $state(false);
	let hints = $state<Hint[]>([]);
	let onlyMine = $state(true);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	// Formular der Leitung
	let fFrom = $state(13);
	let fTo = $state(16);
	let fTarget = $state('alle');
	let fKind = $state<HintKind>('dyn');
	let fDyn = $state('mf');
	let fBody = $state('');

	const id = $derived(page.params.id ?? '');
	const leitung = $derived(me?.role === 'leitung');
	const voice = $derived(title.voices.find((v) => v.id === me?.voice) ?? null);
	const shown = $derived(onlyMine && voice ? hintsFor(hints, voice) : hints);
	const unread = $derived(shown.filter((h) => !h.is_read));

	onMount(() => watchAuth(sb));

	$effect(() => {
		if (sb && auth.user && id) void load();
	});

	const joined = $derived(!!me);
	$effect(() => {
		if (!sb || !joined || !id) return;
		return watchHints(sb, [id], {
			onChange: () => void load(),
			has: (h) => hints.some((x) => x.id === h)
		});
	});

	async function load() {
		if (!sb) return;
		try {
			const acc = await myAccount(sb);
			me = acc.guuggen.find((g) => g.id === id) ?? null;
			missing = !me;
			if (me) hints = await listHints(sb, id, title.slug);
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function run(action: () => Promise<unknown>, done = '') {
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

	function save(e: SubmitEvent) {
		e.preventDefault();
		void run(async () => {
			await addHint(sb!, id, title.slug, {
				from: Number(fFrom),
				to: Number(fTo),
				target: fTarget,
				kind: fKind,
				dyn: fKind === 'dyn' ? fDyn : null,
				body: fBody.trim() || null
			});
			fBody = '';
		}, 'Gespeichert. Alle, für die er gilt, sehen den Hinweis.');
	}

	function remove(h: Hint) {
		if (!confirm(`Hinweis ${barsLabel(h)} löschen?`)) return;
		void run(() => deleteHint(sb!, h.id), 'Hinweis gelöscht.');
	}

	/** Beim »Hinhören« als gelesen markieren; die Seite wechselt trotzdem gleich. */
	function hear(h: Hint) {
		if (sb && !h.is_read) void markHintsRead(sb, [h.id]).catch(() => {});
	}
</script>

<svelte:head>
	<title>Hinweise · giordanomat PROBELOKAL</title>
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
{:else if !me}
	<p class="hint">Einen Moment …</p>
{:else}
	<div class="stack">
		<section class="card">
			<p class="label">Hinweise der Leitung</p>
			<h1>{title.name}</h1>
			<p class="hint">
				Sie erscheinen auch in »Stück üben« auf der Bahn und in den Noten, bei allen, für die sie
				gelten.
			</p>
			{#if voice}
				<div class="seg" role="group" aria-label="Welche Hinweise">
					<button type="button" aria-pressed={onlyMine} onclick={() => (onlyMine = true)}
						>Für {voice.name}</button
					>
					<button type="button" aria-pressed={!onlyMine} onclick={() => (onlyMine = false)}
						>Alle</button
					>
				</div>
			{/if}
		</section>

		{#if notice}<p class="ok" role="status">{notice}</p>{/if}
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		<section class="card">
			{#if shown.length}
				<ul class="list">
					{#each shown as h (h.id)}
						<li>
							<span class="what">
								<strong>
									{barsLabel(h)}{h.kind === 'dyn' ? ' · ' : ''}{#if h.kind === 'dyn'}<span
											class="dyn">{h.dyn}</span
										>{/if}
									{#if !h.is_read}<span class="new">neu</span>{/if}
								</strong>
								<span class="hint">{targetLabel(h.target, title.voices)} · {hintLong(h)}</span>
							</span>
							<span class="acts">
								<a
									class="btn ghost small"
									href="{resolve('/ueben')}?takt={h.bar_from}"
									onclick={() => hear(h)}>Hinhören</a
								>
								{#if leitung}
									<button
										type="button"
										class="mini"
										aria-label="Hinweis {barsLabel(h)} löschen"
										disabled={busy}
										onclick={() => remove(h)}>Löschen</button
									>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				{#if unread.length}
					<p>
						<button
							class="btn ghost"
							type="button"
							disabled={busy}
							onclick={() =>
								run(
									() =>
										markHintsRead(
											sb!,
											unread.map((h) => h.id)
										),
									'Alle als gelesen markiert.'
								)}>Alle gelesen</button
						>
					</p>
				{/if}
			{:else}
				<p class="hint">
					{onlyMine && voice ? `Noch keine Hinweise für ${voice.name}.` : 'Noch keine Hinweise.'}
				</p>
			{/if}
		</section>

		{#if leitung}
			<section class="card">
				<h2>Hinweis eintragen</h2>
				<form class="hintform" onsubmit={save}>
					<label class="field">
						Ab Takt
						<input type="number" min="1" max={title.bars - 1} required bind:value={fFrom} />
					</label>
					<label class="field">
						Bis Takt
						<input type="number" min="1" max={title.bars - 1} required bind:value={fTo} />
					</label>
					<label class="field">
						Für
						<select bind:value={fTarget}>
							<option value="alle">Alle</option>
							{#each Object.entries(REGISTER_LABELS) as [k, label] (k)}
								{#if k !== 'perc'}<option value={k}>{label}</option>{/if}
							{/each}
							{#each title.voices as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
						</select>
					</label>
					<label class="field">
						Art
						<select bind:value={fKind}>
							{#each Object.entries(HINT_KINDS) as [k, label] (k)}<option value={k}>{label}</option
								>{/each}
						</select>
					</label>
					{#if fKind === 'dyn'}
						<label class="field">
							Stärke
							<select bind:value={fDyn}>
								{#each DYNAMICS as d (d)}<option value={d}>{d} · {DYN_TEXT[d]}</option>{/each}
							</select>
						</label>
					{/if}
					<label class="field wide">
						Text{bodyRequired(fKind) ? '' : ' (freiwillig)'}
						<input
							maxlength={HINT_BODY_MAX}
							required={bodyRequired(fKind)}
							placeholder="z. B. Posaunen führen, Trompeten zurücknehmen"
							bind:value={fBody}
						/>
					</label>
					<button class="btn" type="submit" disabled={busy}>Hinweis speichern</button>
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
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}
	.what {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1 1 200px;
	}
	.dyn {
		font-style: italic;
	}
	.new {
		display: inline-block;
		margin-left: 6px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--gelb);
		color: #141619;
		font-size: 12px;
		font-weight: 700;
	}
	.acts {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.small {
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		font-size: 14px;
	}
	.hintform {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
		align-items: end;
	}
	.hintform .wide {
		grid-column: 1 / -1;
	}
</style>
