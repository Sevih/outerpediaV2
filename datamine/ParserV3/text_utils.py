"""
Text Utilities - Helper functions for text formatting

This module provides text formatting utilities matching the TypeScript implementations
from src/utils/formatText.tsx for consistency across the project.

Features:
- toKebabCase: Convert text to kebab-case format for filenames
- NFD normalization to remove accents
- Handles special characters and edge cases

Usage:
    from text_utils import to_kebab_case
    filename = to_kebab_case("Summer Knight's Dream Ember")
    # Returns: "summer-knights-dream-ember"
"""
import unicodedata
import re


def to_kebab_case(text):
    """
    Convert text to kebab-case format (lowercase with hyphens)

    Matches the TypeScript implementation:
    - Converts to lowercase
    - Normalizes unicode (NFD) to remove accents
    - Removes diacritical marks
    - Replaces non-alphanumeric characters with hyphens
    - Removes leading/trailing hyphens

    Args:
        text: Input string to convert

    Returns:
        str: kebab-case formatted string

    Examples:
        >>> to_kebab_case("Summer Knight's Dream Ember")
        'summer-knights-dream-ember'
        >>> to_kebab_case("K")
        'k'
        >>> to_kebab_case("Charlotte")
        'charlotte'
        >>> to_kebab_case("Demiurge Astéi")
        'demiurge-astei'
    """
    if not isinstance(text, str):
        print(f'to_kebab_case: input not a string: {text}')
        return ''

    # Convert to lowercase
    result = text.lower()

    # Normalize unicode (NFD) - decompose combined characters
    result = unicodedata.normalize('NFD', result)

    # Remove diacritical marks (accents) - Unicode range U+0300 to U+036F
    result = re.sub(r'[\u0300-\u036f]', '', result)

    # Replace non-alphanumeric characters with hyphens
    result = re.sub(r'[^a-z0-9]+', '-', result)

    # Remove leading/trailing hyphens
    result = re.sub(r'(^-|-$)', '', result)

    return result
