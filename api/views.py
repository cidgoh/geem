from django.contrib.auth.models import User, Group
from geem.models import Package
from rest_framework import viewsets, permissions
from rest_framework.authentication import SessionAuthentication
from oauth2_provider.contrib.rest_framework import TokenHasReadWriteScope, TokenHasScope, OAuth2Authentication
from api.serializers import UserSerializer, PackageSerializer
from django.db.models import Q

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    authentication_classes = [OAuth2Authentication, SessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer

class PackageViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows packages to be viewed or edited.
    """
    authentication_classes = [OAuth2Authentication, SessionAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = PackageSerializer
    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Package.objects.filter(Q(owner=user) | Q(owner=None))
        else:
            return Package.objects.filter(owner=None)
