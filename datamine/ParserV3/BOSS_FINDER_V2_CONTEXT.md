# Boss Finder V2 - Contexte de développement

## 📋 Résumé
Création d'un nouveau système de recherche de boss (BossFinderV2) avec une approche simplifiée et plus directe que la V1.

## 🎯 Objectif
Créer un système qui :
1. Cherche les boss par nom exact (pas de regroupement par ModelID comme la V1)
2. Récupère toutes les informations : stats, skills, location, dungeon, etc.
3. Gère intelligemment les différents types de spawn/dungeon

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers
- **`boss_finder_v2.py`** - Nouveau module avec la logique de recherche V2
- **`gui_qt.py`** - Ajout de l'onglet "Boss V2" (ligne 1778-1918 et 6557, 6567)

### Structure
```
datamine/ParserV3/
├── boss_finder.py          # Ancien système (V1) - CONSERVÉ
├── boss_finder_v2.py       # Nouveau système (V2) - CRÉÉ
└── gui_qt.py              # Interface avec onglet "Boss V2" - MODIFIÉ
```

## 🔍 Flow de recherche Boss Finder V2

### Étape 1 : Recherche du nom
**TextCharacter.bytes** → Cherche le nom du boss (ex: "Betrayed Deshret")
- Récupère l'`IDSymbol` (ex: `4004005_Name`)

### Étape 2 : Trouver les monstres
**MonsterTemplet.bytes** → Cherche les monstres avec:
- `NameIDSymbol` = IDSymbol OU
- `FirstMeetIDSymbol` = IDSymbol

Résultat : Liste de Monster IDs (ex: `4004005`, `4104005`, `62005208`)

### Étape 3 : Trouver les spawns
**DungeonSpawnTemplet.bytes** → Cherche dans:
- `Monster0-9` : IDs de monstres normaux
- `ID0-9` : IDs de boss (certains boss sont dans `ID3`)

Pour chaque spawn trouvé :
- Niveau : `GroupID` ou `Level0`
- Référence dungeon : Logique intelligente (voir ci-dessous)

### Étape 4 : Sélection intelligente de la référence dungeon

**Logique de priorité :**
```python
if HPLineCount exists:
    use ('HPLineCount', value)
else:
    # Cherche le plus bas ID valorisé (ID0 > ID1 > ID2)
    # ID3 est ignoré car c'est le boss lui-même
    for i in [0, 1, 2]:
        if IDi exists:
            use (f'ID{i}', value)
            break
```

**Exemples :**
- 2 IDs valorisés (ID3 + ID2) → utilise `ID2`
- 3 IDs valorisés (ID3 + ID2 + ID1) → utilise `ID1`
- 4 IDs valorisés (ID3 + ID2 + ID1 + ID0) → utilise `ID0`
- HPLineCount valorisé → utilise `HPLineCount`

### Étape 5 : Trouver le dungeon
**DungeonTemplet.bytes** → Match via plusieurs méthodes:

#### Mapping A : HPLineCount classique
- `HPLineCount0-9` du DungeonTemplet → Boss avec HPLineCount dans spawn

#### Mapping B : SpawnID_Pos → ID
- `SpawnID_Pos0` → correspond à `ID0` du spawn
- `SpawnID_Pos1` → correspond à `ID1` du spawn
- `SpawnID_Pos2` → correspond à `ID2` du spawn

#### Mapping C : HPLineCount → SpawnID_Pos (cas spécial)
- Certains boss (ex: Irregular Queen) ont un HPLineCount qui est en fait un SpawnID
- Le système mappe aussi `SpawnID_Pos0-2` comme s'ils étaient des HPLineCount

## 🐛 Bugs corrigés

### Bug 1 : Betrayed Deshret - Location vide (RÉSOLU)
**Problème :** La V1 du boss_finder retournait une location vide `{}` pour les boss sans dungeon, ce qui crashait l'interface.

**Solution :** Dans `boss_finder.py` (lignes 1478-1484) :
```python
else:
    # No dungeon info - provide empty multilingual values
    location_info = {
        'dungeon': {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''},
        'mode': {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''},
        'area_id': ''
    }
```

### Bug 2 : Niveaux à 0 pour Betrayed Deshret (RÉSOLU)
**Problème :** Les spawns n'étaient pas trouvés car le boss était dans `ID3` au lieu de `Monster0-9`.

**Solution :** Chercher dans `ID0-9` en plus de `Monster0-9` (lignes 230-241 de boss_finder_v2.py)

### Bug 3 : Dungeon non trouvé pour Betrayed Deshret (RÉSOLU)
**Problème :** Le système utilisait seulement `ID0` pour chercher le dungeon.

**Solution :** Implémentation de la logique intelligente qui utilise le plus bas ID valorisé (ID0 > ID1 > ID2)

### Bug 4 : Irregular Queen - Dungeon non trouvé (RÉSOLU)
**Problème :** Le HPLineCount d'Irregular Queen était en fait un SpawnID.

**Solution :** Double mapping des `SpawnID_Pos` comme HPLineCount (lignes 282-287 de boss_finder_v2.py)

## 📊 Données récupérées actuellement

### Données Monster (MonsterTemplet)
- **Stats** : HP, ATK, DEF, Speed, Accuracy, Avoid, Critical Rate/DMG
- **Class & Element** : CCT_ATTACKER → "Striker", CET_EARTH → "Earth"
- **Skills** : Skill_1 à Skill_22 (IDs - 131567, 131568, etc.)
- **Immunités** : BuffImmune, StatBuffImmune
- **Type** : Boss/Monster, Race (Human/Beast/etc)
- **Icône** : FaceIconID, ModelID

### Données Dungeon (DungeonTemplet)
- **Location** : AreaID (42), SeasonFullName, DungeonMode
- **Niveau** : RecommandLevel (129), RecommendBattlePower (85140)
- **Récompenses** : RewardID, SweepRewardID, FarmingTargetItemID
- **Restrictions** : LimitCount, RequireTicket, RequireValue
- **Spawns du stage** : SpawnID_Pos0/1/2 (les 3 vagues de combat)
- **Avantages** : SpawnAdvantageRate_HP/Def/Spd

### Données Spawn (DungeonSpawnTemplet)
- **Niveau** : GroupID ou Level0
- **Spawn ID** : ID du spawn
- **Dungeon Ref** : Tuple (type, value) pour le matching

## 🧪 Tests effectués

### ✅ Betrayed Deshret
```
3 résultats trouvés :
- Level 129 : Dungeon 130212, Area 42
- Level 150 : Dungeon 131210, Area 44
- Level 170 : Infinite Dungeon Earth 90

Tous avec location correcte !
```

### ✅ Irregular Queen
```
9 résultats (certains sans spawn) :
- Level 100 : DM_IRREGULAR_CHASE
- Level 115 : DM_IRREGULAR_CHASE
- Level 120 : HPLineCount trouvé mais dungeon spécial

Gestion des HPLineCount = SpawnID fonctionnelle !
```

## 🔧 Points techniques importants

### Différence V1 vs V2
**V1 (boss_finder.py)** :
- Regroupe tous les boss par ModelID
- "Betrayed Deshret" retourne 8 résultats (5 Typhoon Summoning Traitor + 3 Betrayed Deshret)
- Plus complexe, utilise ModelID pour grouper

**V2 (boss_finder_v2.py)** :
- Match exact sur le nom
- "Betrayed Deshret" retourne 3 résultats (seulement Betrayed Deshret)
- Plus simple et direct

### Gestion des cas limites
1. **Boss sans spawn** : Retourne quand même le monster avec level=0
2. **Boss sans dungeon** : Retourne avec dungeon={}
3. **Plusieurs dungeons par spawn** : Crée un résultat par dungeon
4. **HPLineCount vide** : Utilise ID0/ID1/ID2 automatiquement

## 📝 TODO (pour demain)

### Traductions
- [ ] Traduire `SeasonFullName` (ex: "SYS_DUNGEON_NAME_130212" → vrai nom)
- [ ] Traduire `AreaID` (ex: 42 → nom de la zone)
- [ ] Traduire les skills (IDs → noms et descriptions)

### Format JSON
- [ ] Implémenter `format_results_json()` complète
- [ ] Support multilingue (en, kr, jp, zh)
- [ ] Export vers fichiers JSON du site

### Améliorations possibles
- [ ] Ajouter détails des récompenses (RewardID → items)
- [ ] Ajouter détails des skills complets
- [ ] Gérer les World Boss spéciaux
- [ ] Ajouter filtres (par mode, par zone, etc.)

## 💡 Commandes utiles pour reprendre

### Test rapide
```python
from boss_finder_v2 import BossFinderV2
bf = BossFinderV2('../extracted_astudio/assets/editor/resources/templetbinary')
results = bf.search_boss_by_name('Betrayed Deshret')
```

### Lancer l'interface
```bash
cd datamine/ParserV3
python gui_qt.py
# Aller dans l'onglet "Boss V2"
```

### Vérifier les données
```python
# Voir toutes les données d'un boss
result = results[0]
print(result['monster'])  # Données MonsterTemplet
print(result['dungeon'])  # Données DungeonTemplet
print(result['spawn_level'])  # Niveau
```

## 🎓 Apprentissages clés

1. **Structure des données** : Les boss peuvent être dans `Monster0-9` OU `ID0-9`
2. **Mapping intelligent** : Il faut tester plusieurs stratégies de mapping (HPLineCount, ID0-2, SpawnID_Pos)
3. **HPLineCount != toujours HPLineCount** : Parfois c'est un SpawnID déguisé
4. **ID3 = Boss lui-même** : Ne jamais utiliser ID3 comme référence dungeon
5. **Décalage des IDs** : Le nombre d'IDs valorisés indique quel ID utiliser pour le dungeon

## 📞 Contact / Questions
Si quelque chose n'est pas clair demain, référence ce fichier et les fichiers suivants :
- `boss_finder_v2.py` (lignes 180-289 pour la logique de spawn/dungeon)
- `gui_qt.py` (lignes 1778-1918 pour l'interface)
