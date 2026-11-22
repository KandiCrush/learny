#!/usr/bin/env python3
"""Mesure les silences d'un MP3 de narration (macOS : utilise afconvert).

    python3 scripts/silences.py public/audio/scheduling/01-intro.mp3

Chaque silence ≈ une pause de la voix : le mot suivant commence à la fin du silence.
Reportez ces instants dans `sync` de la scène (voir le README, section « Voix »).
"""
import array, math, subprocess, sys, tempfile, wave, os

src = sys.argv[1]
with tempfile.TemporaryDirectory() as d:
    out = os.path.join(d, 'a.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', src, out], check=True)
    w = wave.open(out)
    sr, n = w.getframerate(), w.getnframes()
    a = array.array('h'); a.frombytes(w.readframes(n))

win = int(sr * 0.02)
rms = [math.sqrt(sum(x * x for x in a[i:i + win]) / win) for i in range(0, len(a) - win, win)]
thr = max(rms) * 0.04
print(f'durée : {n / sr:.2f} s')
sil = None
for i, r in enumerate(rms + [max(rms)]):
    t = i * 0.02
    if r < thr:
        sil = t if sil is None else sil
    elif sil is not None:
        if t - sil >= 0.18:
            print(f'silence {sil:5.2f} → {t:5.2f} s   (le mot suivant commence à {t:.2f} s)')
        sil = None
