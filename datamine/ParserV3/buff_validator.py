"""
Buff Validator
Validates buff and debuff usage in character files

Scans all character JSON files to find buffs/debuffs that are not
defined in the main buffs.json and debuffs.json files.

Author: ParserV3
Date: 2025-10
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
import logging

logger = logging.getLogger(__name__)

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent.parent  # outerpedia-clean folder
CHAR_DATA_FOLDER = PROJECT_ROOT / "src" / "data" / "char"
BUFFS_FILE = PROJECT_ROOT / "src" / "data" / "buffs.json"
DEBUFFS_FILE = PROJECT_ROOT / "src" / "data" / "debuffs.json"
EE_FILE = PROJECT_ROOT / "src" / "data" / "ee.json"
GUIDES_CONTENTS_FOLDER = PROJECT_ROOT / "src" / "app" / "guides" / "_contents"
GUILD_RAID_FOLDER = PROJECT_ROOT / "src" / "data" / "guides" / "guild-raid"


class BuffValidator:
    """Validates buff and debuff usage across character files"""

    def __init__(self):
        self.buffs_data: List[Dict] = []
        self.debuffs_data: List[Dict] = []
        self.defined_buffs: Set[str] = set()
        self.defined_debuffs: Set[str] = set()

    def load_definitions(self):
        """Load buff and debuff definitions from JSON files"""
        try:
            # Load buffs
            if BUFFS_FILE.exists():
                with open(BUFFS_FILE, 'r', encoding='utf-8') as f:
                    self.buffs_data = json.load(f)
                    self.defined_buffs = {buff['name'] for buff in self.buffs_data}
                logger.info(f"Loaded {len(self.defined_buffs)} buff definitions")
            else:
                logger.warning(f"Buffs file not found: {BUFFS_FILE}")

            # Load debuffs
            if DEBUFFS_FILE.exists():
                with open(DEBUFFS_FILE, 'r', encoding='utf-8') as f:
                    self.debuffs_data = json.load(f)
                    self.defined_debuffs = {debuff['name'] for debuff in self.debuffs_data}
                logger.info(f"Loaded {len(self.defined_debuffs)} debuff definitions")
            else:
                logger.warning(f"Debuffs file not found: {DEBUFFS_FILE}")

        except Exception as e:
            logger.exception("Error loading buff/debuff definitions")
            raise

    def sort_buffs_debuffs_files(self) -> Dict[str, any]:
        """
        Sort buffs.json and debuffs.json by name and save them back

        Returns:
            Dictionary with results:
            - success: bool
            - message: str
            - buffs_count: int
            - debuffs_count: int
        """
        try:
            # Load current data
            self.load_definitions()

            # Sort buffs by name
            buffs_sorted = sorted(self.buffs_data, key=lambda x: x.get('name', ''))

            # Sort debuffs by name
            debuffs_sorted = sorted(self.debuffs_data, key=lambda x: x.get('name', ''))

            # Save buffs
            with open(BUFFS_FILE, 'w', encoding='utf-8') as f:
                json.dump(buffs_sorted, f, indent=2, ensure_ascii=False)
                f.write('\n')  # Add newline at end of file

            # Save debuffs
            with open(DEBUFFS_FILE, 'w', encoding='utf-8') as f:
                json.dump(debuffs_sorted, f, indent=2, ensure_ascii=False)
                f.write('\n')  # Add newline at end of file

            logger.info(f"Sorted and saved {len(buffs_sorted)} buffs and {len(debuffs_sorted)} debuffs")

            return {
                'success': True,
                'message': f'Successfully sorted {len(buffs_sorted)} buffs and {len(debuffs_sorted)} debuffs by name',
                'buffs_count': len(buffs_sorted),
                'debuffs_count': len(debuffs_sorted)
            }

        except Exception as e:
            logger.exception("Error sorting buffs/debuffs files")
            return {
                'success': False,
                'message': f'Error sorting files: {str(e)}',
                'buffs_count': 0,
                'debuffs_count': 0
            }

    def extract_buffs_from_character(self, char_data: Dict, char_name: str) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """
        Extract all buffs and debuffs from a character's data

        Returns:
            Tuple of (buffs_dict, debuffs_dict) where keys are skill names and values are lists of buff/debuff names
        """
        char_buffs: Dict[str, List[str]] = {}
        char_debuffs: Dict[str, List[str]] = {}

        if 'skills' not in char_data:
            return char_buffs, char_debuffs

        skills = char_data['skills']

        # Map skill types to readable names
        skill_names = {
            'SKT_FIRST': 's1',
            'SKT_SECOND': 's2',
            'SKT_ULTIMATE': 's3',
            'SKT_CHAIN_PASSIVE': 'chain',
            'SKT_DUAL': 'dual'
        }

        for skill_type, skill_data in skills.items():
            if not isinstance(skill_data, dict):
                continue

            skill_name = skill_names.get(skill_type, skill_type)

            # Extract regular buffs
            if 'buff' in skill_data and isinstance(skill_data['buff'], list):
                for buff in skill_data['buff']:
                    if buff:  # Skip empty strings
                        if skill_name not in char_buffs:
                            char_buffs[skill_name] = []
                        char_buffs[skill_name].append(buff)

            # Extract dual buffs
            if 'dual_buff' in skill_data and isinstance(skill_data['dual_buff'], list):
                for buff in skill_data['dual_buff']:
                    if buff:  # Skip empty strings
                        dual_skill_name = f"{skill_name}_dual"
                        if dual_skill_name not in char_buffs:
                            char_buffs[dual_skill_name] = []
                        char_buffs[dual_skill_name].append(buff)

            # Extract regular debuffs
            if 'debuff' in skill_data and isinstance(skill_data['debuff'], list):
                for debuff in skill_data['debuff']:
                    if debuff:  # Skip empty strings
                        if skill_name not in char_debuffs:
                            char_debuffs[skill_name] = []
                        char_debuffs[skill_name].append(debuff)

            # Extract dual debuffs
            if 'dual_debuff' in skill_data and isinstance(skill_data['dual_debuff'], list):
                for debuff in skill_data['dual_debuff']:
                    if debuff:  # Skip empty strings
                        dual_skill_name = f"{skill_name}_dual"
                        if dual_skill_name not in char_debuffs:
                            char_debuffs[dual_skill_name] = []
                        char_debuffs[dual_skill_name].append(debuff)

        return char_buffs, char_debuffs

    def extract_buffs_from_ee(self, ee_data: Dict) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """
        Extract all buffs and debuffs from exclusive equipment data

        Returns:
            Tuple of (buffs_dict, debuffs_dict) where keys are character names and values are lists of buff/debuff names
        """
        ee_buffs: Dict[str, List[str]] = {}
        ee_debuffs: Dict[str, List[str]] = {}

        for char_id, ee_info in ee_data.items():
            if not isinstance(ee_info, dict):
                continue

            # Extract buffs
            if 'buff' in ee_info and isinstance(ee_info['buff'], list):
                for buff in ee_info['buff']:
                    if buff:  # Skip empty strings
                        if char_id not in ee_buffs:
                            ee_buffs[char_id] = []
                        ee_buffs[char_id].append(buff)

            # Extract debuffs
            if 'debuff' in ee_info and isinstance(ee_info['debuff'], list):
                for debuff in ee_info['debuff']:
                    if debuff:  # Skip empty strings
                        if char_id not in ee_debuffs:
                            ee_debuffs[char_id] = []
                        ee_debuffs[char_id].append(debuff)

        return ee_buffs, ee_debuffs

    def scan_guide_files(self) -> Tuple[Set[str], Set[str]]:
        """
        Scan guide files to find buff/debuff references

        Scans:
        - src/app/guides/_contents (TSX files with {B/BT_...} and {D/BT_...} syntax)
        - src/data/guides/guild-raid (JSON files with {B/BT_...} and {D/BT_...} syntax)

        Returns:
            Tuple of (buffs_set, debuffs_set)
        """
        guide_buffs: Set[str] = set()
        guide_debuffs: Set[str] = set()

        # Regex patterns to match both syntaxes:
        # {B/BT_...} / {D/BT_...}
        # <EffectInlineTag name="..." type="buff/debuff" />
        buff_pattern1 = re.compile(r'\{B/([A-Z0-9_|]+)\}')
        debuff_pattern1 = re.compile(r'\{D/([A-Z0-9_|]+)\}')
        buff_pattern2 = re.compile(r'name="([A-Z0-9_|]+)"\s+type="buff"')
        debuff_pattern2 = re.compile(r'name="([A-Z0-9_|]+)"\s+type="debuff"')

        # Scan TSX files in guides/_contents
        if GUIDES_CONTENTS_FOLDER.exists():
            logger.info(f"Scanning guide TSX files in {GUIDES_CONTENTS_FOLDER}...")
            tsx_files = list(GUIDES_CONTENTS_FOLDER.rglob("*.tsx"))
            for tsx_file in tsx_files:
                try:
                    with open(tsx_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                        # Find all buff references
                        for match in buff_pattern1.finditer(content):
                            guide_buffs.add(match.group(1))
                        for match in buff_pattern2.finditer(content):
                            guide_buffs.add(match.group(1))

                        # Find all debuff references
                        for match in debuff_pattern1.finditer(content):
                            guide_debuffs.add(match.group(1))
                        for match in debuff_pattern2.finditer(content):
                            guide_debuffs.add(match.group(1))

                except Exception as e:
                    logger.warning(f"Error processing {tsx_file.name}: {e}")
        else:
            logger.warning(f"Guides contents folder not found: {GUIDES_CONTENTS_FOLDER}")

        # Scan JSON files in guild-raid
        if GUILD_RAID_FOLDER.exists():
            logger.info(f"Scanning guild raid JSON files in {GUILD_RAID_FOLDER}...")
            json_files = list(GUILD_RAID_FOLDER.glob("*.json"))
            for json_file in json_files:
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                        # Find all buff references
                        for match in buff_pattern1.finditer(content):
                            guide_buffs.add(match.group(1))
                        for match in buff_pattern2.finditer(content):
                            guide_buffs.add(match.group(1))

                        # Find all debuff references
                        for match in debuff_pattern1.finditer(content):
                            guide_debuffs.add(match.group(1))
                        for match in debuff_pattern2.finditer(content):
                            guide_debuffs.add(match.group(1))

                except Exception as e:
                    logger.warning(f"Error processing {json_file.name}: {e}")
        else:
            logger.warning(f"Guild raid folder not found: {GUILD_RAID_FOLDER}")

        logger.info(f"Found {len(guide_buffs)} buffs and {len(guide_debuffs)} debuffs in guide files")
        return guide_buffs, guide_debuffs

    def scan_character_files(self) -> Dict:
        """
        Scan all character JSON files and EE file to find useless buffs/debuffs

        Returns:
            Dictionary containing:
            - used_buffs: Set of all buff names used in character files
            - used_debuffs: Set of all debuff names used in character files
            - undefined_buffs: List of buffs used but not defined
            - undefined_debuffs: List of debuffs used but not defined
            - characters_with_undefined: List of characters using undefined buffs/debuffs
        """
        if not CHAR_DATA_FOLDER.exists():
            raise FileNotFoundError(f"Character data folder not found: {CHAR_DATA_FOLDER}")

        # Track all used buffs/debuffs
        used_buffs: Set[str] = set()
        used_debuffs: Set[str] = set()

        # Track undefined buffs/debuffs with character and skill info
        undefined_buffs_details: List[Dict] = []
        undefined_debuffs_details: List[Dict] = []

        # Process each character file
        char_files = list(CHAR_DATA_FOLDER.glob("*.json"))
        logger.info(f"Scanning {len(char_files)} character files...")

        for char_file in char_files:
            try:
                with open(char_file, 'r', encoding='utf-8') as f:
                    char_data = json.load(f)

                char_name = char_data.get('Fullname', char_file.stem)
                char_buffs, char_debuffs = self.extract_buffs_from_character(char_data, char_name)

                # Check buffs
                for skill_name, buffs in char_buffs.items():
                    for buff in buffs:
                        used_buffs.add(buff)
                        if buff not in self.defined_buffs:
                            undefined_buffs_details.append({
                                'character': char_name,
                                'skill': skill_name,
                                'buff': buff,
                                'file': char_file.name,
                                'source': 'character'
                            })

                # Check debuffs
                for skill_name, debuffs in char_debuffs.items():
                    for debuff in debuffs:
                        used_debuffs.add(debuff)
                        if debuff not in self.defined_debuffs:
                            undefined_debuffs_details.append({
                                'character': char_name,
                                'skill': skill_name,
                                'debuff': debuff,
                                'file': char_file.name,
                                'source': 'character'
                            })

            except Exception as e:
                logger.warning(f"Error processing {char_file.name}: {e}")
                continue

        # Process EE file
        if EE_FILE.exists():
            logger.info(f"Scanning exclusive equipment file...")
            try:
                with open(EE_FILE, 'r', encoding='utf-8') as f:
                    ee_data = json.load(f)

                ee_buffs, ee_debuffs = self.extract_buffs_from_ee(ee_data)

                # Check EE buffs
                for char_id, buffs in ee_buffs.items():
                    for buff in buffs:
                        used_buffs.add(buff)
                        if buff not in self.defined_buffs:
                            undefined_buffs_details.append({
                                'character': char_id,
                                'skill': 'ee',
                                'buff': buff,
                                'file': 'ee.json',
                                'source': 'ee'
                            })

                # Check EE debuffs
                for char_id, debuffs in ee_debuffs.items():
                    for debuff in debuffs:
                        used_debuffs.add(debuff)
                        if debuff not in self.defined_debuffs:
                            undefined_debuffs_details.append({
                                'character': char_id,
                                'skill': 'ee',
                                'debuff': debuff,
                                'file': 'ee.json',
                                'source': 'ee'
                            })

            except Exception as e:
                logger.warning(f"Error processing EE file: {e}")
        else:
            logger.warning(f"EE file not found: {EE_FILE}")

        # Scan guide files
        guide_buffs, guide_debuffs = self.scan_guide_files()

        # Add guide buffs/debuffs to used sets
        used_buffs.update(guide_buffs)
        used_debuffs.update(guide_debuffs)

        # Find defined but unused buffs/debuffs
        unused_buffs = self.defined_buffs - used_buffs
        unused_debuffs = self.defined_debuffs - used_debuffs

        # Remove duplicates from undefined lists
        undefined_buffs_unique = list({item['buff']: item for item in undefined_buffs_details}.values())
        undefined_debuffs_unique = list({item['debuff']: item for item in undefined_debuffs_details}.values())

        results = {
            'used_buffs': used_buffs,
            'used_debuffs': used_debuffs,
            'unused_buffs': sorted(unused_buffs),
            'unused_debuffs': sorted(unused_debuffs),
            'undefined_buffs': sorted(undefined_buffs_unique, key=lambda x: (x['character'], x['skill'])),
            'undefined_debuffs': sorted(undefined_debuffs_unique, key=lambda x: (x['character'], x['skill'])),
            'undefined_buffs_details': sorted(undefined_buffs_details, key=lambda x: (x['character'], x['skill'])),
            'undefined_debuffs_details': sorted(undefined_debuffs_details, key=lambda x: (x['character'], x['skill'])),
            'total_char_files': len(char_files),
            'total_defined_buffs': len(self.defined_buffs),
            'total_defined_debuffs': len(self.defined_debuffs),
            'total_used_buffs': len(used_buffs),
            'total_used_debuffs': len(used_debuffs)
        }

        logger.info(f"Scan complete: {len(used_buffs)} buffs used, {len(used_debuffs)} debuffs used")
        logger.info(f"Found {len(results['undefined_buffs'])} undefined buffs, {len(results['undefined_debuffs'])} undefined debuffs")
        logger.info(f"Found {len(unused_buffs)} unused buffs, {len(unused_debuffs)} unused debuffs")

        return results

    def format_results_text(self, results: Dict) -> str:
        """Format validation results as readable text"""
        lines = []

        lines.append("=" * 80)
        lines.append("BUFF/DEBUFF VALIDATION REPORT")
        lines.append("=" * 80)
        lines.append("")

        # Summary
        lines.append("SUMMARY:")
        lines.append(f"  Total character files scanned: {results['total_char_files']}")
        lines.append(f"  Defined buffs: {results['total_defined_buffs']}")
        lines.append(f"  Defined debuffs: {results['total_defined_debuffs']}")
        lines.append(f"  Used buffs: {results['total_used_buffs']}")
        lines.append(f"  Used debuffs: {results['total_used_debuffs']}")
        lines.append(f"  Unused buffs: {len(results['unused_buffs'])}")
        lines.append(f"  Unused debuffs: {len(results['unused_debuffs'])}")
        lines.append(f"  Undefined buffs: {len(results['undefined_buffs'])}")
        lines.append(f"  Undefined debuffs: {len(results['undefined_debuffs'])}")
        lines.append("")

        # Undefined buffs (detailed)
        if results['undefined_buffs_details']:
            lines.append("=" * 80)
            lines.append(f"UNDEFINED BUFFS ({len(results['undefined_buffs_details'])} occurrences):")
            lines.append("=" * 80)

            # Separate by source
            char_buffs = [item for item in results['undefined_buffs_details'] if item.get('source') == 'character']
            ee_buffs = [item for item in results['undefined_buffs_details'] if item.get('source') == 'ee']

            if char_buffs:
                lines.append("From Character Skills:")
                for item in char_buffs:
                    lines.append(f"  [{item['character']}] {item['skill']}: {item['buff']}")
                lines.append("")

            if ee_buffs:
                lines.append("From Exclusive Equipment:")
                for item in ee_buffs:
                    lines.append(f"  [{item['character']}] {item['skill']}: {item['buff']}")
                lines.append("")

        # Undefined debuffs (detailed)
        if results['undefined_debuffs_details']:
            lines.append("=" * 80)
            lines.append(f"UNDEFINED DEBUFFS ({len(results['undefined_debuffs_details'])} occurrences):")
            lines.append("=" * 80)

            # Separate by source
            char_debuffs = [item for item in results['undefined_debuffs_details'] if item.get('source') == 'character']
            ee_debuffs = [item for item in results['undefined_debuffs_details'] if item.get('source') == 'ee']

            if char_debuffs:
                lines.append("From Character Skills:")
                for item in char_debuffs:
                    lines.append(f"  [{item['character']}] {item['skill']}: {item['debuff']}")
                lines.append("")

            if ee_debuffs:
                lines.append("From Exclusive Equipment:")
                for item in ee_debuffs:
                    lines.append(f"  [{item['character']}] {item['skill']}: {item['debuff']}")
                lines.append("")

        # Unused buffs
        if results['unused_buffs']:
            lines.append("=" * 80)
            lines.append(f"UNUSED BUFFS ({len(results['unused_buffs'])}):")
            lines.append("=" * 80)
            lines.append("These buffs are defined in buffs.json but not used anywhere:")
            lines.append("(Scanned: characters, EE, guides/_contents, guild-raid)")
            for buff in results['unused_buffs']:
                lines.append(f"  - {buff}")
            lines.append("")

        # Unused debuffs
        if results['unused_debuffs']:
            lines.append("=" * 80)
            lines.append(f"UNUSED DEBUFFS ({len(results['unused_debuffs'])}):")
            lines.append("=" * 80)
            lines.append("These debuffs are defined in debuffs.json but not used anywhere:")
            lines.append("(Scanned: characters, EE, guides/_contents, guild-raid)")
            for debuff in results['unused_debuffs']:
                lines.append(f"  - {debuff}")
            lines.append("")

        # All clear message
        if not results['undefined_buffs_details'] and not results['undefined_debuffs_details'] and not results['unused_buffs'] and not results['unused_debuffs']:
            lines.append("=" * 80)
            lines.append("ALL BUFFS AND DEBUFFS ARE PROPERLY DEFINED AND USED!")
            lines.append("=" * 80)

        return "\n".join(lines)

    def remove_buff_from_files(self, buff_name: str, is_debuff: bool = False) -> Dict:
        """
        Remove a specific buff or debuff from all character and EE files

        Args:
            buff_name: Name of the buff/debuff to remove
            is_debuff: True if removing a debuff, False if removing a buff

        Returns:
            Dictionary containing:
            - removed_from: List of files where the buff/debuff was removed
            - locations: Detailed list of removal locations
            - errors: List of errors encountered
        """
        removed_from = []
        locations = []
        errors = []
        field_name = 'debuff' if is_debuff else 'buff'
        dual_field_name = 'dual_debuff' if is_debuff else 'dual_buff'

        # Process character files
        if CHAR_DATA_FOLDER.exists():
            char_files = list(CHAR_DATA_FOLDER.glob("*.json"))

            for char_file in char_files:
                try:
                    with open(char_file, 'r', encoding='utf-8') as f:
                        char_data = json.load(f)

                    modified = False
                    char_name = char_data.get('Fullname', char_file.stem)

                    # Check each skill
                    if 'skills' in char_data:
                        skill_names = {
                            'SKT_FIRST': 's1',
                            'SKT_SECOND': 's2',
                            'SKT_ULTIMATE': 's3',
                            'SKT_CHAIN_PASSIVE': 'chain',
                            'SKT_DUAL': 'dual'
                        }

                        for skill_type, skill_data in char_data['skills'].items():
                            if not isinstance(skill_data, dict):
                                continue

                            skill_name = skill_names.get(skill_type, skill_type)

                            # Check regular buff/debuff field
                            if field_name in skill_data and isinstance(skill_data[field_name], list):
                                if buff_name in skill_data[field_name]:
                                    skill_data[field_name].remove(buff_name)
                                    modified = True
                                    locations.append({
                                        'file': char_file.name,
                                        'character': char_name,
                                        'skill': skill_name,
                                        'field': field_name
                                    })

                            # Check dual buff/debuff field
                            if dual_field_name in skill_data and isinstance(skill_data[dual_field_name], list):
                                if buff_name in skill_data[dual_field_name]:
                                    skill_data[dual_field_name].remove(buff_name)
                                    modified = True
                                    locations.append({
                                        'file': char_file.name,
                                        'character': char_name,
                                        'skill': f"{skill_name}_dual",
                                        'field': dual_field_name
                                    })

                    # Save if modified
                    if modified:
                        with open(char_file, 'w', encoding='utf-8') as f:
                            json.dump(char_data, f, indent=2, ensure_ascii=False)
                        removed_from.append(char_file.name)

                except Exception as e:
                    errors.append(f"Error processing {char_file.name}: {str(e)}")
                    logger.exception(f"Error processing {char_file.name}")

        # Process EE file
        if EE_FILE.exists():
            try:
                with open(EE_FILE, 'r', encoding='utf-8') as f:
                    ee_data = json.load(f)

                modified = False

                for char_id, ee_info in ee_data.items():
                    if not isinstance(ee_info, dict):
                        continue

                    # Check buff/debuff field
                    if field_name in ee_info and isinstance(ee_info[field_name], list):
                        if buff_name in ee_info[field_name]:
                            ee_info[field_name].remove(buff_name)
                            modified = True
                            locations.append({
                                'file': 'ee.json',
                                'character': char_id,
                                'skill': 'ee',
                                'field': field_name
                            })

                # Save if modified
                if modified:
                    with open(EE_FILE, 'w', encoding='utf-8') as f:
                        json.dump(ee_data, f, indent=2, ensure_ascii=False)
                    removed_from.append('ee.json')

            except Exception as e:
                errors.append(f"Error processing ee.json: {str(e)}")
                logger.exception(f"Error processing ee.json")

        return {
            'buff_name': buff_name,
            'is_debuff': is_debuff,
            'removed_from': removed_from,
            'locations': locations,
            'errors': errors,
            'total_removals': len(locations)
        }

    def format_cleanup_report(self, cleanup_results: List[Dict]) -> str:
        """Format cleanup results as readable text"""
        lines = []

        lines.append("=" * 80)
        lines.append("BUFF/DEBUFF CLEANUP REPORT")
        lines.append("=" * 80)
        lines.append("")

        total_removals = sum(r['total_removals'] for r in cleanup_results)
        total_files = len(set(f for r in cleanup_results for f in r['removed_from']))

        lines.append(f"Total items cleaned: {len(cleanup_results)}")
        lines.append(f"Total removals: {total_removals}")
        lines.append(f"Total files modified: {total_files}")
        lines.append("")

        for result in cleanup_results:
            item_type = "DEBUFF" if result['is_debuff'] else "BUFF"
            lines.append("=" * 80)
            lines.append(f"{item_type}: {result['buff_name']}")
            lines.append("=" * 80)
            lines.append(f"Removed from {result['total_removals']} location(s):")

            for loc in result['locations']:
                lines.append(f"  [{loc['character']}] {loc['skill']} in {loc['file']}")

            if result['errors']:
                lines.append("Errors:")
                for error in result['errors']:
                    lines.append(f"  ! {error}")

            lines.append("")

        # Summary of all errors
        all_errors = [e for r in cleanup_results for e in r['errors']]
        if all_errors:
            lines.append("=" * 80)
            lines.append("ALL ERRORS:")
            lines.append("=" * 80)
            for error in all_errors:
                lines.append(f"  ! {error}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("CLEANUP COMPLETE")
        lines.append("=" * 80)

        return "\n".join(lines)


if __name__ == "__main__":
    # Test the validator
    logging.basicConfig(level=logging.INFO)

    validator = BuffValidator()
    validator.load_definitions()
    results = validator.scan_character_files()

    print(validator.format_results_text(results))