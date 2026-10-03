"""Page « Démarrer » : le formulaire le plus simple possible, en trois étapes.

1. Votre besoin (choix en tuiles)  2. Où vous répondre (prénom, WhatsApp ou téléphone, entreprise facultative)
3. Vérifier et lancer. Le métier, la ville, le délai, le site existant, l'e-mail et la préférence de contact
sont retirés : on les demande pendant l'appel. Seul le téléphone est obligatoire.
Idempotent. Usage : python3 tools/demarrer.py
"""
import os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
P = os.path.join(ROOT, 'site', 'demarrer.html')
LEAD_OLD = 'Six petites étapes, deux minutes. Pas de jargon, pas d’engagement : vous validez seulement la première version.'
LEAD_NEW = 'Trois petites étapes, une minute. Pas de jargon, pas d’engagement : vous validez seulement la première version.'
NAME = ('<label class="big-in sm"><span>Nom de l’entreprise (facultatif)</span><input id="wName" type="text" '
        'maxlength="40" autocomplete="organization" placeholder="Ex. : Clinique Azur"></label>')


def steps(h):
    a = h.index('<div class="wz-steps">') + len('<div class="wz-steps">')
    b = h.index('<div class="wz-done"', a)
    parts = re.split(r'(?=<div class="wz-step[^"]*" data-step=")', h[a:b])
    return a, b, [p for p in parts if p.strip()]


def main():
    h = open(P, encoding='utf-8').read()
    a, b, ss = steps(h)
    if len(ss) != 3:
        keep = []
        for s in ss:
            if 'id="tNeeds"' in s or 'id="recap"' in s:
                keep.append(s)
            elif 'id="wTel"' in s:
                s = re.sub(r'<label class="big-in sm"><span>E-mail.*?</label>', '', s, flags=re.S)
                s = re.sub(r'<div class="wz-sub">[^<]*</div><div class="wchips" id="tPref">.*?</div>', '', s, flags=re.S)
                s = s.replace('</div></div>', '</div>' + NAME + '</div>', 1) if '<div class="duo2">' in s else s
                keep.append(s)
        ss = keep
    out = []
    for i, s in enumerate(ss):
        s = re.sub(r'data-step="\d+"', 'data-step="%d"' % i, s, count=1)
        s = re.sub(r'<span class="wz-k">Étape \d+ sur \d+</span>', '<span class="wz-k">Étape %d sur %d</span>' % (i + 1, len(ss)), s)
        out.append(s.strip() + ' ')
    h = h[:a] + ' ' + ''.join(out) + h[b:]
    # la route : trois étapes
    h = re.sub(r'(<div class="wz-route[^>]*>.*?)(<span class="rt-plane")',
               lambda m: re.sub(r'<span class="rt-dot".*', '', m.group(1), flags=re.S) + ''.join(
                   '<span class="rt-dot" data-k="%d" style="left:%s%%"><i></i><em>%s</em></span>' % (k, p, t)
                   for k, (p, t) in enumerate([('0', 'Besoin'), ('50', 'Contact'), ('100', 'Décollage')])) + m.group(2),
               h, count=1, flags=re.S)
    h = h.replace(LEAD_OLD, LEAD_NEW).replace('<span class="wz-count" id="wzCount">1 / 5</span>',
                                              '<span class="wz-count" id="wzCount">1 / 3</span>')
    open(P, 'w', encoding='utf-8').write(h)
    print('démarrer : %d étapes' % len(out))


if __name__ == '__main__':
    main()
