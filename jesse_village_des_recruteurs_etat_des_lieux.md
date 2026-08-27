# Jesse · Village des Recruteurs · État des lieux

Document unique de passation, arrêté au 26 août 2026. Il remplace les quatre
documents précédents, `CONSTRUIRE.md`, `REPRENDRE-LE-SITE.md`,
`RUNBOOK-BASCULE.md` et le fichier d’état des lieux remis à la direction.

Il vit dans le dépôt du site pour voyager avec le code. En cas de divergence
avec un document plus ancien, c’est lui qui fait foi.

## À qui il s’adresse

Deux lectures possibles.

**La direction** lira le chapitre 1 pour l’état du site, puis le chapitre 6
pour ce qui reste à décider. Le reste est technique.

**La personne qui reprend le site** lira les chapitres 2 à 5 avant sa première
modification : comment publier, ce dont elle a besoin, et les pièges propres à
ce site.

## Ce qu’il faut savoir en trois phrases

Le site est en ligne, servi par Cloudflare Pages, et vérifié fichier par
fichier. Sur les 61 constats de l’audit, 46 sont clos. Ce qui reste tient
presque entièrement à des décisions, pas à de la technique.

---

---

# 1. OÙ EN EST LE SITE

## Les chiffres, mesurés en production le 26 août

| | Avant | Après |
|---|---|---|
| Poids d’une visite de l’accueil | 6 905 303 o | **7 034 o** |
| Temps de réponse | 0,176 s | **0,071 s** |
| Adresses indexables | 1 | **23** |
| Anciennes adresses en erreur | 17 | **0** |
| Éléments cliquables hors clavier | 78 | **1** |
| Contrastes non conformes | 19 | **0** |
| Requêtes vers des serveurs tiers | 2 | **0** |
| Décalage de mise en page mesuré | non mesuré | **0** |

L’allègement atteint un facteur 985 sur le poids transféré. Parcourir la
galerie complète passe de 4,07 Mo à 1,90 Mo.

## Ce qui a été vérifié, et comment

Les 470 fichiers du site fabriqué par Cloudflare ont été comparés à une
construction neuve issue d’un clone vierge : **zéro écart inexpliqué**. Les
seules différences sont les transformations que Cloudflare applique lui-même,
l’obfuscation des adresses e-mail sur les trois pages qui en contiennent et le
bloc de règles ajouté au `robots.txt`.

Les 23 pages répondent, les 32 redirections aboutissent, la page d’erreur est
à la charte, et la construction est déterministe : deux exécutions du même
commit produisent une empreinte identique.

## L’environnement, après ménage

Il n’y a plus qu’un seul environnement.

| | |
|---|---|
| Domaine public | `www.levillagedesrecruteurs.fr` |
| Hébergeur | Cloudflare Pages, projet `village-des-recruteurs` |
| Dépôt | `Job-Events/village-vitrine` |
| Branche publiée | `mise-en-production` |
| Adresse technique | `village-des-recruteurs.pages.dev` |

Les deux copies de comparaison, un projet Vercel et un projet Cloudflare en
envoi direct, ont été supprimées le 26 août. Toute adresse en `.vercel.app` ou
en `village-vitrine.pages.dev` rencontrée dans un ancien document n’existe plus.

---

# 2. PUBLIER UNE MODIFICATION

## En une phrase

On modifie un fichier de travail, on pousse sur `mise-en-production`, et
Cloudflare fabrique et publie tout seul.

## Les fichiers que l’on modifie

| Fichier | Contenu |
|---|---|
| `_source.html` | tout le contenu rédigé, les 17 sections du site |
| `app.js` | données de la tournée, photos, fil des réseaux, simulateur |
| `styles.css` | la charte graphique |
| `img/` | les images, et `img/thumb/` les vignettes de galerie |
| `build.py` | le script qui assemble les pages |

## La commande

    git pull
    # modifier _source.html, app.js, styles.css ou img/
    git add -A
    git commit -m "ce que j'ai change"
    git push

Le déploiement part automatiquement, dure moins d’une minute et n’installe
aucune dépendance : `build.py` n’utilise que la bibliothèque standard de
Python et fonctionne depuis la version 3.6.

## Vérifier avant de pousser, si on veut

    python3 build.py

La commande recrée le dossier `dist/` en local et affiche le bilan. Ouvrir
`dist/index.html` dans un navigateur montre le résultat. Ce n’est jamais
obligatoire, Cloudflare construisant de son côté.

## Ce qui est publié, et ce qui ne l’est jamais

Seul le contenu de `dist/` part en ligne, et il n’est pas versionné :
Cloudflare le fabrique à chaque déploiement. `_source.html`, `app.js` à la
racine, `build.py`, `gestion.html`, le présent document et les fichiers de
configuration restent dans le dépôt sans être servis.

C’est la raison de ce découpage : la console de gestion interne,
`gestion.html`, avait été accessible publiquement, sans mot de passe, jusqu’au
26 août 2026.

## Réglages du projet Cloudflare, à ne pas modifier

    Branche de production      mise-en-production
    Commande de construction   python3 build.py
    Dossier de sortie          dist

## Si un déploiement échoue

Le site en ligne reste celui du déploiement précédent, rien n’est cassé. Les
journaux sont dans le projet Cloudflare, onglet Deployments.

Cause la plus probable : la version de Python de l’image de construction. Au
besoin, définir la variable d’environnement `PYTHON_VERSION` à `3.11` dans les
réglages du projet.

---

# 3. LES ACCÈS NÉCESSAIRES

## Un seul suffit pour publier : GitHub

Cloudflare est connecté au dépôt, donc toute poussée déclenche la mise en
ligne. **Aucun accès Cloudflare n’est requis pour modifier le site.**

Il n’existe pas de « connexion GitHub à Claude » : Claude exécute la commande
`git` de la machine, avec les identifiants du poste. Rien à autoriser côté
Claude, aucun jeton à créer.

Ce qu’il faut sur le poste :

| Besoin | Pourquoi |
|---|---|
| **Git** | cloner le dépôt et publier |
| Le dépôt cloné | `git clone https://github.com/Job-Events/village-vitrine.git` |
| Python 3, facultatif | vérifier le rendu en local avant de publier |

Sous Windows, Git installe un gestionnaire d’identifiants : à la première
poussée, une fenêtre de navigateur s’ouvre, on se connecte à GitHub, et c’est
réglé définitivement.

## Les accès occasionnels

**Cloudflare**, par le tableau de bord et jamais par une clé d’API, sert à
quatre choses : purger le cache, lire les journaux d’un déploiement en échec,
revenir à un déploiement précédent, et modifier le DNS.

Ne créez pas de jeton d’API à large portée. Celui utilisé pendant la migration
portait 318 permissions dont 185 en écriture, sans expiration ; il a été
révoqué le 26 août, et les clés de stockage R2 qui l’accompagnaient restent à
révoquer.

**Odoo** héberge les formulaires du site et les notifications internes : le
contact candidat, la demande exposant, et les automatisations qui envoient les
courriels à `communication@job.events` et `demandes@job.events`. Il faut sa
propre clé d’API.

Recommandation formulée le 13 août 2026 et toujours pas appliquée : créer un
utilisateur Odoo technique dédié aux intégrations, avec sa propre clé, pour
qu’un départ ne casse plus les accès.

**Google Search Console** sert au suivi de l’indexation.

---

# 4. LES PIÈGES DE CE SITE

Quatre, dont trois ont réellement coûté cher le 26 août.

## Un bouton de navigation doit être un lien

La source vient d’une époque où le site tenait dans une seule page, avec des
boutons portant `onclick="go('page')"`. La génération en pages réelles retire
cet attribut : le bouton devient alors muet.

Le 26 août, **vingt boutons étaient inertes en production**, dont les deux
appels à l’action de la page d’accueil et les sept qui menaient au simulateur
de coût. Écrire :

    <a class="btn btn-blue" href="#page" onclick="go('page')">Libellé</a>

Jamais `<button>` pour naviguer.

## Vérifier en ligne, pas seulement dans le code

Deux défauts majeurs ont échappé à des contrôles automatiques exhaustifs le
même jour : le lien d’inscription candidat et ces vingt boutons répondaient
tous correctement aux tests d’adresse. Seul un clic réel les révélait.

C’est le signalement d’une candidate de Toulouse, persuadée que le site était
en maintenance, qui a mis le premier au jour.

## Une image remplacée met 24 heures à apparaître

Déposer le nouveau fichier sous le même nom suffit, la propagation est
automatique. Pour un effet immédiat : purger le cache dans Cloudflare, section
Caching, Configuration, Purge Everything. Ou déposer le fichier sous un
**nouveau nom** et mettre la référence à jour, ce qui est la méthode la plus
sûre.

Le 26 août, deux logos redimensionnés sont restés invisibles plusieurs heures :
le cache était alors réglé sur un an en « immutable », ce qui convient aux
polices et aux fichiers versionnés, jamais à un fichier remplaçable à chemin
constant.

## Le DNS et les automatisations Odoo sont les deux endroits dangereux

Une erreur sur l’enregistrement `www` coupe le site. Une erreur sur le `MX`
coupe la messagerie. Et l’enregistrement joker de la zone sert les
sous-domaines de ville vers Matching Square : y toucher casse les inscriptions
candidats. Voir le chapitre 7.

---

# 5. CE QUI A ÉTÉ CORRIGÉ

Sur les 61 constats de l’audit, 46 sont clos. Le détail de chacun figure dans
le document d’audit, retrouvable par sa référence.

LIENS ET PARCOURS DE CONVERSION                                    5 sur 6
------------------------------------------------------------------------------
  1.1  [EN LIGNE]  Le bouton d’inscription candidat menait à une adresse morte.
                   Trois liens visaient le domaine de Matching Square sans le
                   « www », sur lequel le port sécurisé ne répond pas. C’était
                   le principal chemin d’inscription du site.
  1.2  [EN LIGNE]  Une adresse de candidature hors du domaine de l’entreprise,
                   qui aboutissait chez Odoo et non dans la messagerie de
                   l’équipe commerciale.
  1.3  [EN LIGNE]  Le pied de page ne comptait qu’un seul lien véritable sur
                   dix-neuf.
  1.4  [EN LIGNE]  Quatre libellés différents pour le même lien de retour.
  1.5  [EN LIGNE]  Un formulaire de collecte candidat pointait vers un hôte
                   muet. Code mort, aucune inscription perdue, retiré.
  1.6  [HUMAIN]    Reste à vérifier l’état des cinq publications sociales
                   relayées, depuis un compte connecté.

MIGRATION ET ARCHITECTURE                                          7 sur 7
------------------------------------------------------------------------------
  2.1  [EN LIGNE]  Dix-sept anciennes adresses répondaient 404 sans redirection.
                   Trente-deux règles permanentes sont en place, et les seize
                   chaînes testées aboutissent toutes à la bonne page.
  2.2  [EN LIGNE]  Le plan de site ne déclarait qu’une seule adresse. Il en
                   déclare vingt-trois, toutes vérifiées en ligne.
  2.3  [EN LIGNE]  Aucune page d’erreur personnalisée. Les visiteurs recevaient
                   la page d’erreur de GitHub, en anglais et hors charte. Une
                   page maison existe, non indexable et hors plan de site.
  2.4  [EN LIGNE]  Le bouton Retour du navigateur faisait quitter le site.
  2.5  [EN LIGNE]  Six pages Odoo par défaut étaient publiées, dont une page
                   technique révélant la version installée.
  2.6  [EN LIGNE]  Aucun balisage d’événement, alors que c’est le cœur du
                   métier. Les sept fiches de ville portent un balisage complet,
                   dates, lieu, organisateur, gratuité.
  2.7  [EN LIGNE]  Les points d’entrée Odoo et les sous-domaines de ville qui
                   devaient survivre à la migration sont consignés par écrit,
                   et vérifiés après bascule.

SÉMANTIQUE ET INTITULÉS                                            7 sur 7
------------------------------------------------------------------------------
  3.1  [EN LIGNE]  Les titres d’onglet étaient fabriqués à partir des noms de
                   code internes, ce qui exposait « Evenements », « Faq »,
                   « Matchingsquare » et « Village-detail » dans les onglets,
                   les favoris et les résultats de recherche. Les vingt-trois
                   pages portent désormais un titre et une description rédigés.
  3.2  [EN LIGNE]  Le contenu produit par script était invisible pour les
                   moteurs. Une liste servie garantit le maillage vers les sept
                   fiches de ville.
  3.3  [EN LIGNE]  Les villes étaient des données, jamais du texte rédigé.
  3.4  [EN LIGNE]  Une page utile était orpheline.
  3.5  [CLOS]      Le jargon relevé s’adresse en réalité à des professionnels.
  3.6  [EN LIGNE]  Vocabulaire et publics rétablis.
  3.7  [CLOS]      Le constat d’origine était inexact, les balises existaient.

LANGUE ET TYPOGRAPHIE                                              5 sur 5
------------------------------------------------------------------------------
  4.1  [EN LIGNE]  Deux tutoiements avaient survécu au passage au vouvoiement.
  4.2  [EN LIGNE]  Relevé typographique complet appliqué, pourcentages,
                   apostrophes, heures, tirets et graphies.
  4.3  [EN LIGNE]  La balise de partage social employait un tiret cadratin.
  4.4  [CLOS]      Aucune formulation recyclée ne subsistait.
  4.5  [EN LIGNE]  Libellés de retour unifiés.

ACCESSIBILITÉ                                                      8 sur 10
------------------------------------------------------------------------------
  5.1  [EN LIGNE]  Soixante-dix-huit éléments cliquables étaient hors de portée
                   du clavier, dont toute la navigation principale. Il en reste
                   un seul.
  5.2  [EN LIGNE]  Les vingt-neuf libellés de formulaire n’étaient associés à
                   aucun champ.
  5.3  [EN LIGNE]  Dix-neuf combinaisons de couleurs sous le seuil de contraste.
  5.4  [EN LIGNE]  L’anneau de focus prenait la couleur du texte, donc blanc et
                   invisible sur les boutons clairs.
  5.5  [EN LIGNE]  Aucun repère principal dans le document.
  5.6  [ÉCARTÉ]    Les glyphes décoratifs vocalisés par les lecteurs d’écran.
                   Les masquer en bloc retirerait de l’information, la flèche
                   de « 7 → 8 villes » et les numéros portant du sens. Un tri
                   éditorial reste à faire, glyphe par glyphe.
  5.7  [EN LIGNE]  Le bouton du menu mobile n’était pas nommé.
  5.8  [EN LIGNE]  La visionneuse photo n’était pas déclarée comme fenêtre
                   modale. Elle emploie l’élément natif prévu pour cela.
  5.9  [EN LIGNE]  Aucune prise en compte de la réduction des animations.
  5.10 [ÉCARTÉ]    Les éléments sous le plancher typographique. Relever le
                   plancher modifie la mise en page, c’est donc une décision de
                   même nature que celle prise sur les contrastes.

PERFORMANCE                                                        3 sur 5
------------------------------------------------------------------------------
  6.1  [EN LIGNE]  6,9 Mo transférés par affichage. Une visite de la page
                   d’accueil coûte désormais 101 Ko en retour et environ 200 Ko
                   en première venue. Parcourir toute la galerie passe de
                   4,07 Mo à 1,90 Mo, les vignettes étant servies en 440 px et
                   la photo pleine taille réservée à la visionneuse.
  6.2  [EN LIGNE]  Aucune image ne déclarait ses dimensions. Les attributs
                   restent absents, mais le décalage de mise en page mesuré est
                   nul, la feuille de style fixant les hauteurs. Risque
                   théorique, sans effet constaté.
  6.3  [EN LIGNE]  La police était chargée depuis Google par un import en
                   cascade, ce qui transmettait l’adresse des visiteurs à un
                   tiers. Elle est servie depuis le site.
  6.4  [DÉVELOPPT] Aucune mesure d’audience ni de conversion. Voir chapitre 6.
  6.5  [PERDU]     Aucun point de référence relevé avant travaux. Voir la
                   réserve R4 au chapitre 9.

CONFORMITÉ                                                         6 sur 9
------------------------------------------------------------------------------
  7.1  [DÉCISION]  Trois témoignages sans attribution vérifiable. Le point le
                   plus exposé du dossier, voir chapitre 6.
  7.2  [DÉCISION]  La CVthèque annoncée incluse, et facturée quatre cents euros.
  7.3  [EN LIGNE]  Trois notes de travail internes étaient publiées sur les
                   mentions légales, dont « à faire valider par un
                   professionnel du droit », sur la page même censée établir la
                   fiabilité de l’éditeur.
  7.4  [EN LIGNE]  Six articles annoncés avec un temps de lecture, dont aucun
                   n’existait. Section retirée jusqu’à leur rédaction.
  7.5  [EN LIGNE]  La politique de confidentialité ne mentionnait pas le
                   transfert vers Google. Le transfert lui-même a disparu.
  7.6  [EN LIGNE]  Une console de gestion était accessible publiquement, sans
                   authentification. Elle est sortie de la publication. La
                   conséquence sur le circuit de mise à jour de l’actualité est
                   traitée au chapitre 6.
  7.7  [EN LIGNE]  Un formulaire d’inscription inactif dormait dans le code.
  7.8  [HUMAIN]    Reste l’avis du conseil juridique sur l’assujettissement au
                   RGAA et sur le droit à l’image des photographies.
  7.9  [EN LIGNE]  La mention de consentement du formulaire était incomplète.

COHÉRENCE DES CHIFFRES                                             2 sur 6
------------------------------------------------------------------------------
  8.1  [DÉCISION]  D’où vient la valeur de fréquentation affichée pour Reims.
  8.2  [EN LIGNE]  L’ancienneté et le nombre d’éditions se contredisaient.
  8.3  [DÉCISION]  Le périmètre de chacun des volumes annoncés.
  8.4  [EN LIGNE]  Les affirmations de performance sont sourcées ou retirées.
  8.5  [DÉCISION]  Quelle année tarifaire s’applique dans le simulateur.
  8.6  [DÉCISION]  Le calendrier de la Semaine, Toulouse en juin ou en
                   septembre, diverge de la note interne.

PARCOURS ET CONVERSION                                             3 sur 6
------------------------------------------------------------------------------
  9.1  [EN LIGNE]  Le candidat qui cliquait atterrissait sur un site qui ne
                   parlait pas du Village.
  9.2  [DÉVELOPPT] Un seul formulaire de quatre champs pour quatre publics.
  9.3  [EN LIGNE]  Aucun numéro de téléphone commercial.
  9.4  [EN LIGNE]  Les horaires manquaient sur les sept fiches de ville.
  9.5  [DÉCISION]  Le Village et la Semaine sont perçus comme deux événements
                   distincts.
  9.6  [DÉCISION]  Afficher une bande de logos d’exposants, avec leur accord.

---

# 6. CE QU’IL RESTE À FAIRE

Classé par décideur, puisque presque rien ne dépend plus de la technique.

A. DEUX DÉCISIONS QUI ENGAGENT L’ENTREPRISE                         URGENT
------------------------------------------------------------------------------

  A1  L’origine des trois témoignages                          POINT 7.1
      Les trois avis étoilés de la page d’accueil sont signés d’initiales et
      de rôles génériques, sans nom complet, sans entreprise, sans édition de
      rattachement.

      S’ils sont réels, il faut au minimum un prénom et l’édition concernée
      pour qu’ils soient crédibles. S’ils sont illustratifs, il faut l’écrire.
      Présenter des avis fabriqués comme authentiques relève de la pratique
      commerciale trompeuse au sens du Code de la consommation.

      C’est le seul point du dossier qui expose à autre chose qu’une perte
      d’audience. Appréciation indicative, à faire confirmer par le conseil.

      Décide : direction.  Effet : retrait ou sourçage, une heure.

  A2  La CVthèque est-elle dans le socle ou dans l’option        POINT 7.2
      La page Recruteurs annonce « stand privatif à partir de 990 € HT,
      CVthèque incluse ». Le simulateur facture l’accès intégral à la CVthèque
      400 € dans le pack digital, et le socle à 990 € n’en fait pas mention.

      Un exposant qui réserve d’après la première page et reçoit un devis
      conforme à la seconde disposera d’un motif de contestation.

      Décide : direction commerciale.  Effet : aligner deux pages, une heure.

B. UNE RÉUNION D’UNE HEURE DÉBLOQUE SIX POINTS                     POINT 8
------------------------------------------------------------------------------
  Avec la production et la direction commerciale. Aucune ne demande de
  développement, seulement une source qui fait foi.

  B1  8.1  D’où vient la valeur de fréquentation affichée pour Reims. Elle ne
           correspond ni au résultat constaté en 2025, ni à l’objectif de la
           plaquette.
  B2  8.3  Quel périmètre pour chacun des volumes annoncés. Le site affiche
           « 250+ entreprises », « 400+ entreprises en 2026 » et « 3 200+
           entreprises accueillies » à quelques écrans d’intervalle, sans dire
           lequel couvre quoi.
  B3  8.5  Quelle année tarifaire s’applique dans le simulateur, intitulé
           « tarifs prévente 2027 » alors que son sélecteur ouvre sur 2026.
  B4  8.6  Le calendrier de la Semaine des Recruteurs à Toulouse. Le site est
           cohérent en interne, chaque session tombant sept à huit jours après
           son Village. La note interne place Toulouse en juin. À trancher.
  B5  9.5  Comment clarifier que le Village et la Semaine ne sont pas deux
           événements distincts.
  B6  9.6  Peut-on afficher une bande de logos d’exposants, et avec quel
           accord de leur part.

C. RÉFÉRENCEMENT : TROIS ACTIONS DANS LA SEARCH CONSOLE              URGENT
------------------------------------------------------------------------------
  Le site est passé d’une adresse indexable à vingt-trois. Google finira par
  le découvrir seul, le fichier robots.txt déclarant le plan de site, mais une
  soumission explicite accélère de plusieurs semaines.

  C1  Soumettre le nouveau plan de site
      Search Console, propriété levillagedesrecruteurs.fr, section Sitemaps,
      saisir « sitemap.xml », envoyer. La ligne cochée « Google Search Console
      + sitemap » de la checklist du 23 août portait sur l’ancien plan de site,
      qui ne déclarait qu’une seule adresse : elle n’est plus à jour.

      Vérifié le 26 août : le fichier est valide, il déclare vingt-trois
      adresses, et les vingt-trois répondent correctement.

  C2  Demander l’indexation de deux ou trois pages neuves
      Toujours dans la Search Console, outil d’inspection de l’URL. Deux
      exemples utiles : la fiche de Lyon et la page Candidats. Cela amorce la
      découverte des vingt autres.

  C3  Purger les anciens plans de site en erreur
      Une douzaine de plans de site hérités d’Odoo restaient déclarés. À
      supprimer s’ils réapparaissent.

  Ces trois actions se font à la souris, en une dizaine de minutes, et
  personne d’autre que le propriétaire de la propriété Search Console ne peut
  les faire.

  À NOTER, ET C’EST IRRATTRAPABLE                                  POINT 6.5
      Le relevé des repères d’avant travaux n’a pas été fait : nombre
      d’adresses indexées, nombre d’adresses en erreur, impressions et clics
      par requête. L’effet du chantier sera donc plus difficile à démontrer
      chiffres en main. Le mal est limité, la position acquise par les
      anciennes adresses ayant déjà été perdue le 24 août, mais le point de
      comparaison propre n’existe plus.

D. VISIBILITÉ DANS LES ASSISTANTS D’INTELLIGENCE ARTIFICIELLE
------------------------------------------------------------------------------
  D1  Lever un blocage qui n’a jamais été choisi
      Le fichier robots.txt servi n’est pas seulement le vôtre : Cloudflare y
      injecte un bloc qui interdit l’accès aux robots d’OpenAI, d’Anthropic,
      de Perplexity, de Meta et de Common Crawl, ainsi qu’à Google-Extended.

      Conséquence : vos contenus sont exclus des réponses des assistants. Ce
      réglage est actif par défaut, personne ne l’a décidé.

      Vérifié le 26 août : le blocage n’est qu’une déclaration, les robots
      reçoivent bien une réponse normale au niveau du réseau. Un seul
      interrupteur suffit donc à lever la restriction, dans Cloudflare,
      Security Settings, filtre Bot traffic, « Set your preference to block
      training in robots.txt ».

      Google-Extended ne concerne que l’entraînement de Gemini, jamais
      l’indexation dans la recherche : le référencement classique n’est pas en
      cause.

  D2  Une piste écartée pour l’instant, mais consignée
      Les sept fiches de ville répondent parfaitement à un candidat, et pas du
      tout à un recruteur. Celle de Lyon annonce la date, l’horaire, le lieu et
      la gratuité, mais ne contient aucune mention de stand, de tarif ni
      d’exposant.

      Un recruteur qui demande à un assistant où exposer dans sa ville tombe
      donc sur une page qui ne porte pas la réponse. Y ajouter un bloc exposant
      et rendre l’offre lisible par une machine reste possible, une demi-journée.

      Réserve honnête : personne ne peut garantir d’être recommandé par un
      assistant. Ce qui pèse le plus lourd n’est pas sur le site, c’est ce que
      des sources tierces disent de vous, presse locale, pages de métropoles
      partenaires, annuaires d’événements. La ligne « prévenir partenaires et
      exposants » est, de ce point de vue, le meilleur travail de visibilité
      possible.

E. LE CIRCUIT DE MISE À JOUR DE L’ACTUALITÉ                     À NOMMER
------------------------------------------------------------------------------
  La console de gestion des liens et de l’actualité était accessible
  publiquement, sans mot de passe. Elle est sortie de la publication, ce qui
  ferme le défaut mais casse un circuit de travail.

  Deux réponses possibles, et une troisième qui est la vraie.

    Utiliser la console en local, depuis le dépôt. Rien à installer, rien à
    exposer. C’est ce que je recommande à court terme.

    La remettre en ligne derrière une authentification Cloudflare Access. Une
    application et une règle sur les adresses de l’entreprise.

    Mais ce serait un pansement, et il vaut mieux le dire. La console ne fait
    que produire un fichier de données à copier : il faut ensuite le déposer
    dans le dépôt et publier. Or quelqu’un qui peut publier peut aussi ouvrir
    un fichier local. Protéger le formulaire ne rend donc pas la personne
    autonome.

    Le vrai besoin, si une personne non technique doit tenir l’actualité à
    jour, n’est pas un formulaire protégé : c’est que les données d’actualité
    soient modifiables sans passer par une publication technique. C’est un
    chantier plus grand, de l’ordre de quelques jours, et il vaut mieux le
    nommer que le contourner.

  Décide : direction, sur le principe. Puis chiffrage.

F. DEUX DÉVELOPPEMENTS, APRÈS UN CHOIX PRÉALABLE
------------------------------------------------------------------------------
  F1  6.4  Mesure d’audience. Une demi-journée, une fois l’outil choisi.
           Matomo, Plausible ou l’outil de Cloudflare évitent le bandeau de
           consentement, ce qui garde la politique de confidentialité exacte.
           L’endroit où la mesure a le plus de valeur commerciale est le
           simulateur de coût : il révèle le budget qu’un prospect envisage
           avant tout contact.
  F2  9.2  Formulaire exposant distinct par public. Une journée, mais il faut
           savoir vers quel point de collecte l’envoyer.

G. MESSAGERIE DU DOMAINE
------------------------------------------------------------------------------
  G1  Aucun enregistrement DMARC n’existe sur levillagedesrecruteurs.fr, ce
      qui laisse la porte ouverte à l’usurpation d’adresses du domaine. Le
      domaine job.events en possède un, en politique de rejet, mais sans
      adresse de rapport : personne ne voit donc les échecs.

      Recommandation : commencer en politique d’observation avec une adresse
      de rapport, deux semaines, puis durcir. Passer directement au rejet sur
      un domaine dont on ne connaît pas tous les émetteurs revient à faire
      disparaître des courriels sans s’en apercevoir.

  G2  Aucun enregistrement DKIM n’existe non plus. La signature s’active dans
      Microsoft 365 et demande deux enregistrements. Sans elle, la protection
      repose sur le seul SPF, qui échoue dès qu’un message est transféré.

H. FINITIONS ET MÉNAGE DE LA BASCULE
------------------------------------------------------------------------------
  H1  Deux domaines de vanité ne répondent toujours pas en HTTPS, jobevents.fr
      et jobevents.eu, avec et sans « www ». Seul job.events fonctionne dans
      les deux protocoles. La note du 23 août annonçait un certificat OVH
      « sous 24 h » : trois jours plus tard, il n’est pas émis. À relancer.

  H2  Supprimer les deux copies de comparaison devenues inutiles, le projet
      Vercel et le projet Pages en envoi direct. À faire après quelques jours
      de stabilité, pas avant.

  H3  Désactiver GitHub Pages et retirer le fichier CNAME du dépôt, pour ne
      pas laisser deux sources servir le même contenu. Même délai : c’est
      aujourd’hui le retour arrière.

  H4  Le dépôt s’appelle encore « village-vitrine », alors que le projet est
      « Village des Recruteurs » et que le projet d’hébergement porte déjà le
      bon nom. Renommer le dépôt est possible et GitHub conserve les
      redirections, mais la connexion à l’hébergeur devra être refaite. À
      décider, sans urgence.

  H5  Tester le rendu sur Safari, Firefox et Edge. Les vérifications ont été
      faites sur un seul navigateur, à 1 280 et 375 pixels.

  H6  Tester l’aperçu de partage sur LinkedIn et Facebook. Les balises et
      l’image de partage sont en place et répondent, mais les outils de
      débogage n’ont pas été passés, et ils doivent l’être puisque les
      adresses ont changé.

  H7  Revalider la conformité RGPD des formulaires, côté Odoo.

  H8  Intégrer les vraies photographies de l’équipe.

  H9  Aligner les couleurs et les messages de Matching Square sur la charte.
      En cours côté plateforme.

I. LANCEMENT ET SUITE
------------------------------------------------------------------------------
  I1  Programmer les publications sur les réseaux. Les textes sont rédigés.
  I2  Prévenir les partenaires et les exposants par un courriel dédié. À
      cadrer avant envoi, aucun envoi de masse sans accord explicite.
  I3  Surveiller l’indexation dans la Search Console, plus important que
      d’habitude puisque vingt-trois adresses et trente-deux redirections
      viennent d’apparaître.
  I4  Confirmer les dates et les lieux de la saison 2027, attendus fin
      septembre 2026.

---

# 7. L’INFRASTRUCTURE

## La zone DNS, relevée le 26 août 2026

| Type | Nom | Valeur | Proxy |
|---|---|---|---|
| A | `levillagedesrecruteurs.fr` | `51.77.236.197` | oui |
| CNAME | `*.levillagedesrecruteurs.fr` | `prod.matchingsquare.com` | oui |
| CNAME | `www.levillagedesrecruteurs.fr` | le projet Cloudflare Pages | oui |
| MX | `levillagedesrecruteurs.fr` | `levillagedesrecruteurs-fr.mail.protection.outlook.com` | non |
| TXT | `levillagedesrecruteurs.fr` | `google-site-verification=...` | non |
| TXT | `levillagedesrecruteurs.fr` | `v=spf1 include:spf.protection.outlook.com -all` | non |
| TXT | `levillagedesrecruteurs.fr` | `MS=ms72498659` | non |

**L’enregistrement joker.** Le `CNAME *` renvoie vers Matching Square : c’est
lui qui fait fonctionner les sous-domaines de ville, `toulouse.`, `dijon.`,
`orleans.` et `lyon.`, vers lesquels pointent les boutons d’inscription
candidat. Y toucher casse les inscriptions. L’enregistrement `www` étant
explicite, il reste prioritaire sur le joker.

**L’apex** pointe encore vers le serveur Odoo, la même adresse que
`jobevents.odoo.com`. Ce qui produit la redirection vers `www` n’est pas cet
enregistrement mais une règle de zone, expression
`(http.host eq "levillagedesrecruteurs.fr")`, 301, active, indépendante de
l’hébergeur. Si elle était désactivée, l’apex servirait le site Odoo. Ménage à
prévoir, hors périmètre.

**La messagerie** ne dépend pas de l’hébergement du site. Le `MX` et le SPF ont
été vérifiés intacts après bascule, mais aucun envoi réel n’a été testé.

## Les domaines de vanité

`job.events` redirige correctement, en HTTP comme en HTTPS. En revanche
`jobevents.fr` et `jobevents.eu`, avec et sans `www`, **échouent toujours en
HTTPS** : seul l’HTTP fonctionne. Le certificat OVH était annoncé « sous 24 h »
le 23 août ; il n’était toujours pas émis le 26. À relancer.

## Les formulaires, côté Odoo

Le site ne collecte rien lui-même : il redirige vers Odoo, qui crée une
opportunité CRM et notifie l’équipe.

| Formulaire | Adresse Odoo | Notification |
|---|---|---|
| Contact candidat | `/contact-candidat` | `communication@job.events` |
| Demande exposant | `/demande-exposant` | `demandes@job.events` |
| Inscription candidat | `/inscription-candidat` | liste de diffusion de la ville |

Les notifications sont produites par deux automatisations sur `crm.lead`, l’une
filtrée sur les fiches dont le nom commence par « Contact candidat », l’autre
sur la source `vitrine` en excluant ces mêmes fiches.

Cette exclusion a été ajoutée le 26 août : les deux formulaires du site portant
le même `utm_source`, un message de candidat déclenchait aussi la notification
destinée aux demandes exposant, d’où deux courriels pour un seul message. La
mise en page de la notification candidat a été refaite à cette occasion, et
l’expéditeur ramené au domaine de l’entreprise, l’ancienne version usurpant
l’adresse du candidat, ce qui échoue aux contrôles SPF et DMARC.

L’ancien code est sauvegardé dans
`sauvegarde_odoo_contact_candidat_26aout.txt`, remis avec ce document.

---

# 8. RETOUR ARRIÈRE

La branche `main` contient encore l’ancienne version en une seule page, et
GitHub Pages reste actif. Repointer l’enregistrement `CNAME www` vers
`job-events.github.io` fait resservir cette version.

Ce filet est le seul qui existe. Il doit être conservé quelques semaines, puis
retiré une fois la stabilité acquise : supprimer `main`, désactiver GitHub
Pages, retirer le fichier `CNAME` du dépôt.

Pour un simple retour à un déploiement antérieur, sans toucher au DNS, le
projet Cloudflare propose la promotion d’un déploiement précédent, onglet
Deployments.

---

# 9. RÉSERVES À CONNAÎTRE

  R1  La messagerie ne dépend pas de l’hébergement du site. L’enregistrement
      MX et le SPF ont été vérifiés intacts après bascule, mais aucun envoi
      réel n’a été testé. À faire.

  R2  Le CNAME joker de la zone renvoie vers Matching Square : c’est lui qui
      fait fonctionner les sous-domaines de ville, vers lesquels pointent les
      boutons d’inscription candidat. Y toucher casserait les inscriptions.
      Les quatre sous-domaines ont été vérifiés après bascule.

  R3  L’apex du domaine pointe encore vers le serveur Odoo. Ce qui produit la
      redirection vers le « www » est une règle de zone, indépendante de
      l’hébergeur. Si elle était désactivée, l’apex servirait le site Odoo.
      Ménage à prévoir, hors périmètre.

  R4  Le point de comparaison d’avant travaux est perdu, voir POINT 6.5.

  R5  Le jeton d’administration Cloudflare utilisé pendant la bascule a été
      révoqué le 26 août. Le fichier qui le contenait renferme aussi des clés
      de stockage R2 toujours valides : à supprimer.

---

# 10. HISTORIQUE ET MÉTHODE

## Ce qui s’est passé

Le site tournait sur GitHub Pages en une page unique de 6,9 Mo, mise en ligne
le 24 août 2026, qui portait les 61 défauts de l’audit. Il a été découpé en 23
pages, allégé, corrigé, puis migré vers Cloudflare Pages le 26 août, pour
disposer des redirections permanentes des dix-sept anciennes adresses que
GitHub Pages ne permet pas.

Deux copies de comparaison ont existé pendant l’arbitrage d’hébergeur, sur
Vercel et sur Cloudflare en envoi direct. Les deux ont été supprimées le
26 août, ainsi que la configuration Vercel du dépôt, que l’historique Git
conserve si elle devait resservir.

Le choix de Cloudflare plutôt que Vercel tient à deux raisons : son offre
gratuite autorise l’usage commercial, là où l’offre Hobby de Vercel l’exclut et
où l’offre Pro coûte 20 $ par mois et par utilisateur ; et la zone DNS y était
déjà, ce qui a supprimé l’édition manuelle du CNAME.

## Comment les chiffres de ce document ont été obtenus

Poids et temps de réponse relevés par les interfaces de mesure du navigateur
sur le site en service. Contrastes calculés selon la formule de luminance
relative de la norme WCAG 2.1, sur les couleurs résolues par le navigateur, les
blocs posés sur un dégradé étant écartés après vérification. Adresses,
redirections et actifs testés un par un. Enregistrements de messagerie
interrogés directement. Comparaison des 470 fichiers entre le site en service
et une construction neuve. Parcours au clavier par tabulation réelle. Rendu
contrôlé à 1 280 et 375 pixels.

Les appréciations juridiques sont indicatives et ne remplacent pas l’avis d’un
conseil.

## Ce que ce document ne remplace pas

Tout ce qui a été appris de ce projet au fil des sessions vivait dans la
mémoire d’un assistant, sur un poste de travail, et ne suit pas. Ce document
est ce qui traverse. S’il manque quelque chose, il vaut mieux l’y ajouter que
de compter sur une mémoire qui n’existera plus.
