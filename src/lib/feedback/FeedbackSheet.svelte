<!-- Blatt »Rückmeldung« (Entwurf Matthias 19.11.2026): Fehler, Idee oder Lob an Matthias und Hans.
     Lädt Supabase erst beim Öffnen (wie »Stück üben« ohne Konto schlank bleibt). Nur mit Konto. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Sheet from '../ui/Sheet.svelte';
	import { accountLoader, type AccountApi } from '../account/lazy.ts';
	import {
		contextLine,
		deviceLabel,
		FEEDBACK_KINDS,
		type FeedbackContext,
		type FeedbackKind
	} from './feedback.ts';

	let {
		open,
		onclose,
		context
	}: {
		open: boolean;
		onclose: () => void;
		/** Wo man gerade ist (ohne Gerät), beim Öffnen gelesen */
		context: () => Omit<FeedbackContext, 'device'>;
	} = $props();

	const load = accountLoader();
	let account = $state<AccountApi | null | undefined>(undefined);
	let kind = $state<FeedbackKind>('fehler');
	let body = $state('');
	let withContext = $state(true);
	let replyOk = $state(false);
	let busy = $state(false);
	let error = $state('');
	let sent = $state(false);

	const ctx = $derived<FeedbackContext | null>(
		open
			? {
					...context(),
					device: typeof navigator === 'undefined' ? 'unbekannt' : deviceLabel(navigator.userAgent)
				}
			: null
	);

	$effect(() => {
		if (open && account === undefined) {
			load()
				.then((a) => (account = a))
				.catch(() => (account = null));
		}
	});

	async function send(e: SubmitEvent) {
		e.preventDefault();
		if (!account || busy || !body.trim()) return;
		busy = true;
		error = '';
		try {
			await account.api.sendFeedback(account.sb, kind, body, withContext ? ctx : null, replyOk);
			sent = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}

	function again() {
		sent = false;
		body = '';
		kind = 'fehler';
	}
</script>

<Sheet {open} label="Rückmeldung" {onclose}>
	{#if sent}
		<div class="done" role="status">
			<p class="big" aria-hidden="true">🙏</p>
			<h2>Danke! Wir lesen alles.</h2>
			<p class="hint">
				{replyOk
					? 'Wir melden uns per Mail bei dir.'
					: 'Wenn du eine Antwort möchtest, kreuz beim nächsten Mal »antworten« an.'}
			</p>
			<button type="button" class="btn ghost" onclick={again}>Noch etwas melden</button>
		</div>
	{:else if account === undefined}
		<p class="hint">Einen Moment …</p>
	{:else if account === null}
		<h2>Melde dich an</h2>
		<p class="hint">Rückmeldungen gehen nur mit Konto, damit wir bei Fragen nachhaken können.</p>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	{:else}
		<h2>Was ist dir aufgefallen?</h2>
		<div class="chips" role="group" aria-label="Art der Rückmeldung">
			{#each FEEDBACK_KINDS as k (k.id)}
				<button type="button" aria-pressed={kind === k.id} onclick={() => (kind = k.id)}
					>{k.label}</button
				>
			{/each}
		</div>
		<form onsubmit={send}>
			<label class="field">
				<span class="sr">Deine Rückmeldung</span>
				<textarea
					bind:value={body}
					maxlength="2000"
					rows="5"
					placeholder={kind === 'fehler'
						? 'Was ist passiert? Was hast du erwartet?'
						: kind === 'idee'
							? 'Was würde dir helfen?'
							: 'Was gefällt dir?'}></textarea>
			</label>
			<label class="chk">
				<input type="checkbox" bind:checked={withContext} />
				<span
					>Wo ich gerade war und welches Gerät mitschicken
					{#if ctx}<small>{contextLine(ctx)}</small>{/if}</span
				>
			</label>
			<label class="chk">
				<input type="checkbox" bind:checked={replyOk} />
				<span>Ihr dürft mir per Mail antworten</span>
			</label>
			<button class="btn send" type="submit" disabled={busy || !body.trim()}>Schicken</button>
		</form>
		<p class="hint">Geht nur an Matthias und Hans, nicht an deine Leitung.</p>
		{#if error}<p class="err" role="alert">{error}</p>{/if}
	{/if}
</Sheet>

<style>
	h2 {
		margin: 4px 0 10px;
		font-size: 21px;
	}
	.chips {
		display: flex;
		gap: 6px;
	}
	.chips button {
		flex: 1;
		appearance: none;
		border: 1px solid var(--line);
		background: none;
		color: var(--ink);
		border-radius: 999px;
		min-height: 40px;
		font: 600 15px var(--font-body);
		cursor: pointer;
	}
	.chips button[aria-pressed='true'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
		border-color: var(--chip-on-bg);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 10px;
	}
	form .field {
		flex: none;
	}
	textarea {
		font: 400 16px/1.4 var(--font-body);
		color: var(--ink);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 10px 12px;
		resize: vertical;
		min-height: 110px;
	}
	.chk {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 14px;
		cursor: pointer;
	}
	.chk input {
		flex: none;
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--gelb);
	}
	.chk small {
		display: block;
		color: var(--muted);
		font-size: 12px;
		margin-top: 2px;
	}
	.btn.send {
		min-height: 48px;
		background: var(--gelb);
		color: #141619;
	}
	.btn.send:disabled {
		opacity: 0.5;
	}
	.done {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 0;
	}
	.big {
		font-size: 44px;
		margin: 0;
	}
</style>
