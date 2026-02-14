"""
Bytes Parser - Parse OUTERPLANE .bytes templet files

This module parses binary .bytes files from OUTERPLANE game data.
These files contain structured data in a custom binary format with:
- Variable-length quantity (VLQ) encoding for integers
- Length-prefixed strings
- Null-byte separators for structure

File Structure:
    [HEADER]<SEPARATOR_LINE>[ENTRY_1]<SEPARATOR_LINE>[ENTRY_2]...

Header Format:
    [1 byte: class_name length][class_name bytes]<SEPARATOR_FIELD>
    [little-endian: column count]<SEPARATOR_FIELD>
    [column names: [1 byte length][name bytes]...]

Entry Format:
    [VLQ: payload length][payload bytes][VLQ: column index]<SEPARATOR_FIELD>...

Separators:
    - SEPARATOR_LINE: 7 null bytes (0x00 x 7) - separates entries
    - SEPARATOR_FIELD: 3 null bytes (0x00 x 3) - separates fields within entry
    - SEPARATOR_MINI: 2 null bytes (0x00 x 2) - used in compact headers

Performance Optimizations:
    - memoryview for zero-copy field iteration
    - VLQ parsing without intermediate allocations
    - Centralized text decoding with lang.py

Usage:
    from bytes_parser import Bytes_parser

    parser = Bytes_parser("BuffTemplet.bytes")
    data = parser.get_data()  # List of dicts with decoded field values
    columns = parser.get_columns()  # Dict mapping column indices to names

Author: ParserV3
Date: 2025-10
"""
from __future__ import annotations

from typing import Dict, List, Tuple, Optional, Iterator, Generator
from lang import decode_with_lang_prior


class Bytes_parser:
    """
    Parse OUTERPLANE .bytes templet files into structured data

    Handles binary parsing with:
    - Variable-length quantity (VLQ) integer encoding
    - Length-prefixed string fields
    - Multi-language text decoding (via lang.py)
    - Zero-copy parsing using memoryview for performance
    """

    # Binary separators used in .bytes file format
    SEPARATOR_LINE_7 = b"\x00\x00\x00\x00\x00\x00\x00"  # 7 nulls (new format)
    SEPARATOR_LINE_4 = b"\x00\x00\x00\x00"  # 4 nulls (legacy format)
    SEPARATOR_FIELD = b"\x00\x00\x00"  # 3 nulls separate fields within an entry
    SEPARATOR_MINI = b"\x00\x00"  # 2 nulls used in compact header format

    def __init__(self, file_path: str, separator_mode: str = "auto"):
        """
        Initialize parser and parse the .bytes file

        Automatically performs:
        1. Split file into header and body entries
        2. Parse header to extract class name and column definitions
        3. Parse body entries into structured data rows

        Args:
            file_path: Path to the .bytes file to parse
            separator_mode: Separator detection mode ("auto", "7-null", "4-null")
                - "auto": Try 7-null first, fallback to 4-null (default)
                - "7-null": Force 7 null bytes separator (new format)
                - "4-null": Force 4 null bytes separator (legacy format)
        """
        # Binary storage (internal)
        self.header: bytes = b""
        self.body: List[bytes] = []

        # Decoded metadata
        self.class_name: str = ""
        self.column_number: int = 0
        self.column: Dict[int, str] = {}

        # Final decoded data (list of row dictionaries)
        self.data: List[Dict[str, str]] = []

        # Store separator mode
        self.separator_mode: str = separator_mode

        # Perform parsing pipeline
        self.split_head_body(file_path)
        self.defineHead()
        self.parse_body()

    # =============================================================================
    # PUBLIC API
    # =============================================================================

    def get_data(self) -> List[Dict[str, str]]:
        """
        Get parsed data rows

        Returns:
            List of dictionaries, where each dict represents a row with
            column names as keys and decoded values as strings
        """
        return self.data

    def get_columns(self) -> Dict[int, str]:
        """
        Get column definitions

        Returns:
            Dictionary mapping column index (1-based) to column name
        """
        return self.column

    # =============================================================================
    # FILE READING
    # =============================================================================

    def split_head_body(self, file_path: str) -> None:
        """
        Read file and split into header and body entries

        Respects self.separator_mode:
        - "auto": Tries SEPARATOR_LINE_7 first, falls back to SEPARATOR_LINE_4
        - "7-null": Force use of SEPARATOR_LINE_7 (7 null bytes)
        - "4-null": Force use of SEPARATOR_LINE_4 (4 null bytes)

        Split result:
        - parts[0]: header
        - parts[1:]: body entries (one per data row)

        Args:
            file_path: Path to the .bytes file
        """
        with open(file_path, "rb") as f:
            data = f.read()

        # Choose separator based on mode
        if self.separator_mode == "7-null":
            # Force 7-null separator
            parts = data.split(self.SEPARATOR_LINE_7)
        elif self.separator_mode == "4-null":
            # Force 4-null separator
            parts = data.split(self.SEPARATOR_LINE_4)
        else:
            # Auto mode: try 7-null first, fallback to 4-null
            parts = data.split(self.SEPARATOR_LINE_7)
            if len(parts) == 1:
                parts = data.split(self.SEPARATOR_LINE_4)

        if not parts:
            # Empty file - keep everything empty
            self.header = b""
            self.body = []
            return

        self.header = parts[0]
        # Everything after header (may contain empty entries)
        self.body = parts[1:]

    # =============================================================================
    # HEADER PARSING
    # =============================================================================

    def defineHead(self) -> None:
        """
        Parse header to extract class name and column definitions

        Expected header structure:
            pieces[0] = class name: [1 byte: length] + [name bytes]
            pieces[1] = column count (little-endian integer)
            pieces[2] = column names: concatenated [1 byte: length][name bytes]...

        Note: Some files use a "compact" format where pieces[0] contains both
        class name and column count separated by SEPARATOR_MINI (2 null bytes)

        Sets:
            - self.class_name: Decoded class name (e.g., "BuffTemplet")
            - self.column_number: Number of columns
            - self.column: Dict mapping column index to column name
        """
        if not self.header:
            self.class_name = ""
            self.column_number = 0
            self.column = {}
            return

        classNameAndLength = self.header.split(self.SEPARATOR_FIELD)

        # Handle "compact" format (some files group length+name and count together)
        if len(classNameAndLength) < 3:
            pieces = classNameAndLength[0].split(self.SEPARATOR_MINI)
            if len(classNameAndLength) > 1:
                pieces.append(classNameAndLength[1])
        else:
            pieces = classNameAndLength

        # --- Parse class_name: [length byte][name bytes] ---
        class_blob = pieces[0]
        if not class_blob:
            self.class_name = ""
        else:
            name_len = class_blob[0]
            raw_name = class_blob[1 : 1 + name_len]
            self.class_name = decode_with_lang_prior("class_name", raw_name)

        # --- Parse column_number (little-endian integer) ---
        self.column_number = int.from_bytes(pieces[1], "little") if len(pieces) > 1 else 0

        # --- Parse column names: compact array [length][bytes]... ---
        self.column = {}
        if len(pieces) > 2 and pieces[2]:
            blob = pieces[2]
            i = 0
            col_idx = 1  # Column indices are 1-based
            while i < len(blob) and (self.column_number == 0 or col_idx <= self.column_number):
                length = blob[i]
                i += 1
                field_bytes = blob[i : i + length]
                i += length
                if field_bytes:
                    # Centralized decoding with language-aware heuristics
                    field = decode_with_lang_prior("column_name", field_bytes)
                    if field:
                        self.column[col_idx] = field
                col_idx += 1

        # If column_number was 0 but we mapped columns, infer it from max index
        if self.column_number == 0 and self.column:
            self.column_number = max(self.column.keys())

    # =============================================================================
    # BODY PARSING
    # =============================================================================

    def _read_vlq_view(self, mv: memoryview, start: int = 0) -> tuple[int | None, int]:
        """
        Read a Variable-Length Quantity (VLQ) integer from memoryview

        VLQ encoding: 7 bits of data per byte, MSB = continuation bit
        - If MSB is 1, more bytes follow
        - If MSB is 0, this is the last byte

        Example:
            0x7F = 127 (single byte, no continuation)
            0x80 0x01 = 128 (0x80 & 0x7F = 0, shift left 7, add 0x01)

        Args:
            mv: memoryview to read from (zero-copy)
            start: Starting offset in memoryview

        Returns:
            Tuple of (decoded_value, bytes_consumed)
            Returns (None, bytes_consumed) if incomplete/invalid VLQ
        """
        if start >= len(mv):
            return (None, 0)

        result = 0
        shift = 0
        i = start

        # Read byte-by-byte without allocating intermediate buffers
        while i < len(mv):
            byte = mv[i]
            result |= (byte & 0x7F) << shift  # Extract 7 data bits
            i += 1
            if (byte & 0x80) == 0:  # Check continuation bit
                return (result, i - start)
            shift += 7

        return (None, i - start)

    def _iter_fields_view(self, mv: memoryview, sep: bytes) -> Iterator[tuple[int, int]]:
        """
        Iterate over fields separated by separator bytes (zero-copy)

        Yields (start, end) indices for each field without allocating
        intermediate byte arrays (unlike .split())

        Args:
            mv: memoryview of entry bytes
            sep: Separator bytes (SEPARATOR_FIELD = b"\\x00\\x00\\x00")

        Yields:
            Tuple of (start_index, end_index) for each field
        """
        n = len(mv)
        m = len(sep)
        if n == 0:
            return

        i = 0
        last = 0

        # Simple scan (could be optimized with KMP if needed)
        while i <= n - m:
            if mv[i:i + m].tobytes() == sep:
                if i > last:
                    yield (last, i)
                i += m
                last = i
            else:
                i += 1

        # Yield remaining bytes after last separator
        if last < n:
            yield (last, n)

    def parse_body(self) -> None:
        """
        Parse body entries into structured data rows

        Each entry contains multiple fields in format:
            [VLQ: payload_length][payload_bytes][VLQ: column_index]<SEPARATOR_FIELD>...

        Process:
        1. Iterate over each entry (one per data row)
        2. Split entry into fields using SEPARATOR_FIELD
        3. For each field:
           - Read VLQ payload length
           - Extract payload bytes
           - Read VLQ column index
           - Decode payload using column name as language hint
        4. Build row dictionary and append to self.data

        Special handling:
        - Missing column indices: reuse last valid column name
        - Duplicate keys in same row: add "_fallback1", "_fallback2", etc.
        - Language-aware text decoding via lang.decode_with_lang_prior()

        Sets:
            self.data: List of parsed row dictionaries
        """
        parsed_rows: list[dict[str, str]] = []
        last_valid_key: str | None = None

        field_sep = self.SEPARATOR_FIELD  # b"\x00\x00\x00"

        for entry in self.body:
            if not entry:
                continue

            mv = memoryview(entry)  # Zero-copy view
            row: dict[str, str] = {}

            for start, end in self._iter_fields_view(mv, field_sep):
                # blob_view = mv[start:end] (view, no copy)
                blob_view = mv[start:end]
                if not blob_view:
                    continue

                # --- Read payload length (VLQ) ---
                length, n_len = self._read_vlq_view(blob_view, 0)
                if length is None:
                    continue

                data_start = n_len
                data_end = data_start + length
                if data_end > len(blob_view):
                    # Inconsistent sequence - ignore this field
                    continue

                # Only copy bytes here for decoding (unavoidable)
                raw_bytes = blob_view[data_start:data_end].tobytes()

                # --- Read column index (VLQ) immediately after payload ---
                col_idx, n_idx = self._read_vlq_view(blob_view, data_end)

                # Determine column name
                if col_idx is None or col_idx not in self.column:
                    # Missing/invalid column index - reuse last valid key
                    key = last_valid_key
                else:
                    key = self.column[col_idx]
                    last_valid_key = key

                if key is None:
                    continue

                # Handle duplicate keys in same row (shouldn't happen, but be defensive)
                original_key = key
                suffix = 1
                while key in row:
                    key = f"{original_key}_fallback{suffix}"
                    suffix += 1

                # Centralized decoding with language-aware heuristics
                row[key] = decode_with_lang_prior(key, raw_bytes)

            if row:
                parsed_rows.append(row)

        self.data = parsed_rows
