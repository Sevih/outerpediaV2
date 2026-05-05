import Image from 'next/image';
import ItemInline from '@/app/components/inline/ItemInline';
import MultiVideoEmbed, { type VideoItem } from '@/app/components/ui/MultiVideoEmbed';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { Lang } from '@/lib/i18n/config';
import type { EventDef } from '../types';

// ---------------------------------------------------------------------------
// Results data — fill in once winners are known
// ---------------------------------------------------------------------------

type ResultEntry = {
  author: string;
  platform: VideoItem['platform'];
  videoId: string;
  title: string;
};

const podium: [ResultEntry | null, ResultEntry | null, ResultEntry | null] = [
  { author: '39_mikulove', platform: 'youtube', videoId: 'pIQNseGWDBg', title: 'Snow - Outerpedia Event' },
  { author: 'SkyNova', platform: 'youtube', videoId: 'G1AvFRJFVSE', title: 'OUTERPLANE RTA TACTICS LEAGUE: REVIEW' },
  { author: 'adjen', platform: 'youtube', videoId: 'v_6s_T5hTG0', title: 'Gnosis Domine Guide & Review! [ Outerplane ]' },
];

const otherEntries: ResultEntry[] = [
  { author: 'Hiragami', platform: 'youtube', videoId: 'e2r-aoutmgs', title: 'Outerplane: Poison Goes BOOM BOOM!' },
  { author: 'puyotchi#8704', platform: 'youtube', videoId: 'On_dL9Cbfwo', title: '【アウタープレーン】キャラの必殺技を合体攻撃風にしてみた' },
  { author: 'wintrydance', platform: 'bilibili', videoId: 'BV11EXHBNEt2', title: '游戏开荒攻略：异域战记。主角色配队与自动推图' },
  { author: 'yu__zzi', platform: 'youtube', videoId: 'MhQAqceZV0Q', title: "[아우터플레인] 역대급 사기캐 '그노시스 도미네' 등장! | 성능 및 나홀로 결투장" },
  { author: 'elara301', platform: 'bilibili', videoId: 'BV1aKXGBHEhA', title: '【异域战记】实用小技巧之皮肤篇' },
  { author: '엘유#5059', platform: 'youtube', videoId: 'Gu6hNcjORfQ', title: "[아우터 플레인 / OUTERPLANE ] 간?단하게 신규 동료 그노시스 도미네 간단하게 살펴보는 영상 'ㅂ')/" },
];

const hasResults = podium.some(Boolean) || otherEntries.length > 0;

function getVideoUrl({ platform, videoId }: ResultEntry): string {
  switch (platform) {
    case 'youtube':
      return `https://youtu.be/${videoId}`;
    case 'twitch':
      return `https://www.twitch.tv/videos/${videoId}`;
    case 'bilibili':
      return `https://www.bilibili.com/video/${videoId}`;
  }
}

function getThumbnailUrl(entry: ResultEntry): string | null {
  if (entry.platform === 'youtube') {
    return `https://img.youtube.com/vi/${entry.videoId}/hqdefault.jpg`;
  }
  return null;
}

function toVideoItem(entry: ResultEntry): VideoItem {
  return {
    platform: entry.platform,
    id: entry.videoId,
    title: entry.title,
    author: entry.author,
  };
}

function VideoCard({ entry }: { entry: ResultEntry }) {
  const thumb = getThumbnailUrl(entry);
  return (
    <a
      href={getVideoUrl(entry)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-800/40 transition hover:border-rose-500/40 hover:bg-zinc-800/60"
    >
      <div className="relative aspect-video w-full bg-zinc-900">
        {thumb ? (
          <Image
            src={thumb}
            alt={entry.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-zinc-500">
            {entry.platform}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-sm font-medium text-zinc-100 group-hover:text-rose-300">
          {entry.title}
        </span>
        <span className="text-xs text-zinc-400">{entry.author}</span>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const i18n = {
  en: {
    intro:
      'Calling all creators new and seasoned! Outerpedia is hosting a gallery for fan-made content — hero introductions, showcases, guides, and entertainment! Send us your videos to help us add more flair to the space!',
    publisherNote:
      "The EvaMains team has received gifts to share with the community from OUTERPLANE's new publisher, Major9 and support from VAGAMES!",
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
      'How do we build our heroes? What can they really accomplish? Special Request, Irregulars, Adventurer License, Arena, RTA — anything goes!',
    themeActionTitle: 'Lights, Camera, Action!',
    themeActionDesc:
      "Funny lobby compositions, meme teams, fanfiction — it's a game, have fun with it!",
    timeline: 'Timeline',
    timelineOpen: 'Submissions open:',
    timelineOpenDate: 'March 24 (00:00 UTC)',
    timelineDeadline: 'Submission deadline:',
    timelineDeadlineDate: 'April 28 (00:00 UTC)',
    timelineVote: 'Community vote & final tally:',
    timelineVoteDate: 'May 05 (00:00 UTC)',
    timelinePrize: 'Prize distribution (target):',
    timelinePrizeDate: 'May 12 (UTC)',
    timelineAnniversary: "This event coincides with Outerpedia's 1st anniversary on April 29 — celebrate with us!",
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
      'The OUTERPLANE team is watching! Major9 or VAGAMES may contact participants to feature their videos on the official OUTERPLANE YouTube channel, or use them in future promotions.',
    ruleDisqualify:
      "Submissions may be disqualified if not submitted by the original creator, or if they include content not suitable for OUTERPLANE's age rating. Contact the EvaMains Discord admins for disputes.",
    entries: 'Event Entries',
    entriesDesc: 'Please tell us where to find your submission using the form below:',
    entriesButton: 'Submit your Entry',
    results: 'Results',
    resultsIntro: 'The hero video event has now ended! Every one of the 9 participants receives an extra 3 000 ether coupon in addition to their prize.',
    podium1st: '1st place',
    podium2nd: '2nd place',
    podium3rd: '3rd place',
    otherEntries: 'Other Entries',
    rickShoutoutPrefix: "Special shoutout to everyone's honorary hero, ",
    rickShoutoutSuffix: '!',
    pendingVideos: "For video projects that weren't ready in time, Outerpedia will still feature them once completed.",
    couponNotePrefix: "Don't forget to redeem coupon code",
    couponNoteSuffix: '— available to all players. Sevih will distribute prize coupon codes to participants via Discord, so make sure he can reach you.',
  },
  jp: {
    intro:
      '新人もベテランもクリエイター大集合！Outerpediaがファン制作コンテンツのギャラリーを開催します — ヒーロー紹介、ショーケース、ガイド、エンタメ！動画を送ってスペースを盛り上げよう！',
    publisherNote:
      'EvaMainsチームはOUTERPLANEの新パブリッシャーMajor9とVAGAMESの支援により、コミュニティへのプレゼントを受け取りました！',
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
      'ヒーローをどう育成する？彼らの本当の実力は？特別依頼、イレギュラーズ、冒険者ライセンス、アリーナ、RTA — 何でもOK！',
    themeActionTitle: 'ライト、カメラ、アクション！',
    themeActionDesc:
      '面白いロビー構成、ミームチーム、ファンフィクション — ゲームだから楽しもう！',
    timeline: 'スケジュール',
    timelineOpen: '提出開始：',
    timelineOpenDate: '3月24日 (00:00 UTC)',
    timelineDeadline: '提出期限：',
    timelineDeadlineDate: '4月28日 (00:00 UTC)',
    timelineVote: 'コミュニティ投票＆最終集計：',
    timelineVoteDate: '5月5日 (00:00 UTC)',
    timelinePrize: '賞品配布（予定）：',
    timelinePrizeDate: '5月12日 (UTC)',
    timelineAnniversary: 'このイベントはOuterpediaの1周年記念（4月29日）と重なります — 一緒にお祝いしましょう！',
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
      'OUTERPLANEチームも注目しています！Major9またはVAGAMESが公式OUTERPLANEYouTubeチャンネルでの掲載や今後のプロモーションへの使用について連絡する場合があります。',
    ruleDisqualify:
      'オリジナルのクリエイター以外からの提出、またはOUTERPLANEの年齢制限に適さないコンテンツを含む場合、失格となる場合があります。異議はEvaMains Discordの管理者にお問い合わせください。',
    entries: 'エントリー',
    entriesDesc: '以下のフォームから提出先をお知らせください：',
    entriesButton: 'エントリーを提出',
    results: '結果',
    resultsIntro: 'ヒーロー動画イベントが終了しました！9名の参加者全員が、賞品とは別に3 000エーテルのクーポンを追加で受け取ります。',
    podium1st: '1位',
    podium2nd: '2位',
    podium3rd: '3位',
    otherEntries: 'その他のエントリー',
    rickShoutoutPrefix: 'みんなの名誉ヒーロー、',
    rickShoutoutSuffix: 'に特別な感謝を！',
    pendingVideos: '間に合わなかった動画プロジェクトも、完成次第Outerpediaで紹介します。',
    couponNotePrefix: 'クーポンコードの引き換えをお忘れなく',
    couponNoteSuffix: '— 全プレイヤー対象。賞品クーポンコードはSevihがDiscordで配布しますので、連絡が取れるようにしてください。',
  },
  kr: {
    intro:
      '신인부터 베테랑까지 모든 크리에이터 여러분! Outerpedia가 팬 제작 콘텐츠 갤러리를 개최합니다 — 히어로 소개, 쇼케이스, 가이드, 엔터테인먼트! 영상을 보내 공간을 더 멋지게 만들어주세요!',
    publisherNote:
      'EvaMains 팀은 OUTERPLANE의 새 퍼블리셔 Major9와 VAGAMES의 지원으로 커뮤니티와 나눌 선물을 받았습니다!',
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
      '히어로를 어떻게 육성하나요? 그들이 정말로 달성할 수 있는 것은? 특별 의뢰, 이레귤러즈, 모험가 라이선스, 아레나, RTA — 무엇이든 OK!',
    themeActionTitle: '라이트, 카메라, 액션!',
    themeActionDesc:
      '재미있는 로비 구성, 밈 팀, 팬픽션 — 게임이니까 즐기세요!',
    timeline: '일정',
    timelineOpen: '제출 시작:',
    timelineOpenDate: '3월 24일 (00:00 UTC)',
    timelineDeadline: '제출 마감:',
    timelineDeadlineDate: '4월 28일 (00:00 UTC)',
    timelineVote: '커뮤니티 투표 & 최종 집계:',
    timelineVoteDate: '5월 5일 (00:00 UTC)',
    timelinePrize: '상품 배포 (예정):',
    timelinePrizeDate: '5월 12일 (UTC)',
    timelineAnniversary: '이 이벤트는 Outerpedia 1주년(4월 29일)과 함께합니다 — 함께 축하해요!',
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
      'OUTERPLANE 팀이 지켜보고 있습니다! Major9 또는 VAGAMES가 공식 OUTERPLANE YouTube 채널 게재 또는 향후 프로모션에 사용하기 위해 연락할 수 있습니다.',
    ruleDisqualify:
      '원본 크리에이터가 아닌 사람이 제출하거나, OUTERPLANE 연령 등급에 적합하지 않은 콘텐츠가 포함된 경우 실격될 수 있습니다. 이의 제기는 EvaMains Discord 관리자에게 문의하세요.',
    entries: '참가 작품',
    entriesDesc: '아래 양식을 통해 제출물의 위치를 알려주세요:',
    entriesButton: '참가 제출',
    results: '결과',
    resultsIntro: '히어로 영상 이벤트가 종료되었습니다! 9명의 참가자 모두가 상품과 별도로 3 000 에테르 쿠폰을 추가로 받습니다.',
    podium1st: '1위',
    podium2nd: '2위',
    podium3rd: '3위',
    otherEntries: '기타 참가작',
    rickShoutoutPrefix: '모두의 명예 히어로 ',
    rickShoutoutSuffix: '에게 특별한 감사를!',
    pendingVideos: '제때 완성되지 못한 영상 프로젝트도 완성되는 대로 Outerpedia에서 소개됩니다.',
    couponNotePrefix: '쿠폰 코드 사용을 잊지 마세요',
    couponNoteSuffix: '— 모든 플레이어 대상. 상품 쿠폰 코드는 Sevih가 Discord를 통해 배포하므로 연락이 가능하도록 해주세요.',
  },
  zh: {
    intro:
      '召集所有新老创作者！Outerpedia正在举办粉丝创作内容画廊 — 同伴介绍、展示、攻略和娱乐！发送你的视频，帮助我们更加精彩！',
    publisherNote:
      'EvaMains团队收到了与社区分享的礼物：感谢《异域战记》新发行商Major9以及VAGAMES的支持！',
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
      '异域战记官方频道已经有许多3星同伴的技能介绍视频，但同伴们的魅力远不止于此。展示同伴的大厅姿势、表情、服装、最佳台词等！',
    themeShowcaseTitle: '展示！',
    themeShowcaseDesc:
      '我们如何培养同伴？能够做到什么？特别委托、异形怪、冒险家执照、竞技场、实时对战等——什么都行！',
    themeActionTitle: '灯光、摄影、开拍！',
    themeActionDesc:
      '有趣的大厅组合、玩梗队、同人创作——毕竟这是游戏，尽情享受吧！',
    timeline: '截止时间',
    timelineOpen: '提交开放：',
    timelineOpenDate: '3月24日 (00:00 UTC)',
    timelineDeadline: '提交截止：',
    timelineDeadlineDate: '4月28日 (00:00 UTC)',
    timelineVote: '社区投票和最终统计：',
    timelineVoteDate: '5月5日 (00:00 UTC)',
    timelinePrize: '奖品发放（预计）：',
    timelinePrizeDate: '5月12日 (UTC)',
    timelineAnniversary: '本活动恰逢Outerpedia一周年纪念日（4月29日）——与我们一起庆祝吧！',
    rules: '规则',
    ruleFootage: '视频中只能使用游戏内画面。',
    ruleFacecam: '攻略类内容允许露脸。',
    ruleVoice: '同伴的配音语言不限。',
    ruleLength: '视频长度在50至600秒之间。',
    ruleHosting:
      '视频必须上传在YouTube、Twitch或Bilibili上。不接受直接文件上传。',
    ruleVerify:
      '请在描述或置顶评论中添加"Outerpedia video event 2026 – <你的昵称>"以验证你的提交。',
    ruleExisting: '现有视频也可以参加！',
    rulePrizeDist:
      '奖品将以优惠码（由Major9提供）的形式发放，请确保我们能联系到你。',
    ruleGallery:
      'Outerpedia画廊可在经创作者同意后提供视频（无论是否获奖）链接。',
    ruleMirror:
      '视频保留在你自己的频道。YouTube的视频可以选择镜像到Outerpedia的YouTube频道。',
    ruleOfficial:
      '《异域战记》团队也在关注！Major9或VAGAMES可能会联系参与者，将其视频展示在异域战记官方YouTube频道或用于未来推广。',
    ruleDisqualify:
      '非原作者提交，或包含不适合《异域战记》年龄分级内容的提交可能会被取消资格。如有异议请联系EvaMains Discord管理员。',
    entries: '参赛作品',
    entriesDesc: '请通过以下表格告诉我们你的提交在哪里：',
    entriesButton: '提交参赛作品',
    results: '结果',
    resultsIntro: '英雄视频活动已结束！9位参与者每人都将在原有奖品之外，额外获得3 000以太币优惠券。',
    podium1st: '第1名',
    podium2nd: '第2名',
    podium3rd: '第3名',
    otherEntries: '其他参赛作品',
    rickShoutoutPrefix: '特别感谢大家的荣誉同伴',
    rickShoutoutSuffix: '！',
    pendingVideos: '未能及时完成的视频项目，Outerpedia会在完成后继续展示。',
    couponNotePrefix: '别忘了兑换优惠码',
    couponNoteSuffix: '— 所有玩家均可使用。奖品优惠码将由Sevih通过Discord发放给参与者，请确保能联系到你。',
  },
} as const satisfies Record<Lang, Record<string, string>>;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const Page = () => {
  const { lang } = useI18n();
  const l = i18n[lang];

  const podiumLabels = [l.podium1st, l.podium2nd, l.podium3rd];
  const podiumAccents = [
    'border-amber-400/60 bg-amber-500/10',
    'border-zinc-300/40 bg-zinc-400/10',
    'border-orange-500/50 bg-orange-600/10',
  ];

  return (
    <div className="space-y-10 text-zinc-200">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <p className="leading-relaxed text-zinc-300">{l.intro}</p>
        <p className="text-zinc-400">
          {l.publisherNote}
        </p>
      </div>

      {hasResults && (
        <section className="space-y-6">
          <div className="space-y-2 text-center">
            <h3 className="text-3xl font-extrabold tracking-tight text-rose-300">{l.results}</h3>
            <p className="text-zinc-400">{l.resultsIntro}</p>
          </div>

          {podium.some(Boolean) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {podium.map((entry, i) =>
                entry ? (
                  <div
                    key={i}
                    className={`flex flex-col gap-3 rounded-xl border p-4 ${podiumAccents[i]} ${i === 0 ? 'lg:col-span-3' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold uppercase tracking-wide text-zinc-100">
                        {podiumLabels[i]}
                      </span>
                      <span className="text-xs text-zinc-400">{entry.author}</span>
                    </div>
                    <MultiVideoEmbed videos={[toVideoItem(entry)]} />
                  </div>
                ) : null
              )}
            </div>
          )}

          {otherEntries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xl font-semibold text-zinc-100">{l.otherEntries}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherEntries.map((entry) => (
                  <VideoCard key={entry.videoId} entry={entry} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 text-sm text-zinc-300">
            <p>
              {l.rickShoutoutPrefix}
              <a
                href="https://youtu.be/dQw4w9WgXcQ"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-rose-300 underline-offset-2 transition hover:text-rose-200 hover:underline"
              >
                Rick
              </a>
              {l.rickShoutoutSuffix}
            </p>
            <p>{l.pendingVideos}</p>
            <p>
              {l.couponNotePrefix} <code className="rounded bg-rose-500/10 px-2 py-0.5 font-mono text-rose-300">OUTERPEDIA1YEAR</code> {l.couponNoteSuffix}
            </p>
          </div>
        </section>
      )}

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
            <h4 className="font-semibold text-white">{l.themeIntroTitle}</h4>
            <p>{l.themeIntroDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white">{l.themeShowcaseTitle}</h4>
            <p>{l.themeShowcaseDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white">{l.themeActionTitle}</h4>
            <p>{l.themeActionDesc}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-2xl font-bold">{l.timeline}</h3>
        <ul className="list-disc space-y-1 pl-6 text-zinc-300">
          <li>{l.timelineOpen} <strong>{l.timelineOpenDate}</strong></li>
          <li>{l.timelineDeadline} <strong>{l.timelineDeadlineDate}</strong></li>
          <li>{l.timelineVote} <strong>{l.timelineVoteDate}</strong></li>
          <li>{l.timelinePrize} <strong>{l.timelinePrizeDate}</strong></li>
        </ul>
        <p className="mt-2 text-amber-400/90">{l.timelineAnniversary}</p>
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

      {!hasResults && (
        <section className="space-y-3 text-center">
          <h3 className="text-2xl font-bold">{l.entries}</h3>
          <p className="text-zinc-300">{l.entriesDesc}</p>
          <a
            href="https://forms.gle/MHb8S3DwjRtRZkGSA"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500"
          >
            {l.entriesButton}
          </a>
        </section>
      )}
    </div>
  );
};

export default {
  meta: {
    slug: '20260324-video',
    title: {
      en: 'Hero Video Event - Spring 2026',
      jp: 'ヒーロー動画イベント - 2026年春',
      kr: '히어로 영상 이벤트 - 2026년 봄',
      zh: '英雄视频活动 - 2026年春季',
    },
    cover: '/images/events/default.webp',
    type: 'contest',
    organizer: 'Outerpedia / EvaMains',
    start: '2026-03-24T00:00:00Z',
    end: '2026-05-05T00:00:00Z',
    phases: [
      {
        until: '2026-04-28T00:00:00Z',
        label: {
          en: 'Submissions close April 28 00:00 UTC',
          jp: '提出期限：4月28日 00:00 UTC',
          kr: '제출 마감: 4월 28일 00:00 UTC',
          zh: '提交截止：4月28日 00:00 UTC',
        },
      },
      {
        until: '2026-05-05T00:00:00Z',
        label: {
          en: 'Voting in progress',
          jp: '投票受付中',
          kr: '투표 진행 중',
          zh: '投票进行中',
        },
      },
    ],
  },
  Page,
} satisfies EventDef;
