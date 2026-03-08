---
title: "Developer’s Note #5” November to December Balance Adjustments"
date: "2023-11-06T00:00:00.000Z"
category: "developer-notes"
id: "2023-11-06-developer-s-note-5-november-to-december-balance-adjustments"
images:
  - /images/news/legacy/developer-notes/2023-11-06-developer-s-note-5-november-to-december-balance-adjustments/6f396837335c47d4832ae1b479e15aa1.webp
---

![](/images/news/legacy/developer-notes/2023-11-06-developer-s-note-5-november-to-december-balance-adjustments/6f396837335c47d4832ae1b479e15aa1.webp)  
  
Hello, Masters! This is Moonsoo Hyun, the producer of OUTERPLANE. Today, we are pleased to present you with the 5th Developer's Note, in which we aim to offer further information about the balance adjustments mentioned in our previous Developer’s Note.

* * *

**◈ Balance Adjustments**Balance adjustments will be carried out on both PVP and PVE  
to mitigate uncertainty in PVP and refine the dominance of certain combinations, items, and core combat mechanics.  
This will diversify the choice of using different offense and defense decks. As a result, with the upcoming real-time PVP in mind, the direction for asynchronous PVP will be to enhance the satisfaction of victory and alleviate the stress related to progression. For PVE, we plan to ease the challenges faced during early and mid-game adventures and the growth process, while also reducing the difficulty of dungeons with exceptionally high failure rates. **◈ Balance Adjustment Details**  
Due to the nature of numerical balance, radical modifications can bring about excessive side effects.  
Therefore, we are approaching modifications with caution, and we kindly request you to refer to the adjustment details below. ※ Please note that the current changes are in the development and simulation stages, and there may be some modifications when they are applied in the actual update. **1\. Basic Battle Logic Adjustments**  

No. 

Category

Details

Effective date

1

Random Speed Adjustment at the Start of Battle

  
[**#Implemented**](/) following the Update on 10/24  
  
We have reduced the random range due to the observed occurrence of random values exceeding the expected range. - Current: 5% ~ 5% / Expected: 0% ~ 5% The above modification was made to minimize uncertainty stemming from random values and to ensure that the efforts and investments made by our Masters in terms of time and significant costs do not go to waste.

10/24  
 \[Applied\]

2

In the Resurrection mechanism, 

  
we found that the advantages of Resurrection/Revival in PVP were excessive,  
which increased uncertainty in the outcome of battles.   We also observed that this led to overly uniform deck compositions and hindered the formation of effective offensive teams against defensive ones.With these concerns in mind, we made the following adjustments.

12/5

  
\# Current  
\- Revival/Resurrection Effect: All debuffs are dispelled, and skill cooldown is maintained.   Heroes will be resurrected with their Priority at defeat.   (Health is set according to each Heroe's skill/item effects.) - (Enhanced) Resurrection Effect: All debuffs are dispelled, and skill cooldown is reset.   Heroes will be resurrected with their Priority at defeat.   (Health is set according to each Heroe's skill/item effects.)  # Expected Debuffs are dispelled and skill cooldown is reset / Health rules remain the same as before / Changes in Priority for both PVE and PVP - PVE: Remains the same as before. - PVP: Adjustments will be made as follows  ㄴ Heroes will now be resurrected with 50% of their Priority at the time of defeat deducted       (This will be applied as the new Arena league buff effect)  ㄴ E.g. If a Hero's Priority is at 50% at the time of defeat, they will be resurrected with 25% Priority.

  
We anticipate that the above changes will likely reduce the PVP dominance of the  
Water Elemental Hero “Mene” compared to the past. Similarly, the application of the same logic to the Artifact "Resurrection Token," which can be used by Healers, will result in a certain decrease in dominance.However, in PVE, we will maintain the existing rules, and we hope that Mene, designed for use in higher difficulty/content, will continue to maintain her value as it stands today.

  
The new Arena league is scheduled to begin on 12/4,  
and these adjustment changes will be implemented in the form of buffs when the new Arena league starts. For stability reasons, these changes are planned to be applied after the 12/5 maintenance. Please note that these buffs will not be applied  on the league's starting day, 12/4.

3

Penalty for missing hits reduced.

  
While this mechanic is common in many games, in OUTERPLANE, the frequent occurrence of missed shots, influenced by hit/miss statistics, can make the game less enjoyable.  
Therefore, we have made the final decision to ease the penalty for missed shots. Since users have direct control over Accuracy/Evasion stats, we plan to primarily ease the penalty for missed shots, which we initially applied more rigorously. 1. Current Missed Hit Penalty   : No critical hits occur / Final damage reduced by 75% / No debuff effects from skills are applied2. Expected Missed Hit Penalty   : No critical hits occur / Final damage reduced by 50% / No debuff effects from skills are applied

11/21

4

The Probability of Missed Hits

  
To improve the player experience and reduce uncertainty in PVP matches,    
we have determined that it is necessary to adjust the frequency of missed hits to make the missed hit probability more predictable. The most significant issue at present is the relativity in stat comparisons, and the unpredictability of how often missed hits will occur during an attack. Therefore, we plan to adjust the maximum probability of missed hits as follows: 1. Current: Missed hits occur up to around 70% based on the lowest Accuracy/highest Evasion stats 2. Expected: Missed hits occur up to around 25% based on the lowest Accuracy/highest Evasion stats (When adding Heroes with Evasion, we plan to approach it by adding to the probability of missed hits.) In contrast to the maximum value in the mathematical domain, it is anticipated that Masters will experience a miss rate of approximately 0% to 15%. Consequently, the discomfort associated with missed hits is expected to be considerably alleviated compared to the previous setup. However, since the survival stats of most classes were based on the Evasion stat, particularly for Bruisers countering Strikers and Defenders relying heavily on the Evasion stat, an overall rebalancing of survival stats is being implemented. This will involve different adjustments in terms of bonuses and penalties for each class, and detailed information will be provided at the time of the update.

11/21

  
**2\. PVP Balance Adjustments** 

No. 

Category

Details

Effective date

1

PVP Buff (Duelist's Pledge)

  
The effect was introduced with the assumption that it would reduce excessively prolonged battles.  
It primarily applied to the attacking team, taking into account the inherent disadvantage of the defensive team. However, upon reviewing the complete dataset, it was found that the defensive team's success rate in defense was higher than expected. Consequently, it was determined that the effect did not need to be applied exclusively to the attacking team. It has already been adjusted in the first phase, delaying its initial occurrence. The adjustment is aimed at controlling situations where battles are prolonged. The penalty will be adjusted to affect all teams, and in the event that all participating Heroes on both sides die simultaneously, the victory will be awarded to the defensive team. 1. Damage Target: Current: Applied to offensive team only > Expected: Applied to all teams

12/5

2

PVP Buff (Exclusive League Buff)

  
After the balance adjustment update, a new asynchronous PVP league is scheduled to begin.  
As mentioned earlier, we are currently working on adjusting the PVP balance in the direction of reducing uncertainty. In particular, we have identified that the dual-stat computation structure of accuracy/evasion/effectiveness/effect resistance increases uncertainty when using Heroes with debuff effects, and imposes excessive usage constraints. We have considered the radical approach of completely removing effectiveness/effect resistance. However, since there is a possibility of these elements being used as pattern factors in higher-level dungeons in PVE, we have decided to apply league-exclusive buffs in a way that mitigates these conditions, particularly in PVP. Furthermore, please note that we plan to extend the league-exclusive buffs, which were previously only available in the Diamond tier and above, to the Gold tier and above. 1. Scheduled Buffs: Apply +n Effectiveness to all participants (Attack and Defense teams)   ㄴ We will assign an integer value to approach zero, with the aim of minimizing the expected        occurrence of Resistance for the target. As a result, \[Resistance\] will no longer be triggered, and it is expected to reduce unforeseeable variables. Additionally, there will be a significant reduction in the maximum evasion probability, contributing to an improvement of the basic logic.

12/5

   
**3\. Hero Balance Adjustments**

No. 

Category

Details

Effective date

1

Tio

  
While the presence of Silenced and Cooldown Reduction debuffers has already reduced the significance of skill burst 1-3,  
we have determined that the scenario where players can endlessly use these skills to withstand high-tier PVP does not offer a positive experience. Therefore, the following adjustments are being implemented. 1. Effect for Skill Burst Lv.1 of the skill, “This Shot Won't Hurt”, will be adjusted  ㄴ Current: Reduces “This Shot Won't Hurt” Cooldown by 2 turns  ㄴ Adjusted: Reduces “This Shot Won't Hurt” Cooldown by 1 turn

11/21

2

Eliza

  
In the Guild Raid, she is currently being utilized with Beth,  
but as she was originally intended to be a valuable asset in PVP, we are looking to enhance her potential for inclusion in offensive teams by making some minor adjustments. The use of debuffs in general has become more challenging due to the prevalence of immunity sets. Therefore, we intend to make some incremental improvements to the viability of using her as part of offensive teams until new Heroes that can dispell debuffs are introduced. 1. Adjustments will be made to certain effects for the skill “Bloody Roar”   ㄴ Current: Inflicts Bleeding on a random enemy for 2 turn(s) while ignoring Resilience.  ㄴ Adjusted: Inflicts Bleeding on the enemy with the highest speed for 2 turn(s)       while ignoring Resilience.

11/21

3

Rhona

  
We've realized that the Heroes obtained through area clear missions have significantly low utility, regardless of the acquisition difficulty.  
As a result, we plan to introduce changes to their exclusive equipment and certain skill effects to unlock new uses for them. This adjustment is designed to transform them into a health-based damage dealer with respectable speed, eliminating the need for a Critical Hit setup. Please refer to the changes at the time of the update.

11/21

4

Demiurge Astei

As a result of adjustments to the resurrection mechanism,  
certain aspects may be weakened compared to the previous state.  
Considering the acquisition difficulty and value of Demiurge Astei, we have raised the Priority increase upon resurrection. Consequently, there will be a slight improvement in PVE performance, while PVP performance will remain at its previous level. 1. Adjustments will be made to the Priority for the skill, “The People on Earth”  ㄴ Current: +50% Priority after Resurrection  ㄴ Adjusted: +80% Priority after Resurrection

12/5

5

Class Stat Adjustments

We are reevaluating stat values, including Health and Defense,  
which encompass Accuracy and Evasion, as part of an overall stat adjustment.  
This is being done to maintain the value of certain classes that consider Evasion a primary survival stat.(Class/The values will be individually applied based on the characteristics of each subclass.)We will provide detailed adjustment information through announcements in the Update notice.

11/21

  
**4\. Equipment Balance Adjustments**

No. 

Category

Details

Effective date

1

Legendary Gear Unique Effect

  
We have identified that certain Legendary equipment exhibit excessively high synergy  
when combined with specific Heroes or classes. Therefore, adjustments are being made to address this issue.Initially, adjustments will be made to the following category of equipment, and there is a possibility of further additions as we monitor the situation.

11/21

  
\# Blue-Gems White Ring / Legendary Accessory (Defender)  
1\. Current Unique Effect   : Has a \[80%\] chance to increase the Priority of the caster by \[15%\] when hit2. Expected Unique Effect   : Has a \[100%\] chance to increase the Priority of the caster by \[10%\] when hit     (Activated once per turn)

  
**5\. PVE Balance Adjustments**

No. 

Category

Details

Effective date

1

Base > Combat Calculation Module and Auto Combat

We have decided to remove the combat calculation module in the Base that upgrades the functionality of auto combat as it is deemed unnecessary and has become a barrier to early progression.  
Consequently, this feature will be eliminated, and auto combat will be enhanced to offer a more streamlined and definitive auto combat experience.(Burst/Skill Chain use and Battle settings)

11/7

2

Boss Monster difficulty level

\# Difficulty level reduction for certain area bosses/gimmicks   
1) 2-11 : Core Guardian  
2) 3-11 : Forest King 3) 4-5 : Veronica 4) 4-11 : Schwartz5) Hardmode Adventure 10-6: Demiurge Stella     (There is a certain failure rate in dungeons that are led by a story team.     Hence, we will be enhancing the stats of NPC in these dungeons.)

 

* * *

In this 5th Developer’s Note,  
we would like to provide you with details about the balance elements that will be adjusted in this year's update.  
Starting with this balance adjustment, we plan to review overall data approximately every three months and implement balance patches accordingly. We will provide further details through separate announcements once the schedule is confirmed. Please note that regardless of the overall direction of the adjustments, we will offer compensation to Masters who have already acquired and been using these Heroes. Furthermore, as mentioned in the previous Developer's Note, we are actively preparing for real-time PVP, with a targeted release in December.We hope that you will look forward to this upcoming Update.**\[Developer’s Note Celebration Gifts\]**  
\- **Coupon Code**: OUTERNOTE5  
\- **Coupon Redemption Period**: 11/06 (Mon) ~ 12/07 (Thu) 14:59 UTC  
\- **Coupon Rewards**: 500 Ether  
  
This is all we have prepared for you for the 5th Developer’s Note.We will continuously strive to create a more enjoyable environment for our Masters.Thank you.
