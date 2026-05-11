"""
One-shot script to:
  1) Restore French accents in `fr:` values inside LangMap literals across guide files
  2) Replace gacha-sense `tirer/tirage` with `pull/pulls`
  3) Fix `banner` gender (feminine in French)

Only touches `fr: '...'` values inside LangMap literals. Never touches EN/JP/KR/ZH
values, keys, comments, or other code.

Usage: python scripts/reaccent-fr.py
"""
import re
import os
import sys

# Word-boundary replacements for accent-stripped → accented words.
# Keys must be the exact accent-stripped form; values the standard French spelling.
WORD_MAP = {
    # É-start (capitalized)
    'Heros': 'Héros', 'Hero': 'Héros',
    'Equipement': 'Équipement', 'Equipements': 'Équipements',
    'Element': 'Élément', 'Elements': 'Éléments',
    'Etape': 'Étape', 'Etapes': 'Étapes',
    'Evolution': 'Évolution',
    'Eveil': 'Éveil',
    'Etat': 'État', 'Etats': 'États',
    'Etoile': 'Étoile',
    'Energie': 'Énergie',
    'Echange': 'Échange',
    'Echec': 'Échec',
    'Ecole': 'École',
    'Ecart': 'Écart',
    'Ecran': 'Écran',
    'Economie': 'Économie',
    'Equipe': 'Équipe',
    'Eviter': 'Éviter',
    'Electrique': 'Électrique',
    'Ecrire': 'Écrire',
    'Eleve': 'Élevé',
    'Eveille': 'Éveillé',
    # é-start (lowercase)
    'equipement': 'équipement', 'equipements': 'équipements',
    'element': 'élément', 'elements': 'éléments',
    'elementaire': 'élémentaire', 'elementaires': 'élémentaires',
    'etape': 'étape', 'etapes': 'étapes',
    'evolution': 'évolution', 'evolutions': 'évolutions',
    'eveil': 'éveil',
    'etat': 'état', 'etats': 'états',
    'etoile': 'étoile', 'etoiles': 'étoiles',
    'energie': 'énergie',
    'echange': 'échange', 'echanger': 'échanger', 'echangez': 'échangez',
    'echec': 'échec', 'echecs': 'échecs',
    'ecole': 'école',
    'ecart': 'écart',
    'ecran': 'écran',
    'economie': 'économie',
    'equipe': 'équipe', 'equipes': 'équipes',
    'eviter': 'éviter', 'evitez': 'évitez', 'evite': 'évite',
    'electrique': 'électrique',
    'ecrire': 'écrire', 'ecrit': 'écrit',
    'eleve': 'élevé', 'eleves': 'élevés', 'elevee': 'élevée', 'elevees': 'élevées',
    'eveille': 'éveillé', 'eveiller': 'éveiller',
    # Words containing é
    'evenement': 'événement', 'evenements': 'événements',
    'experience': 'expérience', 'experiences': 'expériences',
    'reference': 'référence', 'references': 'références',
    'memoire': 'mémoire',
    'medaille': 'médaille', 'medailles': 'médailles',
    'methode': 'méthode', 'methodes': 'méthodes',
    'cle': 'clé', 'cles': 'clés',
    'creer': 'créer', 'cree': 'créé', 'crees': 'créés', 'creee': 'créée', 'creees': 'créées', 'creez': 'créez',
    'donnee': 'donnée', 'donnees': 'données',
    'heros': 'héros',
    'idee': 'idée', 'idees': 'idées',
    'periode': 'période', 'periodes': 'périodes',
    'generer': 'générer', 'genere': 'généré', 'generes': 'générés',
    'generalement': 'généralement',
    'general': 'général', 'generale': 'générale', 'generales': 'générales', 'generaux': 'généraux',
    'recompense': 'récompense', 'recompenses': 'récompenses',
    'recompenser': 'récompenser',
    'strategie': 'stratégie', 'strategies': 'stratégies',
    'strategique': 'stratégique', 'strategiques': 'stratégiques',
    'selection': 'sélection',
    'selectionner': 'sélectionner', 'selectionnez': 'sélectionnez',
    'selectionnee': 'sélectionnée', 'selectionne': 'sélectionné',
    'securite': 'sécurité',
    'securiser': 'sécuriser', 'securise': 'sécurisé', 'securisee': 'sécurisée',
    'verifier': 'vérifier', 'verifie': 'vérifié', 'verifiez': 'vérifiez',
    'considerer': 'considérer', 'considere': 'considéré', 'considerez': 'considérez',
    'specifique': 'spécifique', 'specifiques': 'spécifiques',
    'special': 'spécial', 'speciale': 'spéciale', 'speciaux': 'spéciaux', 'speciales': 'spéciales',
    'serie': 'série', 'series': 'séries',
    'separe': 'séparé', 'separer': 'séparer', 'separees': 'séparées', 'separee': 'séparée',
    'derniere': 'dernière', 'dernieres': 'dernières',
    'premiere': 'première', 'premieres': 'premières',
    'tres': 'très',
    'apres': 'après',
    'aupres': 'auprès',
    'pres': 'près',
    'progres': 'progrès',
    'succes': 'succès',
    'acces': 'accès',
    'exces': 'excès',
    'expres': 'exprès',
    'deja': 'déjà',
    'voila': 'voilà',
    'detail': 'détail', 'details': 'détails',
    'detaille': 'détaillé', 'detaillee': 'détaillée',
    'developpement': 'développement',
    'developper': 'développer', 'developpe': 'développé',
    'precis': 'précis', 'precise': 'précise', 'precisement': 'précisément',
    'present': 'présent', 'presente': 'présente', 'presenter': 'présenter',
    'presentent': 'présentent', 'presentes': 'présentés',
    'presence': 'présence',
    'utilise': 'utilisé', 'utilisee': 'utilisée',
    'utilisees': 'utilisées', 'utilises': 'utilisés',
    'realise': 'réalisé', 'realiser': 'réaliser', 'realisez': 'réalisez',
    'depend': 'dépend', 'dependent': 'dépendent', 'dependre': 'dépendre',
    'depense': 'dépense', 'depenser': 'dépenser', 'depensez': 'dépensez',
    'depart': 'départ',
    'demarrer': 'démarrer', 'demarre': 'démarré', 'demarrage': 'démarrage',
    'desactiver': 'désactiver', 'desactive': 'désactivé', 'desactivez': 'désactivez',
    'detruire': 'détruire', 'detruit': 'détruit',
    'definir': 'définir', 'defini': 'défini', 'definie': 'définie',
    'definition': 'définition',
    'decouvrir': 'découvrir', 'decouvre': 'découvre', 'decouvert': 'découvert',
    'debloquer': 'débloquer', 'debloque': 'débloqué', 'debloquee': 'débloquée',
    'debloquant': 'débloquant',
    'debut': 'début', 'debuter': 'débuter', 'debuts': 'débuts',
    'difficulte': 'difficulté', 'difficultes': 'difficultés',
    'desole': 'désolé', 'desolee': 'désolée',
    'desire': 'désiré', 'desirent': 'désirent', 'desirez': 'désirez',
    'desormais': 'désormais',
    'caracteristique': 'caractéristique', 'caracteristiques': 'caractéristiques',
    'qualite': 'qualité', 'qualites': 'qualités',
    'quantite': 'quantité', 'quantites': 'quantités',
    'unite': 'unité', 'unites': 'unités',
    'capacite': 'capacité', 'capacites': 'capacités',
    'opportunite': 'opportunité', 'opportunites': 'opportunités',
    'priorite': 'priorité', 'priorites': 'priorités',
    'specialite': 'spécialité', 'specialites': 'spécialités',
    'realite': 'réalité', 'realites': 'réalités',
    'liberte': 'liberté', 'libertes': 'libertés',
    'longevite': 'longévité',
    'efficacite': 'efficacité',
    'rarete': 'rareté', 'raretes': 'raretés',
    'identite': 'identité', 'identites': 'identités',
    'integrite': 'intégrité',
    'eternite': 'éternité',
    'extremement': 'extrêmement',
    'beneficie': 'bénéficie', 'beneficier': 'bénéficier',
    'beneficient': 'bénéficient', 'benefice': 'bénéfice', 'benefices': 'bénéfices',
    'integre': 'intégré', 'integrer': 'intégrer', 'integree': 'intégrée',
    'integration': 'intégration',
    'interesse': 'intéressé', 'interessent': 'intéressent',
    'interesser': 'intéresser', 'interessant': 'intéressant', 'interessante': 'intéressante',
    'interet': 'intérêt', 'interets': 'intérêts',
    'recommande': 'recommandé', 'recommandee': 'recommandée',
    'recommandes': 'recommandés', 'recommandees': 'recommandées',
    'personnalise': 'personnalisé', 'personnalisee': 'personnalisée',
    'differents': 'différents', 'differente': 'différente',
    'differentes': 'différentes', 'different': 'différent',
    'difference': 'différence', 'differences': 'différences',
    'rassemble': 'rassemblé', 'rassemblee': 'rassemblée',
    'remunere': 'rémunéré', 'remuneration': 'rémunération',
    'severite': 'sévérité', 'severe': 'sévère',
    'leger': 'léger', 'legere': 'légère', 'legers': 'légers', 'legeres': 'légères',
    'lie': 'lié', 'lies': 'liés', 'liee': 'liée', 'liees': 'liées',
    'amelioration': 'amélioration', 'ameliorations': 'améliorations',
    'ameliorer': 'améliorer', 'ameliore': 'amélioré', 'amelioree': 'améliorée',
    'depasser': 'dépasser', 'depasse': 'dépassé',
    'preferer': 'préférer', 'prefere': 'préféré', 'preference': 'préférence',
    'preparation': 'préparation', 'preparer': 'préparer', 'prepare': 'préparé',
    'prevoir': 'prévoir', 'prevu': 'prévu', 'prevue': 'prévue',
    'prevention': 'prévention',
    'precedent': 'précédent', 'precedente': 'précédente', 'precedents': 'précédents',
    'concue': 'conçue', 'concu': 'conçu', 'concues': 'conçues',
    'recue': 'reçue', 'recu': 'reçu', 'recues': 'reçues',
    'apercu': 'aperçu',
    'francais': 'français', 'francaise': 'française',
    'lecon': 'leçon', 'lecons': 'leçons',
    # ô
    'plutot': 'plutôt',
    'tot': 'tôt',
    'bientot': 'bientôt',
    'role': 'rôle', 'roles': 'rôles',
    'controle': 'contrôle', 'controler': 'contrôler', 'controles': 'contrôles',
    'controlee': 'contrôlée', 'controlees': 'contrôlées',
    'depot': 'dépôt', 'depots': 'dépôts',
    'cote': 'côté', 'cotes': 'côtés',
    # ê
    'fete': 'fête', 'fetes': 'fêtes',
    'tete': 'tête', 'tetes': 'têtes',
    'bete': 'bête', 'betes': 'bêtes',
    'pret': 'prêt', 'prete': 'prête', 'prets': 'prêts', 'pretes': 'prêtes',
    'preter': 'prêter',
    'meme': 'même', 'memes': 'mêmes',
    'etre': 'être',
    'etes': 'êtes',
    'fenetre': 'fenêtre', 'fenetres': 'fenêtres',
    'requete': 'requête',
    'conquete': 'conquête',
    'enquete': 'enquête',
    'vetement': 'vêtement', 'vetements': 'vêtements',
    # œ
    'oeuvre': 'œuvre', 'oeuvres': 'œuvres',
    'soeur': 'sœur', 'soeurs': 'sœurs',
    'coeur': 'cœur', 'coeurs': 'cœurs',
    # Misc useful
    'systeme': 'système', 'systemes': 'systèmes',
    'probleme': 'problème', 'problemes': 'problèmes',
    'theme': 'thème', 'themes': 'thèmes',
    'scene': 'scène', 'scenes': 'scènes',
    'siecle': 'siècle', 'siecles': 'siècles',
    'modele': 'modèle', 'modeles': 'modèles',
    'piece': 'pièce', 'pieces': 'pièces',
    'colere': 'colère',
    'sincere': 'sincère',
    'fierte': 'fierté',
    'attribut': 'attribut',
    'maitre': 'maître', 'maitres': 'maîtres', 'maitrise': 'maîtrise', 'maitriser': 'maîtriser',
    'gout': 'goût', 'gouts': 'goûts',
    'coute': 'coûte', 'couter': 'coûter', 'couteux': 'coûteux',
    'cout': 'coût', 'couts': 'coûts',
    'epreuve': 'épreuve', 'epreuves': 'épreuves',
    'epee': 'épée', 'epees': 'épées',
    'enorme': 'énorme', 'enormes': 'énormes', 'enormement': 'énormément',
    'etudier': 'étudier', 'etude': 'étude', 'etudes': 'études', 'etudiant': 'étudiant',
    'evaluer': 'évaluer', 'evaluation': 'évaluation', 'evaluee': 'évaluée',
    'evident': 'évident', 'evidente': 'évidente', 'evidemment': 'évidemment',
    'execute': 'exécuté', 'executer': 'exécuter', 'execution': 'exécution',
    'enleve': 'enlevé',
    'envoye': 'envoyé',
    'epuise': 'épuisé', 'epuiser': 'épuiser',
    'eteint': 'éteint', 'eteindre': 'éteindre',
    'esperer': 'espérer', 'espere': 'espéré',
    'essaye': 'essayé',
    'declenche': 'déclenché', 'declencher': 'déclencher',
    'declenchee': 'déclenchée', 'declenchent': 'déclenchent',
    'determine': 'déterminé', 'determiner': 'déterminer', 'determinee': 'déterminée',
    'detenu': 'détenu', 'detenue': 'détenue',
    'devie': 'dévié', 'devier': 'dévier',
    'enchere': 'enchère',
    'enchainer': 'enchaîner', 'enchainement': 'enchaînement',
    'gere': 'géré', 'gerer': 'gérer', 'gerez': 'gérez', 'geree': 'gérée',
    'reserver': 'réserver', 'reserve': 'réservé', 'reservee': 'réservée',
    'reduire': 'réduire', 'reduction': 'réduction', 'reduit': 'réduit', 'reduite': 'réduite',
    'repond': 'répond', 'repondre': 'répondre', 'repondez': 'répondez',
    'reglage': 'réglage', 'reglages': 'réglages',
    'regle': 'règle', 'regles': 'règles',
    'remplace': 'remplacé',
    'reparer': 'réparer',
    'resoudre': 'résoudre', 'resolu': 'résolu',
    'resume': 'résumé',
    'reussite': 'réussite', 'reussir': 'réussir', 'reussi': 'réussi',
    'reveler': 'révéler', 'revele': 'révélé',
    'rever': 'rêver', 'reve': 'rêve', 'reves': 'rêves',
    'derriere': 'derrière',
    'desert': 'désert',
    'discrete': 'discrète',
    'entiere': 'entière', 'entieres': 'entières',
    'exterieur': 'extérieur', 'exterieure': 'extérieure',
    'interieur': 'intérieur', 'interieure': 'intérieure',
    'inferieur': 'inférieur', 'inferieure': 'inférieure',
    'superieur': 'supérieur', 'superieure': 'supérieure', 'superieurs': 'supérieurs',
    'evolue': 'évolué', 'evoluer': 'évoluer',
    'phenomene': 'phénomène',
    'pieger': 'piéger',
    'reseau': 'réseau',
    'reservoir': 'réservoir',
    'sevir': 'sévir',
    'verite': 'vérité',
    'video': 'vidéo', 'videos': 'vidéos',
    'volonte': 'volonté',
    'celebre': 'célèbre',
    'celibataire': 'célibataire',
    'reflechir': 'réfléchir', 'reflechi': 'réfléchi',
    'reflexion': 'réflexion',
    'phenomenes': 'phénomènes',
    'resister': 'résister',
    'reussir': 'réussir',
    'separer': 'séparer',
    'beneficier': 'bénéficier',
    'desactivez': 'désactivez',
    'metaux': 'métaux', 'metal': 'métal',
    'oppose': 'opposé', 'opposer': 'opposer',
    'libere': 'libéré', 'liberer': 'libérer', 'liberee': 'libérée',
    'modifie': 'modifié', 'modifier': 'modifier', 'modifiee': 'modifiée',
    'mene': 'mené', 'mener': 'mener', 'menee': 'menée',
    'compose': 'composé', 'composee': 'composée',
    'retire': 'retiré',
    'sauve': 'sauvé',
    'reveille': 'réveillé', 'reveiller': 'réveiller',
    # Additional words observed in beginner-faq and other guides
    'communaute': 'communauté', 'communautes': 'communautés',
    'compilees': 'compilées', 'compile': 'compilé', 'compilee': 'compilée',
    'experimentes': 'expérimentés', 'experimente': 'expérimenté', 'experimentee': 'expérimentée',
    'experimentes': 'expérimentés',
    'Avances': 'Avancés', 'avances': 'avancés', 'avance': 'avancé', 'avancee': 'avancée', 'avancees': 'avancées',
    'Connexes': 'Connexes',  # already no accent
    'reroll': 'reroll', 'rerolls': 'rerolls',  # gacha jargon, no accent
    'termine': 'terminé', 'terminee': 'terminée', 'termines': 'terminés', 'terminees': 'terminées',
    'forcement': 'forcément',
    'recommande': 'recommandé', 'recommandee': 'recommandée',
    'recommandes': 'recommandés', 'recommandees': 'recommandées',
    'detaille': 'détaillé', 'detaillee': 'détaillée',
    'dedie': 'dédié', 'dediee': 'dédiée',
    'Reguliers': 'Réguliers', 'reguliers': 'réguliers', 'reguliere': 'régulière', 'regulieres': 'régulières',
    'regulier': 'régulier',
    'debutant': 'débutant', 'debutants': 'débutants', 'debutante': 'débutante',
    'donne': 'donné', 'donnee': 'donnée', 'donnes': 'donnés', 'donnees': 'données',
    'farmes': 'farmés', 'farme': 'farmé', 'farmee': 'farmée',
    'legerement': 'légèrement',
    'ajoutes': 'ajoutés', 'ajoute': 'ajouté', 'ajoutee': 'ajoutée', 'ajoutees': 'ajoutées',
    'degat': 'dégât', 'degats': 'dégâts',
    'necessiter': 'nécessiter', 'necessite': 'nécessité', 'necessitent': 'nécessitent',
    'evaluation': 'évaluation', 'evaluations': 'évaluations',
    'benefique': 'bénéfique', 'benefiques': 'bénéfiques',
    'prete': 'prête', 'pretes': 'prêtes',
    'accelere': 'accélère', 'accelerer': 'accélérer', 'acceleration': 'accélération',
    'materiaux': 'matériaux', 'materiel': 'matériel', 'materielle': 'matérielle',
    'reinitialise': 'réinitialise', 'reinitialiser': 'réinitialiser',
    'legendaire': 'légendaire', 'legendaires': 'légendaires',
    'arene': 'arène', 'arenes': 'arènes',
    'Priorite': 'Priorité', 'priorite': 'priorité',
    'offres': 'offres',  # no accent
    'monnaie': 'monnaie',  # no accent
    'depend': 'dépend', 'dependent': 'dépendent', 'dependent': 'dépendent',
    'fortement': 'fortement',  # no accent
    'Tigre': 'Tigre',  # no accent
    'pieces': 'pièces', 'piece': 'pièce',
    'progresser': 'progresser',  # no accent
    'progression': 'progression',  # no accent
    'transcends': 'transcends',  # gacha jargon
    'transcend': 'transcend',
    'recuperer': 'récupérer', 'recupere': 'récupère', 'recuperent': 'récupèrent',
    'recuperez': 'récupérez',
    'Recuperez': 'Récupérez',
    'precoce': 'précoce', 'precoces': 'précoces',
    'Privilegiez': 'Privilégiez', 'privilegier': 'privilégier', 'privilegie': 'privilégié',
    'recents': 'récents', 'recent': 'récent', 'recente': 'récente', 'recentes': 'récentes',
    'transcendance': 'transcendance',  # no accent
    'transcender': 'transcender',  # no accent
    'transcend': 'transcend',
    'cible': 'cible',  # no accent
    'tot': 'tôt',
    'plutot': 'plutôt',
    'jeux': 'jeux',  # no accent
    'a': 'à',  # AMBIGUOUS — handled separately in contextual rules
    'soit': 'soit',  # no accent
    'dehors': 'dehors',  # no accent
    'gratuites': 'gratuites',  # no accent
    'multiples': 'multiples',  # no accent
    'individuels': 'individuels',  # no accent
    'preferentiel': 'préférentiel',
    'Outerplane': 'Outerplane',  # proper noun
    'sortes': 'sortes',
    'sortie': 'sortie',
    'completer': 'compléter', 'complete': 'complété', 'completee': 'complétée',
    'completes': 'complétés', 'completees': 'complétées',
    'completement': 'complètement',
    'completion': 'complétion',
    'meilleur': 'meilleur', 'meilleurs': 'meilleurs', 'meilleure': 'meilleure', 'meilleures': 'meilleures',
    'permettre': 'permettre',
    'choix': 'choix',
    'devra': 'devra',
    'profil': 'profil',
    'progression': 'progression',
    'recherche': 'recherche',  # no
    'rechercher': 'rechercher',
    'classes': 'classes',  # no
    'classement': 'classement',  # no
    'classer': 'classer',
    'limite': 'limité', 'limitee': 'limitée', 'limites': 'limités', 'limitees': 'limitées',
    'limiter': 'limiter',
    'limitation': 'limitation',
    'arrete': 'arrêté', 'arreter': 'arrêter', 'arretee': 'arrêtée',
    'cumule': 'cumulé', 'cumules': 'cumulés', 'cumulee': 'cumulée',
    'parametre': 'paramètre', 'parametres': 'paramètres', 'parametrer': 'paramétrer',
    'parametrage': 'paramétrage',
    'objet': 'objet', 'objets': 'objets',  # no
    'inferieur': 'inférieur', 'inferieure': 'inférieure',
    'superieur': 'supérieur', 'superieure': 'supérieure',
    'sortez': 'sortez',  # no
    'sortie': 'sortie',
    'utilises': 'utilisés',
    'usage': 'usage',
    'usagers': 'usagers',
    'meta': 'meta',  # gacha jargon
    'limitee': 'limitée',
    'transcendent': 'transcendent',  # verb 3p
    'transcendant': 'transcendant',
    'ferme': 'fermé', 'fermes': 'fermés', 'fermee': 'fermée', 'fermees': 'fermées',
    'ouverte': 'ouverte', 'ouvertes': 'ouvertes',
    'ouvert': 'ouvert',  # no accent in masc
    'aborder': 'aborder',  # no
    'rapides': 'rapides',  # no
    'soutiens': 'soutiens',  # no
    'demande': 'demande',  # no (verb or noun, no accent)
    'demandes': 'demandés',  # past part
    'visite': 'visité',  # past part
    'visites': 'visités',
    'mise': 'mise',  # no
    'mises': 'mises',  # no
    'mis': 'mis',  # no
    'engagee': 'engagée', 'engages': 'engagés', 'engagee': 'engagée',
    'engage': 'engagé',
    'expedier': 'expédier', 'expedie': 'expédié',
    'precoce': 'précoce',
    'agree': 'agréé',
    'energique': 'énergique',
    'enerve': 'énervé',
    'eparpille': 'éparpillé',
    'evidemment': 'évidemment',
    'fierte': 'fierté',
    'Foire': 'Foire',  # no
    'questions': 'questions',  # no
    'courantes': 'courantes',  # no
    'posees': 'posées',
    'pose': 'posé', 'poses': 'posés', 'posee': 'posée', 'posees': 'posées',
    'discussions': 'discussions',  # no
    'conseils': 'conseils',  # no
    'Commencer': 'Commencer',  # no
    'Pulls': 'Pulls',  # gacha jargon, no accent
    'Pull': 'Pull',
    'aide': 'aide',  # no
    'obligatoire': 'obligatoire',  # no
    'forment': 'forment',
    'forme': 'formé', 'formes': 'formés', 'formee': 'formée',
    'forte': 'forte', 'fortes': 'fortes',
    'fort': 'fort', 'forts': 'forts',
    'doit': 'doit', 'doivent': 'doivent',
    'avoir': 'avoir',
    'jusque': 'jusque', 'jusquau': 'jusqu\'au',
    'gratuitement': 'gratuitement',
    'pouvez': 'pouvez',
    'choisir': 'choisir',
    'entre': 'entre',
    'plus tard': 'plus tard',
    'egalement': 'également',
    'Hero Premium/Limited': 'Héros Premium/Limited',  # composite, may not match
    'eduque': 'éduqué',
    'majoritairement': 'majoritairement',  # no
    'majoritaire': 'majoritaire',
    'majeur': 'majeur', 'majeure': 'majeure',
    'majeur partie': 'majeure partie',
    # à fixed expressions extension
    'tot ou tard': 'tôt ou tard',
    'des que': 'dès que',
    'des le debut': 'dès le début',
    'des lors': 'dès lors',
    # roles & elements (game) — kept English already
    'Solo': 'Solo',  # gacha jargon kept
    'solo': 'solo',
    # banner combo
    'banners': 'banners',  # gacha jargon, no accent
    # à before infinitive (common verbs needing à)
    # handled in contextual
}

# Contextual replacements (regex) — applied AFTER WORD_MAP
CONTEXTUAL = [
    # à in fixed expressions
    (r"\bjusqu'a\b", "jusqu'à"),
    (r"\bJusqu'a\b", "Jusqu'à"),
    (r"\bgrace a\b", "grâce à"),
    (r"\bGrace a\b", "Grâce à"),
    (r"\bface a\b", "face à"),
    (r"\bFace a\b", "Face à"),
    (r"\bvis-a-vis\b", "vis-à-vis"),
    (r"\bquant a\b", "quant à"),
    (r"\bpar rapport a\b", "par rapport à"),
    (r"\bsuite a\b", "suite à"),
    (r"\bSuite a\b", "Suite à"),
    (r"\bcontrairement a\b", "contrairement à"),
    (r"\bconforme a\b", "conforme à"),
    (r"\benvers a\b", "envers à"),
    # numbers around "a"
    (r"(\d)\s+a\s+(\d)", r"\1 à \2"),
    # verbs followed by "a"
    (r"\baide a\s+([a-zéèêà])", r"aide à \1"),
    (r"\baider a\b", "aider à"),
    (r"\bservir a\b", "servir à"),
    (r"\bsert a\s+([a-zéèêà])", r"sert à \1"),
    (r"\bparvenir a\b", "parvenir à"),
    (r"\bpenser a\b", "penser à"),
    (r"\bcommencer a\b", "commencer à"),
    (r"\bcontinuer a\b", "continuer à"),
    (r"\bcontribuer a\b", "contribuer à"),
    (r"\bapprend a\b", "apprend à"),
    (r"\bcherche a\b", "cherche à"),
    (r"\bchercher a\b", "chercher à"),
    (r"\bvise a\b", "vise à"),
    (r"\bviser a\b", "viser à"),
    (r"\bpermettre a\b", "permettre à"),
    (r"\baccess a\b", "accès à"),
    # Common "verbe + à + infinitive" patterns
    (r"\baide a\s+(?=[a-zéèà])", "aide à "),
    (r"\bsert a\s+(?=[a-zéèà])", "sert à "),
    (r"\baident a\s+(?=[a-zéèà])", "aident à "),
    (r"\bservent a\s+(?=[a-zéèà])", "servent à "),
    (r"\bvise a\s+(?=[a-zéèà])", "vise à "),
    (r"\bvisent a\s+(?=[a-zéèà])", "visent à "),
    (r"\barrive a\s+(?=[a-zéèà])", "arrive à "),
    (r"\barrivent a\s+(?=[a-zéèà])", "arrivent à "),
    (r"\bcontribue a\s+(?=[a-zéèà])", "contribue à "),
    (r"\bcontribuent a\s+(?=[a-zéèà])", "contribuent à "),
    (r"\benseigne a\s+(?=[a-zéèà])", "enseigne à "),
    (r"\bapprend a\s+(?=[a-zéèà])", "apprend à "),
    (r"\bcommence a\s+(?=[a-zéèà])", "commence à "),
    (r"\bcontinue a\s+(?=[a-zéèà])", "continue à "),
    (r"\bcherche a\s+(?=[a-zéèà])", "cherche à "),
    (r"\bessaye a\s+(?=[a-zéèà])", "essaye à "),
    (r"\bessaie a\s+(?=[a-zéèà])", "essaie à "),
    (r"\bpousse a\s+(?=[a-zéèà])", "pousse à "),
    (r"\bencourage a\s+(?=[a-zéèà])", "encourage à "),
    (r"\bautorise a\s+(?=[a-zéèà])", "autorise à "),
    (r"\bdestiné a\b", "destiné à"),
    (r"\bdestinés a\b", "destinés à"),
    (r"\bdestinée a\b", "destinée à"),
    (r"\bpret a\b", "prêt à"),
    (r"\bprete a\b", "prête à"),
    (r"\bprets a\b", "prêts à"),
    (r"\bpretes a\b", "prêtes à"),
    # "a tout moment" pattern
    (r"\ba tout moment\b", "à tout moment"),
    (r"\bA tout moment\b", "À tout moment"),
    # "mois a + infinitive" → "mois à"
    (r"\bmois a\s+(?=[a-zéèà])", "mois à "),
    (r"\bsemaines a\s+(?=[a-zéèà])", "semaines à "),
    # "X a faire" generic
    (r"\bafin a\b", "afin à"),  # rare; afin de is more correct
    # "Premium banner" → "Premium Banner" (capitalize Banner for jargon consistency)
    # Note: banner gender feminine handled below
    (r"\b(Premium|Custom|Rate Up|Mileage|Limited|Seasonal|Festival|Collab|Special|Free|Start Dash|Start)\s+banner\b",
     lambda m: f"{m.group(1)} Banner"),
    (r"\b(Premium|Custom|Rate Up|Mileage|Limited|Seasonal|Festival|Collab|Special|Free|Start Dash|Start)\s+banners\b",
     lambda m: f"{m.group(1)} Banners"),
    # sûr
    (r"\b(E|e)tes sur\b", r"\1tes sûr"),
    (r"\bbien sur\b", "bien sûr"),
    (r"\bBien sur\b", "Bien sûr"),
    (r"\bsur de\b", "sûr de"),
    (r"\bsoyez sur\b", "soyez sûr"),
    (r"\bsoyez sure\b", "soyez sûre"),
    (r"\bplus sur\b", "plus sûr"),
    # Pull/tirage (gacha jargon)
    (r"\btirages\b", "pulls"),
    (r"\btirage\b", "pull"),
    (r"\bTirages\b", "Pulls"),
    (r"\bTirage\b", "Pull"),
    # banner gender (feminine in French — applies to bare "banner" AND "<X> Banner" / "<X> banner")
    # Bare "banner" / "banners" (lowercase)
    (r"\ble banner\b", "la banner"),
    (r"\bLe banner\b", "La banner"),
    (r"\bun banner\b", "une banner"),
    (r"\bUn banner\b", "Une banner"),
    (r"\bce banner\b", "cette banner"),
    (r"\bCe banner\b", "Cette banner"),
    (r"\bdu banner\b", "de la banner"),
    (r"\bau banner\b", "à la banner"),
    (r"\bnouveau banner\b", "nouvelle banner"),
    (r"\bdernier banner\b", "dernière banner"),
    (r"\bpremier banner\b", "première banner"),
    (r"\bsur ce banner\b", "sur cette banner"),
    (r"\bsur le banner\b", "sur la banner"),
    (r"\bdans le banner\b", "dans la banner"),
    (r"\bdans un banner\b", "dans une banner"),
    (r"\bBanner permanent\b", "Banner permanente"),
    (r"\bbanner permanent\b", "banner permanente"),
    (r"\bbanner ouvert\b", "banner ouverte"),
    (r"\bbanner ferme\b", "banner fermée"),
    (r"\bfutur banner\b", "future banner"),
    # "<X> Banner" / "<X> banner" with masculine determiner before (e.g. "le Custom Banner")
    (r"\ble\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"la \1 \2"),
    (r"\bLe\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"La \1 \2"),
    (r"\bun\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"une \1 \2"),
    (r"\bUn\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"Une \1 \2"),
    (r"\bce\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"cette \1 \2"),
    (r"\bCe\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"Cette \1 \2"),
    (r"\bdu\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"de la \1 \2"),
    (r"\bDu\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"De la \1 \2"),
    (r"\bnouveau\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"nouvelle \1 \2"),
    (r"\bdernier\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"dernière \1 \2"),
    (r"\bpremier\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"première \1 \2"),
    (r"\bfutur\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+([Bb]anner)\b", r"future \1 \2"),
    # banniere → banner (accent-stripped FR back to EN jargon)
    (r"\bbanniere\b", "banner"),
    (r"\bBanniere\b", "Banner"),
    (r"\bbannieres\b", "banners"),
    (r"\bBannieres\b", "Banners"),
    # Shop/Workshop/Hub are masculine in French (loanwords). Strip feminine determiners.
    # X Shop pattern: feminine determiner + (one or two words) + Shop
    (r"\bla\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"le \1 Shop"),
    (r"\bLa\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"Le \1 Shop"),
    (r"\bde la\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"du \1 Shop"),
    (r"\bDe la\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"Du \1 Shop"),
    (r"\bune\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"un \1 Shop"),
    (r"\bcette\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Shop\b", r"ce \1 Shop"),
    # Bare "Shop"
    (r"\bla Shop\b", "le Shop"),
    (r"\bde la Shop\b", "du Shop"),
    (r"\bune Shop\b", "un Shop"),
    (r"\bcette Shop\b", "ce Shop"),
    # Workshop (masculin)
    (r"\bla\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Workshop\b", r"le \1 Workshop"),
    (r"\bde la\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Workshop\b", r"du \1 Workshop"),
    (r"\bla Workshop\b", "le Workshop"),
    (r"\bde la Workshop\b", "du Workshop"),
    # Hub (masculin) — singleton
    (r"\bla Hub\b", "le Hub"),
    (r"\bde la Hub\b", "du Hub"),
    (r"\bune Hub\b", "un Hub"),
    (r"\bla\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Hub\b", r"le \1 Hub"),
    (r"\bde la\s+([\w'\-]+(?:\s+[\w'\-]+){0,2})\s+Hub\b", r"du \1 Hub"),
]


def apply_word_map(text: str) -> str:
    for src, dst in WORD_MAP.items():
        if src == dst:
            continue
        text = re.sub(r'\b' + re.escape(src) + r'\b', dst, text)
    return text


def apply_contextual(text: str) -> str:
    for pat, repl in CONTEXTUAL:
        text = re.sub(pat, repl, text)
    return text


def transform_fr_value(value: str) -> str:
    value = apply_word_map(value)
    value = apply_contextual(value)
    return value


# Regex to find `fr: '...'` values, supporting escaped quotes inside.
FR_VALUE_RE = re.compile(r"(fr:\s*)('(?:[^'\\]|\\.)*')")


def process_file(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    count = [0]

    def replace_fn(m):
        prefix = m.group(1)
        quoted = m.group(2)
        inner = quoted[1:-1]
        new_inner = transform_fr_value(inner)
        if new_inner != inner:
            count[0] += 1
        return prefix + "'" + new_inner + "'"

    new_content = FR_VALUE_RE.sub(replace_fn, content)
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    return count[0]


FILES = [
    'src/app/[lang]/guides/_contents/general-guides/banner-mileage/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/beginner-faq/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/core-fusion/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/core-fusion/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/daily-stamina/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/ether-income/data.ts',
    'src/app/[lang]/guides/_contents/general-guides/ether-income/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/ether-income/labels.ts',
    'src/app/[lang]/guides/_contents/general-guides/free-heroes-start-banner/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/free-heroes-start-banner/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/free-heroes-start-banner/recommendedCharacters.ts',
    'src/app/[lang]/guides/_contents/general-guides/gear/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/gear/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/heroes-growth/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/heroes-growth/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/premium-limited/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/premium-limited/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/quirk/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/quirk/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/shop-purchase-priorities/data.ts',
    'src/app/[lang]/guides/_contents/general-guides/shop-purchase-priorities/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/shop-purchase-priorities/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/stats/helpers.tsx',
    'src/app/[lang]/guides/_contents/general-guides/stats/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/stats/labels.ts',
    'src/app/[lang]/guides/_contents/general-guides/timegate-resource/data.ts',
    'src/app/[lang]/guides/_contents/general-guides/timegate-resource/index.tsx',
    'src/app/[lang]/guides/_contents/general-guides/timegate-resource/labels.ts',
    'src/app/[lang]/guides/_contents/general-guides/unlock-content/data.ts',
    'src/app/[lang]/guides/_contents/general-guides/unlock-content/index.tsx',
    'src/app/[lang]/guides/_contents/dimensional-singularity/urd/index.tsx',
    'src/app/[lang]/guides/_contents/dimensional-singularity/abomination-hunter-belial/index.tsx',
    'src/app/[lang]/guides/_contents/other/roadmap-2026/helpers.tsx',
    'src/app/[lang]/guides/_contents/other/roadmap-2026/index.tsx',
]

total_changes = 0
files_changed = 0
for path in FILES:
    if not os.path.exists(path):
        print(f'  SKIP (not found): {path}')
        continue
    n = process_file(path)
    if n > 0:
        files_changed += 1
        total_changes += n
        print(f'  {n:4d} fr values modified: {path}')

print(f'\nTotal: {total_changes} fr values modified across {files_changed} files (of {len(FILES)})')
