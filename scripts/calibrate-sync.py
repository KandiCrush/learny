#!/usr/bin/env python3
"""Calibre sous-titres / bulles / sons / chapitres sur le MP3 du cours (macOS : afconvert).

    python3 scripts/calibrate-sync.py            # écrit src/lessons/scheduling/sync.generated.ts
    python3 scripts/calibrate-sync.py --report   # affiche seulement le diagnostic

Le cours entier est UN seul MP3. On mesure ses silences, puis on les ALIGNE sur les ponctuations du script complet
(fin de ligne, point, virgule, deux-points) par programmation dynamique. Chaque silence reconnu donne un repère
« ce mot commence à tant de secondes ». Le début de chaque scène donne sa plage [from, to] dans le fichier :
c'est ce qui permet d'ouvrir un chapitre à la bonne seconde. Entre deux repères, l'application interpole.
"""
import array, json, math, os, re, subprocess, sys, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'public/audio/scheduling')
OUT = os.path.join(ROOT, 'src/lessons/scheduling/sync.generated.ts')
REPORT = '--report' in sys.argv

LETTERS_PER_SEC = 14.0
PAUSE = {',': 0.22, ';': 0.3, ':': 0.35, '.': 0.6, '!': 0.6, '?': 0.6, '…': 0.5}
MIN_SILENCE = 0.14  # s


UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
         'quatorze', 'quinze', 'seize']
TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']


def fr_number(n):
    """Nombre (0–99) en toutes lettres : seule la LONGUEUR compte (même règle que src/lib/narration.ts)."""
    if n < 17: return UNITS[n]
    if n < 20: return 'dix' + UNITS[n - 10]
    if n < 70:
        t, u = divmod(n, 10)
        return TENS[t] + ('etun' if u == 1 else UNITS[u] if u else '')
    if n < 80: return 'soixante' + fr_number(n - 60)
    if n == 80: return 'quatrevingts'
    return 'quatrevingt' + fr_number(n - 80)


def spoken(w):
    """Longueur parlée d'un mot, en lettres équivalentes : un sigle (SJF, FCFS, PCB) est ÉPELÉ (≈ 0,35 s la lettre,
    soit 5 lettres ordinaires) ; « P1 » se dit « P un ». Même règle que src/lib/narration.ts."""
    core = ''.join(c for c in w if c.isalnum())
    m = re.fullmatch(r'(\d{1,2})(?:[,.](\d{1,2}))?', ''.join(c for c in w if c.isdigit() or c in ',.').strip(',.'))
    if m and core.isdigit() or (m and not any(c.isalpha() for c in w)):
        return len(fr_number(int(m.group(1)))) + (len('virgule') + len(fr_number(int(m.group(2)))) if m.group(2) else 0)
    if len(core) >= 2 and core.isalpha() and core.isupper(): return len(core) * 5
    if re.fullmatch(r'[A-Z]\d+', core): return 7
    return max(2, len(core))


def node_json(expr):
    code = f"import('./src/lessons/scheduling/narration.ts').then(m=>console.log(JSON.stringify({expr})))"
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True))


def analyse(path):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        # afconvert se fie à l'extension : on la déduit du contenu réel du fichier
        with open(path, 'rb') as f: head = f.read(12)
        ext = '.wav' if head[:4] == b'RIFF' else '.m4a' if head[4:8] == b'ftyp' else '.mp3'
        src = os.path.join(d, 'src' + ext)
        os.symlink(os.path.abspath(path), src)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', src, wav], check=True)
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
        t += spoken(w) / LETTERS_PER_SEC + PAUSE.get(w[-1], 0)
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


def align(toks, line_end, est, est_total, t0, t1, sil, rate):
    """Associe silences et ponctuations. Coût = écart de position + cohérence du DÉBIT :
    entre deux silences reconnus, le temps de parole doit correspondre au nombre de lettres lues."""
    scale = (t1 - t0) / est_total
    cands = [i + 1 for i, w in enumerate(toks[:-1]) if w[-1] in ',;:.!?…']
    m, n = len(sil), len(cands)
    L = [0]
    for w in toks: L.append(L[-1] + spoken(w))  # lettres équivalentes cumulées

    # Durée typique du silence selon la ponctuation (mesurée sur la voix : fin de ligne ≈ 0,65 s, point ≈ 0,45 s,
    # deux-points ≈ 0,33 s, virgule ≈ 0,28 s ; une hésitation dure ≤ 0,2 s)
    TYPICAL = {'line': 0.65, '.': 0.45, '!': 0.45, '?': 0.45, '…': 0.45, ':': 0.33, ';': 0.33, ',': 0.28}

    def kind(ci):
        c = cands[ci]
        return 'line' if (c - 1) in line_end else toks[c - 1][-1]

    def pos_cost(si, ci):
        s_end, s_dur = sil[si][1], sil[si][1] - sil[si][0]
        d = abs((t0 + est[cands[ci]] * scale) - s_end) * 0.08           # simple départage (la dérive de l'estimation est grande)
        d += 1.4 * abs(math.log(max(s_dur, 0.1) / TYPICAL[kind(ci)]))    # la durée du silence doit ressembler à sa ponctuation
        if s_dur >= 0.8 and kind(ci) != 'line': d += 3.0
        return d

    def skip_c(ci):
        k = kind(ci)
        return 3.0 if k == 'line' else (1.5 if k in '.!?…' else 0.3)

    def skip_s(si):  # silence non rattaché à une ponctuation (hésitation de la voix…)
        d = sil[si][1] - sil[si][0]
        return 0.3 if d < 0.25 else (0.9 if d < 0.5 else 2.5)

    def rate_cost(word_from, word_to, t_from, t_to, skipped=0.0):
        # `skipped` : durée des silences ignorés entre les deux repères (hésitations) — ce n'est pas de la parole
        speech = max(0.05, t_to - t_from - skipped)
        expected = max(0.3, (L[word_to] - L[word_from]) / rate)   # `rate` = débit MESURÉ de la voix (lettres équivalentes/s hors silences)
        return min(8.0, 3.2 * abs(math.log(speech / expected)))

    INF = 1e18
    BAND = 8  # nombre max d'éléments sautés d'affilée : garde le calcul rapide sur un cours entier
    # best[si][ci] : meilleur coût avec le silence si associé à la ponctuation ci (dernier repère)
    best = [[INF] * n for _ in range(m)]
    prev = [[None] * n for _ in range(m)]
    sdur = [0.0]
    for a_, b_ in sil: sdur.append(sdur[-1] + (b_ - a_))   # durées de silence cumulées
    cum_skip_s = [0.0]
    for si in range(m): cum_skip_s.append(cum_skip_s[-1] + skip_s(si))
    cum_skip_c = [0.0]
    for ci in range(n): cum_skip_c.append(cum_skip_c[-1] + skip_c(ci))
    for si in range(m):
        for ci in range(n):
            # départ : au plus quelques éléments non rattachés au début
            c0 = (cum_skip_s[si] + cum_skip_c[ci] + pos_cost(si, ci) + rate_cost(0, cands[ci], t0, sil[si][0], sdur[si] - sdur[0])) if (si < BAND and ci < BAND) else INF
            best[si][ci] = c0
            for sj in range(max(0, si - BAND), si):
                for cj in range(max(0, ci - BAND), ci):
                    if best[sj][cj] >= INF: continue
                    c = (best[sj][cj] + (cum_skip_s[si] - cum_skip_s[sj + 1]) + (cum_skip_c[ci] - cum_skip_c[cj + 1])
                         + pos_cost(si, ci) + rate_cost(cands[cj], cands[ci], sil[sj][1], sil[si][0], sdur[si] - sdur[sj + 1]))
                    if c < best[si][ci]: best[si][ci] = c; prev[si][ci] = (sj, cj)
    # on termine en comptant les éléments restants comme non rattachés
    end_cost, end = INF, None
    for si in range(m):
        for ci in range(n):
            if best[si][ci] >= INF: continue
            c = best[si][ci] + (cum_skip_s[m] - cum_skip_s[si + 1]) + (cum_skip_c[n] - cum_skip_c[ci + 1])
            if c < end_cost: end_cost, end = c, (si, ci)
    pairs, cur = [], end
    while cur:
        pairs.append(cur); cur = prev[cur[0]][cur[1]]
    return [(sil[si], cands[ci]) for si, ci in reversed(pairs)]


def main():
    order = node_json('m.SCENE_ORDER')
    lines_all = node_json('m.LINES')
    audio_file = node_json('m.AUDIO_FILE')
    path = os.path.join(AUDIO, audio_file)

    # jetons par scène (la ponctuation isolée est rattachée au mot précédent, comme dans src/lib/narration.ts)
    scene_toks, scene_lineend, offsets, toks, line_end = {}, {}, {}, [], set()
    for k in order:
        t, le = words_of(lines_all[k])
        scene_toks[k], scene_lineend[k], offsets[k] = t, le, len(toks)
        line_end |= {offsets[k] + x for x in le}
        toks += t

    result = {k: [] for k in order}
    segments = {k: None for k in order}
    file_duration = None
    if not os.path.exists(path):
        print(f'{audio_file} absent — scènes sans voix (durées simulées)')
    else:
        est, est_total = estimate(toks)
        dur, t0, t1, sil = analyse(path)
        file_duration = round(dur, 2)
        letters = sum(spoken(w) for w in toks)
        rate = letters / max(1.0, (t1 - t0) - sum(b - a for a, b in sil))
        pairs = align(toks, line_end, est, est_total, t0, t1, sil, rate)
        print(f'{audio_file} : durée {dur:.2f}s · voix {t0:.2f}→{t1:.2f}s · {len(sil)} silences · {len(pairs)} repères · débit {rate:.1f} lettres/s')

        matched = {wi: s1 for (s0, s1), wi in pairs}
        # diagnostic : entre deux repères consécutifs, le débit doit rester proche du débit moyen de la voix
        cum = [0]
        for w in toks: cum.append(cum[-1] + spoken(w))
        ratios = []
        for ((a0, a1), wa), ((b0, b1), wb) in zip(pairs, pairs[1:]):
            speech = (b0 - a1) - sum(y - x for x, y in sil if x >= a1 - 1e-6 and y <= b0 + 1e-6)
            if speech <= 0.2: continue
            r = (cum[wb] - cum[wa]) / speech
            ratios.append(rate / r)   # parole réelle / parole attendue : proche de 1 si l'alignement est juste
            if r > rate * 1.7 or r < rate * 0.5:
                print(f'  ⚠ rythme douteux entre {a1:.2f}s et {b0:.2f}s : {r:.0f} lettres/s (voix : {rate:.0f}) — « {toks[wa]} … {toks[wb - 1]} »')
        pts = sorted([(0.0, t0)] + [(est[wi], s1) for wi, s1 in matched.items()] + [(est_total, t1)])

        def real(e):  # temps estimé → temps réel (interpolation entre repères)
            for k in range(1, len(pts)):
                (e0, r0), (e1, r1) = pts[k - 1], pts[k]
                if e <= e1: return r0 + (e - e0) / ((e1 - e0) or 1) * (r1 - r0)
            return t1

        if ratios:
            ok_ = all(0.6 <= x <= 1.6 for x in ratios)
            print(f'  contrôle de plausibilité : {len(ratios)} intervalles, parole réelle / attendue entre ×{min(ratios):.2f} et ×{max(ratios):.2f} '
                  + ('→ alignement cohérent' if ok_ else '→ ⚠ ALIGNEMENT DOUTEUX : vérifier les passages signalés ci-dessus'))

        starts = {}
        for k in order:
            first = offsets[k]
            starts[k] = matched.get(first, real(est[first]))
            if first not in matched: print(f'  ⚠ début de « {k} » estimé (aucun silence reconnu) : {starts[k]:.2f}s')
        starts[order[0]] = 0.0
        for n, k in enumerate(order):
            end = starts[order[n + 1]] if n + 1 < len(order) else dur
            segments[k] = {'from': round(starts[k], 2), 'to': round(end, 2)}
            print(f'\n=== {k}  [{starts[k]:.2f}s → {end:.2f}s]  ({end - starts[k]:.1f}s)')
            for (s0, s1), wi in pairs:
                local = wi - offsets[k]
                if not (0 < local < len(scene_toks[k])): continue
                ph = unique_phrase(scene_toks[k], local)
                at = s1 - starts[k]
                print(f'  silence {s0:6.2f}→{s1:6.2f} ({s1 - s0:3.1f}s)  ⇒ « {ph} » à {at:.2f}s (scène)')
                if 0.05 < at < end - starts[k]: result[k].append({'text': ph, 'at': round(at, 2)})

    if REPORT: return
    body = ['// Généré par scripts/calibrate-sync.py — ne pas modifier à la main.',
            '// Le cours est UN MP3 : chaque scène en occupe une plage [from, to] (secondes).',
            '// `SYNC` : repères « ce mot commence à tant de secondes APRÈS LE DÉBUT DE LA SCÈNE ».',
            "import type { SceneKey } from './narration'", '',
            f'/** Durée du MP3 au moment de la calibration (null = pas de MP3) */',
            f'export const FILE_DURATION: number | null = {json.dumps(file_duration)}', '',
            'export const SEGMENTS: Record<SceneKey, { from: number; to: number } | null> = {']
    for k in order: body.append(f'  {k}: {json.dumps(segments[k])},')
    body += ['}', '', 'export const SYNC: Record<SceneKey, { text: string; at: number }[]> = {']
    for k in order:
        body.append(f'  {k}: [')
        for a in result[k]: body.append(f"    {{ text: {json.dumps(a['text'], ensure_ascii=False)}, at: {a['at']} }},")
        body.append('  ],')
    body.append('}')
    with open(OUT, 'w') as f: f.write('\n'.join(body) + '\n')
    print(f'\n→ {os.path.relpath(OUT, ROOT)} écrit')


main()
