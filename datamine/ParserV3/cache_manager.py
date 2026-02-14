"""
Cache Manager - Pre-decode .bytes files to JSON for fast loading
"""
import json
import hashlib
from pathlib import Path
from bytes_parser import Bytes_parser

class CacheManager:
    """Manage cached JSON versions of .bytes files with checksum validation"""

    def __init__(self, bytes_folder, cache_folder=None):
        self.bytes_folder = Path(bytes_folder)
        self.cache_folder = Path(cache_folder) if cache_folder else Path(__file__).parent / "cache"
        self.cache_folder.mkdir(exist_ok=True)

    def _get_file_checksum(self, file_path):
        """Calculate MD5 checksum of a file"""
        md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                md5.update(chunk)
        return md5.hexdigest()

    def _get_cache_path(self, bytes_filename):
        """Get cache file path for a .bytes file"""
        cache_name = bytes_filename.replace('.bytes', '.json')
        return self.cache_folder / cache_name

    def _get_checksum_path(self, bytes_filename):
        """Get checksum file path for a .bytes file"""
        checksum_name = bytes_filename.replace('.bytes', '.checksum')
        return self.cache_folder / checksum_name

    def _is_cache_valid(self, bytes_file, checksum_file):
        """Check if cache is valid by comparing checksums"""
        if not checksum_file.exists():
            return False

        # Read stored checksum
        with open(checksum_file, 'r') as f:
            stored_checksum = f.read().strip()

        # Calculate current checksum
        current_checksum = self._get_file_checksum(bytes_file)

        return stored_checksum == current_checksum

    def get_data(self, bytes_filename):
        """
        Get data from cache or parse .bytes file if cache is invalid
        Returns the parsed data as a list of dictionaries
        """
        bytes_file = self.bytes_folder / bytes_filename
        cache_file = self._get_cache_path(bytes_filename)
        checksum_file = self._get_checksum_path(bytes_filename)

        # Check if cache exists and is valid
        if cache_file.exists() and self._is_cache_valid(bytes_file, checksum_file):
            # Load from cache
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)

        # Cache miss or invalid - parse .bytes file
        print(f"Parsing {bytes_filename}...")
        parser = Bytes_parser(str(bytes_file))
        data = parser.get_data()

        # Save to cache
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Save checksum
        checksum = self._get_file_checksum(bytes_file)
        with open(checksum_file, 'w') as f:
            f.write(checksum)

        print(f"Cached {bytes_filename} -> {cache_file.name}")

        return data

    def clear_cache(self):
        """Delete all cache files"""
        for file in self.cache_folder.glob('*'):
            file.unlink()
        print(f"Cache cleared: {self.cache_folder}")

    def rebuild_cache(self, bytes_files):
        """Rebuild cache for specific .bytes files"""
        for bytes_filename in bytes_files:
            cache_file = self._get_cache_path(bytes_filename)
            checksum_file = self._get_checksum_path(bytes_filename)

            # Delete existing cache
            if cache_file.exists():
                cache_file.unlink()
            if checksum_file.exists():
                checksum_file.unlink()

            # Rebuild
            self.get_data(bytes_filename)
