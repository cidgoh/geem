from django.contrib import admin
from django.urls import include, path, reverse_lazy
from django.contrib.auth import views as auth_views

from . import views

urlpatterns = [
    path('index.html', views.index, name='index'),
    path('portal.html', views.portal, name='portal'),
    path('form.html', views.form),
    path('templates/modal_lookup.html', views.modal_lookup),
    path('templates/resource_summary_form.html', views.resource_summary_form),

    #/api/urls.py has include that covers this
    #path('data/resource/', views.resources),

    #path('data/ontology/', views.ontologies),
    #path('data/ontology/<file_name>/', views.ontology),
    #path('data/shared/', views.shared_packages),
    #path('data/shared/<file_name>/', views.shared_package),
    #path('data/private/', views.private_packages),
    #path('data/private/<file_name>/', views.private_package),

    path('accounts/login', auth_views.login, name='login', kwargs={'template_name': 'geem/login.html'}),
    path('accounts/logout', auth_views.logout, name='logout', kwargs={'next_page': reverse_lazy('portal')}),
]
