"""
Extract BGM mapping from game data files.

Maps audio file names (ResourceFile) to their display names (English).
Also includes BGM files not in the jukebox with auto-generated names.

Usage:
    python extract_bgm_mapping.py [audio_folder]

Arguments:
    audio_folder - Optional path to folder containing extracted .wav files
                   If provided, includes all BGM files even if not in jukebox

Output:
    bgm_mapping.json - Full mapping with file and name
    bgm_files.txt - Just the file names (for Asset Studio regex)
"""
from bytes_parser import Bytes_parser
import json
import os
import re
import sys

TEMPLET_PATH = "../extracted_astudio/assets/editor/resources/templetbinary"

# Manual names for BGM not in jukebox
MANUAL_NAMES = {
    "Battle_02": "Battle - Alternate 1",
    "Battle_03": "Battle - Alternate 2",
    "Battle_04": "Battle - Alternate 3",
    "Boss_Area_02": "Battle - Area Boss 2",
    "Boss_Area_03": "Battle - Area Boss 3",
    "Boss_Area_04": "Battle - Area Boss 4",
    "Boss_Normal_02": "Battle - Normal Boss 2",
    "Boss_Normal_03": "Battle - Normal Boss 3",
    "Boss_Normal_04": "Battle - Normal Boss 4",
    "Boss_Season_01": "Battle - Season Boss 1",
    "Boss_Season_02": "Battle - Season Boss 2",
    "Boss_Season_03": "Battle - Season Boss 3",
    "Boss_Season_04": "Battle - Season Boss 4",
    "Boss_World_01": "Battle - World Boss",
    "Gacha_BGM": "Gacha",
    "Monadgate": "Monad Gate",
    "Monadgate_Ending_Bad": "Monad Gate - Bad Ending",
    "Monadgate_Ending_Fail": "Monad Gate - Fail Ending",
    "Monadgate_Ending_True": "Monad Gate - True Ending",
    "Remains_02": "Thema - Ruins 2",
    "Remains_03": "Thema - Ruins 3",
    "Remains_04": "Thema - Ruins 4",
    "Result_01": "Result",
    "RTPVP_BanPick": "Real-Time PvP - Ban/Pick",
    "RTPVP_Battle": "Real-Time PvP - Battle",
    "RuinIsland": "Ruin Island",
    "Scene_Crisis02": "Scene Crisis 02",
    "Scene_Crisis03": "Scene Crisis 03",
    "Scene_Fantasy": "Scene Fantasy",
    "Scene_Prologue": "Scene Prologue",
    "Scene_Rhapsody": "Scene Rhapsody",
    "Scene_Situation": "Scene Situation",
    "Event_00030": "Event - Unknown 30",
}


def format_filename_as_name(filename: str) -> str:
    """Convert filename to readable name if not in manual names."""
    # Remove _intro suffix for lookup
    base = re.sub(r"_[Ii]ntro$", "", filename)

    if base in MANUAL_NAMES:
        if "_intro" in filename.lower():
            return MANUAL_NAMES[base] + " (Intro)"
        return MANUAL_NAMES[base]

    # Auto-format: replace underscores, add spaces before numbers
    name = filename.replace("_", " ")
    name = re.sub(r"(\d+)", r" \1", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name.title()


def extract_bgm_mapping(audio_folder: str = None):
    """Extract BGM file to name mapping from game data."""

    # Parse BGM entries from LobbyCustomResourceTemplet (jukebox)
    bgm_parser = Bytes_parser(f"{TEMPLET_PATH}/LobbyCustomResourceTemplet.bytes")
    bgm_data = bgm_parser.get_data()
    bgm_entries = [d for d in bgm_data if d.get("Type") == "LRT_BGM"]

    # Parse translations from TextSystem
    text_parser = Bytes_parser(f"{TEMPLET_PATH}/TextSystem.bytes")
    text_data = text_parser.get_data()

    # Create translation lookup: IDSymbol -> English name
    translations = {
        d.get("IDSymbol"): d.get("English", "")
        for d in text_data
        if d.get("IDSymbol")
    }

    # Build mapping from jukebox: file -> English name
    jukebox_mapping = {}
    for entry in bgm_entries:
        resource = entry.get("ResourceFile", "")
        name_key = entry.get("NAME", "")
        en_name = translations.get(name_key, "")

        # Handle "intro,main" format
        for part in resource.split(","):
            part = part.strip()
            if part and en_name:
                jukebox_mapping[part] = en_name

    # Collect all BGM files
    all_files = set(jukebox_mapping.keys())

    # If audio folder provided, scan for additional files
    if audio_folder and os.path.isdir(audio_folder):
        for f in os.listdir(audio_folder):
            if f.endswith(".wav"):
                base = f[:-4]  # Remove .wav
                all_files.add(base)

    # Build final mapping
    result = []
    for filename in sorted(all_files):
        if filename in jukebox_mapping:
            name = jukebox_mapping[filename]
        else:
            name = format_filename_as_name(filename)

        result.append({"file": filename, "name": name})

    # Write full mapping JSON
    with open("bgm_mapping.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Write file names list (for regex)
    with open("bgm_files.txt", "w", encoding="utf-8") as f:
        for entry in result:
            f.write(entry["file"] + "\n")

    print(f"Extracted {len(result)} BGM entries")
    print(f"  - From jukebox: {len(jukebox_mapping)}")
    print(f"  - Additional: {len(result) - len(jukebox_mapping)}")
    print("Output: bgm_mapping.json, bgm_files.txt")

    return result


if __name__ == "__main__":
    audio_path = sys.argv[1] if len(sys.argv) > 1 else None
    extract_bgm_mapping(audio_path)
