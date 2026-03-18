'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatEffectText } from '@/lib/format-text';

type OptionItem = { id: string; label: string; icon?: string; image?: string };
type Options = { buffs: OptionItem[]; debuffs: OptionItem[]; tags: OptionItem[] };

const CHAIN_TYPES = ['Start', 'Join', 'Finish'];
const RANKS = ['SS', 'S', 'A', 'B', 'C'];
const ROLES = ['dps', 'support', 'sustain'];

const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE'] as const;
const SKILL_LABELS: Record<string, string> = {
  SKT_FIRST: 'Skill 1',
  SKT_SECOND: 'Skill 2',
  SKT_ULTIMATE: 'Ultimate',
  SKT_CHAIN_PASSIVE: 'Chain Passive',
};

const ELEMENT_TEXT: Record<string, string> = {
  Fire: 'text-fire', Water: 'text-water', Earth: 'text-earth', Light: 'text-light', Dark: 'text-dark',
};
const ELEMENT_BORDER: Record<string, string> = {
  Fire: 'border-fire', Water: 'border-water', Earth: 'border-earth', Light: 'border-light', Dark: 'border-dark',
};
const ROLE_BG: Record<string, string> = {
  dps: 'bg-role-dps/70', support: 'bg-role-support/70', sustain: 'bg-role-sustain/70',
};
const CHAIN_BG: Record<string, string> = {
  Start: 'bg-yellow-600/30 text-yellow-300', Join: 'bg-blue-600/30 text-blue-300', Finish: 'bg-red-600/30 text-red-300',
};

// ── Effect icon helper ──

function EffectIcon({ icon, type, size = 20 }: { icon: string; type: 'buff' | 'debuff'; size?: number }) {
  const isIrremovable = icon.includes('Interruption');
  const filterClass = isIrremovable ? '' : `${type}-icon`;
  return (
    <span className="relative inline-block shrink-0 rounded bg-black" style={{ width: size, height: size }}>
      <Image
        src={`/images/ui/effect/${icon}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className={`object-contain ${filterClass}`}
      />
    </span>
  );
}

// ── Reusable components ──

function SelectInline({ value, options, onChange, nullable }: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  nullable?: boolean;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || (nullable ? null : ''))}
      className="rounded border border-white/10 bg-zinc-800 px-2 py-1 text-sm font-semibold focus:border-blue-500 focus:outline-none"
    >
      {nullable && <option value="">—</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EffectMultiSelect({ label, selected, options, onChange, type }: {
  label: string;
  selected: string[];
  options: OptionItem[];
  onChange: (v: string[]) => void;
  type: 'buff' | 'debuff';
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  const pillBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex flex-wrap gap-1 min-h-7">
        {selected.map((id, idx) => {
          const opt = options.find(o => o.id === id);
          return (
            <span key={`${id}-${idx}`} className={`flex items-center gap-1 rounded-md ${pillBg} py-0.5 pr-1.5 pl-0.5 text-[11px] font-semibold text-white`}>
              {opt?.icon && <EffectIcon icon={opt.icon} type={type} size={18} />}
              {opt?.label ?? id}
              <button onClick={() => toggle(id)} className="ml-0.5 text-white/50 hover:text-red-400">×</button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full rounded border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
            {filtered.slice(0, 50).map((o, idx) => (
              <button
                key={`${o.id}-${idx}`}
                onMouseDown={e => { e.preventDefault(); toggle(o.id); }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-zinc-800 ${selected.includes(o.id) ? 'text-blue-400' : ''}`}
              >
                <span className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${selected.includes(o.id) ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'}`} />
                {o.icon && <EffectIcon icon={o.icon} type={type} size={18} />}
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagMultiSelect({ selected, options, onChange }: {
  selected: string[];
  options: OptionItem[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tags</span>
      <div className="flex flex-wrap gap-1 min-h-7">
        {selected.map(id => {
          const opt = options.find(o => o.id === id);
          return (
            <span key={id} className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/10">
              {opt?.image && (
                <span className="relative inline-block h-4 w-4 shrink-0">
                  <Image src={opt.image} alt="" fill sizes="16px" className="object-contain" />
                </span>
              )}
              {opt?.label ?? id}
              <button onClick={() => toggle(id)} className="text-zinc-500 hover:text-red-400">×</button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full rounded border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
            {filtered.map((o, idx) => (
              <button
                key={`${o.id}-${idx}`}
                onMouseDown={e => { e.preventDefault(); toggle(o.id); }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-zinc-800 ${selected.includes(o.id) ? 'text-blue-400' : ''}`}
              >
                <span className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${selected.includes(o.id) ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'}`} />
                {o.image && (
                  <span className="relative inline-block h-4 w-4 shrink-0">
                    <Image src={o.image} alt="" fill sizes="16px" className="object-contain" />
                  </span>
                )}
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skill section (card style) ──

/** A single skill card — icon, name, badges on the right, buffs/debuffs, then description */
function SkillCard({ icon, name, subtitle, desc, cd, wgr, offensive, target, buffs, debuffs, options, onUpdate }: {
  icon: string;
  name: string;
  subtitle: string;
  desc?: string;
  cd?: string | null;
  wgr: number;
  offensive: boolean;
  target: string;
  buffs: string[];
  debuffs: string[];
  options: Options;
  onUpdate: (field: string, value: unknown) => void;
  burnEffect?: boolean;
}) {
  return (
    <div className="card rounded-xl p-4">
      {/* Header row: icon + name on left, badges on right */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <Image src={icon} alt={name} fill sizes="48px" className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-game text-base font-bold">{name}</h3>
          <div className="text-xs text-zinc-500">{subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {cd !== undefined && (
            <label className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
              <span className="text-zinc-400">CD</span>
              <input
                type="number"
                value={cd ?? ''}
                onChange={e => onUpdate('cd', e.target.value === '' ? null : e.target.value)}
                className="w-10 bg-transparent text-center font-semibold focus:outline-none"
              />
            </label>
          )}
          <label className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
            <span className="text-zinc-400">WGR</span>
            <input
              type="number"
              value={wgr}
              onChange={e => onUpdate('wgr', parseInt(e.target.value) || 0)}
              className="w-10 bg-transparent text-center font-semibold focus:outline-none"
            />
          </label>
          <button
            onClick={() => onUpdate('offensive', !offensive)}
            className={`rounded px-1.5 py-0.5 text-xs font-semibold transition ${offensive ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/30' : 'bg-green-500/20 text-green-300 ring-1 ring-green-400/30'}`}
          >
            {offensive ? 'Off' : 'Sup'}
          </button>
          <button
            onClick={() => onUpdate('target', target === 'mono' ? 'multi' : 'mono')}
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-semibold"
          >
            {target === 'mono' ? 'ST' : 'AoE'}
          </button>
        </div>
      </div>

      {/* Buffs / Debuffs */}
      <div className="mb-3 space-y-3">
        <EffectMultiSelect label="Buffs" selected={buffs} options={options.buffs} onChange={v => onUpdate('buff', v)} type="buff" />
        <EffectMultiSelect label="Debuffs" selected={debuffs} options={options.debuffs} onChange={v => onUpdate('debuff', v)} type="debuff" />
      </div>

      {/* Description */}
      {desc && (
        <div className="rounded-lg bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-300">
          {formatEffectText(desc)}
        </div>
      )}
    </div>
  );
}

function SkillSection({ skillKey, skill, options, onChange, element, chainType }: {
  skillKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  skill: Record<string, any>;
  options: Options;
  onChange: (updated: Record<string, unknown>) => void;
  element: string;
  chainType: string;
}) {
  const isChainPassive = skillKey === 'SKT_CHAIN_PASSIVE';
  const hasDual = isChainPassive && skill.dual_offensive !== undefined;

  function update(field: string, value: unknown) {
    onChange({ ...skill, [field]: value });
  }

  if (isChainPassive) {
    const chainIcon = `/images/characters/chain/Skill_ChainPassive_${element}_${chainType}.webp`;
    return (
      <>
        {/* Chain card */}
        <SkillCard
          icon={chainIcon}
          name={skill.name}
          subtitle="Chain Passive"
          desc={skill.true_desc_levels?.['5']}
          wgr={skill.wgr}
          offensive={skill.offensive}
          target={skill.target}
          buffs={skill.buff ?? []}
          debuffs={skill.debuff ?? []}
          options={options}
          onUpdate={(field, value) => {
            if (field === 'buff' || field === 'debuff' || field === 'wgr' || field === 'offensive' || field === 'target') {
              update(field, value);
            }
          }}
        />
        {/* Dual Attack card */}
        {hasDual && (
          <SkillCard
            icon={chainIcon}
            name={skill.name}
            subtitle="Dual Attack"
            wgr={skill.wgr_dual ?? 0}
            offensive={skill.dual_offensive}
            target={skill.dual_target}
            buffs={skill.dual_buff ?? []}
            debuffs={skill.dual_debuff ?? []}
            options={options}
            onUpdate={(field, value) => {
              const fieldMap: Record<string, string> = {
                wgr: 'wgr_dual', offensive: 'dual_offensive', target: 'dual_target',
                buff: 'dual_buff', debuff: 'dual_debuff',
              };
              update(fieldMap[field] ?? field, value);
            }}
          />
        )}
      </>
    );
  }

  const iconSrc = `/images/characters/skills/${skill.IconName}.webp`;
  return (
    <SkillCard
      icon={iconSrc}
      name={skill.name}
      subtitle={SKILL_LABELS[skillKey]}
      desc={skill.true_desc_levels?.['5']}
      cd={skill.cd}
      wgr={skill.wgr}
      offensive={skill.offensive}
      target={skill.target}
      buffs={skill.buff ?? []}
      debuffs={skill.debuff ?? []}
      options={options}
      onUpdate={update}
    />
  );
}

// ── EE Section (card only, no ranks — ranks are in overview) ──

function EeSection({ ee, id, options, onUpdate }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ee: Record<string, any> | null;
  id: string;
  options: Options;
  onUpdate: (field: string, value: unknown) => void;
}) {
  if (!ee) {
    return (
      <section>
        <h2 className="mb-4 text-2xl font-bold">Exclusive Equipment</h2>
        <p className="text-sm text-zinc-500">No EE data for this character.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold">Exclusive Equipment</h2>
      <div className="card rounded-xl p-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: info + effects */}
          <div>
            <div className="mb-3 flex items-start gap-3">
              <div className="relative h-14 w-14 shrink-0">
                <Image
                  src={`/images/characters/ee/${id}.webp`}
                  alt={ee.name}
                  fill
                  sizes="56px"
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-game text-lg font-bold">{ee.name}</h3>
                <div className="mt-1 text-xs text-zinc-500">{ee.mainStat}</div>
              </div>
            </div>

            {ee.effect && (
              <div className="mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Effect</span>
                <div className="mt-1 rounded-lg bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-300">
                  {formatEffectText(ee.effect)}
                </div>
              </div>
            )}
            {ee.effect10 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Effect +10</span>
                <div className="mt-1 rounded-lg bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-300">
                  {formatEffectText(ee.effect10)}
                </div>
              </div>
            )}
          </div>

          {/* Right: buffs/debuffs + save */}
          <div className="space-y-3">
            <EffectMultiSelect label="Buffs" selected={ee.buff ?? []} options={options.buffs} onChange={v => onUpdate('buff', v)} type="buff" />
            <EffectMultiSelect label="Debuffs" selected={ee.debuff ?? []} options={options.debuffs} onChange={v => onUpdate('debuff', v)} type="debuff" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main page ──

export default function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ee, setEe] = useState<Record<string, any> | null>(null);
  const [eeLoaded, setEeLoaded] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/characters/${id}`).then(r => r.json()),
      fetch('/api/admin/options').then(r => r.json()),
      fetch(`/api/admin/ee/${id}`).then(r => r.json()),
    ]).then(([charData, opts, eeData]) => {
      setData(charData);
      setOptions(opts);
      setEe(eeData);
      setEeLoaded(true);
    });
  }, [id]);

  const updateField = useCallback((field: string, value: unknown) => {
    setData(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const updateSkill = useCallback((skillKey: string, updated: Record<string, unknown>) => {
    setData(prev => prev ? { ...prev, skills: { ...prev.skills, [skillKey]: updated } } : prev);
  }, []);

  const updateEe = useCallback((field: string, value: unknown) => {
    setEe(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  async function handleSave() {
    if (!data) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // Save character + EE in parallel
      const promises: Promise<Response>[] = [
        fetch('/api/admin/characters', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
      ];

      if (ee) {
        promises.push(
          fetch(`/api/admin/ee/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rank: ee.rank, buff: ee.buff, debuff: ee.debuff, rank10: ee.rank10 }),
          })
        );
      }

      const results = await Promise.all(promises);
      const failed = results.find(r => !r.ok);
      if (failed) {
        const err = await failed.json();
        setError(err.error || 'Save failed');
      } else {
        setSuccess('Saved!');
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!data || !options) {
    return <div className="flex justify-center py-20"><p className="text-zinc-500">Loading...</p></div>;
  }

  const element = data.Element as string;
  const role = data.role as string;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:px-6">

      {/* ── Save bar ── */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-3 bg-black/60 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <button onClick={() => router.push('/admin/editor/characters')} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back
        </button>
        <div className="flex-1" />
        {error && <span className="text-sm text-red-400">{error}</span>}
        {success && <span className="text-sm text-green-400">{success}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold shadow-lg transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* ── Overview section ── */}
      <section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
          {/* Portrait */}
          <div className="relative mx-auto h-100 w-90 overflow-hidden rounded shadow">
            <Image
              src={`/images/characters/full/IMG_${id}.webp`}
              alt={data.Fullname}
              fill
              sizes="360px"
              priority
              className="object-contain"
            />
          </div>

          {/* Info */}
          <div className="space-y-4">
            <h1 className="font-game text-3xl font-bold">{data.Fullname}</h1>
            <span className="font-mono text-sm text-zinc-600">{id}</span>

            {/* Stars */}
            <div className="flex items-center gap-1">
              {[...Array(data.Rarity)].map((_, i) => (
                <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={22} height={22} />
              ))}
            </div>

            {/* Element + Class */}
            <div className="flex flex-wrap items-center gap-4">
              <span className={`inline-flex items-center gap-1.5 ${ELEMENT_TEXT[element] ?? ''}`}>
                <Image src={`/images/ui/elem/CM_Element_${element}.webp`} alt={element} width={24} height={24} />
                {element}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Image src={`/images/ui/class/CM_Class_${data.Class}.webp`} alt={data.Class} width={24} height={24} />
                {data.Class}
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <Image src={`/images/ui/class/CM_Sub_Class_${data.SubClass}.webp`} alt={data.SubClass} width={24} height={24} />
                {data.SubClass}
              </span>
            </div>

            {/* Editable fields — styled as inline pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-white/10 ${CHAIN_BG[data.Chain_Type] ?? 'bg-zinc-800'}`}>
                <span className="text-xs text-zinc-400">Chain</span>
                <SelectInline value={data.Chain_Type} options={CHAIN_TYPES} onChange={v => updateField('Chain_Type', v)} />
              </div>

              <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm text-white ring-1 ring-white/10 ${ROLE_BG[role] ?? 'bg-zinc-800'}`}>
                <SelectInline value={data.role} options={ROLES} onChange={v => updateField('role', v)} />
              </div>
            </div>

            {/* Ranks */}
            <div className="flex flex-wrap items-center gap-4">
              <label className={`flex items-center gap-2 rounded-lg px-4 py-2 ring-1 ring-white/10 ${ELEMENT_BORDER[element] ?? ''}`}>
                <span className="text-sm text-zinc-400">Rank PvE</span>
                <SelectInline value={data.rank} options={RANKS} onChange={v => updateField('rank', v)} nullable />
              </label>
              <label className={`flex items-center gap-2 rounded-lg px-4 py-2 ring-1 ring-white/10 ${ELEMENT_BORDER[element] ?? ''}`}>
                <span className="text-sm text-zinc-400">Rank PvP</span>
                <SelectInline value={data.rank_pvp ?? null} options={RANKS} onChange={v => updateField('rank_pvp', v)} nullable />
              </label>
              {eeLoaded && ee && (
                <>
                  <label className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-4 py-2 ring-1 ring-white/10">
                    <span className="text-sm text-zinc-400">EE Rank</span>
                    <SelectInline value={ee.rank || null} options={RANKS} onChange={v => updateEe('rank', v ?? '')} nullable />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-4 py-2 ring-1 ring-white/10">
                    <span className="text-sm text-zinc-400">EE +10</span>
                    <SelectInline value={ee.rank10 || null} options={RANKS} onChange={v => updateEe('rank10', v ?? '')} nullable />
                  </label>
                </>
              )}
            </div>

            {/* Tags */}
            <TagMultiSelect selected={data.tags ?? []} options={options.tags} onChange={v => updateField('tags', v)} />
          </div>
        </div>
      </section>

      {/* ── Skills section ── */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Skills</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SKILL_KEYS.map(sk => {
            const skill = data.skills?.[sk];
            if (!skill) return null;
            return (
              <SkillSection
                key={sk}
                skillKey={sk}
                skill={skill}
                options={options}
                onChange={updated => updateSkill(sk, updated)}
                element={element}
                chainType={data.Chain_Type}
              />
            );
          })}
        </div>
      </section>

      {/* ── EE section ── */}
      {eeLoaded && (
        <EeSection
          ee={ee}
          id={id}
          options={options}
          onUpdate={updateEe}
        />
      )}
    </div>
  );
}
