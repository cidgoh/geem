from rest_framework import routers
from django.urls import include, path, reverse_lazy

from . import views
from geem import views as geem_views

router = routers.DefaultRouter()
# These are lisated at top level for /api/ call
router.register('users', views.UserViewSet)
router.register('resources', geem_views.ResourceViewSet, base_name="Package")

urlpatterns = [
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
]
