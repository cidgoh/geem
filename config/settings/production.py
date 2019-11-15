import os

from .base import *
from definitions import BASE_DIR

# GENERAL
# ----------------------------------------------------------------------
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
if os.environ['DJANGO_ALLOWED_HOST']:
    ALLOWED_HOSTS = [os.environ['DJANGO_ALLOWED_HOST']]
else:
    ALLOWED_HOSTS = ['localhost']

# DATABASES
# ----------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'db',
        'PORT': '5432',
        'NAME': 'postgres',
        'USER': os.environ['POSTGRES_USER'],
        'PASSWORD': os.environ['POSTGRES_PASSWORD'],
    }
}

# STATIC
# ----------------------------------------------------------------------
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# ADMIN
# ----------------------------------------------------------------------
ADMIN_URL = os.environ['DJANGO_ADMIN_URL']

# Gunicorn
# ----------------------------------------------------------------------
INSTALLED_APPS += ['gunicorn']
