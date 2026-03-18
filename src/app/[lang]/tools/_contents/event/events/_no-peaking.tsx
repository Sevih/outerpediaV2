import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { Lang } from '@/lib/i18n/config';
import type { EventDef } from '../types';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const i18n = {
  en: {
    notSupposed: "You weren't supposed to find this page.",
    nothing:
      "There's nothing to see here. No event. No secret. Definitely not a hidden test for something coming soon.",
    goPlay: '(Seriously, go play the game or check the',
    homepage: 'homepage',
    goPlayEnd: '.)',
    confidential: 'Confidential Area',
    restricted:
      'Access restricted to Outerpedia Admins, Cats, and Possibly Space Jellyfish. Unauthorized reading may result in mild disappointment.',
    mysterious:
      "(A mysterious force prevents you from going further. Maybe it's the dev's coffee break.)",
    footer:
      "© 2025 Outerpedia — All leaks are imaginary. No rewards will be distributed for finding this page. Probably.",
  },
  jp: {
    notSupposed: 'このページを見つけるはずではなかったのに。',
    nothing:
      'ここには何もありません。イベントもなし。秘密もなし。近日公開予定の隠しテストでもありません。',
    goPlay: '（マジで、ゲームをプレイするか',
    homepage: 'ホームページ',
    goPlayEnd: 'をチェックしてください。）',
    confidential: '機密エリア',
    restricted:
      'Outerpedia管理者、猫、そしておそらく宇宙クラゲのみアクセス可能。無断閲覧は軽い失望を招く可能性があります。',
    mysterious:
      '（謎の力がこれ以上進むことを阻んでいます。開発者のコーヒーブレイクかもしれません。）',
    footer:
      '© 2025 Outerpedia — すべてのリークは架空のものです。このページを見つけても報酬はありません。たぶん。',
  },
  kr: {
    notSupposed: '이 페이지를 찾으면 안 되는 건데.',
    nothing:
      '여기엔 아무것도 없습니다. 이벤트도 없고. 비밀도 없고. 곧 나올 무언가의 숨겨진 테스트도 절대 아닙니다.',
    goPlay: '(진지하게, 게임을 하거나',
    homepage: '홈페이지',
    goPlayEnd: '를 확인하세요.)',
    confidential: '기밀 구역',
    restricted:
      'Outerpedia 관리자, 고양이, 그리고 아마도 우주 해파리만 접근 가능. 무단 열람 시 가벼운 실망이 발생할 수 있습니다.',
    mysterious:
      '(신비로운 힘이 더 나아가는 것을 막고 있습니다. 아마 개발자의 커피 브레이크일 겁니다.)',
    footer:
      '© 2025 Outerpedia — 모든 유출은 상상입니다. 이 페이지를 찾아도 보상은 없습니다. 아마도.',
  },
  zh: {
    notSupposed: '你不应该找到这个页面的。',
    nothing:
      '这里什么都没有。没有活动。没有秘密。绝对不是即将推出的东西的隐藏测试。',
    goPlay: '（说真的，去玩游戏或者看看',
    homepage: '首页',
    goPlayEnd: '。）',
    confidential: '机密区域',
    restricted:
      '仅限Outerpedia管理员、猫和可能存在的太空水母访问。未经授权的阅读可能导致轻微失望。',
    mysterious:
      '（一股神秘的力量阻止你继续前进。也许是开发者的咖啡休息时间。）',
    footer:
      '© 2025 Outerpedia — 所有泄露均为虚构。找到此页面不会获得任何奖励。大概。',
  },
} as const satisfies Record<Lang, Record<string, string>>;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const Page = () => {
  const { lang } = useI18n();
  const l = i18n[lang];

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <p className="text-zinc-300">{l.notSupposed}</p>

      <section className="space-y-4">
        <p className="text-zinc-400">{l.nothing}</p>
        <p className="italic text-zinc-500">
          {l.goPlay}{' '}
          <Link href="/" className="underline hover:text-rose-400">
            {l.homepage}
          </Link>
          {l.goPlayEnd}
        </p>
      </section>

      <section className="mt-10">
        <h3 className="mb-2 text-lg font-semibold text-white">{l.confidential}</h3>
        <p className="text-zinc-400">{l.restricted}</p>
        <p className="mt-2 text-sm text-zinc-500">{l.mysterious}</p>
      </section>

      <footer className="border-t border-white/10 pt-6 text-xs text-zinc-600">
        <p>{l.footer}</p>
      </footer>
    </div>
  );
};

export default {
  meta: {
    slug: '_no-peaking',
    title: {
      en: 'Get out of here',
      jp: 'ここから出て',
      kr: '여기서 나가',
      zh: '快离开这里',
    },
    cover: '/images/events/gtfo.webp',
    type: 'community',
    organizer: 'Outerpedia',
    start: '2025-10-09T00:00:00Z',
    end: '2025-10-15T23:59:59Z',
  },
  Page,
} satisfies EventDef;
