#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.playwright
playwright install chromium
playwright install-deps chromium || true
python manage.py collectstatic --no-input
