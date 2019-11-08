import os

from .base import *
from definitions import BASE_DIR

# GENERAL
# ----------------------------------------------------------------------
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
ALLOWED_HOSTS = [os.environ['DJANGO_ALLOWED_HOST']]

# STATIC
# ----------------------------------------------------------------------
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# ADMIN
# ----------------------------------------------------------------------
ADMIN_URL = os.environ['DJANGO_ADMIN_URL']

# Gunicorn
# ----------------------------------------------------------------------
INSTALLED_APPS += ['gunicorn']
