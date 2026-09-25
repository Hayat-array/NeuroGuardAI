# gunicorn.conf.py
# Production WSGI server config for Render deployment.
# IMPORTANT: Only 1 worker allowed with eventlet (SocketIO in-memory state).
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
worker_class = "gthread"
workers = 1
threads = 8
timeout = 120
keepalive = 65
backlog = 2048
max_requests = 5000
max_requests_jitter = 200
graceful_timeout = 30

