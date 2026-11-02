import { describe, expect, it } from 'vitest';
import { bandSegments, barAt, scoreZoom, scrollToShow, type BarBox } from './boxes';

const boxes: (BarBox | null)[] = [
	{ x: 10, y: 0, w: 100, h: 60 },
	{ x: 110, y: 0, w: 100, h: 60 },
	null,
	{ x: 10, y: 100, w: 200, h: 60 }
];

describe('Notenansicht: Takt-Kästen', () => {
	it('findet den Takt unter dem Finger, auch knapp unter dem System (Liedtext)', () => {
		expect(barAt(boxes, 50, 30)).toBe(0);
		expect(barAt(boxes, 150, 70)).toBe(1);
		expect(barAt(boxes, 50, 130)).toBe(3);
		expect(barAt(boxes, 50, 90)).toBe(-1);
		expect(barAt(boxes, 300, 30)).toBe(-1);
	});

	it('scrollt nur, wenn der Takt aus dem Blick gerät', () => {
		const b = { x: 0, y: 500, w: 100, h: 60 };
		expect(scrollToShow(b, 400, 300)).toBeNull();
		expect(scrollToShow(b, 0, 300)).toBe(410);
		expect(scrollToShow({ ...b, y: 50 }, 400, 300)).toBe(0);
	});

	it('Band eines Hinweises: ein Stück pro Notenzeile, Text nur am Anfang', () => {
		expect(bandSegments(boxes, 0, 1)).toEqual([{ x: 10, y: 0, w: 200, first: true }]);
		// über den Zeilenumbruch, fehlender Kasten dazwischen
		expect(bandSegments(boxes, 1, 3)).toEqual([
			{ x: 110, y: 0, w: 100, first: true },
			{ x: 10, y: 100, w: 200, first: false }
		]);
		expect(bandSegments(boxes, 2, 2)).toEqual([]);
		// ausserhalb der Noten: abgeschnitten
		expect(bandSegments(boxes, 3, 9)).toEqual([{ x: 10, y: 100, w: 200, first: true }]);
	});

	it('kleinerer Zoom auf schmalen Bildschirmen', () => {
		expect(scoreZoom(400)).toBe(0.62);
		expect(scoreZoom(800)).toBe(0.8);
	});
});
