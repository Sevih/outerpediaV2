/**
 * Bytes Parser - Parse OUTERPLANE .bytes files (Unity/.NET BinaryWriter format)
 *
 * Format:
 *   - 7-bit encoded int: table name length, then UTF-8 string
 *   - 4 bytes LE: row count
 *   - 4 bytes LE: column count
 *   - For each column: 7-bit encoded length + name string
 *   - For each row:
 *     - 4 bytes LE: field count (populated fields)
 *     - For each field:
 *       - 4 bytes LE signed: column index (-1 = unnamed/extra column)
 *       - 7-bit encoded length + value string (UTF-8)
 */

// ─── 7-bit encoded int (BinaryReader.Read7BitEncodedInt) ────────────

function read7BitInt(buf: Buffer, pos: number): [value: number, newPos: number] {
  let result = 0;
  let shift = 0;

  while (pos < buf.length) {
    const byte = buf[pos];
    pos++;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return [result, pos];
    }
    shift += 7;
  }

  throw new Error(`Unexpected end of buffer while reading 7-bit encoded int`);
}

// ─── BinaryReader-style string (7-bit length prefix + UTF-8) ────────

function readString(buf: Buffer, pos: number): [value: string, newPos: number] {
  const [len, afterLen] = read7BitInt(buf, pos);
  const str = buf.subarray(afterLen, afterLen + len).toString('utf-8');
  return [str, afterLen + len];
}

// ─── Main parser ────────────────────────────────────────────────────

export interface ParseResult {
  className: string;
  columns: Record<number, string>;
  columnCount: number;
  data: Record<string, string>[];
}

export function parseBytes(fileBuffer: Buffer): ParseResult {
  let pos = 0;

  // Table name
  const [className, afterName] = readString(fileBuffer, pos);
  pos = afterName;

  // Row count (4 bytes LE unsigned)
  const rowCount = fileBuffer.readUInt32LE(pos);
  pos += 4;

  // Column count (4 bytes LE unsigned)
  const columnCount = fileBuffer.readUInt32LE(pos);
  pos += 4;

  // Column names
  const columns: Record<number, string> = {};
  const columnList: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    const [colName, afterCol] = readString(fileBuffer, pos);
    pos = afterCol;
    columns[i] = colName;
    columnList.push(colName);
  }

  // Rows
  const data: Record<string, string>[] = [];
  for (let r = 0; r < rowCount; r++) {
    const fieldCount = fileBuffer.readUInt32LE(pos);
    pos += 4;

    const row: Record<string, string> = {};
    let unknownIdx = 0;

    for (let f = 0; f < fieldCount; f++) {
      const colIdx = fileBuffer.readInt32LE(pos);
      pos += 4;

      const [val, afterVal] = readString(fileBuffer, pos);
      pos = afterVal;

      if (colIdx >= 0 && colIdx < columnList.length) {
        row[columnList[colIdx]] = val;
      } else {
        row[`_unknown_${unknownIdx}`] = val;
        unknownIdx++;
      }
    }

    data.push(row);
  }

  if (pos !== fileBuffer.length) {
    console.warn(`Parse warning: consumed ${pos} bytes but file is ${fileBuffer.length} bytes`);
  }

  return { className, columns, columnCount, data };
}
