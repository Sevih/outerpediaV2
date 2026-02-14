"""
Extract Geas data from GuildRaidGeisTemplet.bytes

Simple script to parse and export geas data to JSON format.
Associates NameID with TextSkill data for localized text.
"""
from bytes_parser import Bytes_parser
from pathlib import Path
import json

# Paths
BASE_PATH = Path(__file__).parent.parent
BYTES_FOLDER = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"
OUTPUT_FILE = Path(__file__).parent / "export" / "geas.json"

def load_textskill():
    """Load TextSkill data and create lookup by IDSymbol"""
    print("Loading TextSkill.bytes...")
    textskill_file = BYTES_FOLDER / "TextSkill.bytes"
    parser = Bytes_parser(str(textskill_file))
    data = parser.get_data()

    # Create lookup dictionary by IDSymbol
    lookup = {}
    for entry in data:
        id_symbol = entry.get('IDSymbol')
        if id_symbol:
            lookup[id_symbol] = {
                'en': entry.get('English', ''),
                'jp': entry.get('Japanese', ''),
                'kr': entry.get('Korean', ''),
                'zh': entry.get('China_Simplified', '')
            }

    print(f"Loaded {len(lookup)} TextSkill entries")
    return lookup

def load_bufftemplet():
    """Load BuffTemplet data and create lookup by BuffID"""
    print("Loading BuffTemplet.bytes...")
    buff_file = BYTES_FOLDER / "BuffTemplet.bytes"
    parser = Bytes_parser(str(buff_file))
    data = parser.get_data()

    # Create lookup dictionary by BuffID
    lookup = {}
    for entry in data:
        buff_id = entry.get('BuffID')
        if buff_id:
            lookup[buff_id] = entry

    print(f"Loaded {len(lookup)} BuffTemplet entries")
    return lookup

def replace_placeholders(text, buff_lookup, is_english=False):
    """Replace buff placeholders in text with actual values

    Placeholder format: [buff_X_buffid]
    Where X is:
      - v: Value
      - t: TurnDuration
      - (add more as needed)

    Args:
        text: Text with placeholders to replace
        buff_lookup: Dictionary of buff data
        is_english: If True, remove negative signs from values
    """
    import re

    # Find all placeholders like [buff_X_...]
    pattern = r'\[buff_([a-z])_([a-z_0-9]+)\]'

    def replace_match(match):
        placeholder_type = match.group(1)  # v, t, etc.
        buff_id = match.group(2)  # the BuffID to lookup

        # Get buff data
        buff_data = buff_lookup.get(buff_id)
        if not buff_data:
            return match.group(0)  # Return original if not found

        # Map placeholder type to BuffTemplet field
        field_map = {
            'v': 'Value',
            't': 'TurnDuration',
        }

        field_name = field_map.get(placeholder_type)
        if not field_name:
            return match.group(0)  # Return original if type unknown

        value = buff_data.get(field_name, '')
        if not value:
            return match.group(0)  # Return original if no value

        # Format the value
        try:
            num_value = int(value)

            # For Value field, check ApplyingType
            if field_name == 'Value':
                applying_type = buff_data.get('ApplyingType', '')

                # Use absolute value for English, keep sign for other languages
                display_value = abs(num_value) if is_english else num_value

                # OAT_NONE and OAT_ADD: raw value, no conversion
                if applying_type in ('OAT_NONE', 'OAT_ADD'):
                    return str(display_value)

                # OAT_RATE: percentage with % symbol (divide by 10)
                if applying_type == 'OAT_RATE':
                    percent = abs(display_value) / 10
                    if percent == int(percent):
                        return f"{int(percent)}%"
                    return f"{percent}%"

                # Default fallback: convert to percentage
                percent = abs(display_value) / 10
                if percent == int(percent):
                    return str(int(percent))
                return str(percent)

            # For TurnDuration, return as-is
            return str(num_value)
        except (ValueError, TypeError):
            return value

    return re.sub(pattern, replace_match, text)

def extract_geas(silent=False):
    """Extract geas data from GuildRaidGeisTemplet.bytes

    Args:
        silent: If True, suppress print statements (for GUI)

    Returns:
        dict: Statistics with keys 'total', 'new', 'skipped', 'conflicts', 'success'
    """
    stats = {
        'total': 0,
        'new': 0,
        'skipped': 0,
        'conflicts': 0,
        'success': False,
        'error': None
    }

    def log(msg):
        if not silent:
            print(msg)

    log("Loading GuildRaidGeisTemplet.bytes...")
    geas_file = BYTES_FOLDER / "GuildRaidGeisTemplet.bytes"

    if not geas_file.exists():
        stats['error'] = f"File not found: {geas_file}"
        log(f"Error: {stats['error']}")
        return stats

    # Parse the bytes file
    try:
        parser = Bytes_parser(str(geas_file))
        geas_data = parser.get_data()
        columns = parser.get_columns()
    except Exception as e:
        stats['error'] = f"Failed to parse geas file: {e}"
        log(f"Error: {stats['error']}")
        return stats

    stats['total'] = len(geas_data)
    log(f"Loaded {len(geas_data)} geas entries")
    log(f"Columns: {list(columns.values())}")

    # Load TextSkill data for text association
    textskill_lookup = load_textskill()

    # Load BuffTemplet for placeholder replacement
    buff_lookup = load_bufftemplet()

    # Associate NameID with TextSkill data
    enriched_geas = {}  # Use dict with gameId as key

    for geas in geas_data:
        name_id = geas.get('NameID', '')
        game_id = geas.get('ID', '')  # Original game ID
        icon_name = geas.get('IconName', '')

        # Create minimal entry with only necessary fields
        enriched_entry = {
            'IconName': icon_name,
        }

        # Add localized text if NameID exists in TextSkill
        if name_id and name_id in textskill_lookup:
            text_data = textskill_lookup[name_id]

            # Replace placeholders in all language texts
            enriched_entry['text'] = {
                'en': replace_placeholders(text_data['en'], buff_lookup, is_english=True),
                'jp': replace_placeholders(text_data['jp'], buff_lookup, is_english=False),
                'kr': replace_placeholders(text_data['kr'], buff_lookup, is_english=False),
                'zh': replace_placeholders(text_data['zh'], buff_lookup, is_english=False),
            }
        else:
            enriched_entry['text'] = None

        # Transform Grade to ratio percentage
        grade_str = geas.get('Grade', '')
        if grade_str:
            try:
                grade_num = int(grade_str)
                ratio_percent = grade_num / 10
                # Format without decimal if it's a whole number
                if ratio_percent == int(ratio_percent):
                    enriched_entry['ratio'] = f"{int(ratio_percent)}%"
                else:
                    enriched_entry['ratio'] = f"{ratio_percent}%"
            except (ValueError, TypeError):
                enriched_entry['ratio'] = None
        else:
            enriched_entry['ratio'] = None

        # Add level from DescID
        desc_id = geas.get('DescID', '')
        if desc_id:
            try:
                enriched_entry['level'] = int(desc_id)
            except (ValueError, TypeError):
                enriched_entry['level'] = None
        else:
            enriched_entry['level'] = None

        # Add to dict with gameId as key
        enriched_geas[game_id] = enriched_entry

    log(f"Associated {sum(1 for g in enriched_geas.values() if g.get('text'))} geas with TextSkill data")

    # Create output directory if needed
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Load existing data if file exists
    existing_data = {}
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)

                # Handle old format with "data" wrapper
                if isinstance(loaded, dict) and "data" in loaded:
                    data = loaded["data"]
                else:
                    data = loaded

                # Handle old list format
                if isinstance(data, list):
                    # Convert list to dict using gameId as key
                    for item in data:
                        key = item.get("gameId") or item.get("ID")
                        if key:
                            # Remove gameId from item since it's now the key
                            item_copy = {k: v for k, v in item.items() if k != "gameId"}
                            existing_data[key] = item_copy
                    log(f"Converted {len(existing_data)} existing geas entries from old list format")
                else:
                    existing_data = data
                    log(f"Loaded {len(existing_data)} existing geas entries")
        except Exception as e:
            log(f"Warning: Could not load existing data: {e}")

    # Merge with intelligent collision detection
    merged_geas = existing_data.copy()

    # Helper function to check if two geas are identical
    def geas_matches(geas1, geas2):
        """Check if two geas have the same IconName, text, ratio, and level"""
        return (geas1.get('IconName') == geas2.get('IconName') and
                geas1.get('text') == geas2.get('text') and
                geas1.get('ratio') == geas2.get('ratio') and
                geas1.get('level') == geas2.get('level'))

    # Helper function to find if a geas exists anywhere with same content
    def find_duplicate_geas(new_geas, existing_dict):
        """Find a geas with matching content in existing data"""
        for gid, existing_geas in existing_dict.items():
            if geas_matches(new_geas, existing_geas):
                return gid
        return None

    # Find the next free ID
    def get_next_free_id(existing_dict):
        """Get the next available integer ID"""
        existing_ids = [int(gid) for gid in existing_dict.keys() if gid.isdigit()]
        if not existing_ids:
            return "1"
        return str(max(existing_ids) + 1)

    # Process each new geas
    for game_id, new_geas in enriched_geas.items():
        if game_id in merged_geas:
            # ID collision - check if content matches
            if geas_matches(new_geas, merged_geas[game_id]):
                # Same ID, same content - skip
                log(f"Skipping geas {game_id} (unchanged)")
                stats['skipped'] += 1
                continue
            else:
                # Same ID but different content - check if duplicate exists elsewhere
                duplicate_id = find_duplicate_geas(new_geas, merged_geas)
                if duplicate_id:
                    # Duplicate exists elsewhere - skip
                    log(f"Skipping geas {game_id} (duplicate of {duplicate_id})")
                    stats['skipped'] += 1
                    continue
                else:
                    # Different content, no duplicate - assign new ID
                    new_id = get_next_free_id(merged_geas)
                    log(f"ID conflict: geas {game_id} changed, assigning new ID {new_id}")
                    merged_geas[new_id] = new_geas
                    stats['conflicts'] += 1
                    # Keep old version too
                    continue
        else:
            # New ID - check if duplicate exists
            duplicate_id = find_duplicate_geas(new_geas, merged_geas)
            if duplicate_id:
                # Duplicate exists - skip
                log(f"Skipping new geas {game_id} (duplicate of {duplicate_id})")
                stats['skipped'] += 1
                continue
            else:
                # Truly new geas - add it
                log(f"Adding new geas {game_id}")
                merged_geas[game_id] = new_geas
                stats['new'] += 1

    # Export to JSON with gameId as keys (directly, no wrapper)
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(merged_geas, f, ensure_ascii=False, indent=2)

        # Also export to src/data folder for the website
        WEBSITE_OUTPUT = Path(__file__).parent.parent.parent / "src" / "data" / "geas.json"
        WEBSITE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with open(WEBSITE_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(merged_geas, f, ensure_ascii=False, indent=2)

        stats['success'] = True
        log(f"Exported to: {OUTPUT_FILE}")
        log(f"Exported to: {WEBSITE_OUTPUT}")
        log(f"Total entries: {len(merged_geas)} (was {len(existing_data)})")
        log(f"Done!")
    except Exception as e:
        stats['error'] = f"Export failed: {e}"
        log(f"Error: {stats['error']}")

    return stats

if __name__ == "__main__":
    extract_geas()
