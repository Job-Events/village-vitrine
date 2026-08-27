# Comment le site est fabriqué et publié

## En une phrase

On modifie les fichiers de travail, on pousse sur `mise-en-production`, et
Cloudflare fabrique et publie le site tout seul.

## Les fichiers que l’on modifie

| Fichier | Contenu |
|---|---|
| `_source.html` | tout le contenu rédigé, les 17 sections du site |
| `app.js` | les données de la tournée, les photos, le fil des réseaux, le simulateur |
| `styles.css` | la charte graphique |
| `img/` | les images, et `img/thumb/` les vignettes de galerie |
| `build.py` | le script qui assemble les pages |

## Ce qui est publié

Le dossier `dist/`, produit par `build.py`. **Il n’est pas versionné** : c’est
Cloudflare qui le fabrique à chaque déploiement. Inutile donc de le construire
avant de pousser.

Réglages du projet Cloudflare Pages, à ne pas modifier :

    Branche de production      mise-en-production
    Commande de construction   python3 build.py
    Dossier de sortie          dist

## Publier une modification

    git pull
    # modifier _source.html, app.js, styles.css ou img/
    git add -A
    git commit -m "ce que j'ai change"
    git push

Le déploiement part automatiquement. Il dure moins d’une minute et n’installe
aucune dépendance : `build.py` n’utilise que la bibliothèque standard de Python.

## Vérifier avant de pousser, si on veut

    python3 build.py

La commande recrée `dist/` en local et affiche le bilan, 23 pages et les
actifs recopiés. Cela permet de voir le résultat dans un navigateur en ouvrant
`dist/index.html`, mais ce n’est jamais obligatoire.

## Remplacer une image

Déposer le nouveau fichier dans `img/` sous le même nom, puis pousser. La
nouvelle version apparaît en ligne sous 24 heures au plus tard, sans rien
faire de plus.

Pour qu’elle soit visible immédiatement, deux possibilités :

- purger le cache dans le projet Cloudflare, section Caching, soit une adresse
  précise soit tout le cache ;
- ou déposer le fichier sous un **nouveau nom** et mettre la référence à jour
  dans `app.js`. C’est la méthode la plus sûre.

Pourquoi cette précaution : les images sont servies avec un cache d’un jour,
puis la version périmée continue d’être servie pendant que la nouvelle est
récupérée en arrière-plan. Le visiteur n’attend donc jamais, et un remplacement
se propage tout seul.

Le 26 août 2026, deux logos redimensionnés sont restés invisibles en ligne
plusieurs heures : le cache était alors réglé sur un an en « immutable », ce qui
convient aux polices et aux fichiers versionnés, jamais à un fichier
remplaçable à chemin constant.

## Ce qui n’est jamais publié

`_source.html`, `app.js` à la racine, `build.py`, `gestion.html`, les runbooks
et les fichiers de configuration restent dans le dépôt sans être servis. Seul
le contenu de `dist/` part en ligne, et `build.py` n’y recopie que les actifs
déclarés dans sa liste `ACTIFS`.

C’est la raison de ce découpage : la console de gestion interne avait été
accessible publiquement, sans mot de passe, jusqu’au 26 août 2026.

## Si un déploiement échoue

Le site en ligne reste celui du déploiement précédent, rien n’est cassé. Les
journaux de construction sont dans le projet Cloudflare, onglet Deployments.

Cause la plus probable, si cela arrive à la première mise en service de ce
mécanisme : la version de Python de l’image de construction. Le script
fonctionne à partir de Python 3.6, sans dépendance. Au besoin, définir la
variable d’environnement `PYTHON_VERSION` dans les réglages du projet.

## Retour arrière

Reversionner `dist/` et revider la commande de construction rétablit le
fonctionnement précédent, où le dossier publié était commité à la main.

## Un piège désormais supprimé

Avant ce changement, `dist/` était versionné. Modifier `_source.html` puis
pousser ne changeait donc rien en ligne : il fallait penser à lancer
`build.py` et à commiter `dist/`. Le déploiement réussissait, et le site
restait identique. Ce piège n’existe plus.
