"""Page « Tous les métiers » : un explorateur par secteur et par métier, avec un exemple de site en grand."""
import json, os, re, unicodedata, importlib.util
H=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location('bs',os.path.join(H,'build_showcase.py')); bs=importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
def slug(t): return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',t).encode('ascii','ignore').decode().lower()).strip('-')
# la réserve d'exemples : chaque page n'est présente qu'une seule fois dans le HTML
POOL={}
for d in bs.med: POOL[d['slug']]=d
E={x['name']:x for x in bs.edu}
POOL['agc']=E['Académie Georges Claude']; POOL['ecole-musique']=E['École de musique']; POOL['angebleu']=E['Groupe scolaire Ange Bleu']
POOL['ecole-internationale']=E['École internationale']; POOL['marronniers']=E['Les Marronniers']; POOL['jardin']=E['Jardin Ange Bleu']
def I(p): return f'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
# (métier, exemple, exemple exact du métier ?)
# (métier, exemple, exemple exact ?, e = entreprise / établissement, p = professionnel indépendant)
def L(items, ex): return [(m, ex, 0, g) for m, g in items]
S=[
 ('sante','Santé et médical',I('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'),[
  ('Clinique et centre médical','centre-medical',1,'e'),('Laboratoire d’analyses','laboratoire',1,'e'),('Centre de fertilité','fertilite',1,'e'),('Clinique dentaire','protheses-dentaires',1,'e'),('Clinique ophtalmologique','centre-medical',0,'e'),('Centre de radiologie','laboratoire',0,'e'),('Clinique esthétique','dermatologie',0,'e'),('Pharmacie','laboratoire',0,'e'),
  ('Médecin généraliste','medecine-famille',1,'p'),('Dentiste','soins-dentaires',1,'p'),('Dermatologue','dermatologie',1,'p'),('Pédiatre','medecine-famille',0,'p'),('Gynécologue','fertilite',0,'p'),('Ophtalmologue','centre-medical',0,'p'),('Cardiologue','centre-medical',0,'p'),('Kinésithérapeute','medecine-famille',0,'p'),('Psychologue','medecine-famille',0,'p'),('Vétérinaire','medecine-famille',0,'p')]),
 ('education','Éducation',I('<path d="M12 4L2 9l10 5 10-5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>'),[
  ('Groupe scolaire','angebleu',1,'e'),('École privée','agc',1,'e'),('École internationale','ecole-internationale',1,'e'),('École supérieure privée','agc',0,'e'),('Formation professionnelle','agc',0,'e'),('Centre de langues','ecole-internationale',0,'e'),('Formation informatique','ecole-internationale',0,'e'),('Crèche','jardin',1,'e'),('Maternelle','marronniers',1,'e'),('Centre de soutien scolaire','marronniers',0,'e'),('Auto-école','ecole-internationale',0,'e'),('École de musique','ecole-musique',1,'e'),('École de danse','ecole-musique',0,'e')]),
 ('restauration','Restauration',I('<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9"/>'),L([('Traiteur pour événements','e'),('Restaurant gastronomique','e'),('Restaurant marocain','e'),('Restaurant de poisson','e'),('Pizzeria','e'),('Fast-food et burger','e'),('Café','e'),('Salon de thé','e'),('Pâtisserie','e'),('Glacier','e')],'dermatologie')),
 ('hotellerie','Hôtellerie',I('<path d="M3 18V8M3 12h18v6M21 18v-3M3 14h18"/><circle cx="7.5" cy="9.5" r="1.8"/>'),L([('Hôtel','e'),('Hôtel de plage et resort','e'),('Riad','e'),('Maison d’hôtes','e'),('Appartements meublés','e'),('Auberge et surf camp','e'),('Camp dans le désert','e'),('Gîte rural','e')],'fertilite')),
 ('commerce','Commerce',I('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>'),L([('Meubles et décoration','e'),('Électroménager','e'),('Boutique de vêtements','e'),('Bijouterie','e'),('Parfumerie','e'),('Opticien','e'),('Épicerie fine','e'),('Librairie','e'),('Boutique de caftans','e'),('Artisanat (tapis, poterie, cuir)','p')],'jardin')),
 ('immobilier','Immobilier',I('<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z"/>'),L([('Promoteur immobilier','e'),('Agence immobilière','e'),('Gestion locative','e'),('Syndic de copropriété','e'),('Location de vacances','e'),('Architecte','p'),('Architecte d’intérieur','p')],'centre-medical')),
 ('sport','Sport et loisirs',I('<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>'),L([('Salle de sport','e'),('Club de padel','e'),('Terrain de foot','e'),('Club de natation','e'),('Club équestre','e'),('Loisirs pour enfants','e'),('Arts martiaux','e'),('Yoga et pilates','e'),('Coach sportif','p')],'ecole-musique')),
 ('beaute','Beauté et bien-être',I('<path d="M6 20l8-8M14 12l3-7 2 2-7 3"/><circle cx="7" cy="7" r="3"/>'),L([('Spa et hammam','e'),('Clinique esthétique','e'),('Institut de beauté','e'),('Épilation laser','e'),('Salon de coiffure','e'),('Barbier','e'),('Onglerie','e'),('Maquilleuse','p'),('Masseur, masseuse','p')],'dermatologie')),
 ('industrie','Industrie',I('<path d="M3 20V10l6 4V10l6 4V6h6v14z"/>'),L([('Usine et fabricant','e'),('Entreprise BTP','e'),('Transport et logistique','e'),('Agroalimentaire','e'),('Emballage','e'),('Matériaux de construction','e'),('Énergie solaire','e'),('Import-export','e')],'laboratoire')),
 ('juridique','Juridique et conseil',I('<path d="M12 4v16M8 20h8M5 8h14"/><path d="M5 8l-2.5 6a2.5 2.5 0 005 0L5 8zM19 8l-2.5 6a2.5 2.5 0 005 0L19 8z"/>'),L([('Cabinet de conseil','e'),('Cabinet d’avocats','e'),('Agence de recrutement','e'),('Assurance','e'),('Fiduciaire','e'),('Expert-comptable','p'),('Notaire','p'),('Huissier','p')],'centre-medical')),
 ('tourisme','Tourisme',I('<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),L([('Agence de voyages','e'),('Transport touristique','e'),('Location de voitures','e'),('Excursions et circuits','e'),('Mariages et événements','e'),('Quad, surf et randonnée','e'),('Guide touristique','p')],'marronniers')),
 ('services','Services',I('<path d="M14.5 4.5a4 4 0 00-4.9 5L4 15.1l2.9 2.9 5.6-5.6a4 4 0 005-4.9l-2.4 2.4-2-2 2.4-2.4z"/>'),[('Entreprise et PME','centre-medical',0,'e')]+L([('Société de nettoyage','e'),('Sécurité et gardiennage','e'),('Déménagement','e'),('Garage automobile','e'),('Imprimerie','e'),('Lavage auto','e'),('Climatisation','e'),('Réparation de téléphones','e'),('Plombier et électricien','p'),('Photographe','p')],'protheses-dentaires'))]

# landings dédiées : landings/metiers/<slug-du-métier>.webp (ou .mp4) remplace l'aperçu du métier
MDIR=os.path.join(H,'metiers')
ALIAS={'clinique-ophtalmologique':'ophtalmologue'}  # métier -> landing partagée
def attach_dedicated():
    global S
    out=[]
    for k,n,ic,m in S:
        mm=[]
        for (a,b,c,g) in m:
            sl=slug(a); src_sl=ALIAS.get(sl,sl); f=os.path.join(MDIR,src_sl+'.webp')
            if os.path.exists(f) and src_sl!=sl:
                if 'm-'+src_sl not in POOL: POOL['m-'+src_sl]={'name':a,'kind':n,'url':src_sl+'.ma','src':bs.b64(os.path.join('metiers',src_sl+'.webp'),'image/webp')}
                mm.append((a,'m-'+src_sl,1,g)); continue
            if os.path.exists(f):
                POOL['m-'+sl]={'name':a,'kind':n,'url':sl+'.ma','src':bs.b64(os.path.join('metiers',sl+'.webp'),'image/webp')}
                mm.append((a,'m-'+sl,1,g))
            else: mm.append((a,b,c,g))
        out.append((k,n,ic,mm))
    S=out
attach_dedicated()

# ---------------- liste courte par secteur, le reste « c'est aussi pour… »
KEEP={'restauration':['Restaurant marocain','Café','Pâtisserie','Traiteur pour événements'],
'hotellerie':['Hôtel','Riad','Maison d’hôtes','Appartements meublés'],
'commerce':['Boutique de vêtements','Meubles et décoration','Bijouterie','Épicerie fine'],
'immobilier':['Agence immobilière','Promoteur immobilier','Architecte'],
'sport':['Salle de sport','Club de padel','Coach sportif'],
'beaute':['Clinique esthétique','Spa et hammam','Salon de coiffure','Institut de beauté'],
'industrie':['Usine et fabricant','Entreprise BTP','Transport et logistique'],
'juridique':['Cabinet d’avocats','Cabinet de conseil','Expert-comptable'],
'tourisme':['Agence de voyages','Excursions et circuits','Location de voitures'],
'services':['Entreprise et PME','Garage automobile','Société de nettoyage','Photographe']}
ALSO_TXT={'sante':('les gynécologues, les centres de dialyse, les orthophonistes, les sages-femmes','cabinet ou établissement de santé'),
'education':('les écoles supérieures, les centres de formation, les écoles de danse, les écoles de code','établissement d’enseignement'),
'restauration':('les fast-foods, les pizzerias, les salons de thé, les glaciers','restaurant'),
'hotellerie':('les resorts, les surf camps, les camps dans le désert, les gîtes','hébergement'),
'commerce':('l’électroménager, les parfumeries, les opticiens, les boutiques de caftans, l’artisanat','commerce'),
'immobilier':('la gestion locative, les syndics, la location de vacances, les architectes d’intérieur','activité immobilière'),
'sport':('les terrains de foot, les clubs de natation, les clubs équestres, les arts martiaux','activité sportive'),
'beaute':('les barbiers, les ongleries, l’épilation laser, les maquilleuses','activité de beauté et de bien-être'),
'industrie':('l’agroalimentaire, l’emballage, les matériaux de construction, l’énergie solaire','entreprise industrielle'),
'juridique':('les notaires, les huissiers, les assurances, les fiduciaires','cabinet'),
'tourisme':('les guides, les activités (quad, surf, randonnée), les mariages et événements, le transport touristique','activité touristique'),
'services':('le lavage auto, le déménagement, la sécurité, les imprimeries, les artisans','entreprise de services')}
EXTRA={}
_S=[]
for k,n,ic,m in S:
    if k in KEEP: keep=[x for x in m if x[0] in KEEP[k]]; keep.sort(key=lambda x: KEEP[k].index(x[0]))
    else: keep=[x for x in m if x[2]]          # santé, éducation : seulement les vraies idées
    EXTRA[k]=[x[0] for x in m if x not in keep]
    _S.append((k,n,ic,keep))
S=_S

# ---------------- une landing par grand secteur : landings/secteurs/<secteur>.webp
SDIR=os.path.join(H,'secteurs')
def attach_sectors():
    global S
    out=[]
    for k,n,ic,m in S:
        f=os.path.join(SDIR,k+'.webp')
        if os.path.exists(f):
            POOL['s-'+k]={'name':n,'kind':n,'url':k+'.ma','src':bs.b64(os.path.join('secteurs',k+'.webp'),'image/webp')}
            mm=[(a,b,c,g) if c==1 else (a,'s-'+k,2,g) for a,b,c,g in m]
            mm+= [(x,'s-'+k,2,'e') for x in EXTRA.get(k,[])]        # les autres types d'entreprise rejoignent la rangée
            EXTRA[k]=[]
            out.append((k,n,ic,mm))
        else: out.append((k,n,ic,m))
    S=out
attach_sectors()

def also_html(k):
    t,dom=ALSO_TXT.get(k,('',''))
    return f'<p class="st-also">C’est aussi pour {t}, et tout type de {dom} : nous étudions votre activité et nous plongeons dans votre domaine pour obtenir le meilleur résultat et une belle présence en ligne.</p>'

def _i(p): return f'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
TI={
'clinique-et-centre-medical':'<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5h6v5"/><path d="M12 8v5M9.5 10.5h5"/>',
'laboratoire-danalyses':'<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7.5 15h9"/>',
'centre-de-fertilite':'<path d="M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z"/><circle cx="12" cy="11" r="2"/>',
'clinique-dentaire':'<path d="M7 3c-2.2 0-4 1.8-4 4.2 0 2 .8 3.3 1.3 5 .5 1.8.7 3.3 1 5.3.3 1.6.8 3.5 2 3.5 1.4 0 1.5-2.4 2-4 .3-1 .8-1.6 1.7-1.6s1.4.6 1.7 1.6c.5 1.6.6 4 2 4 1.2 0 1.7-1.9 2-3.5.3-2 .5-3.5 1-5.3.5-1.7 1.3-3 1.3-5C21 4.8 19.2 3 17 3c-1.8 0-3 1-5 1S8.8 3 7 3z"/><path d="M18 2v3M16.5 3.5h3"/>',
'clinique-ophtalmologique':'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M19 3v3M17.5 4.5h3"/>',
'centre-de-radiologie':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 6v12M9 8.5c1.5.8 4.5.8 6 0M8.5 11.5c2 1 5 1 7 0M9 14.5c1.5.8 4.5.8 6 0"/>',
'clinique-esthetique':'<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
'pharmacie':'<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M12 10v6M9 13h6M8 7V5h8v2"/>',
'medecin-generaliste':'<path d="M6 3v5a4 4 0 008 0V3"/><path d="M10 12v3a5 5 0 0010 0v-2"/><circle cx="20" cy="11" r="2"/><path d="M4 3h4M12 3h4"/>',
'dentiste':'<path d="M7 3c-2.2 0-4 1.8-4 4.2 0 2 .8 3.3 1.3 5 .5 1.8.7 3.3 1 5.3.3 1.6.8 3.5 2 3.5 1.4 0 1.5-2.4 2-4 .3-1 .8-1.6 1.7-1.6s1.4.6 1.7 1.6c.5 1.6.6 4 2 4 1.2 0 1.7-1.9 2-3.5.3-2 .5-3.5 1-5.3.5-1.7 1.3-3 1.3-5C21 4.8 19.2 3 17 3c-1.8 0-3 1-5 1S8.8 3 7 3z"/>',
'dermatologue':'<path d="M12 3c3 4 6 7 6 10.5a6 6 0 01-12 0C6 10 9 7 12 3z"/><path d="M9.5 14a2.5 2.5 0 002.5 2.5"/>',
'pediatre':'<circle cx="12" cy="8" r="4"/><path d="M10.5 8h.01M13.5 8h.01M11 10c.6.4 1.4.4 2 0"/><path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>',
'ophtalmologue':'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
'cardiologue':'<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.2 12 20 12 20z"/><path d="M4.5 12H8l1.5-3 2.5 6 1.5-3H19"/>',
'kinesitherapeute':'<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6l-4 7M12 13l4 7M7 10l5-2 5 2"/>',
'psychologue':'<path d="M12 4a6 6 0 00-6 6c0 2 1 3 1 5v2h7v-3h2a2 2 0 002-2v-2l1.5-.5L18 7a6 6 0 00-6-3z"/><path d="M11 9.5a1.5 1.5 0 013 0c0 1.5-1.5 1.5-1.5 3"/>',
'veterinaire':'<circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="5.5" r="1.8"/><circle cx="16" cy="6.5" r="1.8"/><circle cx="18.5" cy="11" r="1.8"/><path d="M8 18c0-3 2-6 4.5-6s5 3 4.5 5.5c-.4 2-3 1.5-4.5 1.5S8 20 8 18z"/>',
'groupe-scolaire':'<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-4h6v4M9 11h.01M15 11h.01M12 11h.01"/>',
'ecole-privee':'<path d="M12 4L2 9l10 5 10-5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M21 9v5"/>',
'ecole-internationale':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
'centre-de-langues':'<path d="M4 5h9v7H8l-4 3V5z"/><path d="M13 9h7v7l-3-2h-4a2 2 0 01-2-2"/><path d="M6.5 8.5h4"/>',
'creche':'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 7h6l1 3v9a2 2 0 01-2 2h-4a2 2 0 01-2-2v-9z"/><path d="M8 13h8"/>',
'maternelle':'<rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/><rect x="8.5" y="4" width="7" height="7" rx="1"/>',
'centre-de-soutien-scolaire':'<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13M9 7h6M9 10h4"/>',
'auto-ecole':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M12 14.2V21M9.9 11.3L3.5 9.5M14.1 11.3l6.4-1.8"/>',
'ecole-de-musique':'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
'restaurant-marocain':'<path d="M4 17h16M6 17a6 6 0 0112 0"/><path d="M12 8v-2M10 6h4M4 20h16"/>',
'cafe':'<path d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M16 10h2a2 2 0 010 4h-2M7 3.5v2M10 3.5v2M13 3.5v2"/>',
'patisserie':'<path d="M4 20h16M5 20v-6h14v6"/><path d="M5 14c0-2 2-3 3.5-2S11 10 12 12s2.5-2 3.5 0 3.5 0 3.5 2"/><path d="M12 5v4M10.5 6.5h3"/>',
'traiteur-pour-evenements':'<path d="M3 18h18M5 18a7 7 0 0114 0"/><path d="M12 11V9M11 8.5h2"/><path d="M4 21h16"/>',
'hotel':'<path d="M3 18V8M3 12h18v6M21 18v-3M3 14h18"/><circle cx="7.5" cy="9.5" r="1.8"/><path d="M11 12V9.5h6a3 3 0 013 2.5"/>',
'riad':'<path d="M4 21V10a8 8 0 0116 0v11"/><path d="M8 21v-8a4 4 0 018 0v8M4 21h16"/>',
'maison-dhotes':'<path d="M4 11l8-7 8 7M6 10v10h12V10"/><path d="M10 20v-5h4v5"/><path d="M15 4h3v3"/>',
'appartements-meubles':'<rect x="4" y="3" width="11" height="18" rx="1"/><path d="M8 7h3M8 11h3M8 15h3M15 10h4v11h-4"/>',
'boutique-de-vetements':'<path d="M12 5a2 2 0 112 2c-1 .4-2 1-2 2v1l8 5v2H4v-2l8-5"/>',
'meubles-et-decoration':'<path d="M4 12V9a2 2 0 012-2h12a2 2 0 012 2v3"/><path d="M3 12h18v5H3zM5 17v2M19 17v2"/>',
'bijouterie':'<path d="M6 4h12l3 5-9 11L3 9l3-5z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
'epicerie-fine':'<path d="M4 9h16l-2 11H6L4 9z"/><path d="M8 9l2-5M16 9l-2-5M9 13v3M12 13v3M15 13v3"/>',
'agence-immobiliere':'<path d="M4 11l8-7 8 7M6 10v10h12V10"/><circle cx="12" cy="14" r="2"/><path d="M12 16v3"/>',
'promoteur-immobilier':'<path d="M4 21V10h6v11M10 21V4h10v17M3 21h18"/><path d="M13 8h4M13 12h4M13 16h4M6 14h2"/>',
'architecte':'<path d="M12 3v3M12 6l-6 15M12 6l6 15M8 15h8"/><circle cx="12" cy="6" r="1.5"/>',
'salle-de-sport':'<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/><path d="M8 7v10M16 7v10"/>',
'club-de-padel':'<ellipse cx="10" cy="9" rx="6" ry="6.5"/><path d="M14 14l5 6M7.5 7h.01M10.5 7h.01M9 10h.01"/><circle cx="18.5" cy="6" r="1.8"/>',
'coach-sportif':'<circle cx="13" cy="13" r="7"/><path d="M13 9v4l2.5 2M11 3h4M13 3v3M5 8l-2-2"/>',
'spa-et-hammam':'<path d="M12 20c-4 0-7-2-7-5 3 0 5 1 7 3 2-2 4-3 7-3 0 3-3 5-7 5z"/><path d="M12 18c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
'salon-de-coiffure':'<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
'institut-de-beaute':'<rect x="9" y="11" width="6" height="10" rx="1"/><path d="M10 11V6l4-3v8"/>',
'usine-et-fabricant':'<path d="M3 20V10l6 4V10l6 4V6h6v14z"/><path d="M3 20h18M17 6V3"/>',
'entreprise-btp':'<path d="M4 16a8 8 0 0116 0"/><path d="M3 16h18v3H3zM12 8V5M9 9l-1-2.5M15 9l1-2.5"/>',
'transport-et-logistique':'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
'cabinet-davocats':'<path d="M12 4v16M8 20h8M5 8h14"/><path d="M5 8l-2.5 6a2.5 2.5 0 005 0L5 8zM19 8l-2.5 6a2.5 2.5 0 005 0L19 8z"/>',
'cabinet-de-conseil':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/><path d="M8 17l2.5-2.5 2 2L16 13"/>',
'expert-comptable':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 14h.01M12 14h.01M16 14v3M8 17h.01M12 17h.01"/>',
'agence-de-voyages':'<path d="M21 16l-8-4V5.5a1.5 1.5 0 00-3 0V12l-7 4v2l7-2v3l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l8 2z"/>',
'excursions-et-circuits':'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
'location-de-voitures':'<path d="M5 16l1.5-5a2 2 0 012-1.5h7a2 2 0 012 1.5L19 16"/><rect x="3" y="16" width="18" height="3" rx="1"/><circle cx="7" cy="19.5" r="1"/><circle cx="17" cy="19.5" r="1"/><path d="M15 4a2 2 0 11-2 2M13 6h-3"/>',
'entreprise-et-pme':'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
'garage-automobile':'<path d="M14.5 4.5a4 4 0 00-4.9 5L4 15.1l2.9 2.9 5.6-5.6a4 4 0 005-4.9l-2.4 2.4-2-2 2.4-2.4z"/>',
'societe-de-nettoyage':'<path d="M9 3h4v3H9zM8 6h6l1 3v11a1 1 0 01-1 1H8a1 1 0 01-1-1V9z"/><path d="M15 6h3l1 2M17 11h.01M19 13h.01M18 15.5h.01"/>',
'photographe':'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/>'}

FEAT={'sante':['Prise de rendez-vous en ligne','Spécialités et soins','Présentation de l’équipe','Avis des patients','Accès, horaires et urgences'],
'education':['Inscriptions en ligne','Programmes et niveaux','Vie scolaire et galerie','Espace parents','Actualités et événements'],
'restauration':['Menu en ligne','Réservation de table','Commande et livraison','Galerie gourmande','Avis clients'],
'hotellerie':['Réservation directe','Chambres et suites','Galerie immersive','Activités et alentours','Avis voyageurs'],
'commerce':['Catalogue produits','Paiement en ligne (CMI)','Livraison et suivi','Promotions','Avis clients'],
'immobilier':['Annonces filtrables','Visites programmées','Estimation en ligne','Projets neufs','Contact direct'],
'sport':['Abonnements en ligne','Planning des cours','Réservation de terrain','Coachs et équipe','Galerie'],
'beaute':['Réservation en ligne','Prestations et tarifs','Avant et après','Équipe','Cartes cadeaux'],
'industrie':['Présentation de l’entreprise','Catalogue et fiches produits','Demande de devis','Certifications','Références clients'],
'juridique':['Domaines d’expertise','Prise de rendez-vous','Équipe et associés','Actualités juridiques','Contact confidentiel'],
'tourisme':['Circuits et excursions','Réservation en ligne','Galerie','Avis voyageurs','Devis sur mesure'],
'services':['Demande de devis','Zones d’intervention','Tarifs clairs','Avis clients','Urgences sur WhatsApp']}
POP=[('Dentiste','sante'),('Clinique','sante'),('Riad','hotellerie'),('Restaurant','restauration'),('Avocat','juridique'),('École','education'),('Salle de sport','sport'),('Agence immobilière','immobilier')]
LOCK='<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5.2" width="7" height="5.3" rx="1.2" fill="currentColor"/><path d="M4 5.2V3.8a2 2 0 014 0v1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
NE='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>'
SRCH='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
WA='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
CHEV='<svg viewBox="0 0 16 16" aria-hidden="true" class="st-chev"><path d="M5 6l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
FULL='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
CLOSE='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
CHK='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
def media(d):
    if 'video' in d:
        return f'<video poster="{d["poster"]}" muted loop playsinline preload="none"><source src="{d["webm"]}" type="video/webm"><source src="{d["video"]}" type="video/mp4"></video>'
    return f'<img src="{d["src"]}" alt="" loading="lazy" decoding="async" draggable="false">'
GRID='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="2" width="5" height="5" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="5" height="5" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="9" width="5" height="5" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
def search_block():
    icons='<script type="application/json" id="sqIcons">'+json.dumps({k:ic for k,_,ic,_ in S})+'</script>'
    pops=''.join(f'<button type="button" class="smq-pop" data-q="{q}">{q}</button>' for q in ['Dentiste','Riad','Restaurant','Avocat','Boulangerie','École privée','Salle de sport','Entreprise BTP'])
    return (f'<div class="smq smq2" id="sq"><div class="smq-bar" id="sqBar">{SRCH}'
            f'<div class="smq-in"><input id="xpQ" type="search" autocomplete="off" spellcheck="false" placeholder="Votre activité : boulangerie, riad, cabinet d’avocats…" aria-label="Décrivez votre activité" aria-controls="ans"></div>'
            f'<button type="button" class="smq-go" id="sqGo">Voir mon idée{NE}</button></div>'
            f'<div class="smq-pops" id="sqPops"><span>Essayez</span>{pops}</div>'
            f'<div class="smq-drop" id="xpRes" hidden></div>'
            f'<section class="ans" id="ans" aria-live="polite" hidden></section>{icons}</div>')
def build():
    data={'s':[{'k':k,'n':n,'f':FEAT.get(k,[]),'a':EXTRA.get(k,[]),'al':also_html(k),'m':[{'n':a,'e':b,'x':c,'g':g,'u':slug(a),'i':_i(TI[slug(a)]) if slug(a) in TI else ic} for a,b,c,g in m]} for k,n,ic,m in S]}
    tree=''
    for k,n,ic,m in S:
        ex=sum(1 for x in m if x[2]==1); sx=any(x[2]==2 for x in m)
        ge=[x for x in m if x[3]=='e']; gp=[x for x in m if x[3]=='p']
        lis=''
        for grp,lab in [(ge,'Entreprises et établissements'),(gp,'Indépendants')]:
            if not grp: continue
            if ge and gp: lis+=f'<li class="st-gl">{lab}</li>'
            lis+=''.join(f'<li><button type="button" class="st-m{"" if x[2] else " soon"}" data-s="{k}" data-u="{slug(x[0])}"><i></i>{x[0]}</button></li>' for x in grp)
        small=(f'{ex} idées de sites' if ex else (f'{len(m)} types d’entreprise' if sx else f'{len(m)} idées de style'))
        tree+=f'<div class="st-sec" data-s="{k}"><button type="button" class="st-h" aria-pressed="false"><span class="st-ic">{ic}</span><span class="st-n"><b>{n}</b><small>{small}</small></span></button></div>'
    pool=''.join(f'<figure class="xp-ex{" vid" if "video" in d else ""}" data-e="{e}"><div class="xp-vw">{media(d)}</div></figure>' for e,d in POOL.items())
    langs='<span>FR</span><span>EN</span><span lang="ar">عربي</span>'
    parts=[]
    parts.append('<section class="blk mtstudio" id="styles"><div class="st-app w">')
    parts.append(f'<aside class="st-side" aria-label="Secteurs et métiers"><div class="st-sh"><span>Secteurs</span><em>{len(S)}</em></div><div class="st-tree">{tree}</div></aside>')
    parts.append(f'<div class="st-center"><div class="st-types"><div class="st-row" id="stRow" role="listbox" aria-label="Types d’entreprise"></div><p class="st-al" id="stAl"></p></div><div class="st-top"><div class="st-tt"><span class="xp-tag" id="xpTag">Idée de site</span><h3 id="xpMN">Clinique et centre médical</h3><small id="xpSN">Santé et médical</small></div><div class="st-acts"><button type="button" class="st-full" id="stFull" aria-label="Voir en plein écran">{FULL}<span>Plein écran</span></button></div></div>')
    parts.append(f'<div class="st-win xp-stage" tabindex="0" aria-label="Aperçu du site : survolez pour parcourir la page"><div class="xp-bar"><i></i><i></i><i></i><span>{LOCK}<em class="xp-url" id="xpUrl">clinique.ma</em></span><b class="st-hover">Survolez pour parcourir</b></div><div class="xp-pool">{pool}</div><div class="st-brand" id="stBrand" aria-hidden="true"><span class="stb-logo" id="stbLogo">VE</span><b id="stbName">Votre entreprise</b><span class="stb-links"><i>Accueil</i><i>Services</i><i>À propos</i><i>Contact</i></span><em class="stb-cta">Prendre contact</em></div><span class="st-yours" id="stYours">Votre logo, vos couleurs, vos textes</span></div><p class="st-note"><b>Ceci est une idée, pas un modèle.</b> Votre site sera conçu pour vous, autour de votre identité : jamais une copie.</p>')
    parts.append(f'<div class="st-bot"><div class="st-try"><span class="st-lab">Essayez avec votre marque</span><input id="stbIn" type="text" maxlength="32" placeholder="Nom de votre entreprise" autocomplete="organization"><div class="stb-sw" role="group" aria-label="Couleur de votre marque"><button type="button" data-c="#1F57C7" style="--c:#1F57C7" aria-pressed="true" aria-label="Bleu"></button><button type="button" data-c="#0F766E" style="--c:#0F766E" aria-pressed="false" aria-label="Vert"></button><button type="button" data-c="#9F1239" style="--c:#9F1239" aria-pressed="false" aria-label="Bordeaux"></button><button type="button" data-c="#B7791F" style="--c:#B7791F" aria-pressed="false" aria-label="Or"></button><button type="button" data-c="#6D28D9" style="--c:#6D28D9" aria-pressed="false" aria-label="Violet"></button><button type="button" data-c="#111827" style="--c:#111827" aria-pressed="false" aria-label="Noir"></button></div></div><div class="st-ctas"><a class="xp-go" id="xpGo" href="demarrer.html">Je veux ce site{NE}</a><a class="xp-wa" id="xpWa" href="https://wa.me/212649953813" target="_blank" rel="noopener noreferrer">{WA}WhatsApp</a></div></div></div></div>')
    parts.append(f'<div class="st-modal" id="stModal" hidden><div class="st-mbar"><b id="stMT"></b><button type="button" id="stClose" aria-label="Fermer">{CLOSE}</button></div><div class="st-mscroll"><img id="stMImg" alt=""></div></div>')
    parts.append(f'<script type="application/json" id="xpData">{json.dumps(data,ensure_ascii=False)}</script></section>')
    parts.append('<section class="blk l3" id="ecrans"><div class="l3-grid">')
    parts.append('<div class="l3-txt"><span class="pill rv"><span class="ic"></span>Écrans et langues</span><h2 class="rv d1"><span class="l"><span class="li">Trois langues,</span></span><span class="l"><span class="li grad">tous les écrans.</span></span></h2>'
                 '<p class="rv d2">Chaque site est livré en français, en anglais et en arabe, et s’adapte seul à l’ordinateur, à la tablette et au téléphone. Vous parlez à tout le Maroc, et au-delà.</p>'
                 '<div class="l3-sw rv d2" role="tablist" aria-label="Langue de démonstration"><button type="button" data-l="fr" aria-selected="true">Français</button><button type="button" data-l="en" aria-selected="false">English</button><button type="button" data-l="ar" aria-selected="false" lang="ar">العربية</button></div>'
                 f'<ul class="l3-pts rv d3"><li><i>{CHK}</i>Français, anglais et arabe inclus par défaut</li><li><i>{CHK}</i>L’arabe en lecture de droite à gauche, soigné</li><li><i>{CHK}</i>Chaque langue référencée sur Google (hreflang)</li><li><i>{CHK}</i>Ordinateur, tablette et téléphone</li></ul></div>')
    parts.append('<div class="l3-stage rv"><div class="l3-glow"></div>'
                 '<figure class="l3-dev l3-tab"><div class="l3-scr"><img class="dvc-img" alt="" decoding="async"></div></figure>'
                 '<figure class="l3-dev l3-lap"><div class="l3-scr"><div class="l3-nav" id="l3Nav" dir="ltr"><b class="l3-logo">Votre marque</b><span class="l3-links"><i>Accueil</i><i>Services</i><i>À propos</i><i>Contact</i></span><em class="l3-cta">Prendre rendez-vous</em></div><img class="dvc-img" alt="" decoding="async"></div><span class="l3-base"></span></figure>'
                 '<figure class="l3-dev l3-pho"><div class="l3-scr"><span class="l3-isl"></span><img class="dvc-img" alt="" decoding="async"></div></figure>'
                 '<div class="l3-hi" id="l3Hi" dir="ltr"><small id="l3HiK">Français</small><b id="l3HiT">Bienvenue chez vous.</b></div></div></div></section>')
    parts.append(f'<section class="blk xp-any"><div class="xp-anyc w rv"><div><span class="xp-k">Votre métier n’y est pas ?</span><h3>Nous créons <em>tout type de site.</em></h3><p>Cabinet, commerce, usine, association, projet personnel : dites-nous ce que vous faites, nous imaginons le site qui vous ressemble.</p></div><a href="contact.html">Nous contacter{NE}</a></div></section>')
    return '\n'.join(parts)
if __name__=='__main__':
    open(os.path.join(H,'styles.html'),'w').write(build()); open(os.path.join(H,'search.html'),'w').write(search_block()); print('styles.html écrit', sum(len(m) for _,_,_,m in S),'métiers')
