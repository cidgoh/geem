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
            'root_name',
            'version',
            'ontology',
            'public',
            'curation',
            'contents'
        )

class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = (
            'url',
            'username',
            'email'
        )
