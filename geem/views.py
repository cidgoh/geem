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

def form(request):
    return render(request, 'geem/form.html', context={})

#def portal55(request):
#    return render(request, 'geem/portal.5.5.html', context={})
#def form55(request):
#    return render(request, 'geem/form.5.5.html', context={})
def foundation55(request):
    return render(request, 'geem/foundation.5.5.html', context={})

def favicon(request):
    return render(request, 'geem/favicon.ico', context={})

def login(request):
    context = {}
    context['client_id'] = Application.objects.filter(name='geem').values()[0]['client_id']
    return render(request, 'geem/login.html', context)

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
        """
        """
        # IF POST doesn't include a field is it dropped from package?    
        
        # Retrieve existing package for given pk id.
        package = get_object_or_404(Package, pk=pk) 

        #if request.method == 'POST':

        #package.contents['metadata']['prefix'] = "TEST"
        existing_contents = package.contents # A somewhat recursive dictionary
        #print ("existing : ", existing_contents)

        form = PackageForm(request.POST or None, instance=package)
        if form.is_valid():
            package = form.save(commit=False)
            # Merge POST json ".contents" field into existing package.contents
            # Or else POST.contents field will replace entire existing package
            # contents.
            new_contents = json.loads(request.POST['contents'])
            self._merge(package.contents, new_contents)
            #print ("now: ", package.contents )

            #print ("post :", package.contents)
            #package.owner = self.request.user

            package.save()

            return Response(ResourceDetailSerializer(package, context={'request': request}).data)

        return Response(form.errors, status=status.HTTP_400_BAD_REQUEST)

        """
        https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#2xx_Success
        200 OK
        201 Created

        serializer = ResourceDetailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        """

        # So we don't get back a giant file ...
        #response_obj = {'response': 'success'}
        #return Response(response_obj, status=status.HTTP_200_OK)


    def partial_update(self, request, pk=None):
        pass

    """ Achieved by mixins.DestroyModelMixin
    def destroy(self, request, pk=None):
        pass
    """

    def _get_resource_queryset(self, request, ontology=None, public=None):
        """ 
        For listing and individual resource get/retrieve, this returns a basic
        queryset with viewing permission constrained by requesting user.
        When a resource has None as an owner, it can be accessed by anyone.
        ISSUE: who can create/update owner=None packages?

        """
        user = self.request.user

        if user.is_authenticated:
            queryset = Package.objects.filter(Q(owner=user) | Q(owner=None) | Q(public=True, curation='release'))
        else:
            queryset = Package.objects.filter(Q(owner=None) | Q(public=True, curation='release'))  #

        if ontology != None:
            queryset = queryset.filter(Q(ontology=ontology))

        if public != None:
            queryset = queryset.filter(Q(public=public))

        return queryset.order_by('-ontology', 'public')

    # See https://stackoverflow.com/questions/7204805/dictionaries-of-dictionaries-merge/7205107#7205107
    def _merge(self, a, b, path=None):
        "merges b into a"
        if path is None: path = []
        for key in b:
            if key in a:
                if isinstance(a[key], dict) and isinstance(b[key], dict):
                    self._merge(a[key], b[key], path + [str(key)])
                elif a[key] == b[key]:
                    pass # same leaf value
                else:
                    a[key] == b[key]
                    print ("Updating ", key, b[key])
                    #raise Exception('Conflict at %s' % '.'.join(path + [str(key)]))
            else:
                a[key] = b[key]
        return a
