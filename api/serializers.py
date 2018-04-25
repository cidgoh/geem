from django.contrib.auth.models import User
from geem.models import Package
from rest_framework import serializers

class PackageSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Package
        fields = (
            'owner',
            'created',
            'updated',
            'contents'
        )

class UserSerializer(serializers.HyperlinkedModelSerializer):
    packages = PackageSerializer(
        many=True,
        read_only=True
    )
    class Meta:
        model = User
        fields = ('url', 'username', 'email', 'packages')
