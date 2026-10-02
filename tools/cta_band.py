"""Bandeau d'appel à l'action de fin de page : « On vous rappelle » (idempotent).

Chaque page garde son titre (« Prêt à passer à l'action ? », « Une question avant ? »…), et le bandeau devient
un vrai bloc de conversion : un mini-formulaire (prénom + téléphone) pour être rappelé le jour même, envoyé
à l'espace de gestion comme les autres formulaires, plus le lien de la page (démarrer ou contact) et WhatsApp.

Usage : python3 tools/cta_band.py
"""
import glob, os, re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
PHONE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>')
WA = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2'
      'a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1'
      'a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7'
      ' 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')
CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')


def band(h3, href, label):
    h3 = re.sub(r' \?', '&nbsp;?', h3)  # pas de « ? » seul sur sa ligne
    return ('<div class="cband cb2 rv"><div class="cb-l"><span class="cb-live"><i></i>Réponse le jour même</span>'
            '<h3>%s</h3><p class="cb-p">Laissez votre numéro : quelqu’un de l’équipe vous rappelle aujourd’hui, '
            'gratuitement et sans engagement.</p><div class="cb-alt"><a class="cb-go" href="%s">%s%s</a>'
            '<a class="cb-wa" href="https://wa.me/212649953813" target="_blank" rel="noopener noreferrer">%sWhatsApp</a></div></div>'
            '<form class="cb-form" novalidate><b class="cb-t">%sOn vous rappelle</b>'
            '<label><span>Prénom</span><input name="n" autocomplete="given-name" placeholder="Votre prénom" maxlength="40"></label>'
            '<label><span>Téléphone</span><input name="p" type="tel" inputmode="tel" autocomplete="tel" placeholder="06 00 00 00 00" maxlength="20"></label>'
            '<button type="submit">Être rappelé aujourd’hui%s</button>'
            '<small class="cb-n">Du lundi au samedi, de 9 h à 19 h · gratuit</small>'
            '<div class="cb-ok" role="status" aria-live="polite">%s<b>C’est noté, merci&nbsp;!</b><span>Nous vous rappelons aujourd’hui.</span></div>'
            '</form></div>') % (h3, href, label, ARROW, WA, PHONE, ARROW, CHECK)


def main():
    n = 0
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        h = open(f, encoding='utf-8').read()
        if 'class="cband cb2' in h:
            continue
        m = re.search(r'<div class="cband rv"><h3>(.*?)</h3><a href="([^"]+)">([^<]+)<svg.*?</svg></a></div>', h, re.S)
        if not m:
            continue
        h = h[:m.start()] + band(m.group(1), m.group(2), m.group(3)) + h[m.end():]
        open(f, 'w', encoding='utf-8').write(h)
        n += 1
    print(n, 'bandeaux « On vous rappelle »')


if __name__ == '__main__':
    main()
