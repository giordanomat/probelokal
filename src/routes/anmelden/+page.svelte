<script lang="ts">
	// Anmelden mit Code aus der E-Mail; der Link aus der Mail landet ebenfalls hier
	// (?token_hash=…). Warum Code vor Link: src/lib/account/auth.svelte.ts.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, sendCode, verifyCode, verifyLink, watchAuth } from '#lib/account/auth.svelte.ts';
	import { deviceStore, hasPendingInvite, safeNext } from '#lib/account/invite.ts';

	const sb = getSupabase();

	let step = $state<'email' | 'code'>('email');
	let email = $state('');
	let code = $state('');
	let busy = $state(false);
	let error = $state('');

	function target(): string {
		return hasPendingInvite(deviceStore())
			? '/einladung'
			: safeNext(page.url.searchParams.get('next'));
	}

	onMount(() => {
		watchAuth(sb);
		const tokenHash = page.url.searchParams.get('token_hash');
		if (tokenHash && sb) {
			busy = true;
			verifyLink(sb, tokenHash, page.url.searchParams.get('type'))
				.catch((e: Error) => (error = e.message))
				.finally(() => (busy = false));
		}
	});

	// Angemeldet (per Code, Link oder schon vorher): weiter
	$effect(() => {
		if (auth.ready && auth.user) {
			// Ziel ist ein App-Pfad, geprüft von safeNext
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			void goto(target(), { replaceState: true });
		}
	});

	async function send(e: SubmitEvent) {
		e.preventDefault();
		if (!sb || busy) return;
		busy = true;
		error = '';
		try {
			await sendCode(sb, email, `${location.origin}/anmelden`);
			step = 'code';
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}

	async function verify(e: SubmitEvent) {
		e.preventDefault();
		if (!sb || busy) return;
		busy = true;
		error = '';
		try {
			await verifyCode(sb, email, code);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Anmelden · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="card">
	<p class="label">Anmelden</p>
	{#if !sb}
		<h1>Hier gibt es noch keine Konten.</h1>
		<p><a class="go" href={resolve('/ueben')}>Zum Üben ohne Konto →</a></p>
	{:else if auth.user}
		<h1>Du bist angemeldet.</h1>
		<p>Einen Moment …</p>
	{:else if step === 'email'}
		<h1>Hoi! Wie heisst deine E-Mail?</h1>
		<p>Wir schicken dir einen Code. Ein Passwort brauchst du nicht.</p>
		<form class="form" onsubmit={send}>
			<label class="field">
				E-Mail
				<input
					type="email"
					name="email"
					autocomplete="email"
					autocapitalize="off"
					spellcheck="false"
					required
					bind:value={email}
				/>
			</label>
			<button class="btn" type="submit" disabled={busy}>Code schicken</button>
		</form>
	{:else}
		<h1>Schau in deine Mails.</h1>
		<p>
			Wir haben dir einen Code an <strong>{email}</strong> geschickt. Tipp ihn hier ein. Das klappt auch,
			wenn du die Mail auf einem anderen Gerät liest.
		</p>
		<form class="form" onsubmit={verify}>
			<label class="field">
				Code
				<input
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern={'[0-9 ]{6,12}'}
					required
					bind:value={code}
				/>
			</label>
			<button class="btn" type="submit" disabled={busy}>Anmelden</button>
		</form>
		<p class="hint">
			Keine Mail da? Schau im Spam-Ordner nach oder
			<button class="linkish" type="button" onclick={() => ((step = 'email'), (code = ''))}
				>gib die Adresse nochmals ein</button
			>.
		</p>
	{/if}
	{#if error}
		<p class="err" role="alert">{error}</p>
	{/if}
</section>

<style>
	.linkish {
		appearance: none;
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		color: var(--akzent);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
