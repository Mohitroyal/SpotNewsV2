import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
threads = 4
timeout = 300  # 5 minutes to prevent WORKER TIMEOUT during PDF rendering
keepalive = 65
accesslog = "-"
errorlog = "-"
capture_output = True
enable_stdio_inheritance = True
