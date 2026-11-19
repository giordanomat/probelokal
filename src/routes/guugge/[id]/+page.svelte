<script lang="ts">
	// Eine Guugge: eigene Stimme, Rangliste mitmachen, Mitglieder. Für die Leitung zusätzlich:
	// einladen, Rollen, Mitglieder entfernen, Rangliste ein/aus, Guugge auflösen (Entwurf Matthias
	// 18.11.2026). Was erlaubt ist, prüft die
	// Datenbank (supabase/migrations/20261028150000); die Oberfläche blendet nur aus.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		createInvite,
		dissolveGuugge,
		guuggeMembers,
		listHints,
		myAccount,
		namesMatch,
		removeMember,
		revokeInvites,
		ROLE_LABELS,
		setMemberRole,
		setMyVoice,
		type Member,
		type MyGuugge,
		type Role
	} from '#lib/account/api.ts';
	import { inviteUrl } from '#lib/account/invite.ts';
	import { BAD_TOUCH_SLUG, BAD_TOUCH_VOICES } from '#lib/titles/bad-touch-voices.ts';
	import { voiceQuery } from '#lib/practice/prefs.ts';
	import { hintsFor } from '#lib/hints/hints.ts';
	import { watchHints } from '#lib/hints/live.ts';
	import Sheet from '#lib/ui/Sheet.svelte';
	import DangerConfirm from '#lib/ui/DangerConfirm.svelte';

	const sb = getSupabase();
	const ROLES: Role[] = ['mitglied', 'registerchef', 'leitung'];

	let me = $state<MyGuugge | null>(null);
	let missing = $state(false);
	let members = $state<Member[]>([]);
	/** Neue Hinweise der Leitung für die eigene Stimme */
	let newHints = $state(0);
	let hintIds = new Set<string>();
	let inviteRole = $state<Role>('mitglied');
	let link = $state('');
	let copied = $state(false);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let dissolveOpen = $state(false);
	let dissolveError = $state('');

	const id = $derived(page.params.id ?? '');
	const leitung = $derived(me?.role === 'leitung');
	const voiceShort = (v: string | null) => BAD_TOUCH_VOICES.find((x) => x.id === v)?.short ?? '–';

	onMount(() => watchAuth(sb));

	$effect(() => {
		if (sb && auth.user && id) void load();
	});

	// Neue oder gelöschte Hinweise ohne Neuladen (Realtime)
	const joined = $derived(!!me);
	$effect(() => {
		if (!sb || !joined || !id) return;
		return watchHints(sb, [id], { onChange: () => void load(), has: (h) => hintIds.has(h) });
	});

	async function load() {
		if (!sb) return;
		try {
			const acc = await myAccount(sb);
			me = acc.guuggen.find((g) => g.id === id) ?? null;
			missing = !me;
			members = me ? await guuggeMembers(sb, id) : [];
			if (me) {
				const v = BAD_TOUCH_VOICES.find((x) => x.id === me?.voice) ?? null;
				const hs = await listHints(sb, id, BAD_TOUCH_SLUG);
				hintIds = new Set(hs.map((h) => h.id));
				newHints = hintsFor(hs, v).filter((h) => !h.is_read).length;
			}
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function run(action: () => Promise<void>, done = '') {
		if (busy || !sb) return;
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

	const chooseVoice = (v: string) => run(() => setMyVoice(sb!, id, v), 'Stimme gespeichert.');
	const changeRole = (user: string, role: Role) =>
		run(() => setMemberRole(sb!, id, user, role), 'Rolle geändert.');

	function invite() {
		void run(async () => {
			link = inviteUrl(location.origin, await createInvite(sb!, id, inviteRole));
			copied = false;
		});
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
		} catch {
			// Zwischenablage gesperrt: Link steht markierbar im Feld
		}
	}

	async function share() {
		try {
			await navigator.share({ title: `Einladung: ${me?.name ?? 'Guugge'}`, url: link });
		} catch {
			// abgebrochen oder nicht unterstützt
		}
	}

	function revoke() {
		if (!confirm('Alle offenen Einladungslinks zurückziehen? Wer schon dabei ist, bleibt dabei.'))
			return;
		void run(async () => {
			await revokeInvites(sb!, id);
			link = '';
		}, 'Alle Einladungslinks gelten nicht mehr.');
	}

	async function dissolve(typed: string) {
		if (busy || !me) return;
		busy = true;
		dissolveError = '';
		const name = me.name;
		try {
			await dissolveGuugge(sb!, id, typed);
			dissolveOpen = false;
			await goto(resolve(`/guugge?aufgeloest=${encodeURIComponent(name)}`));
		} catch (e) {
			dissolveError = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function remove(m: Member) {
		const self = m.user_id === auth.user?.id;
		// Austritt löscht Etappen und Punkte in dieser Guugge (Entscheid Matthias 18.11.2026)
		const text = self
			? `Aus »${me?.name}« austreten? Deine Etappen und Punkte in dieser Guugge werden gelöscht.`
			: `${m.display_name || 'Diese Person'} aus der Guugge entfernen? Etappen und Punkte dieser Person in der Guugge werden gelöscht.`;
		if (!confirm(text)) return;
		void run(async () => {
			await removeMember(sb!, id, m.user_id);
			if (self) await goto(resolve('/guugge'));
		});
	}
</script>

<svelte:head>
	<title>{me?.name ?? 'Guugge'} · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<p><a class="back" href={resolve('/guugge')}>← Meine Guuggen</a></p>

{#if !sb || (auth.ready && !auth.user)}
	<section class="card">
		<h1>Melde dich an.</h1>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	</section>
{:else if missing}
	<section class="card">
		<h1>Diese Guugge findest du hier nicht.</h1>
		<p>Vielleicht hat die Leitung sie aufgelöst, oder du bist nicht (mehr) dabei.</p>
		<p><a class="go" href={resolve('/guugge')}>Zu meinen Guuggen →</a></p>
	</section>
{:else if !me}
	<p class="hint">Einen Moment …</p>
{:else}
	<div class="stack">
		<section class="card">
			<p class="label">{ROLE_LABELS[me.role]}</p>
			<h1>{me.name}</h1>
		</section>

		{#if notice}<p class="ok" role="status">{notice}</p>{/if}
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		<section class="card">
			<h2>Bad Touch 2.0</h2>
			<p class="hint">Üben mit der Band, Gesamtplan der Leitung und dein Stand pro Teil.</p>
			<p class="golinks">
				<a class="go" href="{resolve('/ueben')}{voiceQuery(me.voice)}">Stück üben →</a>
				<a class="go" href={resolve('/aufwaermen')}>Aufwärmen →</a>
				<a class="go" href={resolve('/guugge/[id]/plan', { id })}>Plan ansehen →</a>
			</p>
		</section>

		<section class="card">
			<h2>Deine Stimme</h2>
			<div class="seg" role="group" aria-label="Deine Stimme">
				{#each BAD_TOUCH_VOICES as v (v.id)}
					<button
						type="button"
						aria-pressed={me.voice === v.id}
						disabled={busy}
						onclick={() => chooseVoice(v.id)}>{v.name}</button
					>
				{/each}
			</div>
			{#if !me.voice}
				<p class="hint">Wähl deine Stimme, dann passen Plan und Hinweise zu dir.</p>
			{/if}
		</section>

		<section class="card">
			<h2>
				Hinweise der Leitung{#if newHints}<span class="new">{newHints} neu</span>{/if}
			</h2>
			<p class="hint">
				Dynamik, Atemstellen und Hinweise zu bestimmten Takten. Sie erscheinen auch auf der Bahn und
				in den Noten.
			</p>
			<p><a class="go" href={resolve('/guugge/[id]/hinweise', { id })}>Hinweise ansehen →</a></p>
		</section>

		<section class="card">
			<h2>Punkte und Rangliste</h2>
			<p class="hint">
				Dein Rang, die Belohnungen und die freiwillige Rangliste (Standard: aus).
				{#if leitung}Hier schaltest du die Rangliste ein und legst Belohnungen fest.{/if}
			</p>
			<p>
				<a class="go" href={resolve('/guugge/[id]/rangliste', { id })}>Punkte und Rangliste →</a>
			</p>
		</section>

		{#if leitung}
			<section class="card">
				<h2>Einladen</h2>
				<p class="hint">
					Ein Link für alle: Er gilt 14 Tage und für beliebig viele Personen. Schick ihn in den
					Gruppenchat.
				</p>
				<div class="form">
					<label class="field">
						Rolle
						<select bind:value={inviteRole}>
							{#each ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
						</select>
					</label>
					<button class="btn" type="button" onclick={invite} disabled={busy}
						>Einladungslink erstellen</button
					>
				</div>
				{#if link}
					<label class="field">
						Einladungslink
						<input readonly value={link} onfocus={(e) => e.currentTarget.select()} />
					</label>
					<div class="row">
						<button class="btn ghost" type="button" onclick={copy}>Kopieren</button>
						{#if typeof navigator !== 'undefined' && 'share' in navigator}
							<button class="btn ghost" type="button" onclick={share}>Teilen</button>
						{/if}
						{#if copied}<span class="ok" role="status">Kopiert.</span>{/if}
					</div>
				{/if}
				<p>
					<button class="btn ghost" type="button" onclick={revoke} disabled={busy}
						>Alle Einladungslinks zurückziehen</button
					>
				</p>
			</section>
		{/if}

		<section class="card">
			<h2>Mitglieder</h2>
			<ul class="members">
				{#each members as m (m.user_id)}
					<li>
						<span class="who">
							<strong
								>{m.display_name || 'Ohne Namen'}{#if m.user_id === auth.user?.id}
									<span class="you">(du)</span>{/if}</strong
							>
							<span class="hint">{voiceShort(m.voice)}</span>
						</span>
						{#if leitung}
							<select
								aria-label="Rolle von {m.display_name || 'Ohne Namen'}"
								value={m.role}
								disabled={busy}
								onchange={(e) => changeRole(m.user_id, e.currentTarget.value as Role)}
							>
								{#each ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
							</select>
							{#if m.user_id !== auth.user?.id}
								<button
									class="mini"
									type="button"
									aria-label="{m.display_name || 'Ohne Namen'} entfernen"
									disabled={busy}
									onclick={() => remove(m)}>✕</button
								>
							{/if}
						{:else}
							<span class="hint">{ROLE_LABELS[m.role]}</span>
						{/if}
					</li>
				{/each}
			</ul>
			{#if me && auth.user}
				<p>
					<button
						class="btn ghost"
						type="button"
						disabled={busy}
						onclick={() =>
							remove({
								user_id: auth.user!.id,
								display_name: '',
								role: me!.role,
								voice: me!.voice
							})}>Austreten</button
					>
				</p>
			{/if}
		</section>

		{#if leitung}
			<section class="card">
				<div class="acc">
					<div>
						<h2>Guugge auflösen</h2>
						<p class="hint">Für alle Mitglieder, nicht rückgängig</p>
					</div>
					<button
						type="button"
						class="linkred"
						aria-haspopup="dialog"
						onclick={() => {
							dissolveError = '';
							dissolveOpen = true;
						}}>Auflösen …</button
					>
				</div>
			</section>
		{/if}
	</div>

	{#if dissolveOpen && me}
		<Sheet open label="Guugge auflösen" onclose={() => (dissolveOpen = false)}>
			<DangerConfirm
				heading="»{me.name}« auflösen?"
				goneTitle="Das ist danach für alle weg:"
				gone={[
					`die Guugge für ${members.length === 1 ? 'dich' : `alle ${members.length} Mitglieder`}`,
					'Gesamtplan und Hinweise der Leitung',
					'Etappen und Punkte aller in dieser Guugge',
					'Rangliste, Belohnungen, Einladungslinks'
				]}
				stay={['die Konten der Mitglieder, ihre anderen Guuggen und Übetage']}
				confirmLabel="Zum Bestätigen den Namen eintippen"
				matches={(t) => namesMatch(t, me!.name)}
				action="Guugge auflösen"
				{busy}
				oncancel={() => (dissolveOpen = false)}
				onconfirm={dissolve}
			/>
			{#if dissolveError}<p class="err" role="alert">{dissolveError}</p>{/if}
		</Sheet>
	{/if}
{/if}

{#if error && !me}<p class="err" role="alert">{error}</p>{/if}

<style>
	.acc {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.acc h2 {
		margin: 0;
		font-size: 17px;
	}
	.acc .hint {
		margin: 2px 0 0;
	}
	.linkred {
		appearance: none;
		border: 0;
		background: none;
		color: var(--rot);
		font: 700 15px var(--font-body);
		min-height: 44px;
		padding: 0 4px;
		cursor: pointer;
		white-space: nowrap;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.new {
		display: inline-block;
		margin-left: 8px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--gelb);
		color: #141619;
		font-size: 13px;
		vertical-align: middle;
	}
	.you {
		color: var(--muted);
		font-weight: 600;
	}
	.back {
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
	}
	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.members li {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.who {
		display: flex;
		flex-direction: column;
		flex: 1 1 140px;
		min-width: 0;
	}
</style>
