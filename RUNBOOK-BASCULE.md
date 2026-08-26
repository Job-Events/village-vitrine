# Bascule du site vers Cloudflare Pages

Hebergeur retenu : **Cloudflare Pages**, projet `village-des-recruteurs`,
connecte au depot `Job-Events/village-vitrine`, branche de production
`mise-en-production`, repertoire publie `dist`.

## Etat au 26 aout 2026

| Element | Etat |
|---|---|
| 23 pages reelles | verifiees, 200 |
| 32 redirections des anciennes adresses | verifiees, aboutissent toutes |
| Page 404 a la charte | verifiee, noindex, hors plan de site |
| Cache images et polices | 1 an, immutable |
| Accueil | 7 005 octets, contre 6 905 303 sur l'ancienne monopage |
| Balises canoniques | pointent vers le domaine reel sur les 23 pages |
| Domaine reel | **pas encore attache** |

Aperçus disponibles :

- `village-des-recruteurs.pages.dev`, connecte a Git, deploiement automatique
- `village-vitrine.pages.dev`, envoi direct, copie de comparaison a supprimer
  une fois la bascule terminee
- `village-vitrine.vercel.app`, copie Vercel, a supprimer egalement

## Ce qu'il reste a faire

### 1. Retirer le noindex, puis attacher le domaine, dans cet ordre

L'ordre est important. `_headers` applique `X-Robots-Tag: noindex` a tout le
site, faute de pouvoir conditionner un en-tete sur le nom d'hote chez Cloudflare.

- Attacher le domaine **avant** de retirer l'en-tete ferait sortir le site reel
  de Google.
- Retirer l'en-tete **avant** d'attacher le domaine expose la copie `pages.dev`
  a l'indexation pendant quelques minutes. Le risque est faible : les 23 pages
  portent une balise canonique vers `www.levillagedesrecruteurs.fr`, et aucun
  lien externe ne pointe vers `pages.dev`.

C'est donc la seconde sequence qu'il faut suivre.

### 2. Attacher le domaine

Projet `village-des-recruteurs` -> **Custom domains** -> ajouter
`www.levillagedesrecruteurs.fr`.

La zone etant hebergee chez Cloudflare, l'enregistrement DNS est cree
automatiquement : aucune edition manuelle n'est necessaire.

### 3. Enregistrements DNS a ne pas toucher

Inventaire releve le 26 aout 2026 par l'API Cloudflare.

| Type | Nom | Valeur | Proxy |
|---|---|---|---|
| A | `levillagedesrecruteurs.fr` | `51.77.236.197` | oui |
| CNAME | `*.levillagedesrecruteurs.fr` | `prod.matchingsquare.com` | oui |
| CNAME | `www.levillagedesrecruteurs.fr` | `job-events.github.io` | non |
| MX | `levillagedesrecruteurs.fr` | `levillagedesrecruteurs-fr.mail.protection.outlook.com` | non |
| TXT | `levillagedesrecruteurs.fr` | `google-site-verification=...` | non |
| TXT | `levillagedesrecruteurs.fr` | `v=spf1 include:spf.protection.outlook.com...` | non |
| TXT | `levillagedesrecruteurs.fr` | `MS=ms72498659` | non |

Seul le `CNAME www` change, et Cloudflare s'en charge.

**Le joker.** Le `CNAME *` renvoie vers `prod.matchingsquare.com` : c'est lui qui
fait fonctionner les sous-domaines de ville, `toulouse.`, `dijon.`, `orleans.` et
`lyon.`, vers lesquels pointent les boutons d'inscription candidat. Y toucher
casserait les inscriptions. L'enregistrement `www` etant explicite, il reste
prioritaire sur le joker.

**L'apex** pointe encore vers le serveur Odoo, `51.77.236.197`, la meme adresse
que `jobevents.odoo.com`. Ce qui produit la redirection vers `www` n'est pas cet
enregistrement mais une regle de redirection dynamique de la zone, expression
`(http.host eq "levillagedesrecruteurs.fr")`, 301, active. Elle est independante
de l'hebergeur et survit a la bascule. Si elle etait desactivee un jour, l'apex
servirait le site Odoo. Menage a prevoir, hors perimetre.

**La messagerie** ne depend pas de l'hebergeur web. `image@levillagedesrecruteurs.fr`,
cite sur la page Galerie, doit continuer de fonctionner : le verifier apres
bascule.

### 4. Controles apres bascule

```
curl -sI https://www.levillagedesrecruteurs.fr/ | grep -iE "^HTTP|x-robots|server"
```

- Aucun `X-Robots-Tag` ne doit apparaitre.
- `Server: cloudflare` confirme que la bascule a pris.
- Les 14 anciennes adresses doivent repondre 301 puis aboutir a la bonne page.
- Verifier l'envoi et la reception d'un courriel sur le domaine.
- Soumettre `sitemap.xml`, 23 adresses, dans la Search Console.
- Retirer le fichier `CNAME` du depot et desactiver GitHub Pages, pour ne pas
  laisser deux sources servir le meme contenu.
- Supprimer les copies devenues inutiles : projet Vercel, et projet Pages
  `village-vitrine` en envoi direct.
- Revoquer le jeton API Cloudflare, qui n'a pas d'expiration.

### 5. Fenetre conseillee

Avant le 10 septembre. Le calendrier se remplit ensuite : Toulouse les 16 et 17
septembre, Dijon le 24, Orleans le 8 octobre, Lyon les 14 et 15. Ne pas basculer
la veille d'un salon.

## Retour arriere

Repointer le `CNAME www` vers `job-events.github.io`. La branche `main` et
GitHub Pages restent intacts et servent toujours l'ancienne version.
