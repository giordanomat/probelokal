import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guuggeFilter, watchHints } from './live';

type Handler = (p: { old?: unknown; new?: unknown }) => void;

/** Nachbau von sb.channel(…).on(…).subscribe() und sb.removeChannel */
function fakeSb() {
	const bindings: { filter: Record<string, string>; handler: Handler }[] = [];
	const removed: unknown[] = [];
	const channel = {
		on(_type: string, filter: Record<string, string>, handler: Handler) {
			bindings.push({ filter, handler });
			return channel;
		},
		subscribe: () => channel
	};
	const sb = {
		channel: () => channel,
		removeChannel: async (c: unknown) => {
			removed.push(c);
			return 'ok' as const;
		}
	};
	const fire = (event: string, p: { old?: unknown; new?: unknown }) =>
		bindings.filter((b) => b.filter.event === event).forEach((b) => b.handler(p));
	return { sb: sb as never, bindings, removed, fire, channel };
}

function fakeDoc() {
	const listeners = new Set<() => void>();
	return {
		visibilityState: 'visible' as DocumentVisibilityState,
		addEventListener: (_: string, l: () => void) => void listeners.add(l),
		removeEventListener: (_: string, l: () => void) => void listeners.delete(l),
		show() {
			listeners.forEach((l) => l());
		},
		listeners
	};
}

describe('Hinweise ohne Neuladen', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('Filter für eine oder mehrere Guuggen, höchstens 100', () => {
		expect(guuggeFilter(['a'])).toBe('guugge_id=eq.a');
		expect(guuggeFilter(['a', 'b'])).toBe('guugge_id=in.(a,b)');
		const many = [...Array(120).keys()].map(String);
		expect(guuggeFilter(many).split(',')).toHaveLength(100);
	});

	it('hört auf neue Hinweise der eigenen Guuggen und auf Löschungen ohne Filter', () => {
		const f = fakeSb();
		watchHints(f.sb, ['g1', 'g2'], { onChange: () => {}, has: () => true, doc: fakeDoc() });
		expect(f.bindings.map((b) => b.filter)).toEqual([
			{ event: 'INSERT', schema: 'public', table: 'hints', filter: 'guugge_id=in.(g1,g2)' },
			{ event: 'DELETE', schema: 'public', table: 'hints' }
		]);
	});

	it('Meldungen gesammelt neu holen; fremde Löschungen zählen nicht', () => {
		const f = fakeSb();
		const onChange = vi.fn();
		const doc = fakeDoc();
		watchHints(f.sb, ['g1'], { onChange, has: (id) => id === 'h1', doc });
		f.fire('INSERT', { new: { id: 'h2' } });
		f.fire('INSERT', { new: { id: 'h3' } });
		vi.advanceTimersByTime(299);
		expect(onChange).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onChange).toHaveBeenCalledTimes(1);
		f.fire('DELETE', { old: { id: 'fremd' } });
		f.fire('DELETE', { old: {} });
		vi.advanceTimersByTime(500);
		expect(onChange).toHaveBeenCalledTimes(1);
		f.fire('DELETE', { old: { id: 'h1' } });
		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledTimes(2);
		// Wieder sichtbar: neu holen, versteckt nicht
		doc.visibilityState = 'hidden';
		doc.show();
		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledTimes(2);
		doc.visibilityState = 'visible';
		doc.show();
		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledTimes(3);
	});

	it('aufhören: Kanal weg, kein Nachzügler; ohne Guuggen gar kein Kanal', () => {
		const f = fakeSb();
		const onChange = vi.fn();
		const doc = fakeDoc();
		const stop = watchHints(f.sb, ['g1'], { onChange, has: () => true, doc });
		f.fire('INSERT', {});
		stop();
		vi.advanceTimersByTime(1000);
		expect(onChange).not.toHaveBeenCalled();
		expect(f.removed).toEqual([f.channel]);
		expect(doc.listeners.size).toBe(0);
		const g = fakeSb();
		watchHints(g.sb, [], { onChange, has: () => true, doc });
		expect(g.bindings).toHaveLength(0);
	});
});
