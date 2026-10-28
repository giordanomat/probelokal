#!/usr/bin/env python3
"""Versatz zwischen Einzelspuren und Tutti-Bounce per Kreuzkorrelation messen.

Summiert die Einzelspuren und sucht an mehreren Stellen den Versatz zum Tutti.
Positiver Wert = die Einzelspuren beginnen so viele Sekunden VOR dem Tutti.
Bei Bad Touch 2.0 (Fassung Schuegu27): 6,237 s gegen den MP3-Bounce – davon ~25 ms MP3-Vorlauf;
der echte Versatz ist 6,261 s (3 Takte). Darum gegen einen WAV-Bounce messen (docs/04).

Aufruf: python3 tools/measure_offset.py tutti.wav stems/*.wav [--bpm 115]
Braucht: ffmpeg, numpy.
"""
import argparse, subprocess
import numpy as np

SR = 11025


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def lag_at(a, b, t, win=8.0, search=10.0):
    """Versatz von b gegenüber a um Zeitpunkt t (Sekunden) über FFT-Korrelation."""
    i0 = int(t * SR); n = int(win * SR); s = int(search * SR)
    seg_a = a[i0:i0 + n]
    seg_b = b[max(0, i0 - s):i0 + n + s]
    if len(seg_a) < n or len(seg_b) < n:
        return None
    size = 1 << int(np.ceil(np.log2(len(seg_a) + len(seg_b))))
    c = np.fft.irfft(np.fft.rfft(seg_b, size) * np.conj(np.fft.rfft(seg_a, size)), size)
    k = int(np.argmax(c[:len(seg_b)]))
    return (k - (i0 - max(0, i0 - s))) / SR


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('tutti'); ap.add_argument('stems', nargs='+'); ap.add_argument('--bpm', type=float)
    a = ap.parse_args()
    tutti = load(a.tutti)
    stems = [load(p) for p in a.stems]
    L = max(len(x) for x in stems)
    mix = np.zeros(L, dtype=np.float32)
    for x in stems:
        mix[:len(x)] += x
    res = []
    for t in (10, 60, 120, 180):
        lag = lag_at(tutti, mix, t)
        if lag is not None:
            res.append(lag); print(f'bei {t:>4} s: Einzelspuren {lag:+.3f} s gegenüber Tutti')
    if res:
        m = float(np.median(res)); spread = max(res) - min(res)
        print(f'Versatz: {m:.3f} s (Streuung {spread*1000:.0f} ms)' + (f' = {m/(240/a.bpm):.2f} Takte' if a.bpm else ''))
        if spread > 0.02:
            print('WARNUNG: Versatz nicht konstant – Drift oder unterschiedliche Exporte prüfen.')


if __name__ == '__main__':
    main()
