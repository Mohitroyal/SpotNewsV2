#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    from pathlib import Path
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(Path(__file__).resolve().parent / "pw-browsers")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
