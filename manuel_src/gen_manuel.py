"""Genere le manuel Odoo en pages web pour l Espace equipe.

Source : manuel_src/manuel.docx (le manuel Word du 25/11/2026).
Sortie : equipe/manuel/ (index.html + chapitre-NN.html + images, a plat).
Les corrections de contenu posterieures au Word (programme 2027 a 5 villes,
grille du simulateur, listes de prix de la tournee) sont appliquees ici,
dans CORRECTIONS, pour que le Word reste la source et que l ecart soit lisible.

Usage : python manuel_src/gen_manuel.py   (depuis la racine du depot)
"""
import os, re, shutil, subprocess, tempfile, zipfile, html as H
from bs4 import BeautifulSoup

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DOCX = os.path.join(ICI, 'manuel.docx')
SORTIE = os.path.join(RACINE, 'equipe', 'manuel')
VERSION = '1.2 — 26 novembre 2026'

# (ancien texte, nouveau texte) appliques au HTML produit par pandoc
CORRECTIONS = []  # le Word 1.2 du 26/11/2026 integre toutes les corrections

CSS = r"""
:root{--rose:#E3007B;--rose-d:#B4005F;--blue:#006FB7;--navy:#08324F;--jaune:#F8B322;--green:#2FA36B;
--ink:#241A12;--muted:#786859;--paper:#FFF9F1;--surface:#fff;--line:rgba(60,40,24,.14);--r:18px;
--shadow-sm:0 8px 22px -14px rgba(80,45,20,.26)}
*{box-sizing:border-box}
@font-face{font-family:"Jost";src:url(/fonts/jost-latin.woff2) format("woff2");font-weight:300 900;font-display:swap}
body{margin:0;background:var(--paper);color:var(--ink);font:400 1.02rem/1.62 "Jost","Century Gothic",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--rose-d)}
.wrap{max-width:76rem;margin:0 auto;padding:1.3rem clamp(.9rem,3vw,2rem) 4rem}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem;background:var(--surface);border:1px solid var(--line);
border-radius:var(--r);padding:1rem 1.2rem;box-shadow:var(--shadow-sm);position:relative;overflow:hidden}
.top::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;
background:linear-gradient(90deg,var(--rose) 0 20%,var(--jaune) 20% 40%,var(--green) 40% 60%,var(--blue) 60% 80%,#0FAE9E 80% 100%)}
.brand{font-weight:800;font-size:1.15rem;margin-top:2px}
.brand small{display:block;font-weight:600;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#C3006A}
.top .nav{margin-left:auto;font-size:.88rem;display:flex;gap:1rem;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:17rem minmax(0,1fr);gap:1.6rem;margin-top:1.4rem;align-items:start}
.toc{position:sticky;top:1rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:1rem .9rem;font-size:.9rem}
.toc b.sep{height:1px;background:var(--line);margin:.9rem .4rem}.toc b{display:block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem .4rem}
.toc ol{list-style:none;margin:0;padding:0}
.toc li a{display:flex;gap:.5rem;padding:.38rem .45rem;border-radius:10px;text-decoration:none;color:var(--ink);line-height:1.3}
.toc li a span{color:var(--rose-d);font-weight:700;min-width:1.4rem}
.toc li a:hover{background:#FDEBD8}
.toc li a[aria-current]{background:var(--navy);color:#fff}.toc li a[aria-current] span{color:#FBE7B8}
.toc .sub{margin:.1rem 0 .5rem 2.3rem;font-size:.82rem}
.toc .sub a{display:block;padding:.15rem 0;color:var(--muted);text-decoration:none}
.toc .sub a:hover{color:var(--rose-d)}
main{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:clamp(1.1rem,3vw,2.4rem);min-width:0}
.eyebrow{display:inline-block;font-weight:700;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--rose-d)}
h1{font-size:clamp(1.6rem,3.2vw,2.2rem);line-height:1.15;margin:.2rem 0 1rem;color:var(--navy)}
h2{font-size:1.3rem;color:var(--navy);margin:2.2rem 0 .6rem;padding-top:.6rem;border-top:1px solid var(--line);scroll-margin-top:1rem}
h3{font-size:1.08rem;color:var(--navy);margin:1.6rem 0 .4rem}
p,li{max-width:48rem}
img{max-width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block;margin:.8rem 0}
figure{margin:1.2rem 0}figcaption{font-size:.85rem;color:var(--muted);margin-top:.3rem}
.tbl{overflow-x:auto;margin:1rem 0 1.3rem}
table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{text-align:left;vertical-align:top;padding:.55rem .7rem;border-bottom:1px solid var(--line)}
thead th{background:#136FB8;color:#fff;font-weight:700}
tbody tr:nth-child(even){background:#F5F8FC}
.callout{border-left:4px solid #136FB8;background:#EAF3FB;border-radius:0 12px 12px 0;padding:.8rem 1rem;margin:1.1rem 0;max-width:48rem}
.callout.rose{border-left-color:#E3145C;background:#FDEBF1}
.callout p{margin:.2rem 0}.callout p+p{margin-top:.9rem;padding-top:.8rem;border-top:1px solid rgba(0,0,0,.08)}
blockquote{margin:0}blockquote.lettre{border-left:3px solid var(--line);background:#FBF8F4;border-radius:0 12px 12px 0;padding:.6rem 1.1rem;margin:.8rem 0 1.4rem;max-width:48rem}pre{background:#F5F8FC;border:1px solid var(--line);border-radius:10px;padding:.8rem 1rem;overflow-x:auto;font-size:.82rem;line-height:1.45;max-width:48rem}code{font-size:.88em}.callout ul{margin:.4rem 0 0}
.pager{display:flex;justify-content:space-between;gap:1rem;margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid var(--line)}
.pager a{display:block;max-width:48%;text-decoration:none;border:1px solid var(--line);border-radius:12px;padding:.7rem 1rem;color:var(--ink)}
.pager a small{display:block;color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em}
.pager a:hover{border-color:var(--rose)}
.chap-list{list-style:none;padding:0;margin:1.2rem 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.8rem}
.chap-list a{display:block;height:100%;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:.9rem 1rem;background:#fff}
.chap-list a:hover{border-color:var(--rose);box-shadow:var(--shadow-sm)}
.chap-list span{display:block;font-weight:800;color:var(--rose-d);font-size:1.3rem}
.meta{font-size:.9rem;color:var(--muted)}
.menu-btn{display:none}
@media (max-width:900px){.grid{grid-template-columns:1fr}.toc{position:static}.toc .sub{display:none}}
@media print{.top,.toc,.pager{display:none}.grid{display:block}main{border:0;padding:0}body{background:#fff}}
"""


def slug_chap(n):
    return 'chapitre-%02d' % n

def url_chap(n):
    return '/equipe/manuel/chapitre-%02d' % n


def charger_html():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, 'm.html')
    subprocess.run(['pandoc', DOCX, '-t', 'html5', '-o', out, '--extract-media=' + tmp], check=True)
    s = open(out, encoding='utf-8').read()
    for a, b in CORRECTIONS:
        if a not in s:
            raise SystemExit('Correction introuvable : ' + a[:70])
        s = s.replace(a, b, 1)
    return s, tmp


def encadres():
    """textes de debut des encadres colores du Word : bleu (EAF3FB) ou rose (FDEBF1)"""
    x = zipfile.ZipFile(DOCX).read('word/document.xml').decode()
    x = re.sub(r'<w:tbl>.*?</w:tbl>', '', x, flags=re.S)
    res = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', x, re.S):
        m = re.search(r'<w:pPr>.*?</w:pPr>', p, re.S)
        if not m:
            continue
        f = re.search(r'<w:shd [^>]*w:fill="([0-9A-F]{6})"', m.group(0))
        if f and f.group(1) in ('EAF3FB', 'FDEBF1'):
            t = H.unescape(re.sub(r'<[^>]+>', '', p))
            res.append((re.sub(r'\s+', ' ', t)[:40], 'rose' if f.group(1) == 'FDEBF1' else 'bleu'))
    return res


def nettoyer(soup, enc, medias, tmp):
    # tableaux : premiere ligne = en-tete, le reste en corps
    for t in soup.find_all('table'):
        rows = t.find_all('tr')
        cg = t.find('colgroup')
        if cg:
            cg.decompose()
        if not rows:
            continue
        if len(rows) == 1 and len(rows[0].find_all(['th', 'td'])) == 1:
            # tableau a une cellule = cadre d une figure
            cell = rows[0].find(['th', 'td'])
            fig = soup.new_tag('figure')
            for c in list(cell.contents):
                fig.append(c.extract() if hasattr(c, 'extract') else c)
            t.replace_with(fig)
            continue
        thead = soup.new_tag('thead'); tbody = soup.new_tag('tbody')
        for i, r in enumerate(rows):
            r.attrs = {}
            if i:
                for c in r.find_all('th'):
                    c.name = 'td'
            (thead if i == 0 else tbody).append(r.extract())
        for c in list(t.children):
            if getattr(c, 'name', None) in ('thead', 'tbody'):
                c.decompose()
        t.append(thead); t.append(tbody)
        t.attrs = {}
        wrap = soup.new_tag('div', attrs={'class': 'tbl'})
        t.wrap(wrap)
    # images : copie et chemins relatifs
    for img in soup.find_all('img'):
        src = img.get('src', '')
        nom = os.path.basename(src)
        chemin = src if os.path.isabs(src) else os.path.join(tmp, 'media', nom)
        if not os.path.exists(chemin):
            chemin = os.path.join(tmp, src)
        medias[nom] = chemin
        img['src'] = '/equipe/manuel/' + nom
        img['loading'] = 'lazy'
        img.attrs.pop('style', None)
        img.attrs.pop('title', None)
    # figure suivie de sa legende (paragraphe court juste apres)
    for fig in soup.find_all('figure'):
        nxt = fig.find_next_sibling()
        if nxt is not None and nxt.name == 'p' and len(nxt.get_text()) < 160 and not nxt.find('strong'):
            cap = soup.new_tag('figcaption'); cap.string = nxt.get_text(' ', strip=True)
            fig.append(cap); nxt.decompose()
    # encadres colores
    for p in soup.find_all(['p', 'blockquote']):
        if any('callout' in (a.get('class') or []) for a in p.parents if getattr(a, 'get', None)):
            continue
        t = re.sub(r'\s+', ' ', p.get_text(' ', strip=True))
        for debut, couleur in enc:
            if t[:25] and debut[:25].strip() and t.startswith(debut[:25].strip()):
                cible = p
                if p.name == 'p' and p.parent and p.parent.name == 'blockquote':
                    cible = p.parent
                cible.name = 'div'
                cible['class'] = ['callout'] + (['rose'] if couleur == 'rose' else [])
                break
    # libelles « CHAPITRE n » redondants
    for p in soup.find_all('p'):
        if re.fullmatch(r'CHAPITRE \d+', p.get_text(strip=True)):
            p.decompose()


def page(titre, corps, toc, courant=None):
    return ('<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<meta name="robots" content="noindex,nofollow">\n'
            '<title>%s · Manuel Odoo · Espace équipe</title>\n<style>%s</style>\n</head>\n<body>\n'
            '<div class="wrap">\n<div class="top"><div class="brand"><small>Espace équipe · Job Events</small>'
            'Manuel Odoo — processus commercial 2027</div>'
            '<div class="nav"><a href="/equipe/manuel/">Sommaire</a><a href="/equipe">← Espace équipe</a></div></div>\n'
            '<div class="grid">\n%s\n<main>\n%s\n</main>\n</div>\n</div>\n</body>\n</html>\n'
            ) % (H.escape(titre), CSS, toc, corps)


ANNEXES = [
    ('A', 'fiche-a-campagnes-email', 'Lancer une campagne e-mail', 'a-campagnes-email.md'),
    ('B', 'fiche-b-communications', 'Communications : tous les échanges avec un client', 'b-communications.md'),
    ('C', 'fiche-c-facturation-electronique', 'Facturation électronique : nos coordonnées pour les fournisseurs', 'c-facturation-electronique.md'),
]


def charger_annexe(fichier, medias):
    src = os.path.join(ICI, 'annexes', fichier)
    out = subprocess.run(['pandoc', '-f', 'markdown-implicit_figures', '-t', 'html5', src],
                         capture_output=True, text=True, check=True).stdout
    soup = BeautifulSoup(out, 'html.parser')
    for t in soup.find_all('table'):
        t.attrs = {}
        for r in t.find_all('tr'):
            r.attrs = {}
        t.wrap(soup.new_tag('div', attrs={'class': 'tbl'}))
    for img in soup.find_all('img'):
        nom = 'fiche-' + os.path.basename(img['src'])
        medias[nom] = os.path.join(ICI, 'annexes', img['src'])
        img['src'] = '/equipe/manuel/' + nom
        img['loading'] = 'lazy'
        p = img.find_parent('p')
        fig = soup.new_tag('figure')
        p.replace_with(fig); fig.append(img)
        nxt = fig.find_next_sibling()
        if nxt is not None and nxt.name == 'p' and nxt.find('em') and len(nxt.get_text()) < 200:
            cap = soup.new_tag('figcaption'); cap.string = nxt.get_text(' ', strip=True)
            fig.append(cap); nxt.decompose()
    for p in soup.find_all('p'):
        st = p.find('strong')
        if st is not None and p.contents and p.contents[0] is st:
            t = st.get_text()
            if t.startswith('Attention'):
                p.name = 'div'; p['class'] = ['callout', 'rose']
            elif t.startswith('Do It Once'):
                nx = p.find_next_sibling()
                p.name = 'div'; p['class'] = ['callout']
                if nx is not None and nx.name == 'ul':
                    p.append(nx.extract())
    for bq in soup.find_all('blockquote'):
        bq['class'] = ['lettre']
    sous = [(h.get('id'), h.get_text(' ', strip=True)) for h in soup.find_all('h2')]
    return str(soup), sous


def main():
    s, tmp = charger_html()
    soup = BeautifulSoup(s, 'html.parser')
    medias = {}
    nettoyer(soup, encadres(), medias, tmp)

    h1s = [h for h in soup.find_all('h1') if h.get('id') != 'table-des-matières']
    pages = []
    for i, h in enumerate(h1s):
        bloc = []
        n = h.next_sibling
        while n is not None and not (getattr(n, 'name', None) == 'h1'):
            bloc.append(n); n = n.next_sibling
        sous = [(x.get('id'), x.get_text(' ', strip=True)) for x in bloc if getattr(x, 'name', None) == 'h2']
        pages.append({'cle': '%02d' % (i + 1), 'etiquette': 'Chapitre %d' % (i + 1), 'section': 'chap',
                      'fichier': slug_chap(i + 1), 'titre': h.get_text(' ', strip=True),
                      'html': ''.join(str(x) for x in bloc), 'sous': sous})
    for lettre, fichier, titre, md in ANNEXES:
        html, sous = charger_annexe(md, medias)
        pages.append({'cle': lettre, 'etiquette': 'Fiche pratique ' + lettre, 'section': 'fiche',
                      'fichier': fichier, 'titre': titre, 'html': html, 'sous': sous})
    for p in pages:
        p['url'] = '/equipe/manuel/' + p['fichier']

    apropos = []
    debut = soup.find(string=re.compile('propos de ce manuel'))
    if debut:
        n = debut.find_parent('p').next_sibling
        while n is not None and not (getattr(n, 'name', None) == 'h1'):
            apropos.append(str(n)); n = n.next_sibling
    meta = []
    for lab in ('Destinataires', 'Périmètre', 'Version', 'Auteur'):
        st = soup.find('strong', string=lab)
        if st:
            meta.append(str(st.find_parent('p')))

    def toc(courant=None):
        blocs = []
        for section, titre in (('chap', 'Sommaire'), ('fiche', 'Fiches pratiques')):
            items = []
            for p in pages:
                if p['section'] != section:
                    continue
                cur = ' aria-current="page"' if courant is p else ''
                li = '<li><a href="%s"%s><span>%s</span>%s</a>' % (p['url'], cur, p['cle'], H.escape(p['titre']))
                if courant is p and p['sous']:
                    li += '<div class="sub">' + ''.join('<a href="#%s">%s</a>' % (i, H.escape(t)) for i, t in p['sous']) + '</div>'
                items.append(li + '</li>')
            blocs.append('<b>%s</b><ol>%s</ol>' % (titre, ''.join(items)))
        return '<nav class="toc">%s</nav>' % '<b class="sep"></b>'.join(blocs)

    if os.path.isdir(SORTIE):
        shutil.rmtree(SORTIE)
    os.makedirs(SORTIE)
    for nom, chemin in medias.items():
        shutil.copy2(chemin, os.path.join(SORTIE, nom))

    def cartes(section):
        return ''.join('<li><a href="%s"><span>%s</span>%s</a></li>' % (p['url'], p['cle'], H.escape(p['titre'])) for p in pages if p['section'] == section)
    accueil = ('<span class="eyebrow">Manuel d\'utilisation</span><h1>Odoo au service du processus commercial</h1>'
               '<p class="meta">Du devis à l\'exécution — Le Village des Recruteurs 2027</p>%s%s'
               '<h2>Les chapitres</h2><ul class="chap-list">%s</ul>'
               '<h2>Les fiches pratiques</h2><ul class="chap-list">%s</ul>'
               '<p class="meta"><em>Document interne — ne pas diffuser à l\'extérieur de Job Events.</em></p>'
               ) % (''.join(meta), ''.join(apropos), cartes('chap'), cartes('fiche'))
    open(os.path.join(SORTIE, 'index.html'), 'w', encoding='utf-8').write(page('Sommaire', accueil, toc()))

    for i, c in enumerate(pages):
        prec = pages[i - 1] if i else None
        suiv = pages[i + 1] if i + 1 < len(pages) else None
        pager = '<div class="pager">%s%s</div>' % (
            ('<a href="%s"><small>← %s</small>%s</a>' % (prec['url'], prec['etiquette'], H.escape(prec['titre']))) if prec else '<span></span>',
            ('<a href="%s" style="text-align:right"><small>%s →</small>%s</a>' % (suiv['url'], suiv['etiquette'], H.escape(suiv['titre']))) if suiv else '<span></span>')
        corps = '<span class="eyebrow">%s</span><h1>%s</h1>%s%s' % (c['etiquette'], H.escape(c['titre']), c['html'], pager)
        open(os.path.join(SORTIE, c['fichier'] + '.html'), 'w', encoding='utf-8').write(page(c['titre'], corps, toc(c)))
    print('%d pages, %d images -> %s' % (len(pages), len(medias), SORTIE))


if __name__ == '__main__':
    main()
