// Full-width buffs / debuffs matrix — 4 columns:
// Attacker buffs (green) · Attacker debuffs (red) · Target buffs (green) · Target debuffs (red)
// Each row: checkbox + tinted icon + label + editable % input (only when active).
// Bottom-row "Marked"-style toggles are flat (on/off, no %).

function BuffsPanel() {
  return (
    <Card title="Buffs & Debuffs" right={
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-zinc-500">2 active</span>
        <button className="text-[11px] text-violet-300 hover:text-violet-200">Reset all</button>
      </div>
    }>
      <div className="grid grid-cols-4 gap-2.5">
        <BuffColumn title="Attacker · Buffs"   side="att" tone="emerald" rows={BUFFS.attBuffs} />
        <BuffColumn title="Attacker · Debuffs" side="att" tone="rose"    rows={BUFFS.attDebuffs} />
        <BuffColumn title="Target · Buffs"     side="tgt" tone="emerald" rows={BUFFS.tgtBuffs} />
        <BuffColumn title="Target · Debuffs"   side="tgt" tone="rose"    rows={BUFFS.tgtDebuffs} />
      </div>
    </Card>
  );
}

function BuffColumn({ title, tone, rows }) {
  const tones = {
    emerald: {
      head: "text-emerald-200",
      bar:  "border-emerald-400/20 bg-emerald-500/[0.06]",
      icon: "text-emerald-300",
      activeBd: "border-emerald-400/40",
    },
    rose: {
      head: "text-rose-200",
      bar:  "border-rose-400/20 bg-rose-500/[0.06]",
      icon: "text-rose-300",
      activeBd: "border-rose-400/40",
    },
  }[tone];

  return (
    <div className={cx("rounded-lg border", tones.bar)}>
      <div className={cx("flex items-center justify-between border-b border-white/[0.05] px-2.5 py-1.5")}>
        <span className={cx("text-[10px] font-semibold uppercase tracking-wider", tones.head)}>{title}</span>
        <span className="font-mono text-[10px] text-zinc-500">{rows.filter(r => r.active).length}/{rows.length}</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {rows.map((b) => (
          <li
            key={b.key}
            className={cx(
              "flex items-center gap-2 px-2.5 py-1.5",
              b.active && "bg-black/20"
            )}
          >
            <Checkbox dense checked={b.active} tone={tone} label="" />
            <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.06]", b.active ? tones.icon : "text-zinc-500")}>
              <BuffStatIcon stat={b.key} className="h-3 w-3" />
            </span>
            <span className={cx("min-w-0 flex-1 truncate text-[11.5px]", b.active ? "text-zinc-100" : "text-zinc-400")}>
              {b.label}
            </span>
            {b.flat ? (
              <span className={cx(
                "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] uppercase tracking-wider",
                b.active
                  ? (tone === "emerald" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100" : "border-rose-400/30 bg-rose-500/15 text-rose-100")
                  : "border-white/[0.06] bg-black/25 text-zinc-500"
              )}>
                {b.active ? "ON" : "off"}
              </span>
            ) : (
              <NumInput value={b.pct} disabled={!b.active} accent={b.active ? (tone === "emerald" ? "text-emerald-200" : "text-rose-200") : ""} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

window.BuffsPanel = BuffsPanel;
