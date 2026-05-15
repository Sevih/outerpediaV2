# -*- coding: utf-8 -*-
"""Insert notes_fr (requirement entries / bossA notes) and footer note_fr into guild-raid files."""
import json, os, re

BASE = r"src/app/[lang]/guides/_contents/guild-raid"

# entry_notes: ordered list (document order) of FR note arrays, one per object holding notes_jp.
# footer_notes: ordered list of FR footer note strings (string-form note_zh).
FILES = {
"frost-legion/versions/05-2025/phase1.json": {
 "entry_notes": [
  ["Si vous parvenez à le briser en chaîne, remplacez le {C/Defender} par un autre DPS. Dans la vidéo, {P/Kuro} a été choisie car c'est un personnage {E/Light}, avec des dégâts corrects, du {B/BT_CP_CHARGE} et du {D/BT_MARKING}."],
 ],
 "footer_notes": [],
},
"frost-legion/versions/11-2025/phase1.json": {
 "entry_notes": [
  ["Si vous parvenez à le briser en chaîne, remplacez le {C/Defender} par un autre DPS. Dans la vidéo, {P/Kuro} a été choisie car c'est un personnage {E/Light}, avec des dégâts corrects, du {B/BT_CP_CHARGE} et du {D/BT_MARKING}."],
 ],
 "footer_notes": [],
},
"madman-laboratory/versions/04-2026/phase2.json": {
 "entry_notes": [
  ["Uniquement S1"],
  ["Maintenez simplement {B/FIERCE_OFFENSIVE} actif pour la {B/BT_ACTION_GAUGE}."],
  ["Doit faire S1 au premier tour pour déclencher {I-W/Rampaging Caracal} et le {SK/Notia|S2} de {P/Notia}"],
  [],
  ["S3 > S2 Burn Niv 2 > S1"],
  ["Uniquement S1 pour gagner de la priorité"],
  ["Uniquement S1 Burn Niv 1 sauf pour le premier break où elle utilisera la Chain attack"],
  ["retirez son EE, vous ne voulez pas qu'elle obtienne un tour supplémentaire"],
  ["Utilisez S2 une fois pour ralentir le Boss puis utilisez la Chain attack sur l'autre break"],
  ["A besoin de 267+ de {S/SPD} pour dépasser le Boss en vitesse après la fin du break"],
  ["Attention à ce que son S3 ne dépasse pas 50K de dégâts — cela déclencherait la compétence de revenge du Boss"],
  ["Le set {AS/Revenge} est idéal aux stages élevés même si elle ne perd qu'un peu de HP. Le set {AS/Attack} fonctionne aux stages inférieurs si elle reste à pleins HP après le coup du Boss",
   "Utilisez une armure +0 si possible pour subir plus de dégâts et déclencher {AS/Revenge} plus fiablement",
   "Retirez l'EE pour qu'elle ne s'intercale pas entre le Boss et {P/Kuro}"],
  ["Set {AS/Revenge} recommandé pour les meilleurs résultats"],
  ["L'une ou l'autre arme convient"],
  ["Ne doit pas équiper une arme qui applique un debuff"],
  [],
  [],
 ],
 "footer_notes": [],
},
"planetary-control-unit/versions/02-2026/phase2.json": {
 "entry_notes": [
  ["L'EE double le geas +150 {S/EFF}, vous n'avez donc besoin que d'environ 218 {S/EFF}, facilement atteint avec le seul emplacement de gants",
   "{I-A/Unholy Exsultet} pour survivre au tour 1 aux stages élevés. {I-A/Charmer's Golden Chalice} si vous devez subir assez de dégâts pour descendre sous 50%"],
  ["518+ {S/EFF}, ou 259+ avec {I-W/Briareos's Recklessness [Ranger]}",
   "Si {P/Roxie} et {P/Maxie} ont 259+ {S/EFF}, vous pouvez vous passer de la réduction de {S/RES}",
   "2 {AS/Bursting} optionnel pour le burst 2 au tour 1 afin d'annuler le buff de défense"],
  ["Peut être à la {S/SPD} minimale (95) mais à 126, elle joue le plus tôt possible tout en n'ayant que 2 tours, donnant à ses burns de S3 plus d'occasions d'être prolongés"],
  ["{S/SPD} minimale. 268+ {S/EFF} requis, sinon activez le geas +150 {S/EFF}",
   "Activez le geas {S/RES} +50/200 si vous pouvez atteindre assez de {S/EFF} pour ceux-ci aussi"],
  ["Doit être plus lente que {P/Mero}",
   "{I-T/Vanguard's Charm} +10 et EE+5 devraient aussi suffire en AP sans set burst"],
  ["Le buff {B/BT_STAT|ST_BUFF_CHANCE} ne sera pas actif en permanence, donc un peu de {S/EFF} est nécessaire"],
  ["2 {AS/Bursting} obligatoire pour faire burst 2 au tour 1 et empêcher le buff de défense",
   "Si vous n'avez pas {I-W/Briareos's Recklessness [Ranger]}, vous devez atteindre 518 {S/EFF}",
   "Casque +0 pour qu'elle meure plus facilement face au S3"],
 ],
 "footer_notes": [
  "Respectez ces valeurs pour des dégâts optimisés sauf si vous savez ce que vous faites. {P/Roxie} et {P/Akari} jouent après {P/Maxie} à certains tours pour un ordre d'extension des debuffs plus optimal.",
 ],
},
"prevent-world-alteration/versions/12-2025/phase2.json": {
 "entry_notes": [
  ["La 5★ fonctionne encore mais vous ne pouvez pas utiliser le Burst 3 à son dernier tour sauf en utilisant {AS/Bursting}",
   "Si vous n'avez pas {I-A/Gorgon's Vanity [Mage]}, vous devrez probablement jouer avec {AS/Speed} plutôt que {AS/Revenge}"],
  ["Exactement 288 {S/SPD}, sinon l'ordre de jeu sera faussé.",
   "Idéalement 6★ pour de l'AP supplémentaire en début de combat"],
  ["A besoin d'assez de HP pour survivre à deux burns de 2 tours avec {I-A/Queen of Prism}",
   "Sans {I-A/Queen of Prism}, faites en sorte que ses HP max soient inférieurs à ceux de {P/Roxie} pour qu'elle reçoive un bouclier de {P/Core Fusion Veronica} plus tard (ce qui veut dire que vous n'encaissez que des burns de 1 tour)"],
  ["EE+10 non requise, mais si vous l'avez, n'utilisez pas l'accessoire {I-A/Chalice of Longing} sinon l'ordre de jeu sera faussé.",
   "{I-A/Chalice of Longing} convient sans EE+10"],
 ],
 "footer_notes": [],
},
}


def find_array_span(text, start_bracket):
    depth = 0
    in_str = False
    esc = False
    i = start_bracket
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c in '[{':
                depth += 1
            elif c in ']}':
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    raise ValueError('unbalanced')


NOTES_ZH_ARR = re.compile(r'^([ \t]*)"notes_zh": \[', re.M)
NOTE_ZH_STR = re.compile(r'^([ \t]*)"note_zh": ("(?:[^"\\]|\\.)*")$', re.M)


def patch(rel, spec):
    path = os.path.join(BASE, rel)
    text = open(path, encoding='utf-8').read()

    entry = spec['entry_notes']
    footer = spec['footer_notes']

    arr_matches = list(NOTES_ZH_ARR.finditer(text))
    if len(arr_matches) != len(entry):
        raise SystemExit('notes_zh count %d != %d in %s' % (len(arr_matches), len(entry), rel))
    str_matches = list(NOTE_ZH_STR.finditer(text))
    if len(str_matches) != len(footer):
        raise SystemExit('footer note_zh count %d != %d in %s' % (len(str_matches), len(footer), rel))

    # build insertion list (position, text) then apply from end
    inserts = []
    for m, fr in zip(arr_matches, entry):
        indent = m.group(1)
        end = find_array_span(text, m.end() - 1)
        dumped = json.dumps(fr, ensure_ascii=False, indent=2).replace('\n', '\n' + indent)
        inserts.append((end, ',\n' + indent + '"notes_fr": ' + dumped))
    for m, fr in zip(str_matches, footer):
        indent = m.group(1)
        end = m.end()
        inserts.append((end, ',\n' + indent + '"note_fr": ' + json.dumps(fr, ensure_ascii=False)))

    for pos, ins in sorted(inserts, key=lambda x: -x[0]):
        text = text[:pos] + ins + text[pos:]

    json.loads(text)  # validate
    open(path, 'w', encoding='utf-8', newline='\n').write(text)
    return len(entry), len(footer)


te = tf = 0
for rel in sorted(FILES):
    e, f = patch(rel, FILES[rel])
    te += e
    tf += f
    print('  notes_fr=%-2d note_fr=%d  %s' % (e, f, rel))
print('TOTAL: %d entry notes_fr, %d footer note_fr' % (te, tf))
