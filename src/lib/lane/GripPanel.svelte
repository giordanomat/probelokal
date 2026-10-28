<script lang="ts">
	// Griff-Anzeige neben der Bahn: grosser aktueller Griff, Ventile bzw. Zug, Schläge, nächster Griff.
	import type { PanelState } from './panel';

	let { state: s }: { state: PanelState } = $props();

	const SLIDE_X = (p: number) => 10 + (p - 1) * 36.6;
</script>

<aside class="panel" aria-live="off">
	<div class="now">
		<div class="kicker">{s.kicker}</div>
		<div class="big" data-testid="griff">{s.big}</div>
		<div class="sub">{s.sub}</div>
		{#if s.valves}
			<div class="valves" aria-hidden="true">
				{#each [1, 2, 3] as v (v)}
					<div class="valve" class:on={s.valves.includes(v)}>{v}</div>
				{/each}
			</div>
		{/if}
		{#if s.slide !== null}
			<svg class="slide" viewBox="0 0 240 46" aria-hidden="true">
				<line x1="10" y1="23" x2="230" y2="23" class="rail" />
				{#each [1, 2, 3, 4, 5, 6, 7] as p (p)}
					<line x1={SLIDE_X(p)} y1="15" x2={SLIDE_X(p)} y2="31" class="tick" />
					<text x={SLIDE_X(p)} y="44" class="num">{p}</text>
				{/each}
				{#if s.slide >= 1 && s.slide <= 7}
					<rect x={SLIDE_X(s.slide) - 9} y="8" width="18" height="30" rx="9" class="pos" />
					<text x={SLIDE_X(s.slide)} y="28" class="posnum">{s.slide}</text>
				{/if}
			</svg>
		{/if}
		{#if s.autoFingering}
			<p class="auto">Griff ergänzt, nicht aus den Noten</p>
		{/if}
	</div>
	<div>
		<p class="label">Takt</p>
		<div class="beats">
			{#each [0, 1, 2, 3] as b (b)}
				<span class="beat" class:one={b === 0} class:on={b === s.beatInBar}></span>
			{/each}
			<span class="count">{s.countIn ?? ''}</span>
		</div>
		<div class="next">{s.next}</div>
	</div>
</aside>

<style>
	.panel {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	@media (max-width: 760px) {
		.panel {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 12px 16px;
			padding: 14px;
		}
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.big {
		font-weight: 700;
		font-size: 30px;
		letter-spacing: -0.02em;
		line-height: 1.05;
		margin-top: 2px;
		min-height: 32px;
	}
	.sub,
	.next {
		font-size: 13.5px;
		color: var(--muted);
		min-height: 20px;
	}
	.next {
		margin-top: 8px;
	}
	.valves {
		display: flex;
		gap: 10px;
		margin-top: 10px;
	}
	.valve {
		flex: none;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		border: 2.5px solid var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		font: 700 17px var(--font-body);
		box-sizing: border-box;
		transition:
			background 0.08s,
			color 0.08s;
	}
	.valve.on {
		background: var(--ink);
		color: var(--bg);
	}
	.slide {
		margin-top: 12px;
		width: 100%;
		height: 46px;
		display: block;
	}
	.rail,
	.tick {
		stroke: var(--muted);
		stroke-width: 2;
	}
	.tick {
		stroke-width: 1.5;
	}
	.num {
		font: 500 10px var(--font-mono);
		fill: var(--muted);
		text-anchor: middle;
	}
	.pos {
		fill: var(--rot);
	}
	.posnum {
		font: 700 13px var(--font-body);
		fill: #fff;
		text-anchor: middle;
	}
	.auto {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--akzent);
	}
	.label {
		margin-bottom: 6px;
	}
	.beats {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.beat {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--line);
	}
	.beat.on {
		background: var(--rot);
	}
	.beat.one.on {
		background: var(--ink);
	}
	.count {
		font: 700 22px var(--font-body);
		min-width: 1.2em;
	}
</style>
