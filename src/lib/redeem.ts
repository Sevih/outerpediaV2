'use client';

// Client-side state + API client for the one-click coupon redeem feature.
// Account info (UID / server) and already-redeemed codes are stored in
// localStorage only — nothing is persisted server-side by Outerpedia.

import { useState, useEffect, useCallback } from 'react';

export type RedeemServer = 'global1' | 'global2' | 'jp';

export const REDEEM_SERVERS: RedeemServer[] = ['global1', 'global2', 'jp'];

// Result keys map 1:1 to `coupons.redeem.result.*` i18n keys.
export type RedeemResultKey =
  | 'success'
  | 'user_not_found'
  | 'invalid'
  | 'expired'
  | 'exhausted'
  | 'already_used'
  | 'same_type'
  | 'maintenance'
  | 'rate_limited'
  | 'network'
  | 'unknown';

type StoredState = {
  uid: string;
  server: RedeemServer | '';
  /** code -> redemption timestamp (ms) */
  redeemed: Record<string, number>;
};

const STORAGE_KEY = 'outerplane:redeem';
const EMPTY: StoredState = { uid: '', server: '', redeemed: {} };

function load(): StoredState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      uid: typeof parsed.uid === 'string' ? parsed.uid : '',
      server: REDEEM_SERVERS.includes(parsed.server as RedeemServer)
        ? (parsed.server as RedeemServer)
        : '',
      redeemed:
        parsed.redeemed && typeof parsed.redeemed === 'object'
          ? (parsed.redeemed as Record<string, number>)
          : {},
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: StoredState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Maps the proxy's HTTP status + game return code to a localizable result key. */
export function resolveResultKey(
  httpStatus: number,
  returnCode: number | null
): RedeemResultKey {
  if (httpStatus === 429) return 'rate_limited';
  switch (returnCode) {
    case 0:
      return 'success';
    case 30241:
      return 'user_not_found';
    case 30242:
      return 'invalid';
    case 30243:
      return 'expired';
    case 30244:
      return 'exhausted';
    case 30245:
      return 'already_used';
    case 30246:
      return 'same_type';
    case 30250:
      return 'maintenance';
  }
  // No game return code: network / upstream failure (502) or unexpected shape.
  if (httpStatus === 502 || httpStatus === 0) return 'network';
  return 'unknown';
}

/** A code counts as "redeemed" once it succeeds or the API reports it as already used. */
export function isRedeemedKey(key: RedeemResultKey): boolean {
  return key === 'success' || key === 'already_used';
}

/** Calls the server-side proxy. Never throws — returns a result key. */
export async function redeemCode(params: {
  uid: string;
  server: RedeemServer;
  code: string;
}): Promise<RedeemResultKey> {
  let res: Response;
  try {
    res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    return 'network';
  }

  let returnCode: number | null = null;
  try {
    const data = (await res.json()) as { returnCode?: number | null };
    returnCode =
      typeof data.returnCode === 'number' ? data.returnCode : null;
  } catch {
    returnCode = null;
  }

  return resolveResultKey(res.status, returnCode);
}

export type UseRedeem = {
  /** False until localStorage has been read (avoids hydration mismatch). */
  loaded: boolean;
  uid: string;
  server: RedeemServer | '';
  /** True when both UID and server are set. */
  isConfigured: boolean;
  redeemed: Record<string, number>;
  saveAccount: (uid: string, server: RedeemServer | '') => void;
  clearAccount: () => void;
  markRedeemed: (code: string) => void;
};

export function useRedeem(): UseRedeem {
  const [state, setState] = useState<StoredState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(load());
    setLoaded(true);
  }, []);

  const saveAccount = useCallback(
    (uid: string, server: RedeemServer | '') => {
      setState((prev) => {
        const next = { ...prev, uid: uid.trim(), server };
        persist(next);
        return next;
      });
    },
    []
  );

  const clearAccount = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, uid: '', server: '' as const };
      persist(next);
      return next;
    });
  }, []);

  const markRedeemed = useCallback((code: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        redeemed: { ...prev.redeemed, [code]: Date.now() },
      };
      persist(next);
      return next;
    });
  }, []);

  return {
    loaded,
    uid: state.uid,
    server: state.server,
    isConfigured: state.uid.length > 0 && state.server.length > 0,
    redeemed: state.redeemed,
    saveAccount,
    clearAccount,
    markRedeemed,
  };
}
