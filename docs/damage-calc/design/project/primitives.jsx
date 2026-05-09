// Shared primitives for the Outerpedia damage calculator mockup.

const cx = (...xs) => xs.filter(Boolean).join(" ");

function ElementBadge({ el, size = "sm" }) {
  const e = ELEMENTS[el];
  if (!e) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md font-medium uppercase tracking-wider",
        size === "xs" ? "h-4 px-1.5 text-[9px]" : "h-5 px-2 text-[10px]"
      )}
      style={{ color: e.fg, background: e.bg, border: `1px solid ${e.bd}` }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: size === "xs" ? 5 : 6,
          height: size === "xs" ? 5 : 6,
          background: e.fg,
          boxShadow: `0 0 6px ${e.fg}`,
        }}
      />
      {e.label}
    </span>
  );
}

function ClassBadge({ cls, size = "sm" }) {
  const c = CLASSES[cls];
  if (!c) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md font-medium uppercase tracking-wider",
        size === "xs" ? "h-4 px-1.5 text-[9px]" : "h-5 px-2 text-[10px]"
      )}
      style={{ color: c.fg, background: c.bg, border: `1px solid ${c.bd}` }}
    >
      {c.label}
    </span>
  );
}

function AutoBadge({ children = "auto" }) {
  return (
    <span className="inline-flex h-3.5 items-center rounded-[3px] border border-violet-400/30 bg-violet-400/10 px-1 text-[9px] font-mono uppercase tracking-wider text-violet-300">
      {children}
    </span>
  );
}

// Small green "(+X)" annotation when team is contributing to a stat
function TeamPlus({ children }) {
  return (
    <span className="font-mono text-[10px] text-emerald-300">(+{children})</span>
  );
}

function Card({ title, right, children, className, padded = true, glow = false }) {
  return (
    <section
      className={cx(
        "relative rounded-xl border border-white/[0.07] bg-[oklch(0.21_0.018_270_/_0.7)] backdrop-blur-sm",
        "shadow-[0_1px_0_oklch(1_0_0_/_0.04)_inset,0_24px_60px_-30px_rgb(0_0_0_/_0.7)]",
        className
      )}
    >
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.78 0.18 290 / 0.4), transparent)" }}
        />
      )}
      {(title || right) && (
        <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{title}</h3>
          {right}
        </header>
      )}
      <div className={padded ? "px-4 py-3.5" : ""}>{children}</div>
    </section>
  );
}

// 6-stat cell as used in the attacker / target stat grids.
// label + numeric value + optional "auto" badge + optional team contribution.
function StatCell({ label, value, auto, teamAdd, accent, sub, editable = true, dim }) {
  return (
    <div className={cx(
      "rounded-md border border-white/[0.05] bg-black/25 px-2 py-1.5",
      dim && "opacity-60"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        {auto && <AutoBadge />}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-1">
        <span className={cx(
          "font-mono text-[14px] font-semibold tabular-nums",
          accent || "text-zinc-100"
        )}>{value}</span>
        {teamAdd && <TeamPlus>{teamAdd}</TeamPlus>}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[9px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function StatRow({ label, value, sub, auto, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-zinc-400">{label}</span>
        {auto && <AutoBadge />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cx("font-mono text-[12.5px] tabular-nums", accent || "text-zinc-100")}>{value}</span>
        {sub && <span className="font-mono text-[10px] text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

function SegToggle({ options, value, dense = false, onChange = () => {} }) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.07] bg-black/30 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative rounded-md font-medium transition-colors whitespace-nowrap",
              dense ? "h-6 px-2 text-[11px]" : "h-7 px-3 text-[12px]",
              active
                ? "bg-violet-500/15 text-violet-100 shadow-[inset_0_0_0_1px_oklch(0.65_0.18_290_/_0.5)]"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Pill({ children, tone = "neutral", className }) {
  const tones = {
    neutral: "border-white/[0.07] bg-white/[0.04] text-zinc-300",
    violet:  "border-violet-400/30 bg-violet-500/15 text-violet-100",
    amber:   "border-amber-400/25 bg-amber-500/10 text-amber-200",
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    rose:    "border-rose-400/25 bg-rose-500/10 text-rose-200",
  };
  return (
    <span className={cx(
      "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium uppercase tracking-wider",
      tones[tone],
      className
    )}>
      {children}
    </span>
  );
}

function Slider({ value, min = 1, max = 5, label, marks = true, hue = 290 }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      {label !== undefined && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[11px] text-zinc-400">{label}</span>
          <span className="font-mono text-[11px] text-zinc-200">
            Lv{value}<span className="text-zinc-500"> / {max}</span>
          </span>
        </div>
      )}
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.05]" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, oklch(0.55 0.18 ${hue}), oklch(0.78 0.18 ${hue}))` }}
        />
        {marks && Array.from({ length: max - min + 1 }, (_, i) => {
          const p = (i / (max - min)) * 100;
          const filled = i + min <= value;
          return (
            <span
              key={i}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${p}%`,
                width: 6,
                height: 6,
                background: filled ? `oklch(0.85 0.15 ${hue})` : "oklch(0.35 0.02 270)",
                boxShadow: filled ? `0 0 8px oklch(0.78 0.18 ${hue} / 0.7)` : "none",
              }}
            />
          );
        })}
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2"
          style={{
            left: `${pct}%`,
            width: 12,
            height: 12,
            background: `oklch(0.92 0.05 ${hue})`,
            boxShadow: `0 0 12px oklch(0.78 0.18 ${hue})`,
            // ringColor approximation
            outline: `2px solid oklch(0.78 0.18 ${hue} / 0.3)`,
          }}
        />
      </div>
    </div>
  );
}

function Checkbox({ label, sub, checked = false, autoOn = false, dense, tone }) {
  const toneOn = {
    emerald: { bd: "border-emerald-400/70 bg-emerald-500/30", tx: "text-emerald-100" },
    rose:    { bd: "border-rose-400/70 bg-rose-500/30",       tx: "text-rose-100" },
    violet:  { bd: "border-violet-400/70 bg-violet-500/30",   tx: "text-violet-100" },
  }[tone] || { bd: "border-violet-400/70 bg-violet-500/30", tx: "text-violet-100" };

  return (
    <label className={cx("flex cursor-pointer items-start gap-2", dense ? "py-0.5" : "py-1")}>
      <span
        className={cx(
          "mt-[2px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
          checked ? toneOn.bd : "border-white/15 bg-black/30"
        )}
      >
        {checked && (
          <svg viewBox="0 0 8 8" className={cx("h-2 w-2", toneOn.tx)} fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M1.5 4.2 L3.2 5.8 L6.5 2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cx("text-[11.5px] leading-tight", checked ? "text-zinc-100" : "text-zinc-300")}>{label}</span>
          {autoOn && <AutoBadge />}
        </span>
        {sub && <span className="block text-[10px] leading-tight text-zinc-500">{sub}</span>}
      </span>
    </label>
  );
}

// Compact text/numeric input — used in stat cells and buff rows.
function NumInput({ value, suffix = "%", width = 60, disabled, accent }) {
  return (
    <span className={cx(
      "inline-flex h-5 items-center gap-0.5 rounded border border-white/[0.07] bg-black/30 pl-1.5 pr-1 font-mono text-[11px] tabular-nums",
      disabled ? "text-zinc-500" : (accent || "text-zinc-100")
    )} style={{ width }}>
      <span className="flex-1 text-right">{value}</span>
      <span className="text-zinc-500">{suffix}</span>
    </span>
  );
}

// Crisp avatar tile placeholder. Initial over a gradient seeded from the
// element hue, so badge colors and avatars feel cohesive.
function Avatar({ name, element, size = 36, ring = true }) {
  const e = ELEMENTS[element] || ELEMENTS.dark;
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(120% 120% at 20% 0%, ${e.fg.replace(")", " / 0.55)")}, oklch(0.20 0.02 270) 70%)`,
        border: ring ? `1px solid ${e.bd}` : "1px solid transparent",
      }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-bold text-white/90"
        style={{ fontSize: Math.round(size * 0.5), textShadow: "0 1px 2px rgb(0 0 0 / 0.6)" }}
      >
        {initial}
      </span>
      {ring && (
        <span
          className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
          style={{ background: e.fg, boxShadow: `0 0 6px ${e.fg}` }}
        />
      )}
    </div>
  );
}

// Striped placeholder for monster art / equipment art / portraits we don't have
function Strip({ label = "art", className, style }) {
  return (
    <div
      className={cx("relative overflow-hidden rounded-md border border-white/10", className)}
      style={{
        background:
          "repeating-linear-gradient(135deg, oklch(0.22 0.02 270) 0 8px, oklch(0.18 0.02 270) 8px 16px)",
        ...style,
      }}
    >
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

// — Icons — kept tiny and stroke-based so they live well next to text.
function ChevronDown({ className = "h-3 w-3" }) {
  return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4.5 L6 8 L9 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function ChevronRight({ className = "h-3 w-3" }) {
  return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4.5 3 L8 6 L4.5 9" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function Search({ className = "h-3.5 w-3.5" }) {
  return (<svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6" cy="6" r="4" /><path d="M9 9 L12 12" strokeLinecap="round" /></svg>);
}
function Bolt({ className = "h-3 w-3" }) {
  return (<svg viewBox="0 0 12 12" className={className} fill="currentColor">
    <path d="M6.5 1 L2.5 7 L5.5 7 L4.5 11 L9 5 L6.5 5 L7.5 1 Z" /></svg>);
}
function Gear({ className = "h-4 w-4" }) {
  return (<svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="8" r="2.4" />
    <path d="M8 1.5 V3.5 M8 12.5 V14.5 M1.5 8 H3.5 M12.5 8 H14.5 M3.3 3.3 L4.6 4.6 M11.4 11.4 L12.7 12.7 M3.3 12.7 L4.6 11.4 M11.4 4.6 L12.7 3.3" strokeLinecap="round" />
  </svg>);
}
function ShareIcon({ className = "h-3.5 w-3.5" }) {
  return (<svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="7" r="1.6" /><circle cx="11" cy="3" r="1.6" /><circle cx="11" cy="11" r="1.6" />
    <path d="M4.4 6.3 L9.6 3.7 M4.4 7.7 L9.6 10.3" strokeLinecap="round" /></svg>);
}
function PlusIcon({ className = "h-3 w-3" }) {
  return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 2 V10 M2 6 H10" strokeLinecap="round" /></svg>);
}
function XIcon({ className = "h-3 w-3" }) {
  return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 3 L9 9 M9 3 L3 9" strokeLinecap="round" /></svg>);
}
function StarIcon({ className = "h-3 w-3", filled = true }) {
  return (<svg viewBox="0 0 12 12" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1">
    <path d="M6 1.4 L7.45 4.5 L10.7 4.95 L8.25 7.2 L8.85 10.4 L6 8.85 L3.15 10.4 L3.75 7.2 L1.3 4.95 L4.55 4.5 Z" strokeLinejoin="round" /></svg>);
}
function WarnIcon({ className = "h-3.5 w-3.5" }) {
  return (<svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 1.5 L13 12 H1 Z" strokeLinejoin="round" /><path d="M7 5.5 V8.2" strokeLinecap="round" /><circle cx="7" cy="10" r="0.6" fill="currentColor" stroke="none" /></svg>);
}

// Tiny stat icon set for the buff matrix. Each shape stands in for a stat
// without leaning on emoji. Recolored via currentColor.
function BuffStatIcon({ stat, className = "h-3 w-3" }) {
  switch (stat) {
    case "atk":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M2 8 L8 2 L10 4 L4 10 Z" /></svg>);
    case "def":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 1.5 L10.5 3 V7 C10.5 9 8.5 10.4 6 11 C3.5 10.4 1.5 9 1.5 7 V3 Z" strokeLinejoin="round"/></svg>);
    case "chc":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.4" fill="currentColor"/></svg>);
    case "chd":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M6 1 L7.6 4.6 L11.4 5 L8.6 7.6 L9.4 11.2 L6 9.3 L2.6 11.2 L3.4 7.6 L0.6 5 L4.4 4.6 Z"/></svg>);
    case "pen":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 6 H10.5 M8 3.5 L10.5 6 L8 8.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "dmg":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M6 1 L8.5 5 L11 6 L8.5 7 L6 11 L3.5 7 L1 6 L3.5 5 Z"/></svg>);
    case "eff":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.2"/><path d="M4 6 L5.5 7.5 L8.2 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "res":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 1.5 L10.5 3.5 L9 10.5 L6 11.5 L3 10.5 L1.5 3.5 Z" strokeLinejoin="round"/></svg>);
    case "dr":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4"/><path d="M3.5 3.5 L8.5 8.5" strokeLinecap="round"/></svg>);
    case "spd":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M3 2 H8 L11 6 L8 10 H3 L6 6 Z"/></svg>);
    case "acc":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.2"/><circle cx="6" cy="6" r="2"/><circle cx="6" cy="6" r="0.4" fill="currentColor"/></svg>);
    case "shld":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M6 1.2 L10.5 3 V6.5 C10.5 8.8 8.6 10.4 6 11 C3.4 10.4 1.5 8.8 1.5 6.5 V3 Z"/></svg>);
    case "imm":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.2"/><path d="M3.5 3.5 L8.5 8.5" strokeLinecap="round"/></svg>);
    case "cdr":
      return (<svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 9 L6 3 L10 9 Z" strokeLinejoin="round"/></svg>);
    case "marked":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><circle cx="6" cy="6" r="4.5" opacity="0.4"/><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="6" r="1" fill="oklch(0.13 0.01 270)"/></svg>);
    case "bleed":
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><path d="M6 1 C7.5 4 10 6 10 8 A4 4 0 0 1 2 8 C2 6 4.5 4 6 1 Z"/></svg>);
    default:
      return (<svg viewBox="0 0 12 12" className={className} fill="currentColor"><circle cx="6" cy="6" r="2.5"/></svg>);
  }
}

Object.assign(window, {
  cx, ElementBadge, ClassBadge, AutoBadge, TeamPlus, Card, StatCell, StatRow,
  SegToggle, Pill, Slider, Checkbox, NumInput, Avatar, Strip,
  ChevronDown, ChevronRight, Search, Bolt, Gear, ShareIcon, PlusIcon, XIcon, StarIcon, WarnIcon,
  BuffStatIcon,
});
