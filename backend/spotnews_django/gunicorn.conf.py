import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
# Use 1 worker on 512MB RAM instances to prevent OOM when Playwright Chromium runs
workers = 1
threads = 4
timeout = 300
keepalive = 65
accesslog = "-"
errorlog = "-"
capture_output = True
enable_stdio_inheritance = True
