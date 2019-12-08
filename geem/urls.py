from django.contrib import admin
from django.urls import include, path, reverse_lazy
from django.contrib.auth import views as auth_views
from django.views.generic.base import RedirectView

favicon_view = RedirectView.as_view(url='/static/geem/favicon.ico', permanent=True)

from . import views

urlpatterns = [
    path('index.html', views.index, name='index'),
    path('portal.html', views.portal, name='portal'),
    path('form.html', views.form),

    #path('portal.5.5.html', views.portal55, name='portal55'), # CSS TESTING    
    #path('form.5.5.html', views.form55), # CSS TESTING
    path('foundation.5.5.html', views.foundation55), # CSS TESTING

    path('favicon.ico', favicon_view),
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

    path('accounts/login', auth_views.LoginView.as_view(template_name='geem/login.html'), name='login'),
    path('accounts/logout', auth_views.LogoutView.as_view(next_page=reverse_lazy('portal')), name='logout'),

    path('get_uploaded_validation_data', views.get_uploaded_validation_data),
    path('csv_str_to_matrix', views.csv_str_to_matrix),
]
