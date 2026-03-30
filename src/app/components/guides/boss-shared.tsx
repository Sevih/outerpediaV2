'use client';

import React, { use } from 'react';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { effectMapsPromise } from '@/lib/data/effects-client';
import { ELEMENT_TOKENS, CLASS_TOKENS, escapeRegex } from '@/lib/boss-utils';
import type { Lang } from '@/lib/i18n/config';
import type { Effect } from '@/types/effect';

/* ── formatBossDesc ────────────────────────────────────────
 * Parses boss skill descriptions:
 *   - <color=#HEX>...</color> tags (supports nesting)
 *   - \\n / \n line breaks
 *   - (when lang is provided) element/class token replacement
 * ──────────────────────────────────────────────────────── */

export function formatBossDesc(text: string, lang?: Lang): React.ReactNode {
  if (!text) return null;

  const normalized = text.replace(/\\n/g, '\n');

  let elemMap: Record<string, string> | undefined;
  let classMap: Record<string, string> | undefined;
  let tokenOnly: RegExp | undefined;

  if (lang) {
    elemMap = ELEMENT_TOKENS[lang];
    classMap = CLASS_TOKENS[lang];
    const allTokens = [...Object.keys(elemMap), ...Object.keys(classMap)]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|');
    const wb = lang === 'en' ? '\\b' : '';
    tokenOnly = new RegExp(`${wb}(${allTokens})${wb}`, 'g');
  }

  let key = 0;

  function parseTokens(fragment: string): React.ReactNode[] {
    if (!tokenOnly || !elemMap || !classMap) return [fragment];
    const nodes: React.ReactNode[] = [];
    let li = 0;
    let m: RegExpExecArray | null;
    tokenOnly.lastIndex = 0;
    while ((m = tokenOnly.exec(fragment)) !== null) {
      if (m.index > li) nodes.push(fragment.slice(li, m.index));
      const tok = m[1];
      if (elemMap[tok]) nodes.push(<ElementInline key={key++} element={elemMap[tok]} />);
      else if (classMap[tok]) nodes.push(<ClassInline key={key++} name={classMap[tok]} />);
      li = tokenOnly.lastIndex;
    }
    if (li < fragment.length) nodes.push(fragment.slice(li));
    return nodes;
  }

  // Stack-based parser that handles nested <color> tags
  function parse(str: string): React.ReactNode[] {
    const tagRegex = /<color=(#[0-9a-fA-F]{6})>|<\/color>|\n/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...parseTokens(str.slice(lastIndex, match.index)));
      }

      if (match[1]) {
        // Opening <color=#HEX> — find matching </color> by depth
        const color = match[1];
        const contentStart = tagRegex.lastIndex;
        let depth = 1;
        while (depth > 0 && (match = tagRegex.exec(str)) !== null) {
          if (match[1]) depth++;
          else if (match[0] === '</color>') depth--;
        }
        const contentEnd = match ? match.index : str.length;
        parts.push(
          <span key={key++} style={{ color }}>
            {parse(str.slice(contentStart, contentEnd))}
          </span>,
        );
        if (!match) {
          // Unclosed tag — rest of string consumed, stop parsing
          lastIndex = str.length;
          break;
        }
        lastIndex = tagRegex.lastIndex;
      } else if (match[0] === '</color>') {
        // Stray closing tag — skip
        lastIndex = tagRegex.lastIndex;
      } else {
        // Line break
        parts.push(<br key={key++} />);
        lastIndex = tagRegex.lastIndex;
      }
    }

    if (lastIndex < str.length) {
      parts.push(...parseTokens(str.slice(lastIndex)));
    }

    return parts;
  }

  return parse(normalized);
}

/* ── ImmuneList ────────────────────────────────────────── */

function resolveGroup(
  name: string,
  buffMap: Record<string, Effect>,
  debuffMap: Record<string, Effect>,
): string {
  if (name.startsWith('ST_')) return `BT_STAT|${name}`;
  const effect = debuffMap[name] ?? buffMap[name];
  return effect?.group ?? name;
}

type ImmuneListProps = {
  immuneStr: string;
  statImmuneStr: string;
  headingTag?: 'h4' | 'h5';
};

export function ImmuneList({ immuneStr, statImmuneStr, headingTag: Tag = 'h5' }: ImmuneListProps) {
  const { t } = useI18n();
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const raw: string[] = [];
  if (immuneStr) raw.push(...immuneStr.split(',').map((s) => resolveGroup(s.trim(), buffMap, debuffMap)).filter(Boolean));
  if (statImmuneStr) raw.push(...statImmuneStr.split(',').map((s) => resolveGroup(s.trim(), buffMap, debuffMap)).filter(Boolean));
  const items = [...new Set(raw)];
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Tag className="text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
        {t('guides.boss_display.immunities')}
      </Tag>
      <BuffDebuffDisplay buffs={[]} debuffs={items} iconOnly />
    </div>
  );
}
