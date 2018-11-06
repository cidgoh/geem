from django.contrib.auth.models import User, Group
from rest_framework import viewsets, permissions
from rest_framework.authentication import SessionAuthentication
from oauth2_provider.contrib.rest_framework import TokenHasReadWriteScope, TokenHasScope, OAuth2Authentication
from api.serializers import UserSerializer

# View framework is at: https://www.django-rest-framework.org/api-guide/viewsets/

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    authentication_classes = [OAuth2Authentication, SessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer

