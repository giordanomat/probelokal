<script lang="ts">
	// Konto: Name, eigene Guuggen, neue Guugge anlegen, abmelden.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, signOut, watchAuth } from '#lib/account/auth.svelte.ts';
	import {
		createGuugge,
		myAccount,
		ROLE_LABELS,
		setMyName,
		type MyAccount
	} from '#lib/account/api.ts';
	import { deviceStore, hasPendingInvite } from '#lib/account/invite.ts';
	import { BAD_TOUCH_VOICES } from '#lib/titles/bad-touch-voices.ts';

	const sb = getSupabase();

	let account = $state<MyAccount | null>(null);
	let name = $state('');
	let newGuugge = $state('');
	let busy = $state(false);
	let error = $state('');
	let saved = $state(false);

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

{#if !sb}
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

		{#if error}
			<p class="err" role="alert">{error}</p>
		{/if}
	</div>
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
	.small {
		min-height: 36px;
		margin-left: 6px;
		font-size: 14px;
	}
</style>
