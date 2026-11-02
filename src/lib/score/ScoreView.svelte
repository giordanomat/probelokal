<script lang="ts">
	// Notenansicht mit OpenSheetMusicDisplay (BSD-3), portiert aus prototype/v7 (initScore,
	// renderScore, highlight). Die Bibliothek wird erst geladen, wenn die Ansicht aufgeht.
	// Zeigt nur die gewählte Stimme; der aktuelle Takt ist markiert, Antippen springt dorthin.
	// Hinweise der Leitung liegen als gelbes Band über den Takten, wie auf der Bahn (lane/draw.ts).
	import { onMount } from 'svelte';
	import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
	import type { LaneHint } from '../lane/draw';
	import { bandSegments, barAt, scoreZoom, scrollToShow, type BarBox } from './boxes';

	let {
		xml,
		partId,
		bar,
		fingering,
		hints = [],
		onpick
	}: {
		xml: string;
		/** Part-ID in der MusicXML, z. B. 'P1' */
		partId: string;
		/** Aktueller Takt (ganzzahlig) */
		bar: number;
		/** Griffe und Zugpositionen (Liedtext) anzeigen */
		fingering: boolean;
		/** Hinweise der Leitung für die gewählte Stimme */
		hints?: readonly LaneHint[];
		onpick?: (bar: number) => void;
	} = $props();

	let box: HTMLDivElement;
	let host: HTMLDivElement;
	let osmd = $state.raw<OpenSheetMusicDisplay | null>(null);
	let error = $state('');
	let boxes = $state.raw<(BarBox | null)[]>([]);
	let width = $state(0);
	let theme = $state(0);
	/** Versatz der SVG im Container (zentriert) */
	let offsetX = $state(0);

	onMount(() => {
		const ro = new ResizeObserver(() => (width = box.clientWidth));
		ro.observe(box);
		const mo = new MutationObserver(() => theme++);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	});

	$effect(() => {
		const text = xml;
		let cancelled = false;
		(async () => {
			try {
				const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
				const o = new OpenSheetMusicDisplay(host, {
					autoResize: false,
					backend: 'svg',
					drawTitle: false,
					drawSubtitle: false,
					drawComposer: false,
					drawLyricist: false,
					drawCredits: false,
					drawPartNames: false,
					drawMeasureNumbers: true,
					measureNumberInterval: 1
				});
				await o.load(text);
				if (!cancelled) osmd = o;
			} catch (e) {
				if (!cancelled) error = 'Die Noten konnten nicht geladen werden. ' + String(e);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// Neu zeichnen bei Stimme, Griffen, Breite und Darstellung (dunkel/hell)
	$effect(() => {
		if (!osmd || !width) return;
		void theme;
		const o = osmd;
		const zoom = scoreZoom(width);
		const ink =
			getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#141619';
		o.zoom = zoom;
		for (const ins of o.Sheet.Instruments) ins.Visible = ins.IdString === partId;
		o.setOptions({
			defaultColorMusic: ink,
			defaultColorNotehead: ink,
			defaultColorStem: ink,
			defaultColorRest: ink,
			defaultColorLabel: ink,
			defaultColorTitle: ink,
			drawLyrics: fingering
		});
		o.render();
		// Einige Linien bleiben schwarz; im Dunkeln nachfärben
		const svg = host.querySelector('svg');
		if (svg) {
			for (const k of ['stroke', 'fill']) {
				for (const el of svg.querySelectorAll(`[${k}="#000000"],[${k}="black"],[${k}="#000"]`)) {
					el.setAttribute(k, ink);
				}
			}
			offsetX = svg.getBoundingClientRect().left - host.getBoundingClientRect().left;
		}
		const unit = 10 * zoom;
		boxes = o.GraphicSheet.MeasureList.map((row) => {
			const shown = row.filter((m) => m?.ParentStaff?.ParentInstrument?.Visible);
			if (!shown.length) return null;
			const top = shown[0].PositionAndShape;
			const bottom = shown[shown.length - 1].PositionAndShape;
			return {
				x: top.AbsolutePosition.x * unit,
				y: (top.AbsolutePosition.y - 2.5) * unit,
				w: top.Size.width * unit,
				h: (bottom.AbsolutePosition.y - top.AbsolutePosition.y + bottom.Size.height + 5) * unit
			};
		});
	});

	const current = $derived(boxes[bar] ?? null);
	/** Band über den Taktnummern, in der Lücke zur Zeile darüber */
	const BAND_LIFT = 12;
	const bands = $derived(
		hints.flatMap((h, i) =>
			bandSegments(boxes, h.from, h.to).map((s) => ({ ...s, key: `${i}-${s.x}-${s.y}`, h }))
		)
	);
	/** Höhe der Wiedergabeleiste unten (sticky), die die Noten überdeckt */
	const TRANSPORT_PX = 110;

	// Aktuellen Takt im Blick halten
	$effect(() => {
		if (!current) return;
		// Nur der Teil des Kastens zählt, der im Fenster über der Wiedergabeleiste liegt
		const visible = Math.min(
			box.clientHeight,
			Math.max(120, window.innerHeight - box.getBoundingClientRect().top - TRANSPORT_PX)
		);
		const top = scrollToShow(current, box.scrollTop, visible);
		if (top === null) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		box.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
	});

	function pick(e: MouseEvent) {
		const r = host.getBoundingClientRect();
		const i = barAt(boxes, e.clientX - r.left - offsetX, e.clientY - r.top);
		if (i >= 0) onpick?.(i);
	}
</script>

<div class="score" bind:this={box} data-testid="noten" data-bar={current ? bar : ''}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="host" bind:this={host} onclick={pick}></div>
	{#each bands as b (b.key)}
		<div
			class="band"
			class:first={b.first}
			style:left="{b.x + offsetX}px"
			style:top="{b.y - BAND_LIFT}px"
			style:width="{b.w}px"
		>
			{#if b.first && b.h.label}<span class:dyn={b.h.dyn} data-testid="noten-band">{b.h.label}</span
				>{/if}
		</div>
	{/each}
	{#if current}
		<div
			class="hl"
			style:left="{current.x + offsetX}px"
			style:top="{current.y}px"
			style:width="{current.w}px"
			style:height="{current.h}px"
		></div>
	{/if}
	{#if !osmd && !error}
		<p class="msg">Noten werden geladen …</p>
	{/if}
	{#if error}
		<p class="msg" role="alert">{error}</p>
	{/if}
</div>

<style>
	.score {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		max-height: 62vh;
		padding: 8px 4px 24px;
		overflow: auto;
		min-width: 0;
	}
	.host {
		cursor: pointer;
	}
	.hl {
		position: absolute;
		pointer-events: none;
		background: rgba(245, 194, 66, 0.26);
		border-bottom: 3px solid var(--rot);
		border-radius: 4px;
		transition:
			left 0.12s,
			top 0.12s,
			width 0.12s;
	}
	@media (prefers-reduced-motion: reduce) {
		.hl {
			transition: none;
		}
	}
	.band {
		position: absolute;
		pointer-events: none;
		height: 16px;
		background: color-mix(in srgb, var(--gelb) 22%, transparent);
		border-top: 2.5px solid var(--gelb);
	}
	.band span {
		position: absolute;
		left: 4px;
		top: -1px;
		font: 700 12px var(--font-body);
		color: var(--ink);
		white-space: nowrap;
	}
	.band .dyn {
		font-style: italic;
	}
	.msg {
		margin: 0;
		padding: 16px;
		color: var(--muted);
		font-size: 14px;
	}
</style>
