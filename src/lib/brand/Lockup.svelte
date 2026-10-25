<!-- Zeichen + »giordanomat PROBELOKAL«, wie im Prototyp mit echter Schrift statt Pfaden,
     damit die Farben der Darstellung folgen. Vektorfassungen der Lockups liegen bei Matthias (Drive). -->
<script lang="ts">
	let { area = 'PROBELOKAL' }: { area?: string } = $props();
</script>

<div class="lockup" role="img" aria-label="giordanomat {area}">
	<svg viewBox="0 0 200 200" aria-hidden="true">
		<circle cx="100" cy="100" r="100" fill="#141619" />
		<circle cx="100" cy="100" r="97" fill="none" stroke="var(--disc-ring)" stroke-width="3" />
		<rect x="40" y="54" width="92" height="26" rx="13" fill="#F5C242" />
		<rect x="68" y="88" width="94" height="26" rx="13" fill="#E0473C" />
		<rect x="38" y="122" width="114" height="26" rx="13" fill="#6EACDA" />
	</svg>
	<p aria-hidden="true"><b>giordanomat</b><span>{area}</span></p>
</div>

<style>
	.lockup {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	svg {
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
		letter-spacing: 0.42em;
		color: var(--akzent);
		margin-top: 4px;
	}
</style>
