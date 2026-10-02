"""Page Contact : formulaire simplifié (idempotent).

L'essentiel d'abord (nom, téléphone, ce qui vous intéresse, message) ; entreprise, métier et ville passent
dans « Ajouter des détails (facultatif) ». Les champs gardent leur nom : le script d'envoi ne change pas.

Usage : python3 tools/contact_page.py
"""
import os, re

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'contact.html')


def main():
    h = open(P, encoding='utf-8').read()
    if 'class="full more-f"' in h:
        print('contact : déjà simplifié')
        return
    f = re.search(r'<form class="cform rv" id="cform" novalidate>(.*?)<div class="ok2"', h, re.S)
    body = f.group(1)
    get = lambda pat: re.search(pat, body, re.S).group(0)
    nom = get(r'<label>Votre nom<input name="nom".*?</label>')
    ent = get(r'<label>Votre entreprise<input name="ent".*?</label>')
    met = get(r'<label>Votre métier<select name="met">.*?</select></label>')
    ville = get(r'<label>Votre ville<input name="ville".*?</label>')
    tel = get(r'<label class="full">Téléphone ou WhatsApp<input name="tel".*?</label>').replace('<label class="full">', '<label>')
    svs = get(r'<div class="full"><label style="margin-bottom:calc\(10 \* var\(--u\)\)">Ce qui vous intéresse</label><div class="svs">.*?</div></div>')
    msg = get(r'<label class="full">Votre message<textarea name="msg".*?</label>')
    more = ('<details class="full more-f"><summary>Ajouter des détails (facultatif)</summary><div class="more-g">%s%s%s</div></details>'
            % (ent, met, ville))
    h = h.replace(body, nom + tel + svs + msg + more, 1)
    h = h.replace('Remplissez ce qui vous paraît utile. Rien n’est obligatoire, sauf votre nom.',
                  'Votre nom et votre numéro suffisent : on vous répond le jour même.')
    open(P, 'w', encoding='utf-8').write(h)
    print('contact : formulaire simplifié')


if __name__ == '__main__':
    main()
