// Calculator + desktop / mobile shells. Includes WIP banner, top toolbar,
// and the four artboard renderers (desktop, mobile, settings modal, char picker).

function WipBanner() {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-amber-300/20 px-4 py-1.5 text-[11.5px]"
      style={{ background: "oklch(0.32 0.10 85 / 0.35)" }}
    >
      <div className="flex items-center gap-2 text-amber-100">
        <WarnIcon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80">Early access</span>
        <span className="text-amber-100/90">expect ±5% accuracy — formula coverage tracked at <span className="underline-offset-2 hover:underline">v3.2 quirks list</span>.</span>
      </div>
      <button className="flex h-5 w-5 items-center justify-center rounded text-amber-200/70 hover:bg-amber-300/10 hover:text-amber-100">
        <XIcon />
      </button>
    </div>
  );
}

function TopBar({ compact, onSettings = () => {}, onShare = () => {} }) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.05] bg-black/40 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-7 w-7 place-items-center rounded-md"
            style={{
              background: "linear-gradient(135deg, oklch(0.55 0.18 290), oklch(0.30 0.12 290))",
              boxShadow: "0 0 18px oklch(0.55 0.18 290 / 0.45)",
            }}
          >
            <span className="font-display text-[14px] font-bold text-white">O</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[14px] font-semibold tracking-tight text-zinc-100">Outerpedia</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">Damage Calculator</div>
          </div>
        </div>
        {!compact && (
          <nav className="ml-3 flex items-center gap-1 text-[12px]">
            {["Characters","Tier list","Calculator","Builds","Banners"].map((n,i) => (
              <a key={n} className={cx(
                "rounded-md px-2.5 py-1 transition-colors",
                i === 2 ? "bg-white/[0.06] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              )}>{n}</a>
            ))}
          </nav>
        )}
      </div>

      {/* tabs */}
      {!compact && (
        <div className="flex items-center gap-1">
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/15 px-3 text-[12px] font-medium text-violet-100">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            Single build
          </button>
          <button disabled className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-zinc-500">
            Compare 3 builds
            <span className="rounded-sm border border-white/10 bg-black/30 px-1 font-mono text-[9px] uppercase tracking-wider">soon</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onShare} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 text-[12px] text-zinc-300 hover:bg-white/[0.06]">
          <ShareIcon /> Share
        </button>
        <button onClick={onSettings} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]" aria-label="Settings">
          <Gear />
        </button>
      </div>
    </header>
  );
}

function PageBackground({ children, className }) {
  return (
    <div
      className={cx("relative h-full w-full overflow-hidden text-zinc-200", className)}
      style={{
        background:
          "radial-gradient(1200px 600px at 80% -10%, oklch(0.28 0.10 290 / 0.35), transparent 60%), radial-gradient(800px 500px at -10% 110%, oklch(0.26 0.10 25 / 0.18), transparent 60%), oklch(0.13 0.012 270)",
        fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(60% 50% at 50% 30%, black, transparent 80%)",
        }}
      />
      <div className="relative h-full w-full overflow-y-auto">{children}</div>
    </div>
  );
}

// — DESKTOP —
function DesktopCalc() {
  return (
    <PageBackground>
      <WipBanner />
      <TopBar />

      {/* page header */}
      <div className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[24px] font-semibold tracking-tight text-zinc-50">Damage Calculator</h1>
          <span className="text-[12px] text-zinc-500">Predict damage in &lt;10s — pick a character, a target, layer your buffs.</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Pill>Patch 2.4 · 2026-05</Pill>
          <Pill tone="emerald">Formula v3.2</Pill>
        </div>
      </div>

      {/* 3-column grid */}
      <main className="grid grid-cols-12 gap-4 px-6 pb-6 pt-4">
        <div className="col-span-4"><AttackerColumn /></div>
        <div className="col-span-4"><TargetColumn /></div>
        <div className="col-span-4"><ResultColumn debugOpen /></div>

        {/* Team row — full width */}
        <div className="col-span-12"><TeamPanel /></div>

        {/* Buffs panel — full width */}
        <div className="col-span-12"><BuffsPanel /></div>

        {/* Footer */}
        <div className="col-span-12 mt-2 flex items-center justify-between border-t border-white/[0.05] pt-4 text-[11px] text-zinc-500">
          <span>Outerpedia is an unofficial fan project. Not affiliated with the game's developer or publisher.</span>
          <div className="flex items-center gap-3">
            <span className="font-mono">Build · 2026.05.08-a</span>
            <a className="text-violet-300 hover:text-violet-200">View formula source</a>
          </div>
        </div>
      </main>
    </PageBackground>
  );
}

// — MOBILE —
function MobileCalc() {
  return (
    <PageBackground className="text-[14px]">
      <WipBanner />
      <TopBar compact />
      <div className="px-3 pt-3">
        <h1 className="font-display text-[18px] font-semibold tracking-tight text-zinc-50">Damage Calculator</h1>
        <p className="text-[11px] text-zinc-500">Pick a character, a target, layer your buffs.</p>
      </div>

      {/* tab strip — Single build / Compare disabled */}
      <div className="mx-3 mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 text-[11px] font-medium uppercase tracking-wider">
        <button className="bg-white/[0.06] py-2 text-zinc-100">Single build</button>
        <button className="py-2 text-zinc-500" disabled>
          Compare 3 <span className="ml-1 rounded-sm border border-white/10 bg-black/30 px-1 font-mono text-[8px] normal-case tracking-wider">soon</span>
        </button>
      </div>

      {/* section nav */}
      <div className="mx-3 mt-2 grid grid-cols-4 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 text-[10.5px] font-medium uppercase tracking-wider">
        {["Attacker","Target","Team","Buffs"].map((n,i) => (
          <button key={n} className={cx("py-2", i === 0 ? "bg-white/[0.06] text-zinc-100" : "text-zinc-400")}>{n}</button>
        ))}
      </div>

      <main className="space-y-3 px-3 pb-44 pt-3">
        <AttackerColumn />
        <Card title="Target · summary" right={<button className="text-[11px] text-violet-300">Open</button>}>
          <div className="flex items-center gap-3">
            <Strip label="mob" className="h-12 w-12 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-zinc-100">Sentry Archer</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <ElementBadge el="earth" size="xs" />
                <ClassBadge cls="ranger" size="xs" />
                <Pill tone="rose" className="h-4 px-1 text-[9px]">Disadv ×0.85</Pill>
              </div>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">4-1 · Lv30</span>
          </div>
        </Card>
      </main>

      {/* sticky bottom bar with damage prediction */}
      <div className="absolute inset-x-0 bottom-0">
        <div
          className="px-3 pb-3 pt-2"
          style={{
            background:
              "linear-gradient(to top, oklch(0.13 0.012 270) 30%, oklch(0.13 0.012 270 / 0.6) 80%, transparent)",
          }}
        >
          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[oklch(0.20_0.018_270)] shadow-[0_-12px_40px_-12px_rgb(0_0_0_/_0.6)]">
            <div className="relative px-3 pt-3 pb-3">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(70% 90% at 50% 0%, oklch(0.78 0.18 75 / 0.22), transparent 70%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Avatar name="Alice" element="earth" size={22} />
                    <span className="text-zinc-300">Alice</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-zinc-400">Sentry Archer</span>
                  </div>
                  <Pill tone="amber"><Bolt className="h-3 w-3" /> Crit</Pill>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <div
                    className="font-display font-mono text-[42px] font-bold leading-none tabular-nums"
                    style={{
                      color: "oklch(0.92 0.16 78)",
                      textShadow: "0 0 20px oklch(0.78 0.18 70 / 0.55)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    14,837
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500">DF · 130.0%</div>
                    <div className="font-mono text-[10px] tabular-nums text-zinc-400">non-crit 9,212</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[10px]">
                  <span className="flex items-center gap-1 text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_oklch(0.78_0.18_150)]" />
                    Live
                  </span>
                  <button className="inline-flex items-center gap-1 text-violet-300">
                    View breakdown <ChevronRight />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

// — Modal preview shells (artboards 3 + 4) —
function SettingsArtboard() {
  return (
    <PageBackground>
      <WipBanner />
      <TopBar />
      <div className="grid grid-cols-12 gap-4 px-6 pt-4 opacity-50">
        <div className="col-span-4"><AttackerColumn /></div>
        <div className="col-span-4"><TargetColumn /></div>
        <div className="col-span-4"><ResultColumn debugOpen={false} /></div>
      </div>
      <SettingsModal />
    </PageBackground>
  );
}

function CharPickerArtboard() {
  return (
    <PageBackground>
      <WipBanner />
      <TopBar />
      <div className="grid grid-cols-12 gap-4 px-6 pt-4 opacity-50">
        <div className="col-span-4"><AttackerColumn /></div>
        <div className="col-span-4"><TargetColumn /></div>
        <div className="col-span-4"><ResultColumn debugOpen={false} /></div>
      </div>
      <CharPickerModal />
    </PageBackground>
  );
}

window.DesktopCalc = DesktopCalc;
window.MobileCalc = MobileCalc;
window.SettingsArtboard = SettingsArtboard;
window.CharPickerArtboard = CharPickerArtboard;
