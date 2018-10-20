from django.shortcuts import render
from django.http import HttpResponse
#from django.template import Context
from oauth2_provider.models import Application
from geem.serializers import ResourceSummarySerializer, ResourceDetailSerializer
import json

import re, os

from rest_framework import mixins
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from oauth2_provider.contrib.rest_framework import TokenHasReadWriteScope, TokenHasScope, OAuth2Authentication
from rest_framework import viewsets, permissions
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from django.db.models import Q

from geem.models import Package
from geem.forms import PackageForm

ROOT_PATH     = 'geem/static/geem/'

"Method \"POST\" not allowed."

# Create your views here.
def index(request):
    return render(request, 'geem/index.html', context={})

def portal(request):
    return render(request, 'geem/portal.html', context={})

def login(request):
    context = {}
    context['client_id'] = Application.objects.filter(name='geem').values()[0]['client_id']
    return render(request, 'geem/login.html', context)

def form(request):
    return render(request, 'geem/form.html', context={})

def modal_lookup(request):
    return render(request, 'geem/templates/modal_lookup.html', context={})

def resource_summary_form(request):
    return render(request, 'geem/templates/resource_summary_form.html', context={})

class ResourceViewSet(viewsets.ModelViewSet, mixins.CreateModelMixin, mixins.DestroyModelMixin): # mixins.UpdateModelMixin, 
    """
    API endpoint that lists packages.
    See: https://www.django-rest-framework.org/api-guide/viewsets/#viewset-actions
    Serializer differs based on list or individual record view.
    """
    authentication_classes = [OAuth2Authentication, SessionAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = ResourceDetailSerializer
    queryset = Package.objects.all() # USED AS DUMMY. Ok? Ignored in favor of methods below
    #queryset = [] 

    def list(self, request, pk=None):

        queryset= self._get_resource_queryset(request)
        return Response(ResourceSummarySerializer(queryset, context={'request': request}, many=True).data)


    def retrieve(self, request, pk=None):

        queryset= self._get_resource_queryset(request)
        package = get_object_or_404(queryset, pk=pk)  # OR .get(pk=1) ???
        return Response(ResourceDetailSerializer(package, context={'request': request}).data)


    def create(self, request, pk=None):

        form = PackageForm(request.POST or None) #or request.data
        if form.is_valid():
            package = form.save(commit=False)
            package.owner = self.request.user # couldn't/shouldn't pass right parammeter from client side.
            package.save()
            return Response(ResourceDetailSerializer(package, context={'request': request}).data)
        else:
            return Response(form.errors)
            """
            if pk is not None:
                pass #complaint = get_object_or_404(Complaint, id=id)
            else:
                pass #complaint = None 
            """


    def post(self, request, pk=None, format=None):
        package = get_object_or_404(Package, pk=pk) 
        #if request.method == 'POST':
        form = PackageForm(request.POST or None, instance=package)
        if form.is_valid():
            package = form.save(commit=False)
            #package.owner = self.request.user
            package.save()

            return Response(ResourceDetailSerializer(package, context={'request': request}).data)

        return Response(form.errors, status=status.HTTP_400_BAD_REQUEST)

        """
        serializer = ResourceDetailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        """

    """
    def post(self, request, pk=None): # no 'post':'update' mapping?
        #instance = self.get_object()
        form = PackageForm(request.POST or None) #or request.data
        if form.is_valid():
            package = form.save(commit=False)
            #package.owner = self.request.user
            package.save()
            return Response(ResourceDetailSerializer(package, context={'request': request}).data)
        else:
            return Response(form.errors)
    """
        # So we don't get back a giant file ...
        #response_obj = {'response': 'success'}
        #return Response(response_obj, status=status.HTTP_200_OK)


    def partial_update(self, request, pk=None):
        pass

    """
    def destroy(self, request, pk=None):
        pass
    """

    def _get_resource_queryset(self, request, ontology=None, public=None):

        user = self.request.user

        if user.is_authenticated:
            queryset = Package.objects.filter(Q(owner=user) | Q(owner=None) | Q(public=True, curation='release'))
        else:
            queryset = Package.objects.filter(owner=None | Q(public=True, curation='release'))  

        if ontology != None:
            queryset = queryset.filter(ontology=ontology)

        if public != None:
            queryset = queryset.filter(public=public)

        return queryset.order_by('-ontology', 'public')
