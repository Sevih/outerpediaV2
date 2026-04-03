"""
Convert .bytes game data files (Unity/.NET BinaryWriter format) to JSON.

Format:
  - 7-bit encoded int: table name length, then UTF-8 string
  - 4 bytes LE: row count
  - 4 bytes LE: column count
  - For each column: 7-bit encoded length + name string
  - For each row:
    - 4 bytes LE: field count (populated fields)
    - For each field:
      - 4 bytes LE signed: column index (-1 = unnamed/extra column)
      - 7-bit encoded length + value string (UTF-8)
"""

import struct
import json
import sys
import os
from pathlib import Path


def read_7bit_int(data, pos):
    """Read a .NET 7-bit encoded integer (BinaryReader.Read7BitEncodedInt)."""
    result = 0
    shift = 0
    while True:
        byte = data[pos]; pos += 1
        result |= (byte & 0x7F) << shift
        if (byte & 0x80) == 0:
            break
        shift += 7
    return result, pos


def read_string(data, pos):
    """Read a .NET BinaryReader-style string (7-bit length prefix + UTF-8)."""
    slen, pos = read_7bit_int(data, pos)
    s = data[pos:pos + slen].decode("utf-8", errors="replace")
    pos += slen
    return s, pos


def parse_bytes_file(filepath):
    with open(filepath, "rb") as f:
        data = f.read()

    pos = 0

    # Table name
    table_name, pos = read_string(data, pos)

    # Row count, then column count
    row_count = struct.unpack_from("<I", data, pos)[0]; pos += 4
    col_count = struct.unpack_from("<I", data, pos)[0]; pos += 4

    # Column names
    columns = []
    for _ in range(col_count):
        s, pos = read_string(data, pos)
        columns.append(s)

    # Rows
    rows = []
    for _ in range(row_count):
        field_count = struct.unpack_from("<I", data, pos)[0]; pos += 4
        row = {}
        unknown_idx = 0
        for __ in range(field_count):
            fidx = struct.unpack_from("<i", data, pos)[0]; pos += 4
            val, pos = read_string(data, pos)
            if 0 <= fidx < len(columns):
                row[columns[fidx]] = val
            else:
                row[f"_unknown_{unknown_idx}"] = val
                unknown_idx += 1
        rows.append(row)

    assert pos == len(data), f"Parse error: consumed {pos} bytes but file is {len(data)} bytes"

    return {
        "table": table_name,
        "columns": columns,
        "rows": rows,
    }


def main():
    bytes_dir = Path(__file__).parent
    out_dir = bytes_dir / "json"
    out_dir.mkdir(exist_ok=True)

    files = sorted(bytes_dir.glob("*.bytes"))
    success = 0
    errors = []

    for f in files:
        try:
            result = parse_bytes_file(f)
            out_path = out_dir / f"{f.stem}.json"
            with open(out_path, "w", encoding="utf-8") as out:
                json.dump(result["rows"], out, ensure_ascii=False, indent=2)
            success += 1
        except Exception as e:
            errors.append((f.name, str(e)))

    print(f"Converted: {success}/{len(files)}")
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for name, err in errors:
            print(f"  {name}: {err}")


if __name__ == "__main__":
    main()
