#!/usr/bin/env python3
"""Runner script for Smith CLI.

Run from services/api directory:
    python run_smith.py
    python run_smith.py --model gemini/gemini-2.5-flash
    python run_smith.py --debug
"""

import sys
import os

# IMPORTANT: Import dspy and other dependencies BEFORE adding src to path
# This prevents the src/queue module from shadowing Python's stdlib queue
import dspy

# Now add src to path (at the end to avoid shadowing)
script_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(script_dir, "src")
if src_dir not in sys.path:
    sys.path.append(src_dir)

# Now we can safely import smith
from smith.cli import main

if __name__ == "__main__":
    main()
