// Bahn zeichnen (Canvas 2D), portiert aus prototype/v7 (Lane.draw), mit Hinweisen der Leitung und
// Bahn-Looks (#lib/lane/looks.ts). Ohne Dirigent-Vorspiel, das kommt mit M3.

import { pressedValves } from '../music/fingering';
import type { InstrumentKind, Section, Track } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';
import {
	STAFF_LINES,
	noteLook,
	pillHeight,
	visibleBeats,
	xOfBeat,
	yOfDia,
	type HelpLevel,
	type LaneGeometry,
	type NoteLook
} from './geometry';
import { LOOK_FG, lookFill, type LaneLook } from './looks';

export interface LaneColors {
	surface: string;
	ink: string;
	muted: string;
	line: string;
	grid: string;
	gelb: string;
	rot: string;
	blau: string;
	gruen: string;
	akzent: string;
	blk: string;
	blkFg: string;
	past: string;
	ghost: string;
}

const VARS: Record<keyof LaneColors, string> = {
	surface: '--surface',
	ink: '--ink',
	muted: '--muted',
	line: '--line',
	grid: '--grid',
	gelb: '--gelb',
	rot: '--rot',
	blau: '--blau',
	gruen: '--gruen',
	akzent: '--akzent',
	blk: '--blk',
	blkFg: '--blk-fg',
	past: '--past',
	ghost: '--ghost'
};

/** Farben aus den CSS-Variablen lesen (nach jedem Wechsel Dunkel/Hell neu). */
export function readLaneColors(el: Element): LaneColors {
	const cs = getComputedStyle(el);
	const out = {} as LaneColors;
	for (const [k, v] of Object.entries(VARS))
		out[k as keyof LaneColors] = cs.getPropertyValue(v).trim();
	return out;
}

/** Ein gemessener Punkt der Tonhöhe (Mithören), für die Spur auf der Bahn. */
export interface TracePoint {
	b: number;
	dia: number;
	c: NoteVerdict | 'free';
}

export interface LaneScene {
	track: Track;
	beat: number;
	kind: InstrumentKind;
	help: HelpLevel;
	names: boolean;
	staff: boolean;
	sections: readonly Section[];
	judged?: ReadonlyMap<number, NoteVerdict>;
	countIn?: number | null;
	/** Echo-Phase oben rechts: »HÖR ZU« blau, »JETZT DU« gelb */
	overlay?: { text: string; tone: 'blau' | 'gelb' } | null;
	trace?: readonly TracePoint[] | null;
	/** Aktuell gehörte Tonhöhe (diatonisch) an der Spiellinie */
	current?: number | null;
	/** Hinweise der Leitung als Band über den Takten (wie im Prototyp) */
	hints?: readonly LaneHint[] | null;
	/** Bahn-Look (Belohnung); nur schon freigeschaltete übergeben */
	look?: LaneLook;
}

export interface LaneHint {
	/** Takte einschliesslich */
	from: number;
	to: number;
	/** Kurztext, z. B. »pp« oder »Atmen« (#lib/hints/hints.ts, hintShort) */
	label: string;
	/** Dynamik kursiv */
	dyn: boolean;
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const BODY = 'Figtree, system-ui, sans-serif';

function roundRect(
	cx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	r = Math.max(0, Math.min(r, h / 2, w / 2));
	cx.beginPath();
	cx.moveTo(x + r, y);
	cx.arcTo(x + w, y, x + w, y + h, r);
	cx.arcTo(x + w, y + h, x, y + h, r);
	cx.arcTo(x, y + h, x, y, r);
	cx.arcTo(x, y, x + w, y, r);
	cx.closePath();
}

function lookColors(
	look: NoteLook,
	c: LaneColors
): { fill: string | null; fg: string; stroke: string | null } {
	switch (look) {
		case 'hit':
			return { fill: c.gruen, fg: '#fff', stroke: null };
		case 'half':
			return { fill: c.gelb, fg: '#141619', stroke: null };
		case 'wrong':
			return { fill: c.rot, fg: '#fff', stroke: null };
		case 'missed':
			return { fill: null, fg: c.muted, stroke: c.past };
		case 'active':
			return { fill: c.blau, fg: '#141619', stroke: null };
		case 'past':
			return { fill: c.past, fg: c.blkFg, stroke: null };
		case 'ghost':
			return { fill: null, fg: c.muted, stroke: c.ghost };
		default:
			return { fill: c.blk, fg: c.blkFg, stroke: null };
	}
}

export function drawLane(
	cx: CanvasRenderingContext2D,
	g: LaneGeometry,
	s: LaneScene,
	c: LaneColors,
	dpr: number
): void {
	const { width: W, height: H } = g;
	const now = s.beat;
	const X = (b: number) => xOfBeat(g, b, now);
	const [b0, b1] = visibleBeats(g, now);
	cx.setTransform(dpr, 0, 0, dpr, 0, 0);
	cx.clearRect(0, 0, W, H);

	// Notenlinien
	if (s.staff && s.help !== 'rhythm' && s.help !== 'memo') {
		cx.strokeStyle = c.muted;
		cx.globalAlpha = 0.5;
		cx.lineWidth = 1;
		for (const d of STAFF_LINES) {
			const y = Math.round(yOfDia(g, d)) + 0.5;
			cx.beginPath();
			cx.moveTo(0, y);
			cx.lineTo(W, y);
			cx.stroke();
		}
		cx.globalAlpha = 1;
	}

	// Takte, Schläge, Teilbuchstaben
	for (let bb = Math.max(0, Math.floor(b0)); bb <= b1; bb++) {
		const x = Math.round(X(bb)) + 0.5;
		const isBar = bb % 4 === 0;
		cx.strokeStyle = isBar ? c.line : c.grid;
		cx.lineWidth = isBar ? 1.5 : 1;
		cx.beginPath();
		cx.moveTo(x, isBar ? 4 : g.laneTop);
		cx.lineTo(x, H - 4);
		cx.stroke();
		if (isBar) {
			const bar = bb / 4;
			cx.fillStyle = c.muted;
			cx.font = `500 10px ${MONO}`;
			cx.fillText(String(bar), x + 4, 13);
			const sec = s.sections.find((x) => x.from === bar && x.name !== 'Vorzähler');
			if (sec) {
				cx.fillStyle = c.akzent;
				cx.font = `700 13px ${BODY}`;
				cx.fillText(sec.name, x + 4 + String(bar).length * 7 + 4, 14);
			}
		}
	}

	// Hinweise der Leitung: helles gelbes Band unter den Taktzahlen, Kurztext darin
	for (const h of s.hints ?? []) {
		const x0 = X(h.from * 4);
		const x1 = X((h.to + 1) * 4);
		if (x1 < 0 || x0 > W) continue;
		cx.fillStyle = c.gelb;
		cx.globalAlpha = 0.22;
		cx.fillRect(x0, 17, x1 - x0, g.laneTop - 17);
		cx.globalAlpha = 1;
		cx.fillRect(x0, 17, x1 - x0, 2.5);
		cx.fillStyle = c.ink;
		cx.font = `${h.dyn ? 'italic ' : ''}700 12px ${BODY}`;
		cx.fillText(h.label, Math.max(x0, 0) + 4, g.laneTop - 3);
	}

	const showGrip = g.gripHeight > 0;
	const rowH = showGrip ? g.gripHeight / g.gripRows : 0;
	if (showGrip) {
		cx.fillStyle = c.grid;
		for (let r = 0; r < g.gripRows; r++)
			cx.fillRect(0, g.gripTop + r * rowH + rowH / 2 - 0.5, W, 1);
		cx.fillStyle = c.muted;
		cx.font = `500 9.5px ${MONO}`;
		cx.fillText(s.kind === 'slide' ? 'ZUG' : 'VENTIL', 24, g.gripTop - 2);
	}

	const midY = g.laneTop + g.laneHeight / 2;
	if (s.help === 'memo') {
		// Auswendig: nur Einsätze
		cx.fillStyle = c.akzent;
		cx.font = `700 12px ${BODY}`;
		for (const e of s.track.entries) {
			if (e < b0 - 1 || e > b1) continue;
			const x = X(e);
			cx.beginPath();
			cx.moveTo(x, midY - 9);
			cx.lineTo(x + 12, midY);
			cx.lineTo(x, midY + 9);
			cx.closePath();
			cx.fill();
			cx.fillText('Einsatz', x + 16, midY + 4);
		}
	} else {
		// Atemzeichen
		cx.fillStyle = c.akzent;
		cx.font = `700 18px ${BODY}`;
		for (const rb of s.track.rests)
			if (rb >= b0 - 1 && rb <= b1) cx.fillText('’', X(rb) + 3, g.laneTop + 12);

		const ph = pillHeight(g);
		const names = s.names && s.help !== 'rhythm';
		s.track.notes.forEach((n, i) => {
			if (n.b + n.d < b0 || n.b > b1) return;
			const x = X(n.b) + 1;
			const w = Math.max(6, n.d * g.ppb - 3);
			const y = (s.help === 'rhythm' ? midY : yOfDia(g, n.dia)) - ph / 2;
			const look = noteLook(n, now, s.judged?.get(i));
			const col = lookColors(look, c);
			const special = look === 'upcoming' && s.look ? lookFill(s.look, n.fing, s.kind) : null;
			if (special) {
				col.fill = special;
				col.fg = LOOK_FG;
			}
			roundRect(cx, x, y, w, ph, ph / 2);
			if (col.fill) {
				cx.fillStyle = col.fill;
				cx.fill();
			}
			if (col.stroke) {
				cx.strokeStyle = col.stroke;
				cx.lineWidth = 1.5;
				if (look === 'ghost') cx.setLineDash([4, 3]);
				cx.stroke();
				cx.setLineDash([]);
			}
			if (look === 'active') {
				cx.strokeStyle = c.ink;
				cx.lineWidth = 2;
				roundRect(cx, x - 2, y - 2, w + 4, ph + 4, ph / 2 + 2);
				cx.stroke();
			}
			if (s.help !== 'rhythm') {
				const label = names ? n.name : n.acc > 0 ? '♯' : n.acc < 0 ? '♭' : '';
				if (label && w >= (names ? 26 : 12)) {
					cx.fillStyle = col.fg;
					cx.font = `700 ${Math.round(ph * 0.55)}px ${BODY}`;
					cx.fillText(label, x + ph * 0.35, y + ph * 0.7);
				} else if (names && label) {
					cx.fillStyle = c.muted;
					cx.font = `600 10px ${BODY}`;
					cx.fillText(label, x, y - 3);
				}
			}
			if (showGrip) {
				const gf = col.fill ?? (look === 'ghost' ? c.ghost : c.past);
				// ergänzte Griffe (aus der Standardtabelle) und vorgespielte Töne etwas blasser
				cx.globalAlpha =
					(n.fing_auto && look === 'upcoming') || look === 'ghost'
						? look === 'ghost'
							? 0.55
							: 0.6
						: 1;
				if (s.kind === 'slide') {
					const p = Number(n.fing);
					if (p >= 1 && p <= 7) {
						roundRect(cx, x, g.gripTop + (p - 1) * rowH + rowH * 0.18, w, rowH * 0.64, rowH * 0.32);
						cx.fillStyle = gf;
						cx.fill();
					}
				} else {
					const pr = pressedValves(n.fing);
					for (let r = 0; r < 3; r++) {
						if (!pr.includes(r + 1)) continue;
						roundRect(cx, x, g.gripTop + r * rowH + rowH * 0.2, w, rowH * 0.6, rowH * 0.3);
						cx.fillStyle = gf;
						cx.fill();
					}
					if (!pr.length && n.fing) {
						const cy = g.gripTop + g.gripHeight / 2;
						const r0 = Math.min(rowH * 0.42, 9);
						cx.strokeStyle = gf;
						cx.lineWidth = 2;
						cx.beginPath();
						cx.arc(x + r0 + 1, cy, r0, 0, Math.PI * 2);
						cx.stroke();
						if (w > r0 * 2 + 30) {
							cx.fillStyle = gf;
							cx.font = `600 11px ${BODY}`;
							cx.fillText('offen', x + r0 * 2 + 6, cy + 4);
						}
					}
				}
				cx.globalAlpha = 1;
			}
		});
	}

	if (showGrip) {
		cx.fillStyle = c.surface;
		cx.globalAlpha = 0.92;
		cx.fillRect(0, g.gripTop, 20, g.gripHeight);
		cx.globalAlpha = 1;
		cx.fillStyle = c.muted;
		cx.font = `700 11px ${BODY}`;
		for (let r = 0; r < g.gripRows; r++)
			cx.fillText(String(r + 1), 6, g.gripTop + r * rowH + rowH / 2 + 4);
	}

	// Spur der gehörten Tonhöhe (Mithören)
	if (s.trace && s.help !== 'rhythm' && s.help !== 'memo') {
		for (const p of s.trace) {
			if (p.b < b0 || p.b > now) continue;
			cx.fillStyle =
				p.c === 'hit' ? c.gruen : p.c === 'wrong' ? c.rot : p.c === 'free' ? c.past : c.gelb;
			cx.beginPath();
			cx.arc(X(p.b), yOfDia(g, p.dia), 2.4, 0, Math.PI * 2);
			cx.fill();
		}
		if (s.current != null) {
			cx.fillStyle = c.ink;
			cx.beginPath();
			cx.arc(g.playX, yOfDia(g, s.current), 6, 0, Math.PI * 2);
			cx.fill();
			cx.strokeStyle = c.surface;
			cx.lineWidth = 2;
			cx.stroke();
		}
	}

	// Spiellinie
	cx.fillStyle = c.rot;
	cx.fillRect(g.playX - 1, g.laneTop - 6, 2.5, H - g.laneTop + 2);
	cx.beginPath();
	cx.moveTo(g.playX - 6, g.laneTop - 8);
	cx.lineTo(g.playX + 7, g.laneTop - 8);
	cx.lineTo(g.playX + 0.5, g.laneTop);
	cx.closePath();
	cx.fill();

	// Einzählen
	if (s.countIn) {
		cx.fillStyle = c.ink;
		cx.font = `700 ${Math.round(g.laneHeight * 0.42)}px ${BODY}`;
		cx.globalAlpha = 0.18;
		cx.fillText(String(s.countIn), g.playX + 20, g.laneTop + g.laneHeight * 0.62);
		cx.globalAlpha = 1;
	}

	// Phase (Echo)
	if (s.overlay) {
		cx.font = `700 13px ${MONO}`;
		const tw = cx.measureText(s.overlay.text).width;
		roundRect(cx, W - tw - 28, g.laneTop, tw + 20, 26, 13);
		cx.fillStyle = c[s.overlay.tone];
		cx.fill();
		cx.fillStyle = '#141619';
		cx.fillText(s.overlay.text, W - tw - 18, g.laneTop + 17);
	}
}
