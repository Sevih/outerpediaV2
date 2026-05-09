// Column 2 — TARGET
// Cascade picker (5 levels) → selected monster card → stats grid (read-only) →
// boss mechanics. Header has Library / Manual mode toggle.

function TargetColumn() {
  const t = TARGET;

  return (
    <div className="flex flex-col gap-3">
      {/* Cascade picker */}
      <Card padded={false} glow>
        <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Target</h3>
          <SegToggle dense value="lib" options={[
            { value: "lib", label: "Library" },
            { value: "manual", label: "Manual" },
          ]} />
        </header>
        <div className="px-4 py-3.5">
          {/* Cascade selects */}
          <div className="grid grid-cols-2 gap-2">
            <CascadeSelect label="Category" value="Story Normal" />
            <CascadeSelect label="Episode"  value="4 — Vellum Reach" />
            <CascadeSelect label="Stage"    value="4-1 · Watchpost" />
            <CascadeSelect label="Monster"  value="Sentry Archer" highlighted />
          </div>

          {/* Selected target detail */}
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <Strip label="mob" className="h-14 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-[15px] font-semibold text-zinc-50">{t.monster}</span>
                <span className="font-mono text-[10px] text-zinc-500">Lv {t.level}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <ElementBadge el={t.element} />
                <ClassBadge cls={t.cls} />
                <Pill tone="neutral">Normal</Pill>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">vs Earth Mage</span>
              <Pill tone="rose" className="h-5">Disadv ×0.85</Pill>
            </div>
          </div>
        </div>
      </Card>

      {/* Target stats — 6 cells, read-only when from cascade */}
      <Card title="Target stats" right={
        <span className="font-mono text-[10px] text-zinc-500">read-only · cascade</span>
      }>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="DEF"       value="382"  auto editable={false} />
          <StatCell label="HP"        value="28.4K" auto editable={false} />
          <StatCell label="Target DR" value="2.9%" auto editable={false} />
          <StatCell label="C.DmgRed"  value="0%"   auto editable={false} />
          <StatCell label="EFF"       value="0%"   auto editable={false} />
          <StatCell label="RES"       value="0%"   auto editable={false} />
        </div>
      </Card>

      {/* Boss mechanics — Sentry Archer is non-boss but has Ranger passives */}
      <Card title="Mechanics & passives">
        <div className="space-y-2">
          <MechanicRow
            checked
            label="Sentry Stance — DEF +15% per stack"
            param={(
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">Stacks</span>
                <Slider value={1} min={0} max={3} marks hue={145} />
                <span className="font-mono text-[11px] text-emerald-300">1 / 3</span>
              </div>
            )}
          />
          <MechanicRow
            label="Counter-shot — fires when hit by Mage"
            param={<span className="font-mono text-[10px] text-zinc-500">No params</span>}
          />
          <MechanicRow
            label="Vigilance — +20% C.DmgRed below 50% HP"
            param={(
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span>HP threshold</span>
                <NumInput value="50" suffix="%" width={52} disabled />
              </div>
            )}
          />
        </div>

        {/* Auto-detected match-up indicators */}
        <ul className="mt-3 space-y-1 border-t border-white/[0.05] pt-3">
          <li className="flex items-center justify-between rounded-md border border-rose-400/15 bg-rose-500/[0.06] px-2.5 py-1.5 text-[11.5px]">
            <span className="flex items-center gap-2 text-rose-200">
              <Bolt className="h-3 w-3" /> Element disadvantage — Earth → Earth
            </span>
            <span className="font-mono text-rose-200">×0.85</span>
          </li>
          <li className="flex items-center justify-between rounded-md border border-emerald-400/15 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[11.5px]">
            <span className="flex items-center gap-2 text-emerald-200">
              <Bolt className="h-3 w-3" /> Class — Mage vs Ranger
            </span>
            <span className="font-mono text-emerald-200">+5% DMG</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function CascadeSelect({ label, value, highlighted }) {
  return (
    <div className={cx(
      "rounded-md border bg-black/25 px-2.5 py-1.5",
      highlighted ? "border-violet-400/30 bg-violet-500/[0.06]" : "border-white/[0.06]"
    )}>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className={cx(
          "truncate text-[12px] font-medium",
          highlighted ? "text-violet-100" : "text-zinc-100"
        )}>{value}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
      </div>
    </div>
  );
}

function MechanicRow({ checked = false, label, param }) {
  return (
    <div className={cx(
      "rounded-md border px-2.5 py-1.5",
      checked ? "border-emerald-400/20 bg-emerald-500/[0.04]" : "border-white/[0.05] bg-black/25"
    )}>
      <Checkbox dense checked={checked} tone="emerald" label={label} />
      <div className="mt-1 pl-5">{param}</div>
    </div>
  );
}

window.TargetColumn = TargetColumn;
