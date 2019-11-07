import os

from .base import *

# GENERAL
# ----------------------------------------------------------------------
DEBUG = True
ALLOWED_HOSTS = ['*']
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
