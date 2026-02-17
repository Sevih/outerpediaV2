import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import parseText from '@/lib/parse-text';

const DEMO_TEXT =
  'In Outerplane, each hero has an Element like {E/Fire} and a Class like {C/Ranger}. ' +
  'Stats such as {S/ATK} and {S/SPD} determine combat performance. ' +
  'Buffs like {B/BT_STAT|ST_ATK} boost your team, while debuffs like {D/BT_DOT_BURN} punish enemies over time. ' +
  'Equip your heroes with weapons like {I-W/Surefire Greatsword}, amulets like {I-A/Death\'s Hold}, ' +
  'talismans like {I-T/Executioner\'s Charm}, and armor sets like {AS/Attack Set} for maximum power. ' +
  'Some heroes like {P/Valentine} have powerful skills such as {SK/Valentine|S3} and unique exclusive equipment like {EE/Valentine}. ' +
  'Don\'t forget to use items like {I-I/Sandwich} to keep your team going!\n' +
  'Portrait crop test: {P/Edelweiss}, {P/Demiurge Vlada}, {P/Kitsune of Eternity Tamamo-no-Mae}, ' +
  '{P/Vlada}, {P/Kuro}, {P/Tamamo-no-Mae}, {P/Maxie}, {P/Monad Eva}.';

const GUIDES = [
  { key: 'faq', nameKey: 'home.beginner.faq', descKey: 'home.beginner.faq.desc' },
  { key: 'freeheroes', nameKey: 'home.beginner.freeheroes', descKey: 'home.beginner.freeheroes.desc' },
  { key: 'stats', nameKey: 'home.beginner.stats', descKey: 'home.beginner.stats.desc' },
  { key: 'gear', nameKey: 'home.beginner.gear', descKey: 'home.beginner.gear.desc' },
  { key: 'growth', nameKey: 'home.beginner.growth', descKey: 'home.beginner.growth.desc' },
] as const;

type Props = {
  lang: Lang;
  t: Messages;
};

export default function BeginnerGuides({ t }: Props) {
  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.beginner']}</h2>
      <div className="card-light p-5 md:p-6">
        <p className="mb-4 text-sm text-zinc-400">{t['home.beginner.desc']}</p>
        <ul className="space-y-2 text-sm">
          {GUIDES.map((guide) => (
            <li key={guide.key}>
              <span className="font-semibold text-white">
                {t[guide.nameKey]}
              </span>{' '}
              <span className="text-zinc-400">
                &mdash; {t[guide.descKey]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs italic text-zinc-500">
          {t['home.beginner.footer']}
        </p>

        {/* Inline components demo */}
        <div className="mt-6 border-t border-white/5 pt-4">
          <p className="text-sm leading-relaxed text-zinc-300">
            {parseText(DEMO_TEXT)}
          </p>
        </div>
      </div>
    </section>
  );
}
