from django.contrib.auth.models import User, Group
from geem.models import Package
from rest_framework import serializers

class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ('url', 'username', 'email', 'groups')

class GroupSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Group
        fields = ('url', 'name')

class PackageSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Package
        fields = (
            'owner',
            'created',
            'updated',
            'package_type',
            'status',
            'title',
            'description',
            'license',
            'version',
            'contents'
        )
