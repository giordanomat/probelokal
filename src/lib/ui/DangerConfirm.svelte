<!-- Bestätigen von etwas, das sich nicht rückgängig machen lässt (Konto löschen, Guugge auflösen;
     Entwürfe Matthias 18.11.2026): was weg ist, was bleibt, ein Wort eintippen, roter Knopf.
     Sperrhinweise (z. B. »Zuerst die Leitung abgeben«) kommen als Inhalt vor die Listen. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		heading,
		gone,
		goneTitle = 'Das ist danach weg:',
		stay,
		stayTitle = 'Das bleibt:',
		confirmLabel,
		matches,
		action,
		busy = false,
		blocked = false,
		oncancel,
		onconfirm,
		children
	}: {
		heading: string;
		gone: string[];
		goneTitle?: string;
		stay: string[];
		stayTitle?: string;
		/** z. B. »Zum Bestätigen »löschen« eintippen« */
		confirmLabel: string;
		/** stimmt das Eingetippte? */
		matches: (typed: string) => boolean;
		/** Text des roten Knopfs */
		action: string;
		busy?: boolean;
		/** gesperrt (Feld und Knopf aus) */
		blocked?: boolean;
		oncancel: () => void;
		onconfirm: (typed: string) => void;
		children?: Snippet;
	} = $props();

	let typed = $state('');
	const ok = $derived(!busy && !blocked && matches(typed));
</script>

<h2 class="dc-h">{heading}</h2>
{@render children?.()}
<p class="what">{goneTitle}</p>
<ul class="marks gone">
	{#each gone as g (g)}<li><i aria-hidden="true">×</i>{g}</li>{/each}
</ul>
<p class="what">{stayTitle}</p>
<ul class="marks stay">
	{#each stay as s (s)}<li><i aria-hidden="true">✓</i>{s}</li>{/each}
</ul>
<form
	class="dc-form"
	onsubmit={(e) => {
		e.preventDefault();
		if (ok) onconfirm(typed);
	}}
>
	<label class="field">
		{confirmLabel}
		<input
			bind:value={typed}
			disabled={blocked}
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
		/>
	</label>
	<div class="dc-btns">
		<button type="button" class="btn ghost" onclick={oncancel}>Abbrechen</button>
		<button type="submit" class="btn red" disabled={!ok}>{action}</button>
	</div>
</form>
<p class="hint">Das lässt sich nicht rückgängig machen.</p>

<style>
	.dc-h {
		margin: 4px 0 8px;
		font-size: 21px;
	}
	.what {
		margin: 10px 0 4px;
		font-weight: 700;
		font-size: 14px;
	}
	.marks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 15px;
	}
	.marks li {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}
	.marks i {
		flex: none;
		width: 18px;
		height: 18px;
		margin-top: 1px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-style: normal;
		font-size: 11px;
		font-weight: 800;
	}
	.gone i {
		background: var(--rot);
		color: #141619;
	}
	.stay i {
		border: 1px solid var(--line);
		color: var(--muted);
	}
	.dc-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 14px;
	}
	.dc-form .field {
		flex: none;
	}
	.dc-btns {
		display: flex;
		gap: 8px;
	}
	.dc-btns .btn {
		flex: 1;
		min-height: 48px;
	}
	.btn.red {
		background: var(--rot);
		color: #141619;
	}
	.btn.red:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
