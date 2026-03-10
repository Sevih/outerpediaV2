import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { Lang } from '@/lib/i18n/config';
import type { EventDef } from '../types';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const i18n = {
  en: {
    intro:
      'Calling all creators new and seasoned! Outerpedia is hosting a gallery for fan-made content — hero introductions, showcases, guides, and entertainment! Send us your videos to help us add more flair to the space!',
    publisherNote:
      "The EvaMains team has received gifts to share with the community from OUTERPLANE's new publisher,",
    prizes: 'The Prizes',
    prizeAll: 'All players:',
    prizeCoupon: 'Coupon Code',
    prize1st: '1st place:',
    prize2nd: '2nd–3rd place:',
    prize4th: '4th–10th place:',
    prizeLucky: '8 lucky participants will receive',
    prizeCreators: 'All creators: A place to share your content on Outerpedia',
    theme: 'The Theme',
    themeIntroTitle: 'Complete Introduction!',
    themeIntroDesc:
      "Outerplane's official channel already has skill introduction videos for many 3-star heroes, but there's more to them than that. Show off their lobby poses, expressions, costumes, best voice lines, and more!",
    themeShowcaseTitle: 'Showcase!',
    themeShowcaseDesc:
      'How do we build our heroes? What can they really accomplish? Special Request, Irregulars, Adventurer License, Arena — anything goes!',
    themeActionTitle: 'Lights, Camera, Action!',
    themeActionDesc:
      "Funny lobby compositions, meme teams, fanfiction — it's a game, have fun with it!",
    timeline: 'Timeline',
    timelineDeadline: 'Submission deadline:',
    timelineDeadlineDate: 'February 01 (00:00 UTC)',
    timelineVote: 'Community vote & final tally:',
    timelineVoteDate: 'February 14 (00:00 UTC)',
    timelinePrize: 'Prize distribution (target):',
    timelinePrizeDate: 'February 28 (UTC)',
    timelineNote:
      "Submissions will remain open after the deadline to be featured in Outerpedia's upcoming Gallery.",
    rules: 'Rules',
    ruleFootage: 'Only use in-game footage in the video.',
    ruleFacecam: 'Face cam is allowed for guide content.',
    ruleVoice: 'Any hero voice-over language is allowed.',
    ruleLength: 'Video length between 50 and 600 seconds.',
    ruleHosting:
      'Videos must be hosted on YouTube, Twitch, or Bilibili. Direct file uploads are not accepted.',
    ruleVerify:
      'Add "Outerpedia video event 2026 – <Your Nickname>" to the description or pinned comment to verify your submission.',
    ruleExisting: 'Existing videos are accepted too!',
    rulePrizeDist:
      'Prizes will be distributed as a Coupon Code (provided by Major9), so please ensure we can contact you.',
    ruleGallery:
      "Videos (prize-winning or not) may be linked in Outerpedia's gallery, with creator consent.",
    ruleMirror:
      "Videos can remain hosted on your own channel. YouTube videos can optionally be mirrored on Outerpedia's YouTube channel — your choice.",
    ruleOfficial:
      'The OUTERPLANE team is watching! Major9 may contact participants to feature their videos on the official OUTERPLANE YouTube channel, or use them in future promotions.',
    ruleDisqualify:
      "Submissions may be disqualified if not submitted by the original creator, or if they include content not suitable for OUTERPLANE's age rating. Contact the EvaMains Discord admins for disputes.",
    entries: 'Event Entries',
    entriesDesc: 'Please tell us where to find your submission using the form below:',
    entriesButton: 'Submit your Entry',
  },
  jp: {
    intro:
      '新人もベテランもクリエイター大集合！Outerpediaがファン制作コンテンツのギャラリーを開催します — ヒーロー紹介、ショーケース、ガイド、エンタメ！動画を送ってスペースを盛り上げよう！',
    publisherNote:
      'EvaMainsチームはOUTERPLANEの新パブリッシャーからコミュニティへのプレゼントを受け取りました、',
    prizes: '賞品',
    prizeAll: '全プレイヤー：',
    prizeCoupon: 'クーポンコード',
    prize1st: '1位：',
    prize2nd: '2～3位：',
    prize4th: '4～10位：',
    prizeLucky: '抽選で8名に',
    prizeCreators: '全クリエイター：Outerpediaにコンテンツを掲載',
    theme: 'テーマ',
    themeIntroTitle: '完全紹介！',
    themeIntroDesc:
      'Outerplaneの公式チャンネルには多くの3つ星ヒーローのスキル紹介動画がありますが、それだけではありません。ロビーポーズ、表情、コスチューム、ベストボイスなどを見せてください！',
    themeShowcaseTitle: 'ショーケース！',
    themeShowcaseDesc:
      'ヒーローをどう育成する？彼らの本当の実力は？特別依頼、イレギュラーズ、冒険者ライセンス、アリーナ — 何でもOK！',
    themeActionTitle: 'ライト、カメラ、アクション！',
    themeActionDesc:
      '面白いロビー構成、ミームチーム、ファンフィクション — ゲームだから楽しもう！',
    timeline: 'スケジュール',
    timelineDeadline: '提出期限：',
    timelineDeadlineDate: '2月1日 (00:00 UTC)',
    timelineVote: 'コミュニティ投票＆最終集計：',
    timelineVoteDate: '2月14日 (00:00 UTC)',
    timelinePrize: '賞品配布（予定）：',
    timelinePrizeDate: '2月28日 (UTC)',
    timelineNote:
      '締め切り後もOuterpediaのギャラリーに掲載するための提出を受け付けます。',
    rules: 'ルール',
    ruleFootage: '動画にはゲーム内の映像のみを使用してください。',
    ruleFacecam: 'ガイドコンテンツではフェイスカメラの使用が許可されています。',
    ruleVoice: 'ヒーローのボイスオーバー言語は問いません。',
    ruleLength: '動画の長さは50～600秒。',
    ruleHosting:
      '動画はYouTube、Twitch、またはBilibiliでホストする必要があります。ファイルの直接アップロードは受け付けていません。',
    ruleVerify:
      '「Outerpedia video event 2026 – <あなたのニックネーム>」を説明文または固定コメントに追加してください。',
    ruleExisting: '既存の動画も受け付けます！',
    rulePrizeDist:
      '賞品はクーポンコード（Major9提供）として配布されますので、連絡が取れるようにしてください。',
    ruleGallery:
      '動画（受賞作品かどうかに関わらず）はクリエイターの同意の上、Outerpediaのギャラリーにリンクされる場合があります。',
    ruleMirror:
      '動画はご自身のチャンネルでホストしたままで構いません。YouTube動画はOuterpediaのYouTubeチャンネルにミラーリングすることもできます。',
    ruleOfficial:
      'OUTERPLANEチームも注目しています！Major9が公式OUTERPLANEYouTubeチャンネルでの掲載や今後のプロモーションへの使用について連絡する場合があります。',
    ruleDisqualify:
      'オリジナルのクリエイター以外からの提出、またはOUTERPLANEの年齢制限に適さないコンテンツを含む場合、失格となる場合があります。異議はEvaMains Discordの管理者にお問い合わせください。',
    entries: 'エントリー',
    entriesDesc: '以下のフォームから提出先をお知らせください：',
    entriesButton: 'エントリーを提出',
  },
  kr: {
    intro:
      '신인부터 베테랑까지 모든 크리에이터 여러분! Outerpedia가 팬 제작 콘텐츠 갤러리를 개최합니다 — 히어로 소개, 쇼케이스, 가이드, 엔터테인먼트! 영상을 보내 공간을 더 멋지게 만들어주세요!',
    publisherNote:
      'EvaMains 팀은 OUTERPLANE의 새 퍼블리셔로부터 커뮤니티와 나눌 선물을 받았습니다,',
    prizes: '상품',
    prizeAll: '전체 플레이어:',
    prizeCoupon: '쿠폰 코드',
    prize1st: '1등:',
    prize2nd: '2~3등:',
    prize4th: '4~10등:',
    prizeLucky: '행운의 8명에게',
    prizeCreators: '모든 크리에이터: Outerpedia에 콘텐츠 게재',
    theme: '테마',
    themeIntroTitle: '완전 소개!',
    themeIntroDesc:
      'Outerplane 공식 채널에는 많은 3성 히어로의 스킬 소개 영상이 있지만, 그게 전부가 아닙니다. 로비 포즈, 표정, 코스튬, 최고의 보이스 등을 보여주세요!',
    themeShowcaseTitle: '쇼케이스!',
    themeShowcaseDesc:
      '히어로를 어떻게 육성하나요? 그들이 정말로 달성할 수 있는 것은? 특별 의뢰, 이레귤러즈, 모험가 라이선스, 아레나 — 무엇이든 OK!',
    themeActionTitle: '라이트, 카메라, 액션!',
    themeActionDesc:
      '재미있는 로비 구성, 밈 팀, 팬픽션 — 게임이니까 즐기세요!',
    timeline: '일정',
    timelineDeadline: '제출 마감:',
    timelineDeadlineDate: '2월 1일 (00:00 UTC)',
    timelineVote: '커뮤니티 투표 & 최종 집계:',
    timelineVoteDate: '2월 14일 (00:00 UTC)',
    timelinePrize: '상품 배포 (예정):',
    timelinePrizeDate: '2월 28일 (UTC)',
    timelineNote:
      '마감 후에도 Outerpedia 갤러리 게재를 위한 제출은 계속 받습니다.',
    rules: '규칙',
    ruleFootage: '영상에는 게임 내 화면만 사용하세요.',
    ruleFacecam: '가이드 콘텐츠에는 페이스캠이 허용됩니다.',
    ruleVoice: '히어로 보이스오버 언어는 무엇이든 가능합니다.',
    ruleLength: '영상 길이는 50~600초.',
    ruleHosting:
      '영상은 YouTube, Twitch 또는 Bilibili에 호스팅해야 합니다. 파일 직접 업로드는 불가합니다.',
    ruleVerify:
      '"Outerpedia video event 2026 – <닉네임>"을 설명란 또는 고정 댓글에 추가하세요.',
    ruleExisting: '기존 영상도 제출 가능합니다!',
    rulePrizeDist:
      '상품은 쿠폰 코드(Major9 제공)로 배포되므로 연락 가능한 상태를 유지해주세요.',
    ruleGallery:
      '영상(수상 여부와 관계없이)은 크리에이터 동의 하에 Outerpedia 갤러리에 링크될 수 있습니다.',
    ruleMirror:
      '영상은 본인 채널에서 호스팅한 채로 유지할 수 있습니다. YouTube 영상은 선택적으로 Outerpedia YouTube 채널에 미러링할 수 있습니다.',
    ruleOfficial:
      'OUTERPLANE 팀이 지켜보고 있습니다! Major9가 공식 OUTERPLANE YouTube 채널 게재 또는 향후 프로모션에 사용하기 위해 연락할 수 있습니다.',
    ruleDisqualify:
      '원본 크리에이터가 아닌 사람이 제출하거나, OUTERPLANE 연령 등급에 적합하지 않은 콘텐츠가 포함된 경우 실격될 수 있습니다. 이의 제기는 EvaMains Discord 관리자에게 문의하세요.',
    entries: '참가 작품',
    entriesDesc: '아래 양식을 통해 제출물의 위치를 알려주세요:',
    entriesButton: '참가 제출',
  },
  zh: {
    intro:
      '召集所有新老创作者！Outerpedia正在举办粉丝创作内容画廊 — 英雄介绍、展示、攻略和娱乐！发送你的视频，帮助我们让空间更加精彩！',
    publisherNote:
      'EvaMains团队从OUTERPLANE的新发行商收到了与社区分享的礼物，',
    prizes: '奖品',
    prizeAll: '所有玩家：',
    prizeCoupon: '优惠码',
    prize1st: '第1名：',
    prize2nd: '第2~3名：',
    prize4th: '第4~10名：',
    prizeLucky: '8位幸运参与者将获得',
    prizeCreators: '所有创作者：在Outerpedia展示你的内容',
    theme: '主题',
    themeIntroTitle: '完整介绍！',
    themeIntroDesc:
      'Outerplane官方频道已经有许多3星英雄的技能介绍视频，但他们的魅力远不止于此。展示他们的大厅姿势、表情、服装、最佳台词等！',
    themeShowcaseTitle: '展示！',
    themeShowcaseDesc:
      '我们如何培养英雄？他们真正能做到什么？特别委托、异常者、冒险家执照、竞技场 — 什么都行！',
    themeActionTitle: '灯光、摄影、开拍！',
    themeActionDesc:
      '有趣的大厅组合、梗队、同人小说 — 这是游戏，尽情享受吧！',
    timeline: '时间线',
    timelineDeadline: '提交截止：',
    timelineDeadlineDate: '2月1日 (00:00 UTC)',
    timelineVote: '社区投票和最终统计：',
    timelineVoteDate: '2月14日 (00:00 UTC)',
    timelinePrize: '奖品发放（预计）：',
    timelinePrizeDate: '2月28日 (UTC)',
    timelineNote:
      '截止日期后仍可提交，以便在Outerpedia即将推出的画廊中展示。',
    rules: '规则',
    ruleFootage: '视频中只能使用游戏内画面。',
    ruleFacecam: '攻略内容允许使用面部摄像头。',
    ruleVoice: '英雄配音语言不限。',
    ruleLength: '视频长度在50至600秒之间。',
    ruleHosting:
      '视频必须托管在YouTube、Twitch或Bilibili上。不接受直接文件上传。',
    ruleVerify:
      '请在描述或置顶评论中添加"Outerpedia video event 2026 – <你的昵称>"以验证你的提交。',
    ruleExisting: '现有视频也可以参加！',
    rulePrizeDist:
      '奖品将以优惠码（由Major9提供）的形式发放，请确保我们能联系到你。',
    ruleGallery:
      '视频（无论是否获奖）经创作者同意后可在Outerpedia画廊中链接。',
    ruleMirror:
      '视频可以继续托管在你自己的频道。YouTube视频可以选择性地镜像到Outerpedia的YouTube频道。',
    ruleOfficial:
      'OUTERPLANE团队在关注！Major9可能会联系参与者，将其视频展示在OUTERPLANE官方YouTube频道或用于未来推广。',
    ruleDisqualify:
      '如果不是原创作者提交，或包含不适合OUTERPLANE年龄分级的内容，提交可能会被取消资格。争议请联系EvaMains Discord管理员。',
    entries: '参赛作品',
    entriesDesc: '请通过以下表格告诉我们你的提交在哪里：',
    entriesButton: '提交参赛作品',
  },
} as const satisfies Record<Lang, Record<string, string>>;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const Page = () => {
  const { lang } = useI18n();
  const l = i18n[lang];

  return (
    <div className="space-y-10 text-zinc-200">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <p className="leading-relaxed text-zinc-300">{l.intro}</p>
        <p className="text-zinc-400">
          {l.publisherNote} <strong className="text-white">Major9</strong>!
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-2xl font-bold">{l.prizes}</h3>
        <ul className="list-disc space-y-1 pl-6 text-zinc-300">
          <li>{l.prizeAll} <strong>{l.prizeCoupon}</strong></li>
          <li>{l.prize1st} <strong>10 000 <ItemInline name="Free Ether" /></strong></li>
          <li>{l.prize2nd} <strong>6 000 <ItemInline name="Free Ether" /></strong></li>
          <li>{l.prize4th} <strong>3 000 <ItemInline name="Free Ether" /></strong></li>
          <li>{l.prizeLucky} <strong>3 000 <ItemInline name="Free Ether" /></strong></li>
          <li>{l.prizeCreators}</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-2xl font-bold">{l.theme}</h3>
        <div className="space-y-4 text-zinc-300">
          <div>
            <p className="font-semibold text-white">{l.themeIntroTitle}</p>
            <p>{l.themeIntroDesc}</p>
          </div>
          <div>
            <p className="font-semibold text-white">{l.themeShowcaseTitle}</p>
            <p>{l.themeShowcaseDesc}</p>
          </div>
          <div>
            <p className="font-semibold text-white">{l.themeActionTitle}</p>
            <p>{l.themeActionDesc}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-2xl font-bold">{l.timeline}</h3>
        <ul className="list-disc space-y-1 pl-6 text-zinc-300">
          <li>{l.timelineDeadline} <strong>{l.timelineDeadlineDate}</strong></li>
          <li>{l.timelineVote} <strong>{l.timelineVoteDate}</strong></li>
          <li>{l.timelinePrize} <strong>{l.timelinePrizeDate}</strong></li>
        </ul>
        <p className="mt-2 text-zinc-400">{l.timelineNote}</p>
      </section>

      <section>
        <h3 className="mb-3 text-2xl font-bold">{l.rules}</h3>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-zinc-300">
          <li>{l.ruleFootage}</li>
          <li>{l.ruleFacecam}</li>
          <li>{l.ruleVoice}</li>
          <li>{l.ruleLength}</li>
          <li>{l.ruleHosting}</li>
          <li>{l.ruleVerify}</li>
          <li>{l.ruleExisting}</li>
          <li>{l.rulePrizeDist}</li>
          <li>{l.ruleGallery}</li>
          <li>{l.ruleMirror}</li>
          <li>{l.ruleOfficial}</li>
          <li>{l.ruleDisqualify}</li>
        </ul>
      </section>

      <section className="space-y-3 text-center">
        <h3 className="text-2xl font-bold">{l.entries}</h3>
        <p className="text-zinc-300">{l.entriesDesc}</p>
        <a
          href="https://forms.gle/your-form-link"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500"
        >
          {l.entriesButton}
        </a>
      </section>
    </div>
  );
};

export default {
  meta: {
    slug: '20260201-video',
    title: {
      en: 'Hero Video Event - Feb. 2026',
      jp: 'ヒーロー動画イベント - 2026年2月',
      kr: '히어로 영상 이벤트 - 2026년 2월',
      zh: '英雄视频活动 - 2026年2月',
    },
    cover: '/images/events/default.webp',
    type: 'contest',
    organizer: 'Outerpedia / EvaMains',
    start: '2026-02-01T00:00:00Z',
    end: '2026-02-14T00:00:00Z',
  },
  Page,
} satisfies EventDef;
