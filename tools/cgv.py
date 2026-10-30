"""Page « Conditions générales de vente » (cgv.html), en français, anglais et arabe, et son lien dans le pied de page.

La page est bâtie à partir des mentions légales (même ciel, même pied de page, même mise en page « legal ») ;
le reste de la chaîne (titres, CSS, traductions, SEO, sitemap) s'applique ensuite comme sur toutes les pages.
Idempotent : relancer ce script réécrit la page et n'ajoute le lien de pied de page qu'une fois.

Le texte décrit ce que Digilago pratique déjà (devis valable 30 jours, acompte et solde à la mise en ligne,
retouches incluses, site cédé après paiement intégral, domaine et hébergement offerts la première année).
Les points marqués « à confirmer » dans A-FAIRE-CE-SOIR.md sont des choix de rédaction à valider par le gérant.

Usage : python3 tools/cgv.py
"""
import glob, hashlib, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
TR = {}


def T(x):
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def save_tr():
    n = 0
    for lang, i in (('en', 0), ('ar', 1)):
        p = os.path.join(I18N, lang + '.json')
        d = json.load(open(p, encoding='utf-8'))
        for fr, tt in TR.items():
            k = sid(fr)
            if not d.get(k):
                d[k] = tt[i]
                n += 1
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')
    return n


TITLE = ('Conditions générales de vente | Digilago', 'Terms of sale | Digilago', 'شروط البيع العامة | Digilago')
DESC = ('Les conditions de vente de Digilago : devis, paiement, délais, retouches, propriété du site, garantie et litiges.',
        'Digilago’s terms of sale: quotes, payment, deadlines, revisions, site ownership, warranty and disputes.',
        'شروط البيع لدى Digilago: عروض الأسعار والدفع والآجال والتعديلات وملكية الموقع والضمان والنزاعات.')
H1 = (('Conditions générales de vente :', 'Terms of sale:', 'شروط البيع العامة:'),
      ('des règles claires, dès le départ.', 'clear rules, from the start.', 'قواعد واضحة منذ البداية.'))
LEAD = ('Ce qui s’applique à chaque projet réalisé avec Digilago.',
        'What applies to every project carried out with Digilago.',
        'ما ينطبق على كل مشروع يُنجز مع Digilago.')
EYEBROW = ('Informations légales', 'Legal information', 'معلومات قانونية')
FOOT = ('Conditions de vente', 'Terms of sale', 'شروط البيع')

# (titre, [paragraphes]) — chaque élément est un triplet (français, anglais, arabe)
SECTIONS = [
    (('Qui vend', 'Who is selling', 'من هو البائع'), [
        ('Ces conditions s’appliquent à toute prestation vendue par LAGODIGITAL, société à responsabilité limitée à associé unique (SARL AU) au capital de 100 000 dirhams, qui exploite la marque Digilago. Siège social : 78, boulevard de la Résistance, Résidence El Marzouki, 5ᵉ étage, appartement 68, Casablanca. Registre du commerce de Casablanca n° 639275. ICE : 003539032000060.',
         'These terms apply to every service sold by LAGODIGITAL, a single-member limited liability company (SARL AU) with a share capital of 100,000 dirhams, which operates the Digilago brand. Registered office: 78, boulevard de la Résistance, Résidence El Marzouki, 5th floor, apartment 68, Casablanca. Casablanca Trade Register no. 639275. ICE: 003539032000060.',
         'تسري هذه الشروط على كل خدمة تبيعها شركة LAGODIGITAL، وهي شركة ذات مسؤولية محدودة بشريك وحيد (SARL AU) رأسمالها 100 000 درهم، وتستغل العلامة التجارية Digilago. المقر الاجتماعي: 78، شارع المقاومة، إقامة المرزوقي، الطابق الخامس، الشقة 68، الدار البيضاء. السجل التجاري بالدار البيضاء رقم 639275. رقم التعريف الموحد للمقاولة: 003539032000060.'),
        ('Elles s’appliquent avec le devis accepté par le client. En cas de différence entre ces conditions et le devis, le devis prévaut.',
         'They apply together with the quote accepted by the client. If these terms and the quote differ, the quote prevails.',
         'تسري مع عرض السعر الذي قبله الزبون. وفي حال وجود اختلاف بين هذه الشروط وعرض السعر، يُعتمد عرض السعر.'),
    ]),
    (('Nos prestations', 'Our services', 'خدماتنا'), [
        ('Digilago conçoit et met en ligne des sites web, des boutiques en ligne et des applications, crée et optimise les fiches Google Business, rédige les textes pour le référencement sur Google (SEO) et pour les assistants IA (GEO), et s’occupe des noms de domaine, de l’hébergement et de la maintenance. Le contenu exact, le prix et les délais de chaque projet figurent sur le devis.',
         'Digilago designs and publishes websites, online shops and apps, creates and optimizes Google Business profiles, writes content for Google search (SEO) and for AI assistants (GEO), and handles domain names, hosting and maintenance. The exact scope, price and deadlines of each project are set out in the quote.',
         'تصمّم Digilago المواقع الإلكترونية والمتاجر الإلكترونية والتطبيقات وتنشرها، وتنشئ ملفات Google Business وتحسّنها، وتكتب النصوص الخاصة بالظهور في نتائج Google (SEO) وفي مساعدات الذكاء الاصطناعي (GEO)، وتتكفّل بأسماء النطاقات والاستضافة والصيانة. ويرد المحتوى الدقيق لكل مشروع وثمنه وآجاله في عرض السعر.'),
    ]),
    (('Devis et commande', 'Quote and order', 'عرض السعر والطلب'), [
        ('Le devis est gratuit et valable 30 jours. Il vaut bon de commande lorsque le client le signe ou l’accepte en ligne. Il indique le prix en dirhams marocains, hors taxes et toutes taxes comprises, la TVA de 20 % s’ajoutant lorsqu’elle s’applique.',
         'The quote is free and valid for 30 days. It becomes a purchase order when the client signs it or accepts it online. It states the price in Moroccan dirhams, excluding and including tax, with 20% VAT added where it applies.',
         'عرض السعر مجاني وصالح لمدة 30 يوماً. ويُعدّ طلب شراء عندما يوقّعه الزبون أو يقبله عبر الإنترنت. ويبيّن الثمن بالدرهم المغربي دون احتساب الضريبة وبعد احتسابها، مع إضافة الضريبة على القيمة المضافة بنسبة 20% حيثما تنطبق.'),
    ]),
    (('Première version, sans risque', 'First version, risk-free', 'النسخة الأولى دون مخاطرة'), [
        ('Digilago réalise une première version du site dans un délai indicatif de 72 heures à compter de la réception des informations nécessaires (logo, textes, photos, coordonnées). Si, après l’avoir vue, le client ne souhaite pas poursuivre, il ne paie rien pour cette première version et tout acompte déjà versé lui est remboursé.',
         'Digilago builds a first version of the site within an indicative 72 hours of receiving the necessary information (logo, text, photos, contact details). If, after seeing it, the client does not wish to continue, they pay nothing for this first version and any deposit already paid is refunded.',
         'تنجز Digilago نسخة أولى من الموقع في أجل تقريبي مدته 72 ساعة ابتداءً من توصلها بالمعلومات اللازمة (الشعار والنصوص والصور ومعطيات الاتصال). وإذا لم يرغب الزبون في المتابعة بعد اطلاعه عليها، فلا يؤدي أي مبلغ عن هذه النسخة الأولى ويُردّ إليه كل عربون سبق أن دفعه.'),
    ]),
    (('Prix et paiement', 'Price and payment', 'الثمن والأداء'), [
        ('Sauf mention contraire sur le devis, un acompte de 50 % est demandé à la commande et le solde à la mise en ligne du site. Un autre échéancier, par tranches ou en mensualités, peut être convenu par écrit sur le devis.',
         'Unless the quote says otherwise, a 50% deposit is requested when the order is placed and the balance when the site goes live. A different schedule, in instalments or monthly payments, may be agreed in writing on the quote.',
         'ما لم يُذكر خلاف ذلك في عرض السعر، يُطلب عربون بنسبة 50% عند الطلب ويُؤدّى الباقي عند نشر الموقع. ويمكن الاتفاق كتابةً في عرض السعر على جدول أداء آخر، على دفعات أو بأقساط شهرية.'),
        ('Le paiement se fait par virement bancaire sur le compte indiqué sur la facture, ou par un autre moyen convenu. Les factures sont payables sous 15 jours, sauf mention contraire.',
         'Payment is made by bank transfer to the account shown on the invoice, or by another agreed method. Invoices are payable within 15 days unless stated otherwise.',
         'يتم الأداء عن طريق تحويل بنكي إلى الحساب المبيّن في الفاتورة، أو بوسيلة أخرى متفق عليها. وتُؤدّى الفواتير داخل 15 يوماً ما لم يُذكر خلاف ذلك.'),
        ('En cas de retard de paiement, Digilago peut suspendre les travaux, puis la mise en ligne ou la maintenance après une relance restée sans effet, jusqu’au règlement, et appliquer les pénalités de retard prévues par la réglementation en vigueur.',
         'In case of late payment, Digilago may suspend the work, then the go-live or the maintenance after a reminder has gone unanswered, until payment is made, and may apply the late-payment penalties provided for by the regulations in force.',
         'في حالة التأخر في الأداء، يجوز لـ Digilago تعليق الأشغال، ثم تعليق النشر أو الصيانة بعد تذكير لم يُستجب له، إلى حين الأداء، وتطبيق غرامات التأخير المنصوص عليها في التنظيم الجاري به العمل.'),
    ]),
    (('Délais et contenus du client', 'Deadlines and client content', 'الآجال ومحتويات الزبون'), [
        ('Les délais courent à partir de la réception de l’acompte, lorsqu’il est prévu, et de tous les éléments à fournir. Un retard du client pour répondre, fournir ou valider décale les délais d’autant.',
         'Deadlines run from receipt of the deposit, where one is required, and of all the items to be supplied. A delay by the client in replying, supplying or approving pushes the deadlines back by the same amount.',
         'تبدأ الآجال من تاريخ التوصل بالعربون، حيثما كان منصوصاً عليه، ومن التوصل بجميع العناصر المطلوب تقديمها. وأي تأخر من الزبون في الرد أو التقديم أو المصادقة يؤجّل الآجال بمدة مماثلة.'),
        ('Le client garantit qu’il a le droit d’utiliser les textes, photos, logos et marques qu’il fournit, et en assume la responsabilité.',
         'The client warrants that they have the right to use the text, photos, logos and trademarks they supply, and is responsible for them.',
         'يضمن الزبون أنه يملك حق استعمال النصوص والصور والشعارات والعلامات التي يقدمها، ويتحمل مسؤوليتها.'),
    ]),
    (('Validation et retouches', 'Approval and revisions', 'المصادقة والتعديلات'), [
        ('Chaque étape de validation, comme la maquette ou le site avant sa mise en ligne, est présentée au client, qui la valide ou demande des modifications. Le nombre de séries de retouches incluses est indiqué sur le devis. Des modifications supplémentaires, ou un changement de ce qui a été commandé, font l’objet d’un nouveau devis.',
         'Each approval stage, such as the mockup or the site before it goes live, is presented to the client, who approves it or asks for changes. The number of rounds of revisions included is stated in the quote. Additional changes, or a change to what was ordered, are covered by a new quote.',
         'تُعرض على الزبون كل مرحلة من مراحل المصادقة، مثل التصميم الأولي أو الموقع قبل نشره، فيصادق عليها أو يطلب تعديلات. ويُذكر في عرض السعر عدد جولات التعديل المشمولة. وأي تعديلات إضافية، أو تغيير في ما تم طلبه، تكون موضوع عرض سعر جديد.'),
        ('Si le client ne répond pas dans les 15 jours à une demande de validation, Digilago peut le relancer et, sans réponse à la relance, considérer l’étape comme validée.',
         'If the client does not reply within 15 days to an approval request, Digilago may send a reminder and, if the reminder goes unanswered, treat the stage as approved.',
         'إذا لم يرد الزبون خلال 15 يوماً على طلب مصادقة، يجوز لـ Digilago تذكيره، وفي حال عدم الرد على التذكير تُعتبر المرحلة مصادَقاً عليها.'),
    ]),
    (('Propriété et références', 'Ownership and references', 'الملكية والمراجع'), [
        ('Les textes, photos et logos fournis par le client restent sa propriété. Le site livré et ses sources sont cédés au client après paiement intégral. Jusqu’à ce paiement, Digilago reste titulaire des droits sur le travail réalisé.',
         'The text, photos and logos supplied by the client remain the client’s property. The delivered site and its source files are transferred to the client after full payment. Until then, Digilago retains the rights to the work produced.',
         'تظل النصوص والصور والشعارات التي يقدمها الزبون ملكاً له. ويُحوَّل الموقع المسلَّم ومصادره إلى الزبون بعد الأداء الكامل. وإلى حين ذلك، تحتفظ Digilago بالحقوق على العمل المنجز.'),
        ('Digilago ne présente un projet dans ses références (captures, nom du site) qu’avec l’accord du client.',
         'Digilago only shows a project among its references (screenshots, site name) with the client’s agreement.',
         'لا تعرض Digilago أي مشروع ضمن مراجعها (لقطات الشاشة، اسم الموقع) إلا بموافقة الزبون.'),
    ]),
    (('Nom de domaine, hébergement et maintenance', 'Domain name, hosting and maintenance', 'اسم النطاق والاستضافة والصيانة'), [
        ('Le nom de domaine est offert la première année et l’hébergement de la première année est inclus, sauf mention contraire sur le devis. Le nom de domaine est enregistré au nom du client. Ensuite, leur renouvellement est facturé au tarif indiqué et Digilago prévient le client avant l’échéance.',
         'The domain name is free for the first year and first-year hosting is included, unless the quote says otherwise. The domain name is registered in the client’s name. After that, renewal is invoiced at the stated rate and Digilago notifies the client before the due date.',
         'اسم النطاق مجاني خلال السنة الأولى، والاستضافة خلال السنة الأولى مشمولة، ما لم يُذكر خلاف ذلك في عرض السعر. ويُسجَّل اسم النطاق باسم الزبون. وبعد ذلك يُفوتر تجديدهما بالسعر المبيّن وتنبّه Digilago الزبون قبل تاريخ الاستحقاق.'),
        ('La maintenance (mises à jour, sécurité, modifications mineures, assistance) est un abonnement mensuel optionnel. Le client peut y mettre fin par écrit à tout moment, avec effet à la fin du mois en cours.',
         'Maintenance (updates, security, minor changes, support) is an optional monthly subscription. The client may end it in writing at any time, effective at the end of the current month.',
         'الصيانة (التحديثات والأمان والتعديلات الطفيفة والمساعدة) اشتراك شهري اختياري. ويمكن للزبون إنهاؤه كتابةً في أي وقت، على أن يسري ذلك في نهاية الشهر الجاري.'),
    ]),
    (('Garantie et responsabilité', 'Warranty and liability', 'الضمان والمسؤولية'), [
        ('Digilago corrige gratuitement tout défaut de fonctionnement du site signalé dans les 30 jours qui suivent la mise en ligne.',
         'Digilago fixes, free of charge, any malfunction of the site reported within 30 days of going live.',
         'تصلح Digilago مجاناً أي خلل في عمل الموقع يتم التبليغ عنه خلال 30 يوماً من نشره.'),
        ('Digilago s’engage à mettre en œuvre les moyens nécessaires à la qualité de son travail. Elle ne garantit pas une position précise sur Google ni dans les assistants IA, qui dépendent de services extérieurs. Elle n’est pas responsable des interruptions dues aux hébergeurs, à Internet ou aux services tiers (Google, Meta, passerelles de paiement…), ni des contenus fournis par le client.',
         'Digilago undertakes to use the means necessary for the quality of its work. It does not guarantee a specific ranking on Google or in AI assistants, which depend on outside services. It is not liable for interruptions caused by hosting providers, the internet or third-party services (Google, Meta, payment gateways…), nor for content supplied by the client.',
         'تلتزم Digilago ببذل الوسائل اللازمة لجودة عملها. ولا تضمن ترتيباً محدداً في Google أو في مساعدات الذكاء الاصطناعي، لأنه يرتبط بخدمات خارجية. ولا تتحمل مسؤولية الانقطاعات الناتجة عن مزوّدي الاستضافة أو الإنترنت أو خدمات الأطراف الثالثة (Google وMeta وبوابات الدفع…)، ولا عن المحتويات التي يقدمها الزبون.'),
        ('La responsabilité de Digilago est limitée au montant payé par le client pour la prestation concernée.',
         'Digilago’s liability is limited to the amount paid by the client for the service concerned.',
         'تقتصر مسؤولية Digilago على المبلغ الذي أداه الزبون عن الخدمة المعنية.'),
    ]),
    (('Arrêt du projet', 'Ending a project', 'إيقاف المشروع'), [
        ('Le client peut arrêter le projet par écrit à tout moment. Les travaux réalisés jusqu’à cette date et les frais déjà engagés auprès de tiers, comme un nom de domaine, restent dus, sauf dans le cas de la première version décrit plus haut.',
         'The client may stop the project in writing at any time. Work carried out up to that date and costs already incurred with third parties, such as a domain name, remain payable, except in the first-version case described above.',
         'يمكن للزبون إيقاف المشروع كتابةً في أي وقت. وتظل الأشغال المنجزة إلى ذلك التاريخ والمصاريف المؤداة سلفاً لفائدة أطراف ثالثة، مثل اسم النطاق، مستحقة الأداء، باستثناء حالة النسخة الأولى المذكورة أعلاه.'),
    ]),
    (('Données personnelles', 'Personal data', 'المعطيات الشخصية'), [
        ('Digilago traite les données de ses clients et des visiteurs du site dans le respect de la loi n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel. Les détails figurent sur la page Confidentialité.',
         'Digilago processes the data of its clients and site visitors in line with Law no. 09-08 on the protection of individuals with regard to the processing of personal data. The details are on the Privacy page.',
         'تعالج Digilago معطيات زبنائها وزوار الموقع طبقاً للقانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي. وتوجد التفاصيل في صفحة الخصوصية.'),
    ]),
    (('Droit applicable et litiges', 'Governing law and disputes', 'القانون الواجب التطبيق والنزاعات'), [
        ('Ces conditions sont régies par le droit marocain. En cas de désaccord, les parties cherchent d’abord une solution amiable : écrivez-nous à contact@digilago.ma. À défaut d’accord, les tribunaux de Casablanca sont compétents.',
         'These terms are governed by Moroccan law. In case of disagreement, the parties first seek an amicable solution: write to us at contact@digilago.ma. Failing agreement, the courts of Casablanca have jurisdiction.',
         'تخضع هذه الشروط للقانون المغربي. وفي حال وقوع خلاف، يسعى الطرفان أولاً إلى حل ودّي: راسلونا على contact@digilago.ma. وإذا تعذّر الاتفاق، تختص محاكم الدار البيضاء.'),
        ('Dernière mise à jour : octobre 2026.', 'Last updated: October 2026.', 'آخر تحديث: أكتوبر 2026.'),
    ]),
]


def body():
    out = '<div class="w nar legal">'
    for h, ps in SECTIONS:
        out += '<h3 class="rv">%s</h3>' % T(h)
        out += ''.join('<p class="rv d1">%s</p>' % T(p) for p in ps)
    return out + '</div>'


def main():
    src = open(os.path.join(SITE, 'mentions-legales.html'), encoding='utf-8').read()
    h = src
    # titre, description, adresses canoniques et équivalents de langue : cette page, pas celle des mentions légales
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(TITLE), h, count=1, flags=re.S)
    if re.search(r'<meta name="description" content="[^"]*">', h):
        h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % html.escape(DESC[0], quote=True), h, count=1)
    T(DESC)
    h = re.sub(r'(https://www\.digilago\.ma(?:/en|/ar)?)/mentions-legales\.html', r'\1/cgv.html', h)
    # grand titre, accroche, bandeau
    h = re.sub(r'(<h1 class="hin">).*?(</h1>)',
               lambda m: m.group(1) + '<span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span>' % (T(H1[0]), T(H1[1])) + m.group(2),
               h, count=1, flags=re.S)
    h = re.sub(r'(<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>).*?(</span></p>)', lambda m: m.group(1) + T(EYEBROW) + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<p class="lead in2 hin">).*?(</p>)', lambda m: m.group(1) + T(LEAD) + m.group(2), h, count=1, flags=re.S)
    # contenu
    a = h.index('<div class="w nar legal">')
    b = h.index('</div></section>', a)
    h = h[:a] + body() + h[b + len('</div>'):]
    open(os.path.join(SITE, 'cgv.html'), 'w', encoding='utf-8').write(h)

    # lien dans le pied de page de chaque page
    T(FOOT)
    link = '<a href="cgv.html">%s</a>' % T(FOOT)
    n = 0
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        t = open(f, encoding='utf-8').read()
        if '<a href="cgv.html">' in t:
            t = re.sub(r'<a href="cgv\.html">.*?</a>', lambda m: link, t, count=1, flags=re.S)
        else:
            old = '<a href="confidentialite.html">Confidentialité</a>'
            if old not in t:
                continue
            t = t.replace(old, old + link, 1)
        open(f, 'w', encoding='utf-8').write(t)
        n += 1
    print('cgv.html écrit,', n, 'pieds de page, ', save_tr(), 'traductions ajoutées')


if __name__ == '__main__':
    main()
