from django.contrib.auth.models import User, Group
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

class GroupSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Group
        fields = ('url', 'name')
