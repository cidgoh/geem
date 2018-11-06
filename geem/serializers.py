from geem.models import Package
from rest_framework import serializers

# This skips contents field 
class ResourceSummarySerializer(serializers.HyperlinkedModelSerializer):
    #owner = serializers.ReadOnlyField(source='owner.username')
    class Meta:
        model = Package
        fields = (
            'id',
            'owner',
            'created',
            'updated',
            'name',
            'description',
            'file_base_name',
            'version',
            'ontology',
            'public',
            'curation'
        )

# This includes contents field 
class ResourceDetailSerializer(serializers.HyperlinkedModelSerializer):
    #owner = serializers.ReadOnlyField(source='owner.username')
    class Meta:
        model = Package
        fields = (
            'id',
            'owner',
            'created',
            'updated',
            'name',
            'description',
            'file_base_name',
            'version',
            'ontology',
            'public',
            'curation',
            'contents' # EXTRA FIELD
        )
