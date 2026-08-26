# Bascule du site en production

Etat prepare sur cette branche `mise-en-production`. Le `X-Robots-Tag: noindex`
a ete retire de `vercel.json` : cette branche est donc **destinee a la
production** et ne doit jamais servir de copie d'apercu.

## Ce qui est deja fait

- 23 pages reelles generees depuis `_source.html` par `build.py`, build
  reproductible et verifie sans ecart.
- 32 redirections permanentes des anciennes adresses, dans `vercel.json` pour
  Vercel et dans `_redirects` pour Cloudflare Pages. Les 15 chaines testees sur
  l'apercu aboutissent toutes a la bonne page.
- Accueil a 7 084 octets transferes, contre 6 905 303 sur l'ancienne monopage.
- Les quatre correctifs bloquants de l'audit du 24 aout : lien apex Matching
  Square, adresse de candidature, notes internes des mentions legales, articles
  inexistants.

## Etapes restantes

### 1. Choisir l'hebergeur

| | Vercel Pro | Cloudflare Pages |
|---|---|---|
| Cout | 20 $/mois/utilisateur | gratuit, usage commercial autorise |
| Fichier de config | `vercel.json` | `_redirects` + `_headers` |
| Integration Git | native, apercu par branche | native, apercu par branche |
| DNS | CNAME vers `cname.vercel-dns.com` | zone deja chez Cloudflare |

Les deux configurations sont presentes dans le depot. Chaque hebergeur ignore
le format de l'autre, il n'y a donc rien a retirer.

### 2. Connecter le depot Git a l'hebergeur

Action console, non scriptable ici. Point de vigilance : designer
`mise-en-production` comme branche de production, ou fusionner cette branche
dans `main` au prealable. Par defaut l'hebergeur prend `main`, qui contient
encore l'ancienne monopage.

### 3. Declarer le domaine

Ajouter `www.levillagedesrecruteurs.fr` dans le projet, ce qui declenche
l'emission du certificat. A faire **avant** l'etape 4, sinon coupure.

### 4. Changer un seul enregistrement DNS

Zone hebergee chez Cloudflare.

- Aujourd'hui : `www` CNAME -> `job-events.github.io`, sans proxy.
- Apres : `www` CNAME -> la cible fournie par l'hebergeur.

A ne pas toucher :

- `MX` -> `levillagedesrecruteurs-fr.mail.protection.outlook.com`. La
  messagerie ne depend pas de l'hebergeur web. `image@levillagedesrecruteurs.fr`
  doit continuer de fonctionner : le verifier apres bascule.
- La redirection de l'apex vers `www` est faite par Cloudflare, en amont de
  l'hebergeur. Elle ne bouge pas.
- Les enregistrements `TXT` (SPF et validations).

Si le proxy Cloudflare est active sur `www`, regler le mode SSL sur
`Full (strict)`, faute de quoi une boucle de redirection apparait.

### 5. Apres bascule, controles

```
curl -sI https://www.levillagedesrecruteurs.fr/ | grep -i "^HTTP\|x-robots"
```

- Aucun `X-Robots-Tag` ne doit apparaitre.
- Les 14 anciennes adresses doivent repondre 301 puis aboutir a la bonne page.
- Verifier l'envoi et la reception d'un courriel sur le domaine.
- Soumettre `sitemap.xml`, 23 adresses, dans la Search Console.
- Retirer le fichier `CNAME` du depot et desactiver GitHub Pages, pour ne pas
  laisser deux sources servir le meme contenu.

### 6. Fenetre conseillee

Avant le 10 septembre. Le calendrier se remplit ensuite : Toulouse les 16 et 17
septembre, Dijon le 24, Orleans le 8 octobre, Lyon les 14 et 15. Ne pas basculer
la veille d'un salon.

## Retour arriere

Repointer le CNAME `www` vers `job-events.github.io`. La branche `main` et
GitHub Pages restent intacts tant que l'etape 5 n'est pas terminee.
