/**
 * Bytes Parser - Parse OUTERPLANE .bytes templet files
 *
 * Port of ParserV3/bytes_parser.py
 *
 * Binary format:
 *   [HEADER] <7-null> [ENTRY_1] <7-null> [ENTRY_2] ...
 *
 * Header:  [len][class_name] <3-null> [col_count LE] <3-null> [col_names...]
 * Entry:   [VLQ:payload_len][payload][VLQ:col_idx] <3-null> ...
 */

import { decodeWithLangPrior } from './lang';

// ─── Separators ─────────────────────────────────────────────────────

const SEP_LINE_7 = Buffer.from([0, 0, 0, 0, 0, 0, 0]);
const SEP_LINE_4 = Buffer.from([0, 0, 0, 0]);
const SEP_FIELD = Buffer.from([0, 0, 0]);
const SEP_MINI = Buffer.from([0, 0]);

type SeparatorMode = 'auto' | '7-null' | '4-null';

// ─── Buffer split utility ───────────────────────────────────────────

function bufferSplit(buf: Buffer, sep: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;

  while (start <= buf.length) {
    const idx = buf.indexOf(sep, start);
    if (idx === -1) {
      parts.push(buf.subarray(start));
      break;
    }
    parts.push(buf.subarray(start, idx));
    start = idx + sep.length;
  }

  return parts;
}

// ─── VLQ reading ────────────────────────────────────────────────────

function readVlq(buf: Buffer, start: number): [value: number | null, bytesRead: number] {
  if (start >= buf.length) return [null, 0];

  let result = 0;
  let shift = 0;
  let i = start;

  while (i < buf.length) {
    const byte = buf[i];
    result |= (byte & 0x7F) << shift;
    i++;
    if ((byte & 0x80) === 0) {
      return [result, i - start];
    }
    shift += 7;
  }

  return [null, i - start];
}

// ─── Field iteration ────────────────────────────────────────────────

interface FieldSlice {
  start: number;
  end: number;
}

function* iterFields(buf: Buffer, sep: Buffer): Generator<FieldSlice> {
  const n = buf.length;
  const m = sep.length;
  if (n === 0) return;

  let i = 0;
  let last = 0;

  while (i <= n - m) {
    if (buf.subarray(i, i + m).equals(sep)) {
      if (i > last) yield { start: last, end: i };
      i += m;
      last = i;
    } else {
      i++;
    }
  }

  if (last < n) yield { start: last, end: n };
}

// ─── Main parser ────────────────────────────────────────────────────

export interface ParseResult {
  className: string;
  columns: Record<number, string>;
  columnCount: number;
  data: Record<string, string>[];
}

export function parseBytes(fileBuffer: Buffer, separatorMode: SeparatorMode = 'auto'): ParseResult {
  // 1. Split header and body
  let parts: Buffer[];

  if (separatorMode === '7-null') {
    parts = bufferSplit(fileBuffer, SEP_LINE_7);
  } else if (separatorMode === '4-null') {
    parts = bufferSplit(fileBuffer, SEP_LINE_4);
  } else {
    // Auto: try 7-null first, fallback to 4-null
    parts = bufferSplit(fileBuffer, SEP_LINE_7);
    if (parts.length === 1) {
      parts = bufferSplit(fileBuffer, SEP_LINE_4);
    }
  }

  if (parts.length === 0) {
    return { className: '', columns: {}, columnCount: 0, data: [] };
  }

  const headerBuf = parts[0];
  const bodyEntries = parts.slice(1);

  // 2. Parse header
  const { className, columns, columnCount } = parseHeader(headerBuf);

  // 3. Parse body
  const data = parseBody(bodyEntries, columns);

  return { className, columns, columnCount, data };
}

// ─── Header parsing ─────────────────────────────────────────────────

function parseHeader(headerBuf: Buffer): {
  className: string;
  columns: Record<number, string>;
  columnCount: number;
} {
  if (headerBuf.length === 0) {
    return { className: '', columns: {}, columnCount: 0 };
  }

  let pieces: Buffer[];
  const fieldParts = bufferSplit(headerBuf, SEP_FIELD);

  // Handle compact format
  if (fieldParts.length < 3) {
    pieces = bufferSplit(fieldParts[0], SEP_MINI);
    if (fieldParts.length > 1) {
      pieces.push(fieldParts[1]);
    }
  } else {
    pieces = fieldParts;
  }

  // Parse class name: [length byte][name bytes]
  let className = '';
  if (pieces[0] && pieces[0].length > 0) {
    const nameLen = pieces[0][0];
    const rawName = pieces[0].subarray(1, 1 + nameLen);
    className = decodeWithLangPrior('class_name', rawName);
  }

  // Parse column count (little-endian)
  let columnCount = 0;
  if (pieces.length > 1 && pieces[1].length > 0) {
    columnCount = pieces[1].readUIntLE(0, Math.min(pieces[1].length, 4));
  }

  // Parse column names: [length][bytes]...
  const columns: Record<number, string> = {};
  if (pieces.length > 2 && pieces[2] && pieces[2].length > 0) {
    const blob = pieces[2];
    let i = 0;
    let colIdx = 1; // 1-based

    while (i < blob.length && (columnCount === 0 || colIdx <= columnCount)) {
      const length = blob[i];
      i++;
      const fieldBytes = blob.subarray(i, i + length);
      i += length;

      if (fieldBytes.length > 0) {
        const field = decodeWithLangPrior('column_name', fieldBytes);
        if (field) {
          columns[colIdx] = field;
        }
      }
      colIdx++;
    }
  }

  // Infer column count if needed
  if (columnCount === 0 && Object.keys(columns).length > 0) {
    columnCount = Math.max(...Object.keys(columns).map(Number));
  }

  return { className, columns, columnCount };
}

// ─── Body parsing ───────────────────────────────────────────────────

function parseBody(entries: Buffer[], columns: Record<number, string>): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const maxColIdx = Math.max(...Object.keys(columns).map(Number), 0);

  for (const entry of entries) {
    if (entry.length === 0) continue;

    // Collect all fields first so we can detect the last-field colIdx anomaly
    const fieldSlices: FieldSlice[] = [];
    for (const slice of iterFields(entry, SEP_FIELD)) {
      fieldSlices.push(slice);
    }

    const parsed: { rawBytes: Buffer; colIdx: number | null }[] = [];

    for (const { start, end } of fieldSlices) {
      const blob = entry.subarray(start, end);
      if (blob.length === 0) continue;

      const [length, nLen] = readVlq(blob, 0);
      if (length === null) continue;

      const dataStart = nLen;
      const dataEnd = dataStart + length;
      if (dataEnd > blob.length) continue;

      const rawBytes = blob.subarray(dataStart, dataEnd);
      const [colIdx] = readVlq(blob, dataEnd);

      parsed.push({ rawBytes, colIdx });
    }

    // Fix last-field anomaly: the last field's trailing byte is a metadata marker,
    // not a real colIdx. Detect this when the last colIdx regresses below the previous.
    if (parsed.length >= 2) {
      const last = parsed[parsed.length - 1];
      const prev = parsed[parsed.length - 2];
      if (last.colIdx !== null && prev.colIdx !== null && last.colIdx <= prev.colIdx) {
        // Last colIdx is a false marker. Deduce the real column by elimination:
        // find the smallest column index > prev.colIdx that isn't already used.
        const usedCols = new Set(parsed.slice(0, -1).map(p => p.colIdx).filter((c): c is number => c !== null));
        let deduced: number | null = null;
        for (let ci = prev.colIdx + 1; ci <= maxColIdx; ci++) {
          if (ci in columns && !usedCols.has(ci)) { deduced = ci; break; }
        }
        last.colIdx = deduced;
      }
    }

    // Build row
    const row: Record<string, string> = {};
    let lastValidKey: string | null = null;

    for (const { rawBytes, colIdx } of parsed) {
      let key: string | null;
      if (colIdx === null || !(colIdx in columns)) {
        key = lastValidKey;
      } else {
        key = columns[colIdx];
        lastValidKey = key;
      }

      if (key === null) continue;

      let finalKey = key;
      let suffix = 1;
      while (finalKey in row) {
        finalKey = `${key}_fallback${suffix}`;
        suffix++;
      }

      row[finalKey] = decodeWithLangPrior(key, Buffer.from(rawBytes));
    }

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}
