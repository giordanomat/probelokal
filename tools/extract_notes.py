#!/usr/bin/env python3
"""MusicXML → Noten-JSON für die Bahn.

Liest jeden Part (ausser Schlagzeug ohne Tonhöhen), führt übergebundene Noten zusammen und
übernimmt den Griff aus dem Liedtext. Ausgabe: Schläge ab Takt 0 (4/4 angenommen, wird geprüft),
notierte MIDI-Tonhöhe, diatonische Stufe für die Bahnhöhe, Vorzeichen, Griff.

Aufruf:  python3 tools/extract_notes.py titel.xml --out notes.json
Prüfung: gegen prototype/v7/badtouch.xml ergibt Trompete 1 genau 345 Noten (Stand 25.10.2026).
"""
import argparse, json, sys
import xml.etree.ElementTree as ET

STEP = {'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6}
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
# Standardgriffe für Blech in B, notiert im Violinschlüssel (MIDI → Griff). Nur Ersatz für fehlende Liedtexte.
VALVE = {54:'123',55:'13',56:'23',57:'12',58:'1',59:'2',60:'0',61:'123',62:'13',63:'23',64:'12',65:'1',66:'2',67:'0',68:'23',69:'12',
         70:'1',71:'2',72:'0',73:'12',74:'1',75:'2',76:'0',77:'1',78:'2',79:'0',80:'23',81:'12',82:'1',83:'2',84:'0'}
SLIDE = {58:'3',59:'2',60:'1',61:'7',62:'6',63:'5',64:'4',65:'3',66:'2',67:'1',68:'5',69:'4',70:'3',71:'2',72:'1',73:'4',74:'3',75:'2',76:'1',77:'3',78:'2',79:'1'}


def sections_from_barlines(part):
    """Teilanfänge aus Doppelstrichen (light-light) ableiten."""
    starts = [0]
    for m in part.findall('measure'):
        for bl in m.findall('barline'):
            style = bl.findtext('bar-style')
            if style in ('light-light', 'light-heavy') and bl.get('location', 'right') == 'right':
                starts.append(int(m.get('number')) + 1)
    return sorted(set(starts))


def parse_part(part):
    div = 1
    notes, last = [], None
    time_sigs = set()
    for m in part.findall('measure'):
        beat = int(m.get('number')) * 4
        for e in m:
            if e.tag == 'attributes':
                if e.find('divisions') is not None:
                    div = int(e.findtext('divisions'))
                t = e.find('time')
                if t is not None:
                    time_sigs.add(t.findtext('beats') + '/' + t.findtext('beat-type'))
            elif e.tag == 'backup':
                beat -= int(e.findtext('duration')) / div
            elif e.tag == 'forward':
                beat += int(e.findtext('duration')) / div
            elif e.tag == 'note':
                if e.find('grace') is not None:
                    continue
                dur = int(e.findtext('duration') or 0) / div
                chord = e.find('chord') is not None
                pt = e.find('pitch')
                if pt is not None and not chord:
                    st = pt.findtext('step'); oc = int(pt.findtext('octave'))
                    al = int(round(float(pt.findtext('alter') or 0)))
                    midi = 12 * (oc + 1) + PC[st] + al
                    stop = any(t.get('type') == 'stop' for t in e.findall('tie'))
                    ly = e.find('lyric/text')
                    if stop and last and last['m'] == midi and abs(last['b'] + last['d'] - beat) < 1e-6:
                        last['d'] += dur
                    else:
                        last = {'b': round(beat, 4), 'd': dur, 'm': midi, 'dia': oc * 7 + STEP[st],
                                'acc': al, 'step': st, 'fing': (ly.text or '').strip() if ly is not None else ''}
                        notes.append(last)
                elif pt is None:
                    last = None
                if not chord:
                    beat += dur
    for n in notes:
        n['d'] = round(n['d'], 4)
    return notes, time_sigs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xml'); ap.add_argument('--out', default='-')
    ap.add_argument('--fill-missing', action='store_true', help='fehlende Griffe aus der Standardtabelle ergänzen und als auto markieren')
    a = ap.parse_args()
    root = ET.parse(a.xml).getroot()
    names = {sp.get('id'): sp.findtext('part-name') for sp in root.find('part-list').findall('score-part')}
    parts = root.findall('part')
    bars = len(parts[0].findall('measure'))
    # Hinweis: Das Ende des Vorzählers (Takt 1) ist meist kein Doppelstrich und muss ergänzt werden.
    out = {'source': a.xml, 'bars': bars, 'sections_from_barlines': [x for x in sections_from_barlines(parts[0]) if x < bars], 'parts': []}
    for p in parts:
        notes, ts = parse_part(p)
        if not notes or not any(n['fing'] for n in notes):
            print(f'übersprungen {p.get("id")} ({names.get(p.get("id"))}): keine Griffe – vermutlich Schlagzeug', file=sys.stderr)
            continue
        if ts - {'4/4'}:
            print(f'WARNUNG {p.get("id")}: Taktart {ts} – Schlagrechnung nimmt 4/4 an', file=sys.stderr)
        kind = 'slide' if any(n['fing'] in ('4', '5', '6', '7') for n in notes) else 'valve'
        missing = [n for n in notes if not n['fing']]
        if missing:
            where = ', '.join(f"T.{int(n['b']//4)}/{n['b']%4+1:g}" for n in missing[:12]) + (' …' if len(missing) > 12 else '')
            print(f'WARNUNG {p.get("id")} ({names.get(p.get("id"))}): {len(missing)} Noten ohne Griff: {where}', file=sys.stderr)
            if a.fill_missing:
                table = SLIDE if kind == 'slide' else VALVE
                for n in missing:
                    if n['m'] in table:
                        n['fing'] = table[n['m']]; n['fing_auto'] = True
        out['parts'].append({'id': p.get('id'), 'name': names.get(p.get('id')), 'kind': kind, 'notes': notes})
    s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if a.out == '-':
        print(s)
    else:
        open(a.out, 'w').write(s)
        print(f'{len(out["parts"])} Stimmen, ' + ', '.join(f'{x["id"]}: {len(x["notes"])}' for x in out['parts']), file=sys.stderr)


if __name__ == '__main__':
    main()
