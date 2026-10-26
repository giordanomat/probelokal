#!/usr/bin/env bash
# Minus-One-Mischungen pro Stimme und Gesamtmischung aus Einzelspuren.
# Aufruf: tools/make_mixes.sh <ordner-mit-einzelspuren> <ausgabeordner> trp1 trp2 pos1 pos2 euph sous -- perc
#   Vor »--« die Stimmen, für die je ein Minus-One entsteht; danach Spuren, die immer mitlaufen (Schlagzeug).
#   Dateinamen im Eingabeordner: <id>.wav oder <id>.mp3
# Ergebnis: minus_<id>.mp3, all.mp3 und <id>.mp3 (Einzelspur als MP3) im Ausgabeordner. MP3 128 kbit/s.
# Mischung wie im Prototyp: amix ohne Normalisierung, Limiter bei 0,89 ohne Auto-Pegel
# (level=0; sonst hebt alimiter auf 0 dB an und die MP3s erreichen 0,0 dB – so war es im Prototyp).
set -euo pipefail
IN="$1"; OUT="$2"; shift 2
VOICES=(); ALWAYS=(); seen=0
for a in "$@"; do if [ "$a" = "--" ]; then seen=1; continue; fi; if [ $seen = 0 ]; then VOICES+=("$a"); else ALWAYS+=("$a"); fi; done
mkdir -p "$OUT"
src(){ for e in wav mp3; do [ -f "$IN/$1.$e" ] && { echo "$IN/$1.$e"; return; }; done; echo "fehlt: $1" >&2; exit 1; }
mix(){ local out="$1"; shift; local args=(); for f in "$@"; do args+=(-i "$f"); done
  ffmpeg -v error -y "${args[@]}" -filter_complex "amix=inputs=$#:normalize=0,alimiter=limit=0.89:level=0" -c:a libmp3lame -b:a 128k "$out"; }
ALL=(); for v in "${VOICES[@]}" "${ALWAYS[@]}"; do ALL+=("$(src "$v")"); done
mix "$OUT/all.mp3" "${ALL[@]}"
for v in "${VOICES[@]}"; do
  REST=(); for w in "${VOICES[@]}" "${ALWAYS[@]}"; do [ "$w" = "$v" ] || REST+=("$(src "$w")"); done
  mix "$OUT/minus_$v.mp3" "${REST[@]}"
  ffmpeg -v error -y -i "$(src "$v")" -c:a libmp3lame -b:a 128k "$OUT/$v.mp3"
done
echo "fertig: $OUT"
