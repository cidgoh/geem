import os

from .base import *

# GENERAL
# ----------------------------------------------------------------------
DEBUG = True
ALLOWED_HOSTS = ['*']
SECRET_KEY = 'local_secret_key'

# DATABASES
# ----------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'db',
        'PORT': '5432',
        'NAME': 'postgres',
        'USER': 'postgres',
        'PASSWORD': 'postgres',
    }
}
