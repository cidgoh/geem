from django.forms import ModelForm
from geem.models import Package

class PackageForm(ModelForm):
    class Meta:
        model=Package
        fields=[
            'id',
            'owner',
            #'created', non-editable
            #'updated', non-editable
            'name',
            'description',
            'file_base_name',
            'version',
            'ontology',
            'public',
            'curation',
            'contents' 
        ]