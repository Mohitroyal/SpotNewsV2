#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
export PLAYWRIGHT_BROWSERS_PATH=0
playwright install
playwright install-deps || true
python manage.py collectstatic --no-input
