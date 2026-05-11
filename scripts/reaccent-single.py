"""Apply the reaccent-fr.py dictionary to a SINGLE file passed as argument.
Imports the dictionary and contextual rules from reaccent-fr to keep them in sync.
"""
import sys
import re
import importlib.util

# Load reaccent-fr module
spec = importlib.util.spec_from_file_location("reaccent_fr", "scripts/reaccent-fr.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

if len(sys.argv) < 2:
    print("Usage: python scripts/reaccent-single.py <path-to-file>")
    sys.exit(1)

path = sys.argv[1]
n = mod.process_file(path)
print(f'{n} fr values modified in {path}')
