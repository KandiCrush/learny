#!/usr/bin/env python3
"""Calibre les sous-titres / bulles / sons sur les MP3 réels (macOS : afconvert).

    python3 scripts/calibrate-sync.py            # écrit src/lessons/scheduling/sync.generated.ts
    python3 scripts/calibrate-sync.py --report   # affiche seulement le diagnostic

Principe : on mesure les silences de chaque MP3, puis on les ALIGNE sur les ponctuations du script
(fin de ligne, point, virgule, deux-points) par programmation dynamique. Chaque silence reconnu
donne un repère « ce mot commence à tant de secondes ». Entre deux repères, l'application interpole.
"""
import array, json, math, os, subprocess, sys, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'public/audio/scheduling')
OUT = os.path.join(ROOT, 'src/lessons/scheduling/sync.generated.ts')
REPORT = '--report' in sys.argv

LETTERS_PER_SEC = 14.0
PAUSE = {',': 0.22, ';': 0.3, ':': 0.35, '.': 0.6, '!': 0.6, '?': 0.6, '…': 0.5}
MIN_SILENCE = 0.14  # s


def node_json(expr):
    code = f"import('./src/lessons/scheduling/narration.ts').then(m=>console.log(JSON.stringify({expr})))"
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True))


def analyse(path):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path, wav], check=True)
        w = wave.open(wav)
        sr, n = w.getframerate(), w.getnframes()
        a = array.array('h'); a.frombytes(w.readframes(n))
    win = int(sr * 0.02)
    rms = [math.sqrt(sum(x * x for x in a[i:i + win]) / win) for i in range(0, len(a) - win, win)]
    thr = max(rms) * 0.04
    dur = n / sr
    voiced = [i for i, r in enumerate(rms) if r >= thr]
    t0, t1 = voiced[0] * 0.02, (voiced[-1] + 1) * 0.02
    sil, cur = [], None
    for i, r in enumerate(rms):
        t = i * 0.02
        if r < thr:
            cur = t if cur is None else cur
        elif cur is not None:
            if t - cur >= MIN_SILENCE and cur > t0 and t < t1:
                sil.append((cur, t))
            cur = None
    return dur, t0, t1, sil


def words_of(lines):
    toks, line_end = [], set()
    for line in lines:
        for w in line.split():
            # ponctuation isolée (« terminé : il ») : rattachée au mot précédent, comme dans src/lib/narration.ts
            if toks and not any(c.isalnum() for c in w): toks[-1] += ' ' + w
            else: toks.append(w)
        line_end.add(len(toks) - 1)
    return toks, line_end


def estimate(toks):
    est, t = [], 0.0
    for w in toks:
        est.append(t)
        letters = sum(c.isalnum() for c in w)
        t += max(2, letters) / LETTERS_PER_SEC + PAUSE.get(w[-1], 0)
    return est, t


def norm(s):
    return ' '.join(''.join(c if c.isalnum() or c.isspace() else ' ' for c in s.lower()).split())


def unique_phrase(toks, i):
    """Plus courte expression commençant au mot i dont la première occurrence est bien i."""
    normed = [norm(t) for t in toks]
    for k in range(1, 8):
        p = ' '.join(normed[i:i + k])
        # même logique que src/lib/narration.ts : première occurrence de la chaîne
        for j in range(len(normed)):
            acc = ''
            for q in range(j, len(normed)):
                if len(acc) >= len(p): break
                acc += (' ' if acc else '') + normed[q]
            if acc == p:
                if j == i: return ' '.join(toks[i:i + k])
                break
    return ' '.join(toks[i:i + 3])


def align(toks, line_end, est, est_total, t0, t1, sil):
    """Associe silences et ponctuations. Coût = écart de position + cohérence du DÉBIT :
    entre deux silences reconnus, le temps de parole doit correspondre au nombre de lettres lues."""
    scale = (t1 - t0) / est_total
    cands = [i + 1 for i, w in enumerate(toks[:-1]) if w[-1] in ',;:.!?…']
    m, n = len(sil), len(cands)
    letters = [sum(ch.isalnum() for ch in w) for w in toks]
    L = [0]
    for x in letters: L.append(L[-1] + max(2, x))  # lettres cumulées (au moins 2 par mot)

    def pos_cost(si, ci):
        s_end, s_dur = sil[si][1], sil[si][1] - sil[si][0]
        c = cands[ci]
        is_line_end = (c - 1) in line_end
        d = abs((t0 + est[c] * scale) - s_end) * 0.5
        if s_dur >= 0.8 and not is_line_end: d += 3.0   # long silence = fin de ligne
        if s_dur < 0.5 and is_line_end: d += 1.2
        return d

    def skip_c(ci):
        return 3.0 if (cands[ci] - 1) in line_end else (1.3 if toks[cands[ci] - 1][-1] in '.!?…' else 0.6)

    def skip_s(si):  # silence non rattaché à une ponctuation (hésitation de la voix…)
        d = sil[si][1] - sil[si][0]
        return 0.8 if d < 0.3 else (1.6 if d < 0.8 else 3.0)

    def rate_cost(word_from, word_to, t_from, t_to):
        speech = max(0.05, t_to - t_from)
        expected = max(0.3, (L[word_to] - L[word_from]) / LETTERS_PER_SEC)
        return min(2.0, 0.8 * abs(math.log(speech / expected)))

    INF = 1e18
    # best[si][ci] : meilleur coût avec le silence si associé à la ponctuation ci (dernier repère)
    best = [[INF] * n for _ in range(m)]
    prev = [[None] * n for _ in range(m)]
    cum_skip_s = [0.0]
    for si in range(m): cum_skip_s.append(cum_skip_s[-1] + skip_s(si))
    cum_skip_c = [0.0]
    for ci in range(n): cum_skip_c.append(cum_skip_c[-1] + skip_c(ci))
    for si in range(m):
        for ci in range(n):
            c0 = cum_skip_s[si] + cum_skip_c[ci] + pos_cost(si, ci) + rate_cost(0, cands[ci], t0, sil[si][0])
            best[si][ci] = c0
            for sj in range(si):
                for cj in range(ci):
                    if best[sj][cj] >= INF: continue
                    c = (best[sj][cj] + (cum_skip_s[si] - cum_skip_s[sj + 1]) + (cum_skip_c[ci] - cum_skip_c[cj + 1])
                         + pos_cost(si, ci) + rate_cost(cands[cj], cands[ci], sil[sj][1], sil[si][0]))
                    if c < best[si][ci]: best[si][ci] = c; prev[si][ci] = (sj, cj)
    # on termine en comptant les éléments restants comme non rattachés
    end_cost, end = INF, None
    for si in range(m):
        for ci in range(n):
            c = best[si][ci] + (cum_skip_s[m] - cum_skip_s[si + 1]) + (cum_skip_c[n] - cum_skip_c[ci + 1])
            if c < end_cost: end_cost, end = c, (si, ci)
    pairs, cur = [], end
    while cur:
        pairs.append(cur); cur = prev[cur[0]][cur[1]]
    return [(sil[si], cands[ci]) for si, ci in reversed(pairs)]


def main():
    names = node_json('m.FILES')
    lines_all = node_json('m.LINES')
    result = {}
    for key, fname in names.items():
        path = os.path.join(AUDIO, fname)
        if not os.path.exists(path):
            print(f'[{key}] {fname} absent — ignoré'); continue
        toks, line_end = words_of(lines_all[key])
        est, est_total = estimate(toks)
        dur, t0, t1, sil = analyse(path)
        pairs = align(toks, line_end, est, est_total, t0, t1, sil)
        print(f'\n=== {key}  ({fname})  durée {dur:.2f}s · voix {t0:.2f}→{t1:.2f}s · {len(sil)} silences · {len(pairs)} repères')
        anchors = []
        for (s0, s1), wi in pairs:
            ph = unique_phrase(toks, wi)
            print(f'  silence {s0:5.2f}→{s1:5.2f} ({s1 - s0:3.1f}s)  ⇒ « {ph} » à {s1:.2f}s')
            if 0 < s1 < dur: anchors.append({'text': ph, 'at': round(s1, 2)})
        # fin de voix : le dernier mot ne doit pas être étiré jusqu'au silence final
        result[key] = anchors
    if REPORT: return
    body = ['// Généré par scripts/calibrate-sync.py — ne pas modifier à la main.',
            '// Repères mesurés sur les MP3 : « ce mot commence à tant de secondes ».',
            "import type { SceneKey } from './narration'", '',
            'export const SYNC: Record<SceneKey, { text: string; at: number }[]> = {']
    for key in names:
        body.append(f'  {key}: [')
        for a in result.get(key, []):
            body.append(f"    {{ text: {json.dumps(a['text'], ensure_ascii=False)}, at: {a['at']} }},")
        body.append('  ],')
    body.append('}')
    with open(OUT, 'w') as f: f.write('\n'.join(body) + '\n')
    print(f'\n→ {os.path.relpath(OUT, ROOT)} écrit')


main()
