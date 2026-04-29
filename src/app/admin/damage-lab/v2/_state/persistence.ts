/**
 * Damage Lab v2 — versioned localStorage persistence.
 *
 *   key:     'damage-lab-form-v2'
 *   shape:   { version: 2, state: FormState }
 *   on read: parse failure or version mismatch → null (caller falls back to
 *            `makeInitialFormState`). Pre-v1 blobs are ignored, never migrated.
 *   on save: best-effort; QuotaExceeded etc. swallowed.
 *
 * Use `usePersistFormState(state)` from a `'use client'` component to write
 * with a 200ms debounce — a one-line hook that wraps `saveFormState`.
 */

import { useEffect } from 'react'
import type { FormState } from './types'

const STORAGE_KEY = 'damage-lab-form-v2'
const STORAGE_VERSION = 2

interface PersistedShape {
  version: number
  state: FormState
}

export function loadFormState(): FormState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedShape>
    if (parsed?.version !== STORAGE_VERSION || !parsed.state) return null
    return parsed.state
  } catch {
    return null
  }
}

export function saveFormState(state: FormState): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedShape = { version: STORAGE_VERSION, state }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded, private mode, etc. — no remediation, just skip.
  }
}

export function clearFormState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Save `state` to localStorage with a 200ms debounce. */
export function usePersistFormState(state: FormState): void {
  useEffect(() => {
    const timer = window.setTimeout(() => saveFormState(state), 200)
    return () => window.clearTimeout(timer)
  }, [state])
}
