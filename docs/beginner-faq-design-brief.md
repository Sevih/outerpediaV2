# Brief — Refonte visuelle & ergonomique du guide « Beginner FAQ » (Outerpedia V2)

## Fichier
`src/app/[lang]/guides/_contents/general-guides/beginner-faq/index.tsx`

FAQ débutant du jeu **Outerplane**, page longue (6 sections + grille de liens).
Mission : **améliorer la lisibilité, l'ergonomie et la hiérarchie visuelle.**
NE PAS toucher au contenu rédactionnel : on ne change ni les textes, ni les chiffres,
ni les `LangMap` existants. On réorganise et on restyle uniquement le JSX.

---

## OBJECTIF
La page est dense et inégale. On veut qu'un débutant trouve vite sa réponse et lise
confortablement sur desktop comme sur mobile.

## CE QUI NE VA PAS AUJOURD'HUI (à corriger côté présentation)
- **Aucune navigation interne** alors que la page est très longue.
  → ajouter un **sommaire ancré** (table of contents avec anchors), responsive :
    sticky/latéral sur desktop, repliable/compact sur mobile.
- **Sections de longueur très inégale** : « Getting Started » = 3 phrases vs « Gear » = 4 grosses
  cartes. → équilibrer visuellement (densité homogène, espacements cohérents entre sections).
- **Carte « Where do I go first? » orpheline** : c'est un `ContentCard` sans `GuideSectionHeading`,
  posé entre deux sections. → la rattacher proprement à une section ou lui donner un heading cohérent.
- **Langage visuel incohérent** : mélange de `ContentCard`, `Callout` (note/warning/tip/info) et de
  `<div>` colorés bruts (`bg-purple-900/20`, `bg-amber-900/20`, etc. écrits à la main).
  → harmoniser : un motif visuel cohérent et réutilisable pour les blocs « question → réponse »
    et pour les encarts (priorités boss, tableaux de ticks, listes ordonnées).
- **Repérage des sections** : chaque section a une couleur (`GuideSectionHeading color=` sky/purple/
  amber/green/rose). → exploiter ce code couleur de façon cohérente (titres, anchors, accents)
  pour aider le scan visuel, sans surcharger.
- **Lisibilité des blocs denses** : la section Gear (« gear worth keeping », tableau 6★ Legendary/
  Epic/Superior, règles de reforge) est lourde. → améliorer la mise en forme (espacement, tableaux,
  séparation visuelle) sans retoucher le texte.

## CE QU'IL FAUT ABSOLUMENT PRÉSERVER
- **Tout le contenu textuel** et **tous les `LangMap`** (en/jp/kr/zh/fr) à l'identique.
  Si tu déplaces une chaîne, tu la déplaces telle quelle. Pas d'ajout/suppression de texte.
- **Tous les `Link` internes** : premium-limited, free-heroes-start-banner, gear, heroes-growth,
  special-request, skyward-tower.
- Tous les composants inline déjà utilisés : `CharacterInline`, `EffectInline`, `SkillInline`,
  `InlineIcon`, `StarBadge`, `parseText(...)`, tags `{B/}`,`{S/}`,`{E/}`,`{I-I/}`,`{P/}`.
- La grille « Related Guides » de fin (4 liens).

## CONTRAINTES TECHNIQUES
- 5 langues i18n (en/jp/kr/zh/fr) — ne jamais casser une clé `LangMap`.
- Code/commentaires en anglais.
- Tailwind v4, classes canoniques (pas de `[Xpx]` si une classe d'échelle existe).
- **Responsive desktop + mobile** pensé dès le départ.
- Composants dispo (déjà importés) : `GuideTemplate`, `GuideSectionHeading`, `ContentCard`,
  `Callout`, + les inline ci-dessus. Réutiliser l'existant ; si tu introduis un sous-composant
  de présentation, garde-le local et purement visuel.
- NE PAS lancer `npm run build`.

## LIVRABLE
`index.tsx` réécrit côté présentation uniquement : nouvelle hiérarchie, sommaire ancré responsive,
langage visuel harmonisé — contenu et i18n strictement inchangés.
