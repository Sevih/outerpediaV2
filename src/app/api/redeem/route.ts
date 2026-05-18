import { NextRequest, NextResponse } from 'next/server';
import { REDEEM_ENABLED } from '@/lib/redeem-config';

/**
 * PROTOTYPE — Coupon redeem proxy.
 *
 * The official Outerplane coupon endpoint (`/coupon/use`) is same-origin only:
 * it sends no CORS headers, so the browser cannot call it from outerpedia.com.
 * This route proxies the request server-side (no CORS applies server-to-server).
 *
 * Flow:  browser -> POST /api/redeem -> official endpoint -> return_code
 *
 * Status: prototype. In-memory rate limiting is per-process only (not shared
 * across PM2 cluster workers). Harden before production.
 */

// Force Node runtime — Edge runtime cannot reach a non-standard HTTPS port.
export const runtime = 'nodejs';

const OFFICIAL_ENDPOINT =
  'https://coupon.outerplane.vagames.co.kr:39009/coupon/use';

// Server values accepted by the official API (in-game: Settings > Account).
const SERVERS = ['global1', 'global2', 'jp'] as const;
type Server = (typeof SERVERS)[number];

const REQUEST_TIMEOUT_MS = 15_000;

// Return codes observed on the official coupon page (RETURN_CODE_MAP).
const RETURN_CODE_MESSAGES: Record<string, string> = {
  '0': 'Redemption completed successfully.',
  '-1': 'Unknown server error.',
  '-100': 'Network error. Please try again later.',
  '30241': 'The user cannot be found. Check your UID and server.',
  '30242': 'This coupon is invalid.',
  '30243': 'The coupon has expired.',
  '30244': 'The coupon has been exhausted.',
  '30245': 'This coupon has already been used.',
  '30246': 'You have already used a coupon of the same type.',
  '30250': 'Maintenance in progress. Please try again later.',
};

/* ------------------------------------------------------------------ */
/* Rate limiting — protects the server's IP from being flagged/banned. */
/* ------------------------------------------------------------------ */

const PER_IP_LIMIT = 5; // requests per window, per client IP
const GLOBAL_LIMIT = 30; // requests per window, all clients combined
const RATE_WINDOW_MS = 60_000;

const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

function withinWindow(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < RATE_WINDOW_MS);
}

/** Returns an error message if rate-limited, otherwise null (and records the hit). */
function checkRateLimit(ip: string): string | null {
  const now = Date.now();

  globalHits = withinWindow(globalHits, now);
  if (globalHits.length >= GLOBAL_LIMIT) {
    return 'The redeem service is busy. Please try again in a minute.';
  }

  const hits = withinWindow(ipHits.get(ip) ?? [], now);
  if (hits.length >= PER_IP_LIMIT) {
    return 'Too many attempts. Please wait a minute before retrying.';
  }

  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);
  return null;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/* ------------------------------------------------------------------ */

type RedeemBody = {
  server?: unknown;
  uid?: unknown;
  code?: unknown;
};

export async function POST(req: NextRequest) {
  // --- feature flag -------------------------------------------------
  // Kept disabled until VA Games / GM Ame approve the third-party relay.
  if (!REDEEM_ENABLED) {
    return NextResponse.json(
      { ok: false, status: 'error', message: 'This feature is currently disabled.' },
      { status: 403 }
    );
  }

  // --- rate limit ---------------------------------------------------
  const limited = checkRateLimit(clientIp(req));
  if (limited) {
    return NextResponse.json(
      { ok: false, status: 'error', message: limited },
      { status: 429 }
    );
  }

  // --- parse + validate input --------------------------------------
  let body: RedeemBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, status: 'error', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const server = String(body.server ?? '').trim().toLowerCase();
  const uid = String(body.uid ?? '').trim();
  const code = String(body.code ?? '').trim();

  if (!SERVERS.includes(server as Server)) {
    return NextResponse.json(
      { ok: false, status: 'error', message: 'Invalid or missing server.' },
      { status: 400 }
    );
  }
  // UID is numeric in-game; keep the check loose but sane.
  if (!/^[0-9]{4,20}$/.test(uid)) {
    return NextResponse.json(
      { ok: false, status: 'error', message: 'Invalid or missing UID.' },
      { status: 400 }
    );
  }
  if (!/^[A-Za-z0-9]{2,40}$/.test(code)) {
    return NextResponse.json(
      { ok: false, status: 'error', message: 'Invalid or missing coupon code.' },
      { status: 400 }
    );
  }

  // --- call the official endpoint ----------------------------------
  let upstream: Response;
  try {
    upstream = await fetch(OFFICIAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ServerRegion: server,
        UserUID: uid,
        CouponCode: code,
        locale: 'en',
        nonce: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        message: 'Could not reach the coupon service. Please try again later.',
      },
      { status: 502 }
    );
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await upstream.json();
  } catch {
    data = null;
  }

  // The official API returns return_code or returnCode (shape varies).
  const rawCode =
    data && (data.return_code ?? data.returnCode ?? data.ReturnCode);
  const rc = rawCode === undefined || rawCode === null ? null : Number(rawCode);

  if (rc === null || Number.isNaN(rc)) {
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        returnCode: null,
        message:
          (data && typeof data.message === 'string' && data.message) ||
          'Unexpected response from the coupon service.',
      },
      { status: 502 }
    );
  }

  const success = rc === 0;
  return NextResponse.json({
    ok: success,
    status: success ? 'success' : 'error',
    returnCode: rc,
    message:
      RETURN_CODE_MESSAGES[String(rc)] ||
      (data && typeof data.message === 'string' && data.message) ||
      'Unknown server error.',
  });
}
