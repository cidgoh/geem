from django.contrib import admin
from django.urls import include, path, reverse_lazy
from django.contrib.auth import views as auth_views

from . import views

urlpatterns = [
    path('index.html', views.index, name='index'),
    path('portal.html', views.portal, name='portal'),
    path('form.html', views.form),
    path('data/shared_packages/test.epi.json', views.test_epi),
    path('data/private_packages/new_2018-04-16.json', views.new_2018_04_16),
    path('data/ontology/foodon-merged.json', views.foodon_merged),
    path('data/ontology/genepio-merged.json', views.genepio_merged),
    path('templates/modal_lookup.html', views.modal_lookup),
    path('templates/resource_summary_form.html', views.resource_summary_form),
    path('accounts/login', auth_views.login, name='login', kwargs={'template_name': 'geem/login.html'}),
    path('accounts/logout', auth_views.logout, name='logout', kwargs={'next_page': reverse_lazy('portal')}),
]
