// Team panel — 3 horizontal ally slot cards, full-width below the 3-col grid.
// Slot 1: Yuelchen (Defender, ATK% talisman, Exquisite Death tier 3, flat DEF)
// Slots 2-3: empty "+ add ally"

function TeamPanel() {
  return (
    <Card title="Team" right={
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-zinc-500">3 slots · contributions roll up to attacker stats</span>
        <button className="text-[11px] text-violet-300 hover:text-violet-200">Edit team</button>
      </div>
    }>
      <div className="grid grid-cols-3 gap-3">
        {TEAM.map((m, i) => (m ? <AllySlot key={i} m={m} /> : <EmptySlot key={i} />))}
      </div>
    </Card>
  );
}

function AllySlot({ m }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/25 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={m.name} element={m.element} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[14px] font-semibold text-zinc-100">{m.name}</span>
            <span className="font-mono text-[10px] text-amber-300/90">★{m.star}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ElementBadge el={m.element} size="xs" />
            <ClassBadge cls={m.cls} size="xs" />
          </div>
        </div>
        <button className="text-zinc-500 hover:text-zinc-300"><XIcon /></button>
      </div>

      {/* Talisman slot */}
      <button className="mt-3 flex w-full items-center gap-2 rounded-md border border-white/[0.05] bg-black/30 px-2 py-1.5 text-left transition-colors hover:border-violet-400/30">
        <Strip label="tal" className="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Talisman</div>
          <div className="text-[11.5px] text-zinc-200">
            <span className="font-medium">{m.talisman.main}</span>
            <span className="ml-1 font-mono text-emerald-300">{m.talisman.value}</span>
          </div>
        </div>
        <ChevronRight className="h-3 w-3 text-zinc-500" />
      </button>

      {/* Class-conditional sub-block */}
      {m.cls === "defender" && (
        <div className="mt-2 rounded-md border border-blue-400/20 bg-blue-500/[0.06] p-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-blue-100">
              <Checkbox dense checked={m.sub.absoluteToggle} tone="violet" label="Exquisite Death" />
            </span>
            <Pill tone="violet" className="h-4">Tier {m.sub.tier}</Pill>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">Flat DEF</span>
            <NumInput value={m.sub.flatDef.toLocaleString()} suffix="" width={68} />
            <span className="ml-auto font-mono text-[10px] text-emerald-300">→ +1,234 ATK</span>
          </div>
        </div>
      )}
      {m.cls === "ranger" && (
        <div className="mt-2 rounded-md border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
          <Checkbox dense checked tone="violet" label="Absolute Music" />
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
            <span>Tier</span>
            <SegToggle dense value={2} options={[0,1,2,3,4].map(n => ({ value:n, label:String(n) }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <button className="group flex h-full min-h-[152px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.10] bg-black/15 p-3 text-zinc-500 transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.04] hover:text-violet-200">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 group-hover:border-violet-400/40">
        <PlusIcon className="h-3 w-3" />
      </span>
      <span className="text-[11px] font-medium">Add ally</span>
      <span className="text-[10px] text-zinc-600">empty slot</span>
    </button>
  );
}

window.TeamPanel = TeamPanel;
