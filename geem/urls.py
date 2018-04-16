from django.contrib import admin
from django.urls import include, path

from . import views

urlpatterns = [
    path('index.html', views.index),
    path('portal.html', views.portal),
    path('form.html', views.form),
    path('data/shared_packages/test.epi.json', views.test_epi),
    path('data/ontology/foodon-merged.json', views.foodon_merged),
    path('data/ontology/genepio-merged.json', views.genepio_merged),
    path('templates/modal_lookup.html', views.modal_lookup),
    path('templates/resource_summary_form.html', views.resource_summary_form),
]
