"""Genere le site en 23 pages reelles depuis index.html.

Le fichier index.html reste la source unique : il contient l en-tete, le pied de
page, la visionneuse et les 17 conteneurs de page. Ce script en extrait chaque
morceau et compose un fichier par adresse, avec son propre titre, sa propre
description et sa propre balise canonique.

Usage : python build.py
Sortie : les 23 fichiers HTML, sitemap.xml, et app.js adapte a la navigation
         par adresse reelle.
"""
import io, os, re, sys, shutil, unicodedata

SOURCE = '_source.html'   # document source, distinct des fichiers generes
SITE = 'https://www.levillagedesrecruteurs.fr'

# ---------------------------------------------------------------- table des adresses
# identifiant de page -> (adresse, titre, description)
PAGES = [
 ('accueil', '/', 'Le rendez-vous qui connecte vos ambitions',
  'Le salon de l’emploi gratuit du Village des Recruteurs : rencontrez en direct '
  'les entreprises qui recrutent, la formation, l’alternance et la reconversion, '
  'près de chez vous.'),
 ('evenements', '/nos-villages/', 'Nos Villages, dates et villes de la tournée',
  'Les dates, les villes et les lieux de la tournée 2026 du Village des '
  'Recruteurs : sept salons de l’emploi gratuits, de Nantes à Lyon.'),
 ('candidats', '/candidats/', 'Candidats, participez gratuitement',
  'Emploi, alternance, apprentissage, stage, reconversion : préparez votre visite '
  'au Village des Recruteurs et rencontrez les entreprises qui recrutent.'),
 ('recruteurs', '/exposer/', 'Exposer au Village des Recruteurs',
  'Rencontrez 15 à 40 candidats qualifiés par édition. Stand à partir de 990 € HT, '
  'grille dégressive et simulateur de coût en ligne.'),
 ('semaine', '/semaine-des-recruteurs/', 'La Semaine des Recruteurs',
  'Confiez votre recrutement à un recruteur professionnel : 690 € HT pour une '
  'offre, satisfait ou remboursé en dessous de cinq candidats.'),
 ('formation', '/centres-de-formation/', 'Centres de formation',
  'Présentez vos cursus à un public en recherche d’orientation, d’alternance et '
  'de reconversion, au Village des Recruteurs.'),
 ('entrepreneuriat', '/entrepreneuriat/', 'Entrepreneuriat',
  'Accompagnement à la création d’entreprise au Village des Recruteurs : '
  'rencontrez ceux qui hésitent encore à se lancer.'),
 ('partenaires', '/partenaires/', 'Partenaires et institutions',
  'France Travail, APEC, Cap Emploi, Agefiph, métropoles et fédérations : les '
  'acteurs qui font vivre le Village des Recruteurs.'),
 ('matchingsquare', '/matching-square/', 'Matching Square',
  'La plateforme du Village des Recruteurs : profil généré depuis le CV, prise de '
  'rendez-vous et suivi jusqu’à cinq jours après le salon.'),
 ('galerie', '/galerie/', 'Le Village en images',
  'Les photographies des éditions du Village des Recruteurs : affluence, stands, '
  'conférences et rencontres.'),
 ('blog', '/actualite/', 'Actualité',
  'Les dernières publications du Village des Recruteurs sur LinkedIn, Facebook '
  'et Instagram, réunies au même endroit.'),
 ('simulateur', '/simulateur/', 'Simuler votre participation',
  'Composez votre stand et vos options : le coût de votre participation au '
  'Village des Recruteurs s’ajuste en direct, remises comprises.'),
 ('faq', '/faq/', 'FAQ, vos questions sur le salon',
  'Inscription, horaires, CV, accessibilité : les réponses aux questions des '
  'candidats et des exposants du Village des Recruteurs.'),
 ('contact', '/contact/', 'Nous contacter',
  'Une question sur votre inscription, vos rendez-vous ou un Village en '
  'particulier ? Écrivez à l’équipe du Village des Recruteurs.'),
 ('mentions', '/mentions-legales/', 'Mentions légales et confidentialité',
  'Éditeur, hébergement, propriété intellectuelle, données personnelles et '
  'cookies du site du Village des Recruteurs.'),
 ('jobevents', '/job-events/', 'Job Events, l’agence',
  'L’agence qui organise le Village des Recruteurs depuis 2015 : l’équipe, les '
  'chiffres et les offres d’emploi.'),
]
ADRESSE = {p[0]: p[1] for p in PAGES}


def ardoise(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()


def echappe(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&quot;'))


def de(nom):
    """elision devant une voyelle : de Lyon, mais d Orleans"""
    return (u"d\u2019" + nom) if nom[:1].lower() in u"aeiouyh\u00e9\u00e8\u00ea" \
           else (u"de " + nom)


# ---------------------------------------------------------------- lecture de la source
h = io.open(SOURCE, encoding='utf-8', newline='').read()

def entre(debut, fin, depuis=0):
    a = h.find(debut, depuis)
    b = h.find(fin, a)
    if a < 0 or b < 0:
        print('ECHEC : bloc %r introuvable' % debut); sys.exit(1)
    return h[a:b + len(fin)]

SKIP = entre('<a class="skip-link"', '</a>')
HEADER = entre('<header>', '</header>')
FOOTER = entre('<footer>', '</footer>')
DIALOG = entre('<dialog class="lb"', '</dialog>')

def bloc_page(pid):
    m = re.search(r'<div class="page[^"]*" id="page-%s">' % re.escape(pid), h)
    if not m:
        print('ECHEC : page %s introuvable' % pid); sys.exit(1)
    i, d = m.start(), 0
    for j in re.finditer(r'</?div\b', h[i:]):
        d += -1 if j.group(0).startswith('</') else 1
        if d == 0:
            fin = i + j.end() + len('>')
            return h[i:h.find('>', i + j.end()) + 1]
    print('ECHEC : fermeture de la page %s introuvable' % pid); sys.exit(1)

def adresses_reelles(bloc):
    """remplace les fragments de page par leurs adresses reelles"""
    def remplace(m):
        cible = m.group(1)
        if cible not in ADRESSE:
            return m.group(0)
        return 'href="%s"' % ADRESSE[cible]
    bloc = re.sub(r'href="#([a-z0-9\-]+)"', remplace, bloc)
    bloc = re.sub(r"""\s*onclick="go\('[a-z0-9\-]+'\);return false;\"""", '', bloc)
    bloc = re.sub(r"""\s*onclick="go\('[a-z0-9\-]+'\)\"""", '', bloc)
    return bloc

CONTENUS = {}
for pid, _, _, _ in PAGES:
    c = bloc_page(pid)
    # la page generee est la seule du document, donc toujours active
    c = re.sub(r'^<div class="page[^"]*"', '<div class="page active"', c)
    CONTENUS[pid] = adresses_reelles(c)

# ---------------------------------------------------------------- donnees des villes
js = io.open('app.js', encoding='utf-8', newline='').read()
mv = re.search(r'villages2026\s*=\s*\[', js)
i = mv.end() - 1; d = 0
for j in range(i, len(js)):
    if js[j] == '[': d += 1
    elif js[j] == ']':
        d -= 1
        if d == 0: break
brut = js[i:j + 1]

VILLES = []
for m in re.finditer(r'\{([^{}]*(?:\[[^\]]*\][^{}]*)*)\}', brut):
    champ = {}
    for c in re.finditer(r"(\w+)\s*:\s*'([^']*)'", m.group(1)):
        champ[c.group(1)] = c.group(2)
    sec = re.search(r"sectors\s*:\s*\[([^\]]*)\]", m.group(1))
    champ['sectors'] = re.findall(r"'([^']*)'", sec.group(1)) if sec else []
    if champ.get('city'):
        VILLES.append(champ)
print('villes lues :', len(VILLES), '->', ', '.join(v['city'] for v in VILLES))


def page_ville(v):
    """contenu statique d une fiche de ville, redige et non genere par script"""
    slug = ardoise(v['city'])
    passe = v.get('state') == 'past'
    inscr = v.get('ms', '')
    secteurs = ', '.join(v['sectors'])
    horaire = '9 h 30 à 17 h'
    bouton = ('<p class="nv-closed" style="display:inline-block;padding:.6rem 1rem;'
              'border-radius:12px">Événement clôturé</p>'
              if passe or not inscr else
              '<a class="btn btn-primary" href="%s" target="_blank" rel="noopener">'
              'Je m’inscris comme candidat</a>' % echappe(inscr))
    expo = ('<a class="btn btn-ghost" href="%s" target="_blank" rel="noopener">'
            'Exposer à %s</a>' % (echappe(v.get('odoo', '')), echappe(v['city']))
            if v.get('odoo') else '')
    return (
'<div class="page active" id="page-village-detail">\r\n'
'  <div class="phead" style="padding-bottom:1.4rem">\r\n'
'    <div class="wrap">\r\n'
'      <a class="back" href="/nos-villages/">← Toute la tournée</a>\r\n'
'      <span class="eyebrow">%(mois)s 2026 · %(region)s</span>\r\n'
'      <h1>Village des Recruteurs %(de_city)s</h1>\r\n'
'      <p class="lead">Salon de l’emploi gratuit, le %(date)s, de %(horaire)s, '
'%(venue)s à %(city)s. Entrée libre sur inscription.</p>\r\n'
'    </div>\r\n'
'  </div>\r\n'
'  <section style="padding-top:2rem">\r\n'
'    <div class="wrap two-col">\r\n'
'      <div>\r\n'
'        <h2>Ce que vous trouverez à %(city)s</h2>\r\n'
'        <p>Le Village des Recruteurs de %(city)s réunit les entreprises qui '
'recrutent en %(region)s, les organismes de formation, l’accompagnement à la '
'création d’activité et le service public de l’emploi. Vous repartez avec une '
'piste, quel que soit votre point de départ : emploi, alternance, '
'apprentissage, stage ou reconversion.</p>\r\n'
'        <h3>Secteurs représentés</h3>\r\n'
'        <p>%(secteurs)s.</p>\r\n'
'        <h3>Informations pratiques</h3>\r\n'
'        <ul>\r\n'
'          <li><b>Date</b> : %(date)s</li>\r\n'
'          <li><b>Horaires</b> : de %(horaire)s</li>\r\n'
'          <li><b>Lieu</b> : %(venue)s, %(city)s</li>\r\n'
'          <li><b>Région</b> : %(region)s</li>\r\n'
'          <li><b>Entrée</b> : gratuite, sur inscription</li>\r\n'
'        </ul>\r\n'
'        <div style="display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.2rem">'
'%(bouton)s%(expo)s</div>\r\n'
'      </div>\r\n'
'      <aside><div class="aside-card">\r\n'
'        <span class="eyebrow">Affluence attendue</span>\r\n'
'        <p style="font-size:1.3rem;font-weight:800;margin:.3rem 0">%(count)s</p>\r\n'
'        <p style="font-size:.9rem">Objectif 2026 pour cette édition.</p>\r\n'
'        <p style="margin-top:1rem"><a href="/exposer/">Exposer sur cette '
'édition</a></p>\r\n'
'        <p><a href="/candidats/">Préparer ma visite</a></p>\r\n'
'      </div></aside>\r\n'
'    </div>\r\n'
'  </section>\r\n'
'</div>\r\n') % dict(v, secteurs=echappe(secteurs), horaire=horaire, de_city=echappe(de(v['city'])),
                     bouton=bouton, expo=expo)


def jsonld_event(v):
    slug = ardoise(v['city'])
    dates = re.findall(r'\d+', v['date'])
    mois = {'janv': '01', 'févr': '02', 'mars': '03', 'avril': '04', 'mai': '05',
            'juin': '06', 'juil': '07', 'août': '08', 'sept': '09', 'oct': '10',
            'nov': '11', 'déc': '12'}
    mm = next((n for k, n in mois.items() if k in v['date'].lower()), '01')
    debut = '2026-%s-%02d' % (mm, int(dates[0]))
    fin = '2026-%s-%02d' % (mm, int(dates[1])) if len(dates) > 2 else debut
    statut = 'EventScheduled'
    return (
'<script type="application/ld+json">{"@context":"https://schema.org",'
'"@type":"Event","name":"Le Village des Recruteurs de %s",'
'"startDate":"%s","endDate":"%s",'
'"eventStatus":"https://schema.org/%s",'
'"eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",'
'"location":{"@type":"Place","name":"%s","address":{"@type":"PostalAddress",'
'"addressLocality":"%s","addressRegion":"%s","addressCountry":"FR"}},'
'"organizer":{"@type":"Organization","name":"Job Events","url":"%s/"},'
'"isAccessibleForFree":true,"inLanguage":"fr-FR",'
'"url":"%s/nos-villages/%s/"}</script>\r\n'
) % (v['city'], debut, fin, statut, v['venue'], v['city'], v['region'],
     SITE, SITE, slug)


# ---------------------------------------------------------------- gabarit de page
FAVICON = re.search(r'<link rel="icon"[^>]*>', h).group(0)

def navigation(actif):
    """en-tete et pied de page avec les adresses reelles et l entree active"""
    def adapte(bloc):
        # les liens de navigation pointent vers de vraies adresses
        def remplace(m):
            cible = m.group(1)
            # un fragment qui ne designe pas une page reste inchange :
            # c est le cas de #main, cible du lien d evitement
            if cible not in ADRESSE:
                return m.group(0)
            return 'href="%s"' % ADRESSE[cible]
        bloc = re.sub(r'href="#([a-z0-9\-]+)"', remplace, bloc)
        # le gestionnaire de clic n a plus d objet : le navigateur navigue
        bloc = re.sub(r'\s*onclick="go\(\'[a-z0-9\-]+\'\)"', '', bloc)
        bloc = re.sub(r'\s*onclick="go\(\'[a-z0-9\-]+\'\);return false;"', '', bloc)
        # l entree correspondant a la page recoit sa classe active
        bloc = bloc.replace('data-nav="%s"' % actif,
                            'data-nav="%s" class="active"' % actif)
        return bloc
    return adapte(HEADER), adapte(FOOTER)


def compose(adresse, titre, description, contenu, actif, extra_ld=''):
    entete, pied = navigation(actif)
    canon = SITE + adresse
    titre_complet = 'Le Village des Recruteurs, ' + titre
    return (
'<!DOCTYPE html>\r\n<html lang="fr">\r\n<head>\r\n'
'<meta charset="UTF-8">\r\n'
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\r\n'
'<title>%(titre)s</title>\r\n'
'<meta name="description" content="%(desc)s">\r\n'
'<link rel="canonical" href="%(canon)s">\r\n'
'<meta name="theme-color" content="#006FB7">\r\n'
'<link rel="preload" href="/fonts/jost-latin.woff2" as="font" type="font/woff2" crossorigin>\r\n'
'<link rel="stylesheet" href="/styles.css">\r\n'
'%(favicon)s\r\n'
'<meta property="og:type" content="website">\r\n'
'<meta property="og:site_name" content="Le Village des Recruteurs">\r\n'
'<meta property="og:locale" content="fr_FR">\r\n'
'<meta property="og:title" content="%(og)s">\r\n'
'<meta property="og:description" content="%(desc)s">\r\n'
'<meta property="og:url" content="%(canon)s">\r\n'
'<meta property="og:image" content="%(site)s/og-image.png">\r\n'
'<meta property="og:image:width" content="1200">\r\n'
'<meta property="og:image:height" content="630">\r\n'
'<meta name="twitter:card" content="summary_large_image">\r\n'
'<meta name="twitter:title" content="%(og)s">\r\n'
'<meta name="twitter:description" content="%(desc)s">\r\n'
'<meta name="twitter:image" content="%(site)s/og-image.png">\r\n'
'%(ld)s'
'</head>\r\n<body>\r\n'
'%(skip)s\r\n\r\n%(header)s\r\n'
'<main id="main" tabindex="-1">\r\n%(contenu)s</main>\r\n'
'%(footer)s\r\n%(dialog)s\r\n'
'<script src="/app.js"></script>\r\n</body>\r\n</html>\r\n'
) % dict(titre=echappe(titre_complet), desc=echappe(description), canon=canon,
         og=echappe(titre + ' · Le Village des Recruteurs'), site=SITE,
         favicon=FAVICON, ld=extra_ld, skip=SKIP, header=entete, footer=pied,
         contenu=contenu, dialog=DIALOG)


# ---------------------------------------------------------------- ecriture
ORGA = (
'<script type="application/ld+json">{"@context":"https://schema.org",'
'"@type":"Organization","name":"Le Village des Recruteurs",'
'"alternateName":"Job Events","url":"%s/",'
'"logo":"%s/og-image.png"}</script>\r\n'
'<script type="application/ld+json">{"@context":"https://schema.org",'
'"@type":"WebSite","name":"Le Village des Recruteurs","url":"%s/",'
'"inLanguage":"fr-FR"}</script>\r\n') % (SITE, SITE, SITE)

def liste_villes_statique():
    """Liste des 7 villes, en HTML servi.

    Les cartes de la tournee sont produites par script. Un explorateur qui
    n execute pas le JavaScript ne verrait donc aucun lien vers les fiches de
    ville, et le maillage interne resterait nul malgre le decoupage. Cette
    liste garantit un lien present dans le document servi.
    """
    li = []
    for v in VILLES:
        etat = (u"\u00c9dition cl\u00f4tur\u00e9e" if v.get("state") == "past"
                else u"Inscriptions ouvertes")
        li.append(
            u'        <li><a href="/nos-villages/%s/">Village des Recruteurs '
            u'%s</a>, le %s, %s, %s. %s.</li>\r\n'
            % (ardoise(v["city"]), echappe(de(v["city"])), echappe(v["date"]),
               echappe(v["venue"]), echappe(v["region"]), etat))
    return (u'  <section style="padding-top:1rem">\r\n'
            u'    <div class="wrap">\r\n'
            u'      <div class="sec-head">\r\n'
            u'        <span class="eyebrow">Toutes les \u00e9tapes</span>\r\n'
            u'        <h2>Les sept Villages de la tourn\u00e9e 2026</h2>\r\n'
            u'      </div>\r\n'
            u'      <ul style="max-width:62ch;margin-inline:auto">\r\n'
            + u''.join(li) +
            u'      </ul>\r\n'
            u'    </div>\r\n'
            u'  </section>\r\n')


# la page de la tournee recoit la liste servie, avant sa balise fermante
CONTENUS["evenements"] = CONTENUS["evenements"].rstrip()
assert CONTENUS["evenements"].endswith("</div>"), "fin de page inattendue"
CONTENUS["evenements"] = (CONTENUS["evenements"][:-6]
                          + liste_villes_statique() + "</div>\r\n")


ecrits = []
for pid, adresse, titre, desc in PAGES:
    ld = ORGA if adresse == '/' else ''
    page = compose(adresse, titre, desc, CONTENUS[pid], pid, ld)
    # les chemins d actifs doivent etre absolus, la page pouvant etre en sous-dossier
    page = re.sub(r'(src|href)="(img|fonts)/', r'\1="/\2/', page)
    chemin = 'index.html' if adresse == '/' else adresse.strip('/') + '/index.html'
    os.makedirs(os.path.dirname(chemin) or '.', exist_ok=True)
    io.open(chemin, 'w', encoding='utf-8', newline='').write(page)
    ecrits.append((adresse, chemin, len(page)))

for v in VILLES:
    slug = ardoise(v['city'])
    adresse = '/nos-villages/%s/' % slug
    titre = 'Village des Recruteurs %s' % de(v['city'])
    desc = ('Salon de l’emploi gratuit à %s le %s, %s. Entrée libre sur '
            'inscription. Secteurs : %s.') % (v['city'], v['date'], v['venue'],
                                              ', '.join(v['sectors'][:4]))
    page = compose(adresse, titre, desc, page_ville(v), 'evenements',
                   jsonld_event(v))
    page = re.sub(r'(src|href)="(img|fonts)/', r'\1="/\2/', page)
    chemin = adresse.strip('/') + '/index.html'
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    io.open(chemin, 'w', encoding='utf-8', newline='').write(page)
    ecrits.append((adresse, chemin, len(page)))

# ---------------------------------------------------------------- plan de site
lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for adresse, _, _ in ecrits:
    prio = '1.0' if adresse == '/' else ('0.8' if '/nos-villages/' in adresse else '0.6')
    lignes.append('  <url><loc>%s%s</loc><lastmod>2026-08-25</lastmod>'
                  '<changefreq>weekly</changefreq><priority>%s</priority></url>'
                  % (SITE, adresse, prio))
lignes.append('</urlset>')
io.open('sitemap.xml', 'w', encoding='utf-8', newline='').write('\r\n'.join(lignes) + '\r\n')

print()
print('=== PAGES ECRITES ===')
for adresse, chemin, taille in ecrits:
    print('  %-30s %-42s %7d octets' % (adresse, chemin, taille))
print('  ---')
print('  %d pages, %d octets au total, %d octets en moyenne'
      % (len(ecrits), sum(x[2] for x in ecrits),
         sum(x[2] for x in ecrits) // len(ecrits)))
print('  sitemap.xml : %d adresses' % len(ecrits))
