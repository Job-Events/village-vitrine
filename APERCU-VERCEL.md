# Aperçu Vercel, branche `apercu-vercel`

Cette branche existe pour un seul usage : déployer une **copie de comparaison**
du site sur Vercel, pendant que la version en service reste sur GitHub Pages.

## Pourquoi une branche séparée

`vercel.json` y déclare un en-tête `X-Robots-Tag: noindex, nofollow, noarchive`
sur toutes les adresses. Sans lui, la copie serait indexée par Google et
concurrencerait `www.levillagedesrecruteurs.fr` sur ses propres requêtes. C'est
exactement le défaut que l'audit du 12 août reprochait à la maquette.

Cet en-tête ne doit **jamais** partir en production. C'est la raison pour
laquelle il vit sur une branche distincte de `correction/liens-et-parcours`, et
non dans la branche des correctifs.

## Si la migration vers Vercel est décidée

1. Retirer le bloc `X-Robots-Tag` de `vercel.json`.
2. Y ajouter les redirections permanentes des anciennes adresses, voir le
   point 2.1 de l'audit.
3. Basculer le domaine, en vérifiant que l'enregistrement MX de
   `levillagedesrecruteurs.fr` reste sur Outlook.

## Ce que le déploiement ne change pas

Ni le domaine, ni les DNS, ni la messagerie, ni le site en service. La copie
vit sur une adresse `.vercel.app` distincte.
