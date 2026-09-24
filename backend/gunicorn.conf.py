# gunicorn.conf.py
# Production WSGI server config for Render deployment.
# IMPORTANT: Only 1 worker allowed with eventlet (SocketIO in-memory state).
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
worker_class = "eventlet"
workers = 1
threads = 1
timeout = 120
keepalive = 5
