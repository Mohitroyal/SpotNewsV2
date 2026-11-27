import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from pathlib import Path
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(Path(__file__).resolve().parent.parent / "pw-browsers")
application = get_wsgi_application()
