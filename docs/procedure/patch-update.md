# Procédure — note de patch → checklist de maj

Outerpedia = base de données **permanente**. À chaque maj, partir de la note de patch (entrée dans `data/patch-notes/posts.json`) et produire une checklist où **chaque ligne mappe vers une action concrète**, format : `**<nom site>** — <type> => <action>`.

Une checklist par patch, datée, dans `docs/checklists/<date-maj>.md` (ex. `docs/checklists/2026-06-02.md`).

## Règles d'écriture

1. **Nom du site, pas le nom EN de la note.** Toujours mapper :
   - `Sanzang Ame` → `Mystic Sage Ame`
   - `World Transformation Deterrence` → `[Prevent World Alteration]`
   - `Kitsune of Eternity Tamamo-no-Mae` → `E.Tamamo-no-Mae`

   Vérifier le nom via les données du site, ne pas inventer.
2. **Une ligne = une action**, pas une description de ce qui change.
3. **Une seule action par ligne** → un nouveau perso / Core Fusion en génère plusieurs.

## Mapping type → action (pertinent)

| Type dans la note | Action |
|---|---|
| Balance perso (skills / EE / transcendance) | `=> admin extract char & ee` |
| Correction de texte seule (mécanique inchangée) | `=> admin extract char` |
| Nouveau perso | `=> admin extract char & ee` + `=> gear reco` |
| Core Fusion | `=> admin extract char & ee` + `=> gear reco` + `=> update general-guides\core-fusion & core_fusion_data.json` |
| Nouvelle bannière rate-up | `· banner.json` (ajout manuel : id, name, start, end) |
| Nouvelle saison Guild Raid | `=> update guild-raid\<slug>` (voir recette ci-dessous) |

## Ignorer (aucune ligne)

Events à durée limitée (donjons, login, missions, bingo, coin exchange) · boutique / packs / prix · beta (ex. RTA) · bugfix / QoL UI · note de patch (`posts.json`, import auto) · changelog site (`changelog.json`, géré ailleurs).

## Recette — nouvelle saison Guild Raid

Le slug est réutilisé à chaque rotation (`src/app/[lang]/guides/_contents/guild-raid/<slug>/`). Preshootable en scaffold :

1. Dupliquer la dernière version : `versions/<MM-AAAA précédent>/` → `versions/<MM-AAAA nouveau>/`.
2. Dans le nouveau `config.json`, mettre à jour `label` (5 langues).
3. Wirer dans `index.tsx` : import du nouveau override + phase1/phase2, ajout de l'entrée `versions={{ ... }}`, et `defaultVersion` = nouvelle clé.
4. Ajouter la prop **`updating`** sur `<GuildRaidGuide>` (bandeau « en cours de maj »).
5. Bumper **`last_updated`** (date de la maj) dans `data/guides/_index.json`.
6. Post-maj : remplacer boss IDs + `phase1.json`/`phase2.json` par les vraies données, puis retirer `updating`.

## Notes

- Les données character / EE sont **multilingues et extraites du jeu** via l'outil admin (en/jp/kr/zh) — jamais saisies à la main depuis la note EN. La checklist sert juste à lister **quelles extractions/actions lancer** après la maj.
- Seul "preshot" possible avant maintenance = la ligne `banner.json`.
- **À trancher** : équipement permanent hors-perso (armes/accessoires de shops d'event, ex. ★6 Legendary Weapon) — pas inclus pour l'instant.
