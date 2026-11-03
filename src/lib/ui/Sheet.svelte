<script lang="ts">
	// Blatt von unten (Handy) bzw. Fenster in der Mitte (breit): natives <dialog> mit showModal, damit
	// Fokus, Esc und Screenreader ohne eigenen Code stimmen. Antippen daneben schliesst.
	import type { Snippet } from 'svelte';

	let {
		open,
		label,
		onclose,
		children
	}: { open: boolean; label: string; onclose: () => void; children: Snippet } = $props();

	let dlg: HTMLDialogElement;

	$effect(() => {
		if (open && !dlg.open) dlg.showModal();
		else if (!open && dlg.open) dlg.close();
	});
</script>

<!-- Klick auf den Rand (das dialog-Element selbst, nicht der Inhalt) schliesst; Esc macht der Browser. -->
<dialog
	bind:this={dlg}
	aria-label={label}
	{onclose}
	onclick={(e) => {
		if (e.target === dlg) dlg.close();
	}}
>
	<div class="body">
		<div class="head">
			<p class="label">{label}</p>
			<button type="button" class="mini" onclick={() => dlg.close()}>Fertig</button>
		</div>
		{@render children()}
	</div>
</dialog>

<style>
	dialog {
		box-sizing: border-box;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		padding: 0;
		width: min(560px, 100vw);
		max-width: 100vw;
		max-height: min(86dvh, 760px);
		margin: auto auto 0;
		border-radius: 22px 22px 0 0;
		box-shadow: 0 -16px 40px rgb(0 0 0 / 0.45);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}
	@media (min-width: 700px) {
		dialog {
			margin: auto;
			border-radius: 22px;
		}
	}
	.body {
		padding: 12px max(18px, env(safe-area-inset-right, 0px))
			max(22px, env(safe-area-inset-bottom, 0px)) max(18px, env(safe-area-inset-left, 0px));
		overflow-y: auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.head .label {
		margin: 0;
	}
</style>
