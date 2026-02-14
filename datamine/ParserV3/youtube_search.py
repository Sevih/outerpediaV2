"""
YouTube Video Search - OUTERPLANE Official Channel Video Discovery

This module searches for character introduction videos on the official OUTERPLANE YouTube channel
using the YouTube Data API v3. It supports searching across multiple regional channels (Global,
Korea, Japan, Taiwan) and handles rate limiting through quota management.

API Information:
- Daily Quota: 10,000 units
- Cost per search: 100 units
- Maximum searches per day: ~100 characters

Features:
- Search official OUTERPLANE channels only or all YouTube
- Automatic fallback from full name to base name
- Graceful error handling for missing videos
- Support for multiple regional channels

Usage:
    from youtube_search import search_character_video

    # Search official channel only (recommended)
    video_url = search_character_video("Charlotte", search_official_only=True)

    # Search all YouTube with OUTERPLANE keyword
    video_url = search_character_video("Charlotte", search_official_only=False)

Configuration:
- Add additional regional channel IDs to OFFICIAL_CHANNELS dict
- API_KEY can be obtained from Google Cloud Console (YouTube Data API v3)

Author: ParserV3
Date: 2025-10
"""
import requests
from typing import Optional

# OUTERPLANE official channel IDs (multiple regional channels)
# Channel IDs can be found by searching for the channel on YouTube and extracting from the URL
OFFICIAL_CHANNELS = {
    "Global": "UCj3n-ek2lSiQygcnV37GVTg",  # @OUTERPLANE_OFFICIAL
    # Additional regional channels can be added here:
    # "Korea": "UC...",
    # "Japan": "UC...",
    # "Taiwan": "UC..."
}

# YouTube Data API v3 Key
# Obtain from: https://console.cloud.google.com/ -> APIs & Services -> Credentials
API_KEY = "AIzaSyD4pTIAgE-J3NanvhL-AiWPrsLDOqItOjw"

def search_character_video(character_name: str, search_official_only: bool = False) -> Optional[str]:
    """
    Search for a character video on YouTube

    Args:
        character_name: Full character name (e.g., "Monad Eva", "Charlotte")
        search_official_only: If True, search only official OUTERPLANE channels.
                            If False, search all YouTube with "OUTERPLANE" keyword.

    Returns:
        Video URL if found, None otherwise

    API Cost: 100 units per search (or 100 units per channel if searching all official channels)
    Daily quota: 10,000 units (100 searches)
    """
    # YouTube Data API v3 search endpoint
    url = "https://www.googleapis.com/youtube/v3/search"

    if search_official_only:
        # Search in all official channels
        for region, channel_id in OFFICIAL_CHANNELS.items():
            params = {
                "part": "snippet",
                "channelId": channel_id,
                "q": character_name,
                "type": "video",
                "maxResults": 5,
                "order": "relevance",
                "key": API_KEY
            }

            try:
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                if "items" in data and len(data["items"]) > 0:
                    # Look for exact match in title
                    for item in data["items"]:
                        title = item.get("snippet", {}).get("title", "")
                        if character_name.lower() in title.lower():
                            # Check if video_id exists in the structure
                            if "id" in item and "videoId" in item["id"]:
                                video_id = item["id"]["videoId"]
                                print(f"  Found in {region} channel")
                                return f"https://www.youtube.com/watch?v={video_id}"

            except Exception as e:
                # Silent error - just continue to next channel
                continue

        return None

    else:
        # Search all YouTube with "OUTERPLANE" keyword
        params = {
            "part": "snippet",
            "q": f"OUTERPLANE {character_name}",
            "type": "video",
            "maxResults": 10,
            "order": "relevance",
            "key": API_KEY
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if "items" not in data or len(data["items"]) == 0:
                return None

            # Look for videos from official channels first
            for item in data["items"]:
                channel_id = item["snippet"]["channelId"]
                if channel_id in OFFICIAL_CHANNELS.values():
                    video_id = item["id"]["videoId"]
                    return f"https://www.youtube.com/watch?v={video_id}"

            # If no official video, return most relevant result
            video_id = data["items"][0]["id"]["videoId"]
            return f"https://www.youtube.com/watch?v={video_id}"

        except requests.exceptions.RequestException as e:
            print(f"Error searching YouTube for '{character_name}': {e}")
            return None
        except KeyError as e:
            print(f"Unexpected API response format: {e}")
            return None


def search_multiple_characters(character_names: list[str]) -> dict[str, Optional[str]]:
    """
    Search videos for multiple characters

    Args:
        character_names: List of character names

    Returns:
        Dictionary mapping character names to video URLs

    Note: Each search costs 100 units. With 10,000 daily quota, you can search ~100 characters/day.
    """
    results = {}

    for i, name in enumerate(character_names, 1):
        print(f"Searching {i}/{len(character_names)}: {name}...")
        video_url = search_character_video(name)
        results[name] = video_url

        if video_url:
            print(f"  ✓ Found: {video_url}")
        else:
            print(f"  ✗ Not found")

    return results


if __name__ == "__main__":
    # Test with a single character
    import sys

    if len(sys.argv) > 1:
        char_name = " ".join(sys.argv[1:])
        print(f"Searching for '{char_name}'...")
        video = search_character_video(char_name)
        if video:
            print(f"Found: {video}")
        else:
            print("No video found")
    else:
        print("Usage: python youtube_search.py <character name>")
        print("Example: python youtube_search.py Monad Eva")
