// Column 3 — RESULT
// Big damage readout (gold/amber on crit), DF subtitle, debug breakdown.

function ResultColumn({ debugOpen = true }) {
  // Sample brief: 14,837 damage on crit
  const crit = 14_837;
  const nonCrit = 9_212;
  const df = "130.0%";

  return (
    <div className="flex flex-col gap-3">
      {/* Big damage readout */}
      <Card padded={false} glow className="overflow-hidden">
        <div className="relative px-5 pt-5 pb-4">
          {/* gold glow halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 90% at 50% 0%, oklch(0.78 0.18 75 / 0.28), transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Predicted damage</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_oklch(0.78_0.18_150)]" />
                Live
              </span>
            </div>

            {/* The hero number */}
            <div className="mt-3">
              <div
                className="font-display font-mono text-[68px] font-bold leading-none tabular-nums"
                style={{
                  color: "oklch(0.92 0.16 78)",
                  textShadow:
                    "0 0 28px oklch(0.78 0.18 70 / 0.55), 0 0 70px oklch(0.78 0.18 70 / 0.28)",
                  letterSpacing: "-0.03em",
                }}
              >
                {crit.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px]">
                <Pill tone="amber"><Bolt className="h-3 w-3" /> Crit hit</Pill>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-zinc-300">DF: {df}</span>
                <span className="ml-auto font-mono text-[11px] text-zinc-500">non-crit {nonCrit.toLocaleString()}</span>
              </div>
            </div>

            {/* tiny meta strip */}
            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30">
              {[
                ["Skill",   "S1 · Lv5"],
                ["Burst",   "Tier 3"],
                ["Roll",    "CRIT"],
              ].map(([k,v], i) => (
                <div key={k} className={cx("px-3 py-2", i < 2 && "border-r border-white/[0.05]")}>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500">{k}</div>
                  <div className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-zinc-100">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Show breakdown — toggleable */}
      <Card padded={false}>
        <button className="flex w-full items-center justify-between px-4 py-2.5 text-left">
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
              {debugOpen ? "▼" : "▶"} Show breakdown
            </span>
          </span>
          <span className="font-mono text-[10px] text-zinc-500">v3.2 · 7 quirks</span>
        </button>

        {debugOpen && (
          <div className="border-t border-white/[0.05] px-4 py-3.5">
            {/* Mini-grid of intermediate values */}
            <div className="grid grid-cols-3 gap-2">
              <IntCell k="Pool %"     v="+186%" />
              <IntCell k="Rate"       v="62.4%"  hint="CHC" />
              <IntCell k="Mitigation" v="×0.953" hint="DEF" />
              <IntCell k="Elem mult"  v="×0.85"  hint="−" tone="rose" />
              <IntCell k="Main calc"  v="11,420" hint="non-crit" />
              <IntCell k="Add'l calc" v="+3,417" hint="codex" tone="violet" />
            </div>

            {/* Per-step trace */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Per-step trace</span>
                <span className="font-mono text-[10px] text-zinc-500">14 steps · click to copy</span>
              </div>
              <ol className="overflow-hidden rounded-md border border-white/[0.05]">
                {[
                  ["01", "Base ATK", "8,272"],
                  ["02", "Apply S1 multiplier 110%", "9,099"],
                  ["03", "Apply Mage class +5% vs Ranger", "9,554"],
                  ["04", "Pool: +71% DMG Inc · +12% Codex · +30% buff", "+2,991"],
                  ["05", "Apply mitigation (DEF 382, PEN 38%)", "×0.953"],
                  ["06", "Element disadv (Earth → Earth)", "×0.85"],
                  ["07", "Target DR 2.9%", "×0.971"],
                  ["08", "Marked debuff — 1.10× post-mitigation", "×1.10"],
                  ["09", "Boss bonus (n/a — non-boss)", "—"],
                  ["10", "Sub-total non-crit", "9,212"],
                  ["11", "Roll CRIT — apply CHD 218%", "×1.61"],
                  ["12", "Apply C.DmgRed 0%", "×1.00"],
                  ["13", "EE active vs Earth — +15% additive", "+1,236"],
                  ["14", "Final · CRIT", "14,837"],
                ].map(([n, label, val], i, arr) => (
                  <li key={n} className={cx(
                    "grid grid-cols-[28px_1fr_auto] items-baseline gap-2 px-2.5 py-1 text-[11px]",
                    i % 2 === 0 ? "bg-black/30" : "bg-black/15",
                    i === arr.length - 1 && "border-t border-amber-400/30 bg-amber-500/[0.05]"
                  )}>
                    <span className={cx(
                      "font-mono text-[10px]",
                      i === arr.length - 1 ? "text-amber-200" : "text-zinc-500"
                    )}>{n}</span>
                    <span className={cx(
                      "truncate",
                      i === arr.length - 1 ? "font-semibold text-zinc-100" : "text-zinc-300"
                    )}>{label}</span>
                    <span className={cx(
                      "font-mono tabular-nums",
                      i === arr.length - 1 ? "text-[13px] font-bold text-amber-200" : "text-zinc-200"
                    )}>{val}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Card>

      {/* Per-skill comparison footer */}
      <Card title="vs other skills" right={
        <span className="font-mono text-[10px] text-zinc-500">crit · same buffs</span>
      }>
        <ul className="space-y-1.5">
          {[
            ["S1 · Lacuna Ping",   14_837, true],
            ["S2 · Cipher Bloom",  22_410, false],
            ["S3 · Null Cathedral",38_905, false],
          ].map(([name, v, active]) => {
            const max = 38_905;
            const pct = (v / max) * 100;
            return (
              <li key={name} className={cx(
                "rounded-md border px-2.5 py-1.5",
                active ? "border-violet-400/30 bg-violet-500/[0.06]" : "border-white/[0.05] bg-black/20"
              )}>
                <div className="flex items-baseline justify-between text-[11.5px]">
                  <span className={active ? "text-violet-100" : "text-zinc-300"}>{name}</span>
                  <span className={cx("font-mono tabular-nums", active ? "text-amber-200" : "text-zinc-300")}>
                    {v.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full" style={{
                    width: `${pct}%`,
                    background: active
                      ? "linear-gradient(90deg, oklch(0.65 0.18 290), oklch(0.85 0.16 75))"
                      : "oklch(0.50 0.04 270)"
                  }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function IntCell({ k, v, hint, tone }) {
  const tones = {
    rose:   "text-rose-200",
    violet: "text-violet-200",
    amber:  "text-amber-200",
  };
  return (
    <div className="rounded-md border border-white/[0.05] bg-black/30 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{k}</span>
        {hint && <span className="font-mono text-[9px] text-zinc-500">{hint}</span>}
      </div>
      <div className={cx("mt-0.5 font-mono text-[14px] font-semibold tabular-nums", tones[tone] || "text-zinc-100")}>{v}</div>
    </div>
  );
}

window.ResultColumn = ResultColumn;
