import os


def get_security_settings(environ=None):
    environ = os.environ if environ is None else environ
    production = environ.get('FLASK_ENV', '').lower() == 'production' or environ.get('RENDER', '').lower() == 'true'
    secret_key = environ.get('SECRET_KEY')
    if production and not secret_key:
        raise RuntimeError('SECRET_KEY must be set in production.')

    frontend_url = environ.get('FRONTEND_URL', 'http://localhost:5000')
    origins = {
        origin.strip().rstrip('/')
        for origin in environ.get('CORS_ALLOWED_ORIGINS', frontend_url).split(',')
        if origin.strip()
    }
    return {
        'production': production,
        'secret_key': secret_key or os.urandom(32),
        'allowed_origins': sorted(origins),
    }
