# Reprendre le site après le départ de Jesse

Document de passation, arrêté au 26 août 2026. À lire avant la première
modification. `CONSTRUIRE.md` décrit le circuit technique, celui-ci décrit les
accès, les pièges et ce qui reste à faire.

## Ce qu’il faut sur votre poste, et rien de plus

| Besoin | Pourquoi |
|---|---|
| **Git** | cloner le dépôt et publier |
| Le dépôt cloné | `git clone https://github.com/Job-Events/village-vitrine.git` |
| Python 3, facultatif | vérifier le rendu en local avant de publier |

**Un seul accès est nécessaire pour publier : GitHub.** Cloudflare est connecté
au dépôt, donc toute poussée sur la branche `mise-en-production` déclenche la
fabrication et la mise en ligne. Aucun accès Cloudflare n’est requis pour
modifier le site.

Sous Windows, Git installe un gestionnaire d’identifiants : à la première
poussée, une fenêtre de navigateur s’ouvre, vous vous connectez à GitHub, et
c’est réglé définitivement. Aucun jeton à créer ni à coller nulle part.

## Les accès occasionnels

**Cloudflare**, par le tableau de bord et jamais par une clé d’API, sert à
quatre choses : purger le cache, lire les journaux si un déploiement échoue,
revenir à un déploiement précédent, et modifier le DNS.

Ne créez pas de jeton d’API à large portée. Celui utilisé pendant la migration
portait 318 permissions dont 185 en écriture, sans expiration ; il a été
révoqué le 26 août.

**Odoo** sert aux formulaires du site et aux notifications internes. Les
formulaires de contact candidat et de demande exposant y vivent, ainsi que les
automatisations qui envoient les courriels à `communication@job.events` et
`demandes@job.events`. Il vous faut votre propre clé d’API.

Recommandation formulée le 13 août et toujours pas appliquée : créer un
utilisateur Odoo technique dédié aux intégrations, avec sa propre clé, pour
qu’un départ ne casse plus les accès.

## Les pièges de ce site

**Un bouton de navigation doit être un lien.** La source vient d’une époque où
le site tenait dans une seule page, avec des boutons portant
`onclick="go('page')"`. La génération en pages réelles retire cet attribut : un
bouton devient alors muet. Le 26 août, vingt boutons étaient inertes en
production, dont les deux appels à l’action de la page d’accueil. Écrivez
`<a class="btn ..." href="#page" onclick="go('page')">`, jamais `<button>`.

**Vérifiez toujours en ligne, pas seulement dans le code.** Deux défauts
majeurs ont échappé à des contrôles automatiques ce jour-là : le lien
d’inscription candidat et ces vingt boutons répondaient tous correctement aux
tests d’adresse. Seul un clic réel les révélait.

**Une image remplacée met 24 heures à apparaître.** Voir `CONSTRUIRE.md`. Pour
un effet immédiat, purgez le cache, ou déposez le fichier sous un nouveau nom.

**Le DNS et les automatisations Odoo sont les deux endroits dangereux.** Une
erreur sur l’enregistrement `www` coupe le site ; une erreur sur le `MX` coupe
la messagerie. L’enregistrement joker de la zone sert les sous-domaines de
ville vers Matching Square : y toucher casse les inscriptions candidats.

## Retour arrière

La branche `main` contient encore l’ancienne version en une seule page, et
GitHub Pages reste actif. Repointer l’enregistrement `CNAME www` vers
`job-events.github.io` fait resservir cette version.

Ce filet doit être conservé quelques semaines, puis retiré une fois la
stabilité acquise : supprimer `main`, désactiver GitHub Pages, retirer le
fichier `CNAME`.

## Ce qui reste à faire

La liste complète, avec pour chaque point qui décide et combien de temps cela
prend, se trouve dans `etat_des_lieux_village_des_recruteurs_26_aout_2026.txt`,
remis à la direction. Les points les plus urgents :

1. **Deux décisions de direction.** L’origine des trois témoignages étoilés de
   la page d’accueil, et la CVthèque annoncée incluse dans les 990 € mais
   facturée 400 € au simulateur. Ce sont les deux seuls points qui engagent
   l’entreprise.
2. **Soumettre le plan de site** dans la Search Console : le site est passé
   d’une adresse indexable à vingt-trois.
3. **Ajouter DMARC et DKIM** sur le domaine, absents tous les deux.
4. **Relancer OVH** pour les certificats de `jobevents.fr` et `jobevents.eu`,
   toujours en échec en HTTPS.
5. **Installer une mesure d’audience.** Aucune n’existe. Un défaut du parcours
   d’inscription est resté en ligne plusieurs jours et une seule candidate a
   écrit ; personne ne sait combien ont renoncé en silence.

## Historique de la migration

Le site tournait sur GitHub Pages en une page unique de 6,9 Mo. Il a été
découpé en 23 pages, allégé à 7 Ko pour la page d’accueil, et migré vers
Cloudflare Pages le 26 août 2026, pour disposer des redirections permanentes
des dix-sept anciennes adresses, que GitHub Pages ne permet pas.

Une copie de comparaison a existé sur Vercel pendant l’arbitrage, et une
seconde sur Cloudflare en envoi direct. Les deux projets ont été supprimés le
26 août 2026, ainsi que la configuration Vercel du dépôt ; l’historique Git la
conserve si elle devait resservir.

Il ne reste donc qu’un seul environnement, le projet Cloudflare Pages
`village-des-recruteurs`, connecté au dépôt `Job-Events/village-vitrine` sur la
branche `mise-en-production`. Toute autre adresse rencontrée dans d’anciens
documents, en `.vercel.app` ou en `village-vitrine.pages.dev`, n’existe plus.

`RUNBOOK-BASCULE.md` garde la trace détaillée de cette migration, dont
l’inventaire complet de la zone DNS.
