// Column 1 — ATTACKER
// Header card · stats grid (6 stats × 2 rows) · skill+crit row · burst+transcend ·
// equipment block · conditional modifiers.

function AttackerColumn({ openPicker = () => {}, openEquip = () => {} }) {
  const ch = SELECTED;
  const skill = "s1";       // sample brief: S1 active
  const skillLevel = 5;     // sample brief: skill lvl 5
  const sk = SKILLS[skill];

  return (
    <div className="flex flex-col gap-3">
      {/* Character header card — clickable */}
      <Card padded={false} glow>
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Attacker</h3>
          <button
            onClick={openPicker}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Change <ChevronRight />
          </button>
        </div>
        <button onClick={openPicker} className="block w-full text-left">
          <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
            <Avatar name={ch.name} element={ch.element} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-[18px] font-semibold leading-none text-zinc-50">{ch.name}</span>
                <span className="font-mono text-[10px] text-amber-300/90">★★★★★</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <ElementBadge el={ch.element} />
                <ClassBadge cls={ch.cls} />
                <Pill tone="violet">DPS</Pill>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          </div>
        </button>
      </Card>

      {/* Stats grid — 6 stats × 2 rows */}
      <Card title="Stats" right={
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-500">auto-prefilled</span>
          <Pill tone="violet">AL bonus on</Pill>
        </div>
      }>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="ATK"      value="7,842" auto teamAdd="430" accent="text-zinc-50" />
          <StatCell label="CHC"      value="62.4%" auto />
          <StatCell label="CHD"      value="218%"  auto />
          <StatCell label="PEN"      value="38.0%" auto />
          <StatCell label="DMG INC"  value="71.0%" auto />
          <StatCell label="EFF / RES" value="22 / 18%" sub="eff / res" />
        </div>
      </Card>

      {/* Skill row */}
      <Card title="Skill" right={
        <SegToggle dense value={skill} options={[
          { value: "s1", label: "S1" },
          { value: "s2", label: "S2" },
          { value: "s3", label: "S3" },
        ]} />
      }>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[14px] font-semibold text-zinc-100">{sk.name}</span>
          <span className="font-mono text-[11px] text-zinc-500">{Math.round(sk.coef*100)}% ATK · {sk.hits}h</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-zinc-400">{sk.desc}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
          <Slider label="Skill level" value={skillLevel} min={1} max={5} />
          <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-500/10 px-2 text-[11px] font-medium text-amber-200">
            <span className="flex h-3 w-3 items-center justify-center rounded-[2px] bg-amber-400/80">
              <svg viewBox="0 0 8 8" className="h-2 w-2 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M1.5 4.2 L3.2 5.8 L6.5 2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Crit
          </label>
        </div>
      </Card>

      {/* Burst + transcend */}
      <Card title="Burst & Transcendance" right={<AutoBadge>auto</AutoBadge>}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <Pill tone="amber" className="h-7 px-2.5 text-[11px]">
            <span className="font-mono">Burst 3</span>
            <span className="ml-1 text-[9px] opacity-70">T6</span>
          </Pill>
          <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-1.5">
            <span className="text-[11px] text-zinc-400">Transcend</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-violet-200">
              Lv6 (Max) <ChevronDown className="h-3 w-3 text-zinc-500" />
            </span>
          </div>
        </div>
        <ul className="mt-3 space-y-1 border-t border-white/[0.05] pt-2.5">
          {[
            ["Lv3", "ATK +12% · Skill DMG +8%"],
            ["Lv4-2", "Burst II unlock · CHD +15%"],
            ["Lv5-3", "PEN +10% on S1"],
            ["Lv6", "Burst III · S1 hits twice on CRIT"],
          ].map(([k, v], i) => (
            <li key={k} className="flex items-baseline justify-between text-[11px]">
              <span className={cx("font-mono", i === 3 ? "text-violet-200" : "text-zinc-500")}>{k}</span>
              <span className={cx("flex-1 px-2 text-zinc-400", i === 3 && "text-zinc-200")}>{v}</span>
              {i === 3 && <span className="font-mono text-[9px] uppercase tracking-wider text-violet-300">active</span>}
            </li>
          ))}
        </ul>
      </Card>

      {/* Equipment block */}
      <Card title="Equipment" right={
        <button className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200">
          Collapse <ChevronDown />
        </button>
      }>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Weapon",    "Vellum Quill",       "+672 ATK"],
            ["Armor",     "Codex Mantle",       "+18% HP"],
            ["Accessory", "Inkwell Pendant",    "+42 SPD"],
            ["Talisman",  "Chapter VI Marker",  "ATK% main"],
          ].map(([slot, name, sub]) => (
            <button
              key={slot}
              onClick={openEquip}
              className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-black/25 p-2 text-left transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.04]"
            >
              <Strip label="art" className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{slot}</div>
                <div className="truncate text-[12px] font-medium text-zinc-200">{name}</div>
                <div className="font-mono text-[10px] text-violet-300/80">{sub}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={openEquip} className="mt-2 flex w-full items-center justify-between rounded-md border border-dashed border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:border-violet-400/30 hover:text-violet-200">
          <span>Substats · 14 rolls</span>
          <span className="font-mono text-[10px]">CHC 5 · CHD 3 · ATK% 4 · SPD 2</span>
        </button>
      </Card>

      {/* Conditional modifiers */}
      <Card title="Conditional modifiers">
        <div className="space-y-1.5">
          <Checkbox checked autoOn dense label='EE active vs Earth target — "Margin Note" +15% DMG' sub="auto-on; target is Earth" tone="emerald" />
          <Checkbox dense label="S1 second hit on CRIT (Lv6)" sub="requires the previous hit to crit" />
          <Checkbox checked dense tone="emerald" label="Boss bonus +30%" sub="active when target.isBoss" />
          <Checkbox dense label="HP threshold ≥ 80% — opening hit bonus" />
        </div>
      </Card>
    </div>
  );
}

window.AttackerColumn = AttackerColumn;
