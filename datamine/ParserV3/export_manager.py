"""
Export Manager - Handles character JSON export and buff/debuff validation

This module manages:
- Exporting character JSON to export/char/
- Validating buffs/debuffs exist in buffs.json/debuffs.json
- Extracting missing buff/debuff metadata
- Managing ignored effects list

Usage:
    from export_manager import ExportManager

    manager = ExportManager()
    missing = manager.export_character(char_data)
    # Returns list of missing effects that need user input

Author: ParserV3
Date: 2025-10
"""
from pathlib import Path
import json
from buff_metadata_extractor import BuffMetadataExtractor


class ExportManager:
    """Manage character export and buff/debuff validation"""

    def __init__(self):
        # Paths
        from config import CHAR_DATA, BUFFS_FILE, DEBUFFS_FILE, IGNORED_EFFECTS_FILE, EXPORT_FOLDER

        self.char_export_path = CHAR_DATA
        self.buffs_path = BUFFS_FILE
        self.debuffs_path = DEBUFFS_FILE
        self.ignored_path = IGNORED_EFFECTS_FILE

        # Ensure directories exist
        self.char_export_path.mkdir(parents=True, exist_ok=True)
        EXPORT_FOLDER.mkdir(parents=True, exist_ok=True)

        # Load existing data
        self.buffs = self._load_json(self.buffs_path)
        self.debuffs = self._load_json(self.debuffs_path)
        self.ignored = self._load_json(self.ignored_path)

        # Create buff/debuff name sets for fast lookup
        self.buff_names = {b['name'] for b in self.buffs}
        self.debuff_names = {d['name'] for d in self.debuffs}
        self.ignored_names = set(self.ignored)

        # Metadata extractor
        self.metadata_extractor = BuffMetadataExtractor()

    def _load_json(self, filepath: Path) -> list:
        """Load JSON file, return empty list if not exists"""
        if not filepath.exists():
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_json(self, filepath: Path, data: list):
        """Save JSON file with pretty formatting"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

    def _reorder_effect_metadata(self, metadata: dict) -> dict:
        """
        Reorder effect metadata fields to: name, category, group (optional), label, description, icon

        Order: name, category, group, label (EN/JP/KR/ZH), description (EN/JP/KR/ZH), icon
        """
        ordered = {}

        # Field order (group is optional)
        field_order = [
            'name',
            'category',
            'group',  # Optional: for grouping similar effects in filters
            'label', 'label_jp', 'label_kr', 'label_zh',
            'description', 'description_jp', 'description_kr', 'description_zh',
            'icon'
        ]

        # Add fields in order
        for field in field_order:
            if field in metadata and metadata[field] is not None:
                ordered[field] = metadata[field]

        # Add any remaining fields (shouldn't happen but just in case)
        for key, value in metadata.items():
            if key not in ordered and value is not None:
                ordered[key] = value

        return ordered

    def export_character(self, char_data: dict) -> dict:
        """
        Export character JSON and collect missing buffs/debuffs

        Returns:
            {
                'missing_buffs': [(identifier, metadata), ...],
                'missing_debuffs': [(identifier, metadata), ...],
                'exported_path': 'path/to/char.json'
            }
        """
        # Collect all buffs/debuffs from character
        all_buffs, all_debuffs = self._collect_effects(char_data)

        # Filter out ignored effects from character data before exporting
        filtered_char_data = self._filter_ignored_effects(char_data, all_buffs, all_debuffs)

        # Export character JSON (with ignored effects removed)
        filename = char_data['ID'] + '.json'
        export_path = self.char_export_path / filename

        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(filtered_char_data, f, indent=2, ensure_ascii=False)

        # Find missing effects
        missing_buffs = []
        missing_debuffs = []

        for buff in all_buffs:
            if buff not in self.buff_names and buff not in self.ignored_names:
                metadata = self.metadata_extractor.get_metadata(buff, is_buff=True)
                missing_buffs.append((buff, metadata))

        for debuff in all_debuffs:
            if debuff not in self.debuff_names and debuff not in self.ignored_names:
                metadata = self.metadata_extractor.get_metadata(debuff, is_buff=False)
                missing_debuffs.append((debuff, metadata))

        return {
            'missing_buffs': missing_buffs,
            'missing_debuffs': missing_debuffs,
            'exported_path': str(export_path)
        }

    def _collect_effects(self, char_data: dict) -> tuple:
        """Collect all unique buffs and debuffs from character skills"""
        buffs = set()
        debuffs = set()

        for skill_type, skill_data in char_data.get('skills', {}).items():
            # Regular buffs/debuffs
            for buff in skill_data.get('buff', []):
                buffs.add(buff)
            for debuff in skill_data.get('debuff', []):
                debuffs.add(debuff)

            # Dual buffs/debuffs (chain passive)
            if 'dual_buff' in skill_data:
                dual_buffs = skill_data['dual_buff']
                if isinstance(dual_buffs, list):
                    buffs.update(dual_buffs)
                else:
                    buffs.add(dual_buffs)

            if 'dual_debuff' in skill_data:
                dual_debuffs = skill_data['dual_debuff']
                if isinstance(dual_debuffs, list):
                    debuffs.update(dual_debuffs)
                else:
                    debuffs.add(dual_debuffs)

        return list(buffs), list(debuffs)

    def _filter_ignored_effects(self, char_data: dict, all_buffs: list, all_debuffs: list) -> dict:
        """Remove missing effects (both ignored and skipped) from character data before export"""
        import copy

        # Deep copy to avoid modifying original
        filtered_data = copy.deepcopy(char_data)

        # Remove effects that are not in the database (includes both ignored and skipped effects)
        # Only keep effects that exist in buffs.json or debuffs.json
        for skill_type, skill_data in filtered_data.get('skills', {}).items():
            # Filter regular buffs - only keep those in database
            if 'buff' in skill_data:
                skill_data['buff'] = [b for b in skill_data['buff'] if b in self.buff_names]

            # Filter regular debuffs - only keep those in database
            if 'debuff' in skill_data:
                skill_data['debuff'] = [d for d in skill_data['debuff'] if d in self.debuff_names]

            # Filter dual buffs - only keep those in database
            if 'dual_buff' in skill_data:
                if isinstance(skill_data['dual_buff'], list):
                    skill_data['dual_buff'] = [b for b in skill_data['dual_buff'] if b in self.buff_names]
                elif skill_data['dual_buff'] not in self.buff_names:
                    skill_data['dual_buff'] = []

            # Filter dual debuffs - only keep those in database
            if 'dual_debuff' in skill_data:
                if isinstance(skill_data['dual_debuff'], list):
                    skill_data['dual_debuff'] = [d for d in skill_data['dual_debuff'] if d in self.debuff_names]
                elif skill_data['dual_debuff'] not in self.debuff_names:
                    skill_data['dual_debuff'] = []

        return filtered_data

    def add_buff(self, metadata: dict):
        """Add a buff to buffs.json"""
        if metadata['name'] not in self.buff_names:
            # Reorder fields before adding
            ordered_metadata = self._reorder_effect_metadata(metadata)
            self.buffs.append(ordered_metadata)
            self.buff_names.add(metadata['name'])
            self._save_json(self.buffs_path, self.buffs)

    def add_debuff(self, metadata: dict):
        """Add a debuff to debuffs.json"""
        if metadata['name'] not in self.debuff_names:
            # Reorder fields before adding
            ordered_metadata = self._reorder_effect_metadata(metadata)
            self.debuffs.append(ordered_metadata)
            self.debuff_names.add(metadata['name'])
            self._save_json(self.debuffs_path, self.debuffs)

    def add_ignored(self, effect_name: str):
        """Add an effect to ignored list"""
        if effect_name not in self.ignored_names:
            self.ignored.append(effect_name)
            self.ignored_names.add(effect_name)
            self._save_json(self.ignored_path, self.ignored)

    def reload(self):
        """Reload all JSON files (after external modifications)"""
        self.buffs = self._load_json(self.buffs_path)
        self.debuffs = self._load_json(self.debuffs_path)
        self.ignored = self._load_json(self.ignored_path)
        self.buff_names = {b['name'] for b in self.buffs}
        self.debuff_names = {d['name'] for d in self.debuffs}
        self.ignored_names = set(self.ignored)


if __name__ == "__main__":
    """Self-test"""
    import sys

    # Test with a mock character
    mock_char = {
        'ID': '2000020',
        'Fullname': 'Alice',
        'skills': {
            'SKT_FIRST': {
                'buff': ['BT_STAT|ST_AVOID'],
                'debuff': []
            },
            'SKT_SECOND': {
                'buff': ['BT_ACTION_GAUGE'],
                'debuff': ['BT_REMOVE_BUFF', 'BT_STAT|ST_BUFF_CHANCE']
            }
        }
    }

    manager = ExportManager()
    result = manager.export_character(mock_char)

    print("Export Manager self-test")
    print("=" * 80)
    print(f"Exported to: {result['exported_path']}")
    print(f"\nMissing buffs: {len(result['missing_buffs'])}")
    for buff, metadata in result['missing_buffs']:
        print(f"  - {buff}: {metadata.get('label', 'No label')}")

    print(f"\nMissing debuffs: {len(result['missing_debuffs'])}")
    for debuff, metadata in result['missing_debuffs']:
        print(f"  - {debuff}: {metadata.get('label', 'No label')}")
