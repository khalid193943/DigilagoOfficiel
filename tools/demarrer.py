"""Page « Démarrer » : le formulaire le plus simple possible, en trois étapes.

1. Votre besoin (choix en tuiles)  2. Où vous joindre (prénom, téléphone, entreprise facultative)
3. Quand vous appeler (maintenant, dans l'heure, plus tard aujourd'hui, demain, un autre jour ; matin ou
après-midi). La demande part directement dans l'espace de gestion (pas de redirection vers WhatsApp) ; le
moment choisi dit à l'équipe qui rappeler d'abord, et à quel point le client est intéressé.
Puis un écran de confirmation clair : « C'est reçu, on vous appelle [moment choisi] », les étapes qui suivent,
et WhatsApp en option. Le métier, la ville, le délai, le site existant et l'e-mail sont demandés pendant l'appel.
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


CHK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
WAI = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2'
       'a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1'
       'a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7'
       ' 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')
CLK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">'
       '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>')
# les moments proposés ; le script de la page cache ceux qui ne sont plus possibles (heure, jour de fermeture)
CB_OPTS = [('now', 'Maintenant', 'On vous appelle dans les 15 minutes'),
           ('open', 'Dès l’ouverture', 'Demain à 9 h'),
           ('hour', 'Dans l’heure', 'Le temps de vous libérer'),
           ('today', 'Plus tard aujourd’hui', 'Avant 19 h'),
           ('day', 'Demain', 'Le matin ou l’après-midi'),
           ('pick', 'Un autre jour', 'Vous choisissez la date')]
CB_STEP = ('<div class="wz-step" data-step="2"><span class="wz-k">Étape 3 sur 3</span>'
           '<h3>Quand voulez-vous <em>qu’on vous appelle ?</em></h3>'
           '<p class="wz-h">Un appel de dix minutes, gratuit et sans engagement. Du lundi au samedi, de 9 h à 19 h.</p>'
           '<div class="cbo-g" id="tCb" role="radiogroup">%s</div>'
           '<div class="cbo-more" id="cbMore" hidden><label class="big-in sm" id="cbDateW" hidden><span>Le jour</span>'
           '<input id="cbDate" type="date"></label><div class="cbo-slot" id="cbSlot" role="radiogroup">'
           '<button type="button" class="wchip on" data-slot="am" role="radio" aria-checked="true">Le matin <small>9 h – 12 h</small></button>'
           '<button type="button" class="wchip" data-slot="pm" role="radio" aria-checked="false">L’après-midi <small>14 h – 18 h</small></button>'
           '</div></div><dl class="recap" id="recap"></dl></div> ') % ''.join(
    '<button type="button" class="cbo" data-cb="%s" role="radio" aria-checked="false"><span class="cbo-ic">%s</span>'
    '<b>%s</b><small>%s</small></button>' % (k, CLK, t, d) for k, t, d in CB_OPTS)
DONE = ('<div class="wz-done" id="wzDone"><span class="done-ic">%s</span><span class="wz-k" id="wzRef"></span>'
        '<h3>C’est reçu. <em>On vous appelle.</em></h3>'
        '<div class="done-when"><span class="dw-ic">%s</span><div><b id="wzWhen"></b><span id="wzTel"></span></div></div>'
        '<ol class="done-tl">'
        '<li class="d-ok"><i>%s</i><div><b>Demande reçue</b><span>À l’instant, par l’équipe Digilago</span></div></li>'
        '<li class="d-nx"><i>2</i><div><b>Appel de dix minutes</b><span id="wzT2">Au moment que vous avez choisi</span></div></li>'
        '<li><i>3</i><div><b>Votre première version</b><span>Sous 72 heures après l’appel</span></div></li>'
        '<li><i>4</i><div><b>Mise en ligne</b><span>Quand elle vous plaît, et pas avant</span></div></li></ol>'
        '<div class="done-alt"><span>Une question d’ici là ?</span><a class="wz-wa" id="wzWa" href="https://wa.me/212649953813" '
        'target="_blank" rel="noopener noreferrer">%sÉcrire sur WhatsApp</a></div></div>') % (CHK, CLK, CHK, WAI)
FAIL = ('<div class="wz-fail" id="wzFail" role="alert" hidden><b>La demande n’est pas partie.</b>'
        '<span>Vérifiez votre connexion et réessayez. Ou envoyez-la sur WhatsApp : rien n’est perdu.</span>'
        '<div><button type="button" class="wz-retry" id="wzRetry">Réessayer</button>'
        '<a class="wz-wa" id="wzFailWa" href="https://wa.me/212649953813" target="_blank" rel="noopener noreferrer">%sEnvoyer sur WhatsApp</a>'
        '</div></div>') % WAI


def callback_step(h):
    """3ᵉ étape « Quand vous appeler ? », écran de confirmation, message en cas d'échec (idempotent)."""
    a, b, ss = steps(h)
    ss = [CB_STEP if ('id="recap"' in x or 'id="tCb"' in x) else x for x in ss]
    h = h[:a] + ' ' + ''.join(x.strip() + ' ' for x in ss) + h[b:]
    i = h.index('<div class="wz-done"')
    j = h.index('<div class="wz-err"', i)
    # la fin de l'écran de confirmation : juste avant la fermeture de la carte, qui précède wz-err
    h = h[:i] + DONE + '</div>' + h[j:]
    h = re.sub(r'<div class="wz-fail".*?</div></div>', '', h, flags=re.S)
    k = h.index('<div class="wz-err"')
    return h[:k] + FAIL + h[k:]


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
                   for k, (p, t) in enumerate([('0', 'Besoin'), ('50', 'Contact'), ('100', 'Rappel')])) + m.group(2),
               h, count=1, flags=re.S)
    h = callback_step(h)
    h = h.replace(LEAD_OLD, LEAD_NEW).replace('en 5 étapes simples.', 'en 3 étapes simples.').replace('<span class="wz-count" id="wzCount">1 / 5</span>',
                                              '<span class="wz-count" id="wzCount">1 / 3</span>')
    open(P, 'w', encoding='utf-8').write(h)
    print('démarrer : %d étapes' % len(out))


if __name__ == '__main__':
    main()
