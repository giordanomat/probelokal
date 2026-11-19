<script lang="ts">
	// Konto: Name, eigene Guuggen, neue Guugge anlegen, abmelden, Konto löschen (Entwurf Matthias
	// 18.11.2026: unten als eigene Karte, Blatt mit »weg« und »bleibt«, Bestätigen mit »löschen«).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, deleteAccount, signOut, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		confirmsDeletion,
		createGuugge,
		DELETE_WORD,
		myAccount,
		myAccountDeletion,
		ROLE_LABELS,
		setMyName,
		type AccountDeletion,
		type MyAccount
	} from '#lib/account/api.ts';
	import Sheet from '#lib/ui/Sheet.svelte';
	import DangerConfirm from '#lib/ui/DangerConfirm.svelte';
	import FeedbackSheet from '#lib/feedback/FeedbackSheet.svelte';
	import { deviceStore, hasPendingInvite } from '#lib/account/invite.ts';
	import { BAD_TOUCH_VOICES } from '#lib/titles/bad-touch-voices.ts';

	const sb = getSupabase();

	let account = $state<MyAccount | null>(null);
	let name = $state('');
	let newGuugge = $state('');
	let busy = $state(false);
	let error = $state('');
	let saved = $state(false);
	/** Nach dem Auflösen einer Guugge: ihr Name, für eine kurze Meldung */
	const dissolved = $derived(page.url.searchParams.get('aufgeloest'));

	// Konto löschen
	let delOpen = $state(false);
	let delInfo = $state<AccountDeletion | null>(null);
	let delError = $state('');
	let deleted = $state(false);
	let feedbackOpen = $state(false);
	const blocked = $derived(!!delInfo?.blocking.length || !!delInfo?.licensed?.length);

	const voiceName = (id: string | null) =>
		BAD_TOUCH_VOICES.find((v) => v.id === id)?.name ?? 'noch keine Stimme';

	onMount(() => watchAuth(sb));

	$effect(() => {
		if (!sb || !auth.user) return;
		if (hasPendingInvite(deviceStore())) {
			void goto(resolve('/einladung'), { replaceState: true });
			return;
		}
		void load();
	});

	async function load() {
		if (!sb) return;
		error = '';
		try {
			account = await myAccount(sb);
			name = account.display_name;
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		error = '';
		saved = false;
		try {
			await action();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function saveName(e: SubmitEvent) {
		e.preventDefault();
		void run(async () => {
			await setMyName(sb!, name);
			await load();
			saved = true;
		});
	}

	function create(e: SubmitEvent) {
		e.preventDefault();
		void run(async () => {
			const id = await createGuugge(sb!, newGuugge);
			await goto(resolve('/guugge/[id]', { id }));
		});
	}

	async function openDelete() {
		delOpen = true;
		delInfo = null;
		delError = '';
		try {
			delInfo = await myAccountDeletion(sb!);
		} catch (e) {
			delError = (e as Error).message;
		}
	}

	async function removeAccount(typed: string) {
		if (busy || blocked || !confirmsDeletion(typed)) return;
		busy = true;
		delError = '';
		try {
			await deleteAccount(sb!, typed);
			delOpen = false;
			account = null;
			deleted = true;
		} catch (err) {
			delError = (err as Error).message;
		} finally {
			busy = false;
		}
	}

	function logout() {
		void run(async () => {
			await signOut(sb!);
			account = null;
		});
	}
</script>

<svelte:head>
	<title>Meine Guugge · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if deleted}
	<section class="card gone" data-testid="konto-geloescht">
		<h1>Dein Konto ist gelöscht.</h1>
		<p class="hint">
			Auch die Einstellungen und Baustellen auf diesem Gerät sind weg. Danke fürs Üben!
		</p>
		<!-- Die Startseite liefert src/hooks.server.ts aus, sie ist keine Route (daher ohne resolve) -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="btn ghost" href="/" data-sveltekit-reload>Zur Startseite</a>
		<p class="hint">Fragen? <a href="mailto:hallo@probelokal.ch">hallo@probelokal.ch</a></p>
	</section>
{:else if !sb}
	<section class="card">
		<p class="label">Meine Guugge</p>
		<h1>Hier gibt es noch keine Konten.</h1>
		<p><a class="go" href={resolve('/ueben')}>Zum Üben ohne Konto →</a></p>
	</section>
{:else if !auth.ready}
	<p class="hint">Einen Moment …</p>
{:else if !auth.user}
	<section class="card">
		<p class="label">Meine Guugge</p>
		<h1>Melde dich an.</h1>
		<p>Mit einem Konto bist du in deiner Guugge dabei: Stimme, Hinweise der Leitung, Plan.</p>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
		<p class="hint">Üben geht auch ohne Konto.</p>
	</section>
{:else}
	<div class="stack">
		{#if dissolved}<p class="ok" role="status">»{dissolved}« ist aufgelöst.</p>{/if}
		<section class="card">
			<p class="label">Meine Guuggen</p>
			{#if account === null}
				<p class="hint">Einen Moment …</p>
			{:else if account.guuggen.length === 0}
				<h1>Noch in keiner Guugge.</h1>
				<p>
					Hast du einen Einladungslink von deiner Leitung? Öffne ihn einfach, dann bist du dabei.
				</p>
			{:else}
				<ul class="list">
					{#each account.guuggen as g (g.id)}
						<li>
							<a href={resolve('/guugge/[id]', { id: g.id })}>
								<strong>{g.name}</strong>
								<span class="hint">{ROLE_LABELS[g.role]} · {voiceName(g.voice)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="card">
			<h2>Neue Guugge anlegen</h2>
			<p class="hint">Du bist dann die Leitung und kannst die anderen per Link einladen.</p>
			<form class="form" onsubmit={create}>
				<label class="field">
					Name der Guugge
					<input name="guugge" maxlength="60" required bind:value={newGuugge} />
				</label>
				<button class="btn" type="submit" disabled={busy}>Anlegen</button>
			</form>
		</section>

		<section class="card">
			<h2>Dein Name</h2>
			<p class="hint">So sehen dich die anderen in deiner Guugge.</p>
			<form class="form" onsubmit={saveName}>
				<label class="field">
					Name
					<input name="name" maxlength="40" autocomplete="nickname" bind:value={name} />
				</label>
				<button class="btn ghost" type="submit" disabled={busy}>Speichern</button>
			</form>
			{#if saved}<p class="ok" role="status">Gespeichert.</p>{/if}
			<p class="hint">
				Angemeldet als {auth.user.email}.
				<button class="btn ghost small" type="button" onclick={logout} disabled={busy}
					>Abmelden</button
				>
			</p>
		</section>

		<section class="card">
			<div class="acc">
				<div>
					<h2>Rückmeldung</h2>
					<p class="hint">Fehler, Idee oder Lob – direkt an Matthias und Hans</p>
				</div>
				<button
					type="button"
					class="linkgo"
					aria-haspopup="dialog"
					onclick={() => (feedbackOpen = true)}>Schreiben →</button
				>
			</div>
		</section>

		<section class="card">
			<div class="acc">
				<div>
					<h2>Dein Konto</h2>
					<p class="hint">Konto und alle deine Daten löschen</p>
				</div>
				<button type="button" class="linkred" aria-haspopup="dialog" onclick={openDelete}
					>Löschen …</button
				>
			</div>
		</section>

		{#if error}
			<p class="err" role="alert">{error}</p>
		{/if}
	</div>

	<FeedbackSheet
		open={feedbackOpen}
		onclose={() => (feedbackOpen = false)}
		context={() => ({ page: 'Meine Guuggen' })}
	/>

	{#if delOpen}
		<Sheet open label="Konto löschen" onclose={() => (delOpen = false)}>
			{#if delInfo === null && !delError}
				<h2 class="del-h">Konto endgültig löschen?</h2>
				<p class="hint">Einen Moment …</p>
			{:else if delInfo}
				<DangerConfirm
					heading="Konto endgültig löschen?"
					gone={[
						'deine E-Mail-Adresse und Anmeldung',
						'dein Name, deine Stimmen, deine Mitgliedschaften',
						'Etappen, Punkte, Level und Übetage',
						'dein Platz in der Rangliste',
						...delInfo.alone.map((g) => `die Guugge »${g.name}« (du bist allein drin)`)
					]}
					stayTitle="Das bleibt für die anderen:"
					stay={[
						'Hinweise, die du als Leitung geschrieben hast (ohne deinen Namen)',
						'Guuggen mit anderen Mitgliedern'
					]}
					confirmLabel="Zum Bestätigen »{DELETE_WORD}« eintippen"
					matches={confirmsDeletion}
					action="Konto löschen"
					{busy}
					{blocked}
					oncancel={() => (delOpen = false)}
					onconfirm={removeAccount}
				>
					{#each delInfo.blocking as g (g.id)}
						<div class="warn">
							<strong>Zuerst die Leitung abgeben</strong>
							<p class="hint">
								In »{g.name}« bist du die einzige Leitung. Mach jemanden zur Leitung, sonst steht
								die Guugge ohne da.
							</p>
							<a class="go" href={resolve('/guugge/[id]', { id: g.id })}>Zu {g.name} →</a>
						</div>
					{/each}
					{#each delInfo.licensed ?? [] as g (g.id)}
						<div class="warn">
							<strong>Gekaufte Arrangements</strong>
							<p class="hint">
								»{g.name}« hat gekaufte Arrangements. Schreib uns an hallo@probelokal.ch, bevor du
								dein Konto löschst, damit der Kauf nicht verloren geht.
							</p>
						</div>
					{/each}
				</DangerConfirm>
			{/if}
			{#if delError}<p class="err" role="alert">{delError}</p>{/if}
		</Sheet>
	{/if}
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.list a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
		color: var(--ink);
		text-decoration: none;
	}
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
	.linkgo {
		appearance: none;
		border: 0;
		background: none;
		color: var(--gelb);
		font: 700 15px var(--font-body);
		min-height: 44px;
		padding: 0 4px;
		cursor: pointer;
		white-space: nowrap;
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
	.gone {
		text-align: center;
		align-items: center;
		gap: 10px;
	}
	.del-h {
		margin: 4px 0 8px;
		font-size: 21px;
	}
	.warn {
		border: 2px solid var(--gelb);
		border-radius: 14px;
		padding: 10px 12px;
		margin-bottom: 10px;
	}
	.warn .hint {
		margin: 4px 0 6px;
	}
	.go {
		color: var(--ink);
		font-weight: 700;
	}
	.gone .btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		padding: 0 22px;
	}
	.small {
		min-height: 36px;
		margin-left: 6px;
		font-size: 14px;
	}
</style>
