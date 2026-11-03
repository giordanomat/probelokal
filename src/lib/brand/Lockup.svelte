<!-- Zeichen + Wortmarke »Probelokal« (Marke seit 27.10.2026), mit echter Schrift statt Pfaden,
     damit die Farben der Darstellung folgen. Vektorfassungen der Lockups liegen bei Matthias (Drive). -->
<script lang="ts">
	import Mark from './Mark.svelte';
	let { sub = 'Arrangements × Übungssuite' }: { sub?: string } = $props();
</script>

<div class="lockup" role="img" aria-label="Probelokal">
	<Mark class="mark" />
	<p aria-hidden="true"><b>Probelokal</b><span>{sub}</span></p>
</div>

<style>
	.lockup {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lockup :global(.mark) {
		width: 40px;
		height: 40px;
		flex: none;
	}
	p {
		margin: 0;
	}
	b {
		display: block;
		font-weight: 700;
		font-size: 21px;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	span {
		display: block;
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: 9.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--marke-sub);
		margin-top: 4px;
	}
</style>
