# Bascule du site en production

Etat prepare sur cette branche `mise-en-production`, validee pour mise en
service.

Le `X-Robots-Tag: noindex` n'est plus retire : il est **conditionne au nom
d'hote** dans `vercel.json`. La copie `village-vitrine.vercel.app` le porte, le
domaine reel ne le porte jamais. Il n'y a donc plus d'etape manuelle a ne pas
oublier au moment de la bascule, et plus de risque de sortir le site de Google.

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

Fait le 26 aout 2026 : `Job-Events/village-vitrine` est connecte au projet
Vercel.

Fait egalement : `mise-en-production` est designee comme branche de production,
dans Settings, Environments, environnement Production, section Branch Tracking.
Le reglage n'existe plus sous Settings, Git, contrairement a ce que decrivent
d'anciennes documentations.

Vercel ne documente aucune methode API ni CLI pour ce reglage : il se fait
uniquement au tableau de bord.

### 3. Declarer le domaine

Ajouter `www.levillagedesrecruteurs.fr` dans le projet, ce qui declenche
l'emission du certificat. A faire **avant** l'etape 4, sinon coupure.

### 4. Changer un seul enregistrement DNS

Zone hebergee chez Cloudflare.

- Aujourd'hui : `www` CNAME -> `job-events.github.io`, sans proxy.
- Apres : `www` CNAME -> la cible fournie par l'hebergeur.

Inventaire complet de la zone, releve le 26 aout 2026 par l'API Cloudflare :

| Type | Nom | Valeur | Proxy |
|---|---|---|---|
| A | `levillagedesrecruteurs.fr` | `51.77.236.197` | oui |
| CNAME | `*.levillagedesrecruteurs.fr` | `prod.matchingsquare.com` | oui |
| CNAME | `www.levillagedesrecruteurs.fr` | `job-events.github.io` | non |
| MX | `levillagedesrecruteurs.fr` | `levillagedesrecruteurs-fr.mail.protection.outlook.com` | non |
| TXT | `levillagedesrecruteurs.fr` | `google-site-verification=...` | non |
| TXT | `levillagedesrecruteurs.fr` | `v=spf1 include:spf.protection.outlook.com...` | non |
| TXT | `levillagedesrecruteurs.fr` | `MS=ms72498659` | non |

Seul l'enregistrement `CNAME www` doit changer. Les six autres restent en place.

**Attention au joker.** Le `CNAME *` renvoie vers `prod.matchingsquare.com` : c'est
lui qui fait fonctionner les sous-domaines de ville, `toulouse.`, `dijon.`,
`orleans.` et `lyon.`, vers lesquels pointent les boutons d'inscription candidat.
Y toucher casserait les inscriptions. L'enregistrement `www` etant explicite, il
reste prioritaire sur le joker : les deux cohabitent sans conflit.

**L'apex pointe encore vers le serveur Odoo**, `51.77.236.197`, la meme adresse
que `jobevents.odoo.com`. Ce qui produit la redirection vers `www` n'est pas cet
enregistrement mais une regle de redirection dynamique de la zone, expression
`(http.host eq "levillagedesrecruteurs.fr")`, 301, active. Elle est independante
de l'hebergeur et survit donc a la bascule. A noter tout de meme : si cette regle
etait desactivee un jour, l'apex servirait le site Odoo. Menage a prevoir, hors
du perimetre de la bascule.

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

- Aucun `X-Robots-Tag` ne doit apparaitre sur le domaine reel. Il doit en
  revanche rester present sur `village-vitrine.vercel.app`, ce qui se verifie
  avec la meme commande sur cette adresse.
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
