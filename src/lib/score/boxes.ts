// Takt-Kästen in der Notenansicht (aus OpenSheetMusicDisplay, portiert aus prototype/v7:
// renderScore, highlight, Klick auf einen Takt). Reine Rechnung, damit sie ohne Browser testbar ist.

/** Kasten eines Takts über alle sichtbaren Systeme, in Pixeln relativ zur Noten-SVG. */
export interface BarBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Takt unter einem Punkt (Pixel relativ zur SVG), sonst −1. Unten etwas Luft für den Liedtext. */
export function barAt(boxes: readonly (BarBox | null)[], x: number, y: number, slack = 12): number {
	return boxes.findIndex(
		(b) => b !== null && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h + slack
	);
}

/**
 * Neue Scrollposition, damit der Takt sichtbar bleibt (er landet bei 30 % der Höhe),
 * oder null, wenn er schon gut sichtbar ist.
 */
export function scrollToShow(
	box: BarBox,
	scrollTop: number,
	viewHeight: number,
	margin = 20
): number | null {
	if (box.y >= scrollTop + margin && box.y + box.h <= scrollTop + viewHeight - margin) return null;
	return Math.max(0, box.y - viewHeight * 0.3);
}

/** Zoom der Noten: auf schmalen Bildschirmen kleiner (wie im Prototyp). */
export function scoreZoom(width: number): number {
	return width < 520 ? 0.62 : 0.8;
}

/** Stück eines Hinweis-Bands auf einer Notenzeile, in Pixeln relativ zur Noten-SVG. */
export interface BandSegment {
	x: number;
	y: number;
	w: number;
	/** Erstes Stück des Hinweises (trägt den Text) */
	first: boolean;
}

/**
 * Band über den Takten from–to (einschliesslich), pro Notenzeile ein Stück. Takte ohne Kasten
 * (nicht gezeichnet) unterbrechen das Band nicht; eine neue Zeile erkennt man an einem anderen y.
 */
export function bandSegments(
	boxes: readonly (BarBox | null)[],
	from: number,
	to: number
): BandSegment[] {
	const out: BandSegment[] = [];
	for (let i = Math.max(0, from); i <= Math.min(to, boxes.length - 1); i++) {
		const b = boxes[i];
		if (!b) continue;
		const last = out[out.length - 1];
		if (last && Math.abs(last.y - b.y) < 1) last.w = b.x + b.w - last.x;
		else out.push({ x: b.x, y: b.y, w: b.w, first: out.length === 0 });
	}
	return out;
}
