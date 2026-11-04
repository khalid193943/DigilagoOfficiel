"""Page « Recrutement » (recrutement.html), en français ; l'anglais et l'arabe suivent avec le reste de la chaîne.

Stages et emplois chez Digilago : les métiers de l'agence, comment se passe une candidature, puis le formulaire.
La candidature arrive dans la Gestion (« Demandes », source « Recrutement »), avec WhatsApp en relais
(src/js/lab.js, partagé avec le Lab et la page Collaborer). Aucune offre n'est inventée : la page présente les métiers
et accepte les candidatures spontanées. Le CV se partage par un lien (Drive, LinkedIn, portfolio).

Même mise en page que « Collaborer » (src/css/collab.src.css). Le script ajoute « Recrutement » dans la colonne
Navigation du pied de page de toutes les pages (idempotent).

Usage : python3 tools/recrutement.py
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lab  # noqa: E402
import collab  # noqa: E402
from lab import T, A, ARR, WA, GET, field, svg  # noqa: E402
from collab import ico, sh  # noqa: E402

ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
FOOT = ('Recrutement', 'Careers', 'التوظيف')

collab.ICO.update({
    'code': '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5l-3 14"/>',
    'design': '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1.3"/><circle cx="14.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="13.5" r="1.3"/><path d="M12 20.5c-1.5 0-2-1.5-1-2.5s.5-2.5-1-2.5"/>',
    'write': '<path d="M5 19.5h14"/><path d="M14.5 5.5 18 9l-8.5 8.5H6V14z"/>',
    'video': '<rect x="3.5" y="6" width="12.5" height="12" rx="2.5"/><path d="m16 10.5 4.5-2.5v8l-4.5-2.5"/>',
    'sales': '<path d="M4.5 19.5h15"/><path d="M6.5 16V11M11 16V7.5M15.5 16v-5.5"/><path d="M18.5 5.5l-3 3"/>',
    'school': '<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 11.5v4.2c1.4 1.3 3 1.8 5 1.8s3.6-.5 5-1.8v-4.2"/><path d="M21 9.5V15"/>',
})

C = {
    'title': ('Recrutement : stages et emplois chez Digilago | Digilago',
              'Careers: internships and jobs at Digilago | Digilago',
              'التوظيف: تداريب ووظائف في Digilago | Digilago'),
    'desc': ('Stage, premier emploi ou poste confirmé : rejoignez Digilago, agence web marocaine. Développement, design, '
             'rédaction, vidéo ou vente : candidature en deux minutes.',
             'Internship, first job or experienced role: join Digilago, a Moroccan web agency. Development, design, '
             'writing, video or sales: apply in two minutes.',
             'تدريب أو أول وظيفة أو منصب لذوي الخبرة: انضم إلى Digilago، الوكالة الرقمية المغربية. تطوير أو تصميم أو كتابة '
             'أو فيديو أو مبيعات: قدّم ترشيحك في دقيقتين.'),
    'eyebrow': ('Recrutement', 'Careers', 'التوظيف'),
    'h1a': ('Rejoignez Digilago :', 'Join Digilago:', 'انضم إلى Digilago:'),
    'h1b': ('stages et emplois.', 'internships and jobs.', 'تداريب ووظائف.'),
    'lead': ('Développement, design, rédaction, vidéo ou vente : si le web vous passionne, écrivez-nous. Chaque candidature '
             'est lue par l’équipe.',
             'Development, design, writing, video or sales: if the web is your thing, write to us. Every application is '
             'read by the team.',
             'تطوير أو تصميم أو كتابة أو فيديو أو مبيعات: إذا كان الويب شغفك، فاكتب إلينا. كل ترشيح يقرؤه الفريق.'),
    'cta': ('Postuler', 'Apply', 'قدّم ترشيحك'),
    'trust': [('Stages et emplois', 'Internships and jobs', 'تداريب ووظائف'),
              ('Candidature en deux minutes', 'Apply in two minutes', 'ترشيح في دقيقتين'),
              ('Candidatures spontanées bienvenues', 'Open applications welcome', 'الترشيحات التلقائية مرحَّب بها')],
    'jobs_k': ('Les métiers', 'The roles', 'المهن'),
    'jobs_h1': ('Cinq métiers à l’agence,', 'Five roles at the agency,', 'خمس مهن في الوكالة،'),
    'jobs_h2': ('une seule équipe.', 'one team.', 'وفريق واحد.'),
    'jobs_p': ('Pas d’offre précise en ce moment ? Envoyez une candidature spontanée : nous la gardons pour le bon projet.',
               'No specific opening right now? Send an open application: we keep it for the right project.',
               'لا يوجد عرض محدد حالياً؟ أرسل ترشيحاً تلقائياً: نحتفظ به للمشروع المناسب.'),
    'intern_k': ('Stages', 'Internships', 'التداريب'),
    'intern_h': ('Un stage sur de vrais projets.', 'An internship on real projects.', 'تدريب على مشاريع حقيقية.'),
    'intern_p': ('Stage d’observation, d’été ou de fin d’études : vous travaillez sur des sites et des outils qui servent '
                 'de vrais clients, avec quelqu’un de l’équipe à vos côtés. À la fin, une attestation de stage.',
                 'Observation, summer or final-year internship: you work on websites and tools that serve real clients, '
                 'with someone from the team by your side. At the end, an internship certificate.',
                 'تدريب ملاحظة أو تدريب صيفي أو تدريب نهاية الدراسة: تعمل على مواقع وأدوات تخدم زبناء حقيقيين، مع أحد أعضاء '
                 'الفريق إلى جانبك. وفي النهاية، شهادة تدريب.'),
    'intern_tip': ('Indiquez votre école, vos dates et, si vous en avez un, le sujet de votre projet de fin d’études.',
                   'Tell us your school, your dates and, if you have one, the topic of your final-year project.',
                   'اذكر مدرستك وتواريخك، وموضوع مشروع نهاية الدراسة إن وُجد.'),
    'steps_k': ('Comment ça se passe', 'How it works', 'كيف يتم ذلك'),
    'steps_h1': ('Trois étapes,', 'Three steps,', 'ثلاث مراحل،'),
    'steps_h2': ('sans détour.', 'no detours.', 'دون تعقيد.'),
    'form_k': ('Postuler', 'Apply', 'الترشيح'),
    'form_h1': ('Votre candidature,', 'Your application,', 'ترشيحك،'),
    'form_h2': ('en deux minutes.', 'in two minutes.', 'في دقيقتين.'),
    'form_p': ('Un lien vers votre CV ou vos travaux suffit : Google Drive, LinkedIn, Behance, GitHub ou votre site.',
               'A link to your CV or your work is enough: Google Drive, LinkedIn, Behance, GitHub or your website.',
               'يكفي رابط إلى سيرتك الذاتية أو أعمالك: Google Drive أو LinkedIn أو Behance أو GitHub أو موقعك.'),
    'kind': ('Vous cherchez', 'You are looking for', 'تبحث عن'),
    'field': ('Votre métier', 'Your field', 'مجالك'),
    'email': ('E-mail', 'Email', 'البريد الإلكتروني'),
    'city': ('Ville', 'City', 'المدينة'),
    'link': ('Lien vers votre CV ou vos travaux', 'Link to your CV or your work', 'رابط سيرتك الذاتية أو أعمالك'),
    'msg': ('Quelques mots sur vous', 'A few words about you', 'كلمات قليلة عنك'),
    'msg_ph': ('Ce que vous savez faire, ce que vous voulez apprendre, et pour un stage : votre école et vos dates.',
               'What you can do, what you want to learn, and for an internship: your school and your dates.',
               'ما تجيده، وما تريد تعلّمه، وبالنسبة للتدريب: مدرستك وتواريخك.'),
    'send': ('Envoyer ma candidature', 'Send my application', 'أرسل ترشيحي'),
    'privacy': ('Votre candidature sert seulement à ce recrutement : elle n’est jamais partagée.',
                'Your application is only used for this recruitment: it is never shared.',
                'يُستعمل ترشيحك لهذا التوظيف فقط: ولا يُشارَك أبداً.'),
    'wa_hello': ('Bonjour Digilago, je vous écris pour une candidature.', 'Hello Digilago, I am writing about an application.',
                 'مرحباً Digilago، أكتب إليكم بخصوص ترشيح.'),
    'ok_p': ('Merci. Quelqu’un de l’équipe lit votre candidature et vous recontacte s’il y a une suite.',
             'Thank you. Someone from the team reads your application and gets back to you if there is a next step.',
             'شكراً. سيقرأ أحد أعضاء الفريق ترشيحك ويعاود الاتصال بك إن كانت هناك خطوة تالية.'),
    'faq_k': ('Questions', 'Questions', 'أسئلة'),
    'faq_h1': ('Avant de postuler,', 'Before you apply,', 'قبل أن تترشح،'),
    'faq_h2': ('ce qu’on nous demande.', 'what people ask us.', 'ما يُسأل عنه.'),
}
# (clé, icône, métier, ce que vous y faites, libellé pour la Gestion)
JOBS = [
    ('dev', 'code', ('Développement web', 'Web development', 'تطوير الويب'),
     ('Sites, boutiques et applications : du code propre, rapide et testé.', 'Websites, shops and apps: clean, fast and tested code.',
      'مواقع ومتاجر وتطبيقات: برمجة نظيفة وسريعة ومختبَرة.'), 'Développement'),
    ('design', 'design', ('Design et identité visuelle', 'Design and visual identity', 'التصميم والهوية البصرية'),
     ('Maquettes, logos, chartes : des marques qu’on reconnaît.', 'Mock-ups, logos, brand guides: brands people recognise.',
      'نماذج وشعارات وهويات: علامات يتعرّف عليها الناس.'), 'Design'),
    ('content', 'write', ('Rédaction et référencement', 'Writing and SEO', 'الكتابة وتحسين الظهور'),
     ('Des textes clairs en français, en arabe ou en anglais, trouvés sur Google et par les IA.',
      'Clear copy in French, Arabic or English, found on Google and by AI assistants.',
      'نصوص واضحة بالفرنسية أو العربية أو الإنجليزية، تظهر على Google وفي أدوات الذكاء الاصطناعي.'), 'Rédaction / SEO'),
    ('video', 'video', ('Réseaux sociaux et vidéo', 'Social media and video', 'الشبكات الاجتماعية والفيديو'),
     ('Reels, photos et publications qui donnent envie d’appeler.', 'Reels, photos and posts that make people want to call.',
      'مقاطع Reels وصور ومنشورات تحفّز على الاتصال.'), 'Réseaux sociaux / vidéo'),
    ('sales', 'sales', ('Relation client et vente', 'Client relations and sales', 'العلاقة مع الزبناء والمبيعات'),
     ('Écouter les entreprises, les conseiller et les accompagner jusqu’à la mise en ligne.',
      'Listen to businesses, advise them and stay with them until launch.',
      'الإنصات إلى الشركات ونصحها ومرافقتها إلى غاية النشر.'), 'Commercial'),
]
KINDS = [('stage', ('Un stage', 'An internship', 'تدريب'), 'Stage'),
         ('emploi', ('Un emploi', 'A job', 'وظيفة'), 'Emploi'),
         ('spontanee', ('Candidature spontanée', 'Open application', 'ترشيح تلقائي'), 'Candidature spontanée')]
STEPS = [
    (('Vous postulez', 'You apply', 'تتقدم بترشيحك'),
     ('Par le formulaire ci-dessous, avec un lien vers votre CV ou vos travaux.',
      'With the form below, with a link to your CV or your work.', 'عبر الاستمارة أسفله، مع رابط إلى سيرتك الذاتية أو أعمالك.')),
    (('On en parle', 'We talk', 'نتحدث'),
     ('Un appel de 20 minutes pour faire connaissance et parler de vos projets.',
      'A 20-minute call to get to know each other and talk about your projects.', 'مكالمة من 20 دقيقة للتعارف والحديث عن مشاريعك.')),
    (('On décide ensemble', 'We decide together', 'نقرر معاً'),
     ('Stage, essai ou contrat : les missions et les conditions sont écrites avant de commencer.',
      'Internship, trial or contract: the tasks and terms are written down before you start.',
      'تدريب أو فترة تجريبية أو عقد: تُكتب المهام والشروط قبل البدء.')),
]
FAQ = [
    (('Faut-il un diplôme pour postuler ?', 'Do I need a degree to apply?', 'هل يلزم دبلوم للترشح؟'),
     ('Pas forcément. Montrez-nous ce que vous savez faire : un site, des maquettes, des textes ou des vidéos comptent beaucoup.',
      'Not necessarily. Show us what you can do: a website, mock-ups, writing or videos count a lot.',
      'ليس بالضرورة. أرنا ما تجيده: موقع أو نماذج أو نصوص أو فيديوهات، كلها مهمة.')),
    (('Comment postuler pour un stage de fin d’études ?', 'How do I apply for a final-year internship?',
      'كيف أترشح لتدريب نهاية الدراسة؟'),
     ('Choisissez « Un stage », puis indiquez votre école, vos dates et le sujet de votre projet si vous en avez un.',
      'Choose “An internship”, then tell us your school, your dates and your project topic if you have one.',
      'اختر «تدريب»، ثم اذكر مدرستك وتواريخك وموضوع مشروعك إن وُجد.')),
    (('Puis-je envoyer mon CV par e-mail ?', 'Can I send my CV by email?', 'هل يمكنني إرسال سيرتي الذاتية عبر البريد الإلكتروني؟'),
     ('Oui, à contact@digilago.ma. Le formulaire reste le plus rapide : un lien vers votre CV suffit.',
      'Yes, to contact@digilago.ma. The form is still the fastest way: a link to your CV is enough.',
      'نعم، إلى contact@digilago.ma. وتبقى الاستمارة الطريقة الأسرع: يكفي رابط إلى سيرتك الذاتية.')),
    (('Que devient ma candidature ?', 'What happens to my application?', 'ماذا يحدث لترشيحي؟'),
     ('L’équipe la lit, et vous recontacte s’il y a une suite. Elle ne sert qu’au recrutement et n’est jamais partagée.',
      'The team reads it and gets back to you if there is a next step. It is only used for recruitment and never shared.',
      'يقرؤه الفريق ويعاود الاتصال بك إن كانت هناك خطوة تالية. ولا يُستعمل إلا للتوظيف ولا يُشارَك أبداً.')),
]


def hero(sky):
    trust = ''.join('<li>%s%s</li>' % (ico('check'), T(t)) for t in C['trust'])
    return ('<header class="phero co-hero">%s<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>%s</span></p>'
            '<h1 class="hin"><span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span></h1>'
            '<p class="lead in2 hin">%s</p><div class="hcta in2"><a href="#postuler" class="cta mono"><span class="arw">%s</span>'
            '<span class="lbl">%s</span></a><a href="%s" class="ghost" target="_blank" rel="noopener noreferrer">%s%s</a></div>'
            '<ul class="trust in2">%s</ul></header>') % (
        sky, T(C['eyebrow']), T(C['h1a']), T(C['h1b']), T(C['lead']), ARR, T(C['cta']), WA, T(lab.S['wa']), ARR, trust)


def jobs():
    cards = ''.join(
        '<article class="co-way rc-job rv" id="rc-%s"><span class="co-ic">%s</span><h3>%s</h3><p class="co-for">%s</p>'
        '<a class="co-go" href="#postuler" data-pick="rc-%s">%s %s</a></article>' % (
            k, ico(ic), T(title), T(p), k, T(C['cta']), ARR.replace('<svg', '<svg class="ar"', 1))
        for k, ic, title, p, fr in JOBS)
    intern = ('<article class="co-way rc-intern rv"><span class="co-ic">%s</span><p class="rc-k">%s</p><h3>%s</h3>'
              '<p class="co-for">%s</p><p class="rc-tip">%s</p><a class="co-go" href="#postuler" data-pick="rc-stage">%s %s</a></article>') % (
        ico('school'), T(C['intern_k']), T(C['intern_h']), T(C['intern_p']), T(C['intern_tip']), T(C['cta']),
        ARR.replace('<svg', '<svg class="ar"', 1))
    return '<section class="blk co-sec" id="metiers">%s<div class="co-ways rc-jobs w">%s%s</div></section>' % (
        sh(C['jobs_k'], C['jobs_h1'], C['jobs_h2'], C['jobs_p']), intern, cards)


def steps():
    items = ''.join('<li class="rv d%d"><span class="co-num" aria-hidden="true">0%d</span><h3>%s</h3><p>%s</p></li>' % (
        i + 1, i + 1, T(h), T(p)) for i, (h, p) in enumerate(STEPS))
    return '<section class="blk co-sec" id="etapes">%s<ol class="co-steps w">%s</ol></section>' % (
        sh(C['steps_k'], C['steps_h1'], C['steps_h2']), items)


def form():
    opt = lambda name, val, fr, label, icon, on: (
        '<label class="co-opt"><input type="radio" name="%s" value="%s" data-fr="%s"%s><span>%s%s</span></label>' % (
            name, val, fr, ' checked' if on else '', icon, T(label)))
    kinds = ''.join(opt('kind', 'rc-' + k, 'Recrutement · ' + fr, label, ico('school' if k == 'stage' else 'users'), i == 0)
                    for i, (k, label, fr) in enumerate(KINDS))
    domains = ''.join(opt('domain', 'rc-' + k, fr, title, ico(ic), i == 0) for i, (k, ic, title, p, fr) in enumerate(JOBS))
    f = ('<form class="ask co-form rv d1" novalidate data-src="Recrutement" data-form="recrutement" aria-labelledby="rcFormTitle">'
         '<fieldset class="co-opts"><legend>%s</legend>%s</fieldset>'
         '<fieldset class="co-opts"><legend>%s</legend>%s</fieldset>'
         '<div class="ask-grid">%s%s%s%s%s%s</div>'
         '<div class="ask-hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>'
         '<p class="ask-err" role="alert" hidden><span data-e="name">%s</span><span data-e="contact">%s</span>'
         '<span data-e="send">%s</span></p>'
         '<div class="ask-go"><button class="co-send" type="submit">%s%s</button>'
         '<a class="ask-wa" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>'
         '<p class="ask-pv">%s%s <a href="confidentialite.html">%s</a></p>'
         '<span class="ask-t" hidden data-t="hello">%s</span></form>'
         '<div class="ask-ok co-ok" role="status" tabindex="-1" hidden>%s<b>%s</b><p>%s</p>'
         '<a class="co-send" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>') % (
        T(C['kind']), kinds, T(C['field']), domains,
        field('name', GET['name'], auto='name', mx=80),
        field('phone', GET['phone'], kind='tel', auto='tel', mx=24, ph=('06 00 00 00 00',) * 3),
        field('email', C['email'], kind='email', auto='email', mx=120),
        field('city', C['city'], auto='address-level2', opt=True, mx=80),
        field('link', C['link'], kind='url', auto='url', opt=True, mx=300, ph=('https://',) * 3),
        field('message', C['msg'], kind='area', opt=True, ph=C['msg_ph'], mx=2000, full=True),
        T(GET['e_name']), T(GET['e_contact']), T(GET['e_send']),
        T(C['send']), ARR.replace('<svg', '<svg class="ar"', 1), WA, svg('chat'), T(GET['or_wa']),
        svg('lock'), T(C['privacy']), T(GET['privacy_a']), T(C['wa_hello']),
        ico('check'), T(GET['ok_h']), T(C['ok_p']), WA, svg('chat'), T(lab.S['wa']))
    return ('<section class="blk co-sec" id="postuler"><div class="co-form-in w"><div class="co-form-side">%s</div>'
            '<div class="co-form-main">%s</div></div></section>') % (
        sh(C['form_k'], C['form_h1'], C['form_h2'], C['form_p'], cls='left').replace('<h2 ', '<h2 id="rcFormTitle" ', 1), f)


def faq():
    items = ''.join('<details class="rv"><summary>%s<i aria-hidden="true"></i></summary><p>%s</p></details>' % (T(q), T(a))
                    for q, a in FAQ)
    return '<section class="blk co-sec" id="faq">%s<div class="faq co-faq w">%s</div></section>' % (
        sh(C['faq_k'], C['faq_h1'], C['faq_h2']), items)


def foot_link(h):
    """« Recrutement » dans la colonne Navigation du pied de page, après « Collaborer » (idempotent)."""
    f = re.search(r'<nav class="f-col" aria-label="Navigation"><h6>Navigation</h6>(.*?)</nav>', h, re.S)
    if not f or 'href="recrutement.html"' in f.group(1):
        return h
    link = '<a href="recrutement.html">%s</a>' % T(FOOT)
    col, n = re.subn(r'(<a href="collaborer\.html">.*?</a>)', lambda x: x.group(1) + link, f.group(1), count=1, flags=re.S)
    if not n:
        col = col.replace('<a href="contact.html">', link + '<a href="contact.html">', 1)
    return h[:f.start(1)] + col + h[f.end(1):]


def main():
    src = open(os.path.join(SITE, 'services.html'), encoding='utf-8').read()
    a = src.index('<main class="pg light" id="main">')
    b = src.index('</main>', src.index('<section class="blk"><div class="cband'))
    hd, tail = src[:a], src[b:]
    ph = src[a:src.index('</header>', a)]
    sky = ph[ph.index('<div class="sky"'):ph.index('<p class="eyebrow')]
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(C['title']), hd, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % A(C['desc']), h, count=1)
    h = re.sub(r'<style id="(?:co|rc)-css">.*?</style>', '', h, flags=re.S)
    h = re.sub(r'<style id="lband-css">.*?</style>', '', h, flags=re.S)
    h = h.replace('</head>', '<style id="rc-css">%s%s</style></head>' % (collab.css(), lab.css('recrutement.src.css')), 1)
    i = tail.rindex('</body>')
    tail = tail[:i] + '<script id="lab-js">%s</script>' % lab.lab_js() + tail[i:]
    body = hero(sky) + jobs() + steps() + form() + faq()
    page = foot_link(h + '<main class="pg light co rc" id="main" data-rc="1">%s' % body + tail)
    open(os.path.join(SITE, 'recrutement.html'), 'w', encoding='utf-8').write(page)
    n = 0
    for f in glob.glob(os.path.join(SITE, '*.html')):
        h = open(f, encoding='utf-8').read()
        k = foot_link(h)
        if k != h:
            open(f, 'w', encoding='utf-8').write(k)
            n += 1
    print('Recrutement : page écrite, lien ajouté au pied de %d pages, %d traductions ajoutées' % (n, lab.save_tr()))


if __name__ == '__main__':
    main()
