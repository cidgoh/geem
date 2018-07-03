from rest_framework import routers
from django.urls import include, path

from . import views

router = routers.DefaultRouter()
router.register('users', views.UserViewSet)
router.register('packages', views.PackageViewSet, base_name="Package")

urlpatterns = [
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework'))
]
