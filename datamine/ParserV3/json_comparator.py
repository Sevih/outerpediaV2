"""
JSON Comparator - Compare extracted character JSON with existing JSON in data/character

This module provides deep comparison between two JSON objects and identifies:
- Added fields (new in extracted)
- Removed fields (missing from extracted)
- Modified fields (different values)
- Unchanged fields

Features:
- Ignores key order (only values matter)
- Deep nested comparison (skills, transcend, etc.)
- Type-aware comparison
- Returns structured diff for easy processing

Usage:
    comparator = JSONComparator(extracted_json, existing_json)
    diff = comparator.get_diff()
    print(diff['added'])    # New fields
    print(diff['removed'])  # Missing fields
    print(diff['modified']) # Changed fields
"""

class JSONComparator:
    """Compare two JSON objects and return structured differences"""

    # Keys to ignore during comparison (technical fields from extraction)
    IGNORED_KEYS = {
        'DescID',
        'RangeType',
        'RangeType_fallback1',
        'SkipNameID',
        'TargetTeamType',
        'TargetTeamType_fallback1',
        'description',
        'ApproachType',
        'ApproachZ',
        'ApproachTime',
        'SkillSubType',
        'SkillType',
        'IconName',
        'NameIDSymbol',
        'ApproachFreezeTime_fallback1'
    }

    def __init__(self, extracted_data, existing_data):
        """
        Initialize comparator with extracted and existing JSON data

        Args:
            extracted_data: Newly extracted character JSON (dict)
            existing_data: Existing character JSON from data/character (dict)
        """
        self.extracted = extracted_data
        self.existing = existing_data
        self.diff = {
            'added': {},      # Fields only in extracted
            'removed': {},    # Fields only in existing
            'modified': {},   # Fields with different values
            'unchanged': {}   # Fields with same values
        }

    def get_diff(self):
        """
        Perform deep comparison and return differences

        Returns:
            dict: Structured diff with 'added', 'removed', 'modified', 'unchanged' keys
        """
        self._compare_dicts(self.extracted, self.existing, path='')
        return self.diff

    def _compare_dicts(self, extracted, existing, path=''):
        """
        Recursively compare two dictionaries

        Args:
            extracted: Extracted data (dict)
            existing: Existing data (dict)
            path: Current path in nested structure (e.g., 'skills.SKT_FIRST.name')
        """
        # Get all keys from both dicts
        extracted_keys = set(extracted.keys()) if isinstance(extracted, dict) else set()
        existing_keys = set(existing.keys()) if isinstance(existing, dict) else set()

        # Filter out ignored keys
        extracted_keys = {k for k in extracted_keys if k not in self.IGNORED_KEYS}
        existing_keys = {k for k in existing_keys if k not in self.IGNORED_KEYS}

        # Find added keys (only in extracted)
        added_keys = extracted_keys - existing_keys
        for key in added_keys:
            full_path = f"{path}.{key}" if path else key
            self.diff['added'][full_path] = extracted[key]

        # Find removed keys (only in existing)
        removed_keys = existing_keys - extracted_keys
        for key in removed_keys:
            full_path = f"{path}.{key}" if path else key
            self.diff['removed'][full_path] = existing[key]

        # Compare common keys
        common_keys = extracted_keys & existing_keys
        for key in common_keys:
            full_path = f"{path}.{key}" if path else key
            extracted_value = extracted[key]
            existing_value = existing[key]

            # Check if values are identical
            if self._are_equal(extracted_value, existing_value):
                self.diff['unchanged'][full_path] = extracted_value
            else:
                # Values differ - check if both are dicts (nested comparison)
                if isinstance(extracted_value, dict) and isinstance(existing_value, dict):
                    self._compare_dicts(extracted_value, existing_value, full_path)
                elif isinstance(extracted_value, list) and isinstance(existing_value, list):
                    self._compare_lists(extracted_value, existing_value, full_path)
                else:
                    # Different types or different primitive values
                    self.diff['modified'][full_path] = {
                        'old': existing_value,
                        'new': extracted_value
                    }

    def _compare_lists(self, extracted_list, existing_list, path):
        """
        Compare two lists

        Args:
            extracted_list: Extracted list
            existing_list: Existing list
            path: Current path in nested structure
        """
        if self._are_equal(extracted_list, existing_list):
            self.diff['unchanged'][path] = extracted_list
        else:
            # Lists differ
            self.diff['modified'][path] = {
                'old': existing_list,
                'new': extracted_list
            }

    def _are_equal(self, val1, val2):
        """
        Check if two values are equal (deep comparison for nested structures)

        Args:
            val1: First value
            val2: Second value

        Returns:
            bool: True if values are equal, False otherwise
        """
        # Handle None
        if val1 is None and val2 is None:
            return True
        if val1 is None or val2 is None:
            return False

        # Handle different types
        if type(val1) != type(val2):
            return False

        # Handle dicts (compare recursively)
        if isinstance(val1, dict):
            if set(val1.keys()) != set(val2.keys()):
                return False
            return all(self._are_equal(val1[k], val2[k]) for k in val1.keys())

        # Handle lists
        if isinstance(val1, list):
            if len(val1) != len(val2):
                return False
            return all(self._are_equal(v1, v2) for v1, v2 in zip(val1, val2))

        # Primitive types (str, int, float, bool)
        return val1 == val2

    def get_summary(self):
        """
        Get a summary of the comparison

        Returns:
            dict: Summary with counts of added, removed, modified fields
        """
        return {
            'added_count': len(self.diff['added']),
            'removed_count': len(self.diff['removed']),
            'modified_count': len(self.diff['modified']),
            'unchanged_count': len(self.diff['unchanged']),
            'has_changes': len(self.diff['added']) > 0 or
                          len(self.diff['removed']) > 0 or
                          len(self.diff['modified']) > 0
        }

    def format_diff_for_display(self):
        """
        Format differences for human-readable display

        Returns:
            str: Formatted diff string
        """
        lines = []

        # Added fields
        if self.diff['added']:
            lines.append("=== ADDED FIELDS ===")
            for path, value in sorted(self.diff['added'].items()):
                lines.append(f"  + {path}: {self._format_value(value)}")
            lines.append("")

        # Removed fields
        if self.diff['removed']:
            lines.append("=== REMOVED FIELDS ===")
            for path, value in sorted(self.diff['removed'].items()):
                lines.append(f"  - {path}: {self._format_value(value)}")
            lines.append("")

        # Modified fields
        if self.diff['modified']:
            lines.append("=== MODIFIED FIELDS ===")
            for path, values in sorted(self.diff['modified'].items()):
                lines.append(f"  ~ {path}:")
                lines.append(f"      OLD: {self._format_value(values['old'])}")
                lines.append(f"      NEW: {self._format_value(values['new'])}")
            lines.append("")

        if not (self.diff['added'] or self.diff['removed'] or self.diff['modified']):
            lines.append("No differences found - JSONs are identical")

        return "\n".join(lines)

    def _format_value(self, value, max_length=100):
        """
        Format value for display (truncate if too long)

        Args:
            value: Value to format
            max_length: Maximum length before truncation

        Returns:
            str: Formatted value
        """
        if isinstance(value, (dict, list)):
            import json
            formatted = json.dumps(value, ensure_ascii=False)
            if len(formatted) > max_length:
                return formatted[:max_length] + "..."
            return formatted
        return str(value)
