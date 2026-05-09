// Modal mockups — Settings · Char Picker (Mage filter) · Equipment Picker.
// Each "modal" is rendered inline at artboard level so it can be screenshotted
// as its own option. Real wiring would mount these via portals on top of the
// page; for the mockup we show the page underneath dimmed and blurred.

function ModalShell({ title, sub, width = 720, footer, children, onClose }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center" style={{
      background: "oklch(0.10 0.01 270 / 0.65)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <div
        className="relative max-h-[92%] overflow-hidden rounded-2xl border border-white/[0.08] bg-[oklch(0.16_0.018_270)] shadow-[0_50px_120px_-30px_rgb(0_0_0_/_0.8)]"
        style={{ width }}
      >
        {/* header */}
        <header className="flex items-start justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-tight text-zinc-50">{title}</h2>
            {sub && <div className="mt-0.5 text-[11.5px] text-zinc-500">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-black/30 text-zinc-400 hover:text-zinc-200"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </header>
        <div className="max-h-[80vh] overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex items-center justify-between border-t border-white/[0.06] bg-black/30 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// — SETTINGS —
function SettingsModal({ onClose = () => {} }) {
  return (
    <ModalShell
      title="Settings"
      sub="Global calculator preferences. Saved per browser."
      width={620}
      onClose={onClose}
      footer={(
        <>
          <span className="font-mono text-[10px] text-zinc-500">Last saved · 2026-05-08 14:22</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06]">Cancel</button>
            <button className="rounded-md border border-violet-400/30 bg-violet-500/20 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/30">Save</button>
          </div>
        </>
      )}
    >
      <div className="space-y-5 px-5 py-5">
        {/* Hero Codex */}
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">Hero Codex level</h3>
            <span className="font-mono text-[12px] text-violet-200">Lv 11 / 11</span>
          </div>
          <p className="mt-1 text-[11.5px] text-zinc-500">Codex contributes flat ATK and stat bonuses to every owned character.</p>
          <div className="mt-2.5 px-1">
            <Slider value={11} min={1} max={11} marks={false} label={undefined} />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-500">
              <span>1</span><span>4</span><span>7</span><span className="text-zinc-200">11 (Max)</span>
            </div>
          </div>
        </section>

        {/* Quirks */}
        <section className="border-t border-white/[0.05] pt-5">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">Quirks</h3>
          <p className="mt-1 text-[11.5px] text-zinc-500">Toggle global modifiers. The calculator auto-detects when each applies to the current matchup.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <QuirkToggle on
              label="Element advantage system"
              sub="Apply ×1.20 / ×0.85 multipliers based on element wheel."
            />
            <QuirkToggle on
              label="Job (class) bonuses"
              sub="Apply class-vs-class multipliers (e.g. Mage vs Ranger +5%)."
            />
            <QuirkToggle on
              label="PVE Counteract Strong Enemies"
              sub="Adds a difficulty-scaled mitigation curve in PVE content."
            />
            <QuirkToggle
              label="Adventure License bonuses"
              sub="Auto-apply AL stat bonuses when the target is an AL stage."
            />
          </div>
        </section>

        {/* Number formatting */}
        <section className="border-t border-white/[0.05] pt-5">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">Display</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <SettingRow label="Number format">
              <SegToggle dense value="comma" options={[
                { value: "comma", label: "12,345" },
                { value: "short", label: "12.3K" },
              ]} />
            </SettingRow>
            <SettingRow label="Decimals">
              <SegToggle dense value={1} options={[
                { value: 0, label: "0" },
                { value: 1, label: "1" },
                { value: 2, label: "2" },
              ]} />
            </SettingRow>
            <SettingRow label="Theme">
              <SegToggle dense value="dark" options={[
                { value: "dark", label: "Dark" },
                { value: "auto", label: "Auto" },
              ]} />
            </SettingRow>
            <SettingRow label="Sim trials">
              <NumInput value="5,000" suffix="" width={80} />
            </SettingRow>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}

function QuirkToggle({ label, sub, on = false }) {
  return (
    <label className={cx(
      "block cursor-pointer rounded-lg border p-3 transition-colors",
      on ? "border-violet-400/30 bg-violet-500/[0.06]" : "border-white/[0.06] bg-black/25 hover:bg-white/[0.04]"
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className={cx("text-[12px] font-semibold", on ? "text-violet-100" : "text-zinc-200")}>{label}</span>
        <ToggleSwitch on={on} />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">{sub}</p>
    </label>
  );
}

function ToggleSwitch({ on }) {
  return (
    <span className={cx(
      "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
      on ? "bg-violet-500/70" : "bg-white/10"
    )}>
      <span className={cx(
        "absolute h-3 w-3 rounded-full bg-white shadow transition-transform",
        on ? "translate-x-3.5" : "translate-x-0.5"
      )} />
    </span>
  );
}

function SettingRow({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/[0.05] bg-black/25 px-3 py-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

// — CHAR PICKER (filtered to Mage class) —
function CharPickerModal({ onClose = () => {} }) {
  const mages = CHARACTERS.filter(c => c.cls === "mage");
  const selectedId = "alice";

  return (
    <ModalShell
      title="Pick a character"
      sub="Filtering · Mage · 5★ + 4★"
      width={920}
      onClose={onClose}
      footer={(
        <>
          <span className="font-mono text-[10px] text-zinc-500">{mages.length} of 142 characters · keyboard ↑↓ to navigate</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06]">Cancel</button>
            <button className="rounded-md border border-violet-400/30 bg-violet-500/20 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/30">Choose Alice</button>
          </div>
        </>
      )}
    >
      {/* Search + filters */}
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
        <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-white/[0.07] bg-black/30 px-2.5">
          <Search />
          <input
            readOnly
            value="al"
            className="flex-1 bg-transparent text-[12px] text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <span className="rounded-sm border border-white/10 px-1 font-mono text-[9px] text-zinc-500">⌘K</span>
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(ELEMENTS).map((el) => (
            <button key={el} className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.06] bg-black/30 hover:bg-white/[0.06]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ELEMENTS[el].fg, boxShadow: `0 0 8px ${ELEMENTS[el].fg}` }} />
            </button>
          ))}
        </div>
        <div className="ml-1">
          <SegToggle dense value="mage" options={Object.keys(CLASSES).map(k => ({ value: k, label: CLASSES[k].label }))} />
        </div>
      </div>

      {/* Two-pane: grid + selected detail */}
      <div className="grid grid-cols-[1fr_300px] divide-x divide-white/[0.05]">
        {/* Grid */}
        <div className="px-5 py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">5★ Mages</span>
            <span className="font-mono text-[10px] text-zinc-500">7 results</span>
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            {mages.map((c) => (
              <button
                key={c.id}
                className={cx(
                  "group relative flex flex-col items-stretch rounded-lg border p-2 text-left transition-colors",
                  c.id === selectedId
                    ? "border-violet-400/40 bg-violet-500/[0.10] shadow-[0_0_0_1px_oklch(0.65_0.18_290_/_0.4)]"
                    : "border-white/[0.06] bg-black/25 hover:border-white/[0.12] hover:bg-white/[0.04]"
                )}
              >
                <Strip label="art" className="aspect-square w-full" />
                <div className="mt-1.5">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[12px] font-semibold text-zinc-100">{c.name}</span>
                    <span className="font-mono text-[9px] text-amber-300/80">★{c.rarity}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <ElementBadge el={c.element} size="xs" />
                    <ClassBadge cls={c.cls} size="xs" />
                  </div>
                </div>
                {c.id === selectedId && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_0_10px_oklch(0.65_0.18_290)]">
                    <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1.5 4.2 L3.2 5.8 L6.5 2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[10px] text-zinc-500">
            <span>4★ Mages</span>
            <span className="font-mono">1 result</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2.5">
            <button className="flex flex-col items-stretch rounded-lg border border-white/[0.06] bg-black/25 p-2 text-left hover:bg-white/[0.04]">
              <Strip label="art" className="aspect-square w-full opacity-80" />
              <div className="mt-1.5">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[12px] font-semibold text-zinc-200">Tessera</span>
                  <span className="font-mono text-[9px] text-amber-300/80">★4</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <ElementBadge el="earth" size="xs" />
                  <ClassBadge cls="mage" size="xs" />
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Selected detail pane */}
        <div className="bg-black/15 px-4 py-4">
          <Strip label="full body" className="h-44 w-full" />
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="font-display text-[16px] font-semibold text-zinc-50">Alice</div>
              <div className="mt-0.5 flex items-center gap-1">
                <ElementBadge el="earth" />
                <ClassBadge cls="mage" />
              </div>
            </div>
            <span className="font-mono text-[10px] text-amber-300/90">★★★★★</span>
          </div>
          <p className="mt-3 text-[11.5px] leading-snug text-zinc-400">
            Earth Mage. Single-target erasure specialist. Scales with PEN and CHD;
            best paired with a Defender ally for ATK% talisman uptime.
          </p>
          <ul className="mt-3 space-y-1.5 text-[11.5px]">
            <li className="flex justify-between"><span className="text-zinc-400">Base ATK</span><span className="font-mono text-zinc-100">7,842</span></li>
            <li className="flex justify-between"><span className="text-zinc-400">Best skill</span><span className="font-mono text-violet-200">S2 · Cipher Bloom</span></li>
            <li className="flex justify-between"><span className="text-zinc-400">Tier (PVE)</span><span className="font-mono text-amber-200">SS</span></li>
          </ul>
          <div className="mt-3 rounded-md border border-violet-400/20 bg-violet-500/[0.06] p-2 text-[11px] text-violet-100">
            Stat sheet preview will load with current Codex Lv 11 + Transcend Lv6.
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

window.SettingsModal = SettingsModal;
window.CharPickerModal = CharPickerModal;
