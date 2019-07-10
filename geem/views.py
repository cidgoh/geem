from django.shortcuts import render
from django.http import HttpResponse
#from django.template import Context
from oauth2_provider.models import Application
from geem.serializers import ResourceSummarySerializer, ResourceDetailSerializer
import json
from psycopg2.extras import Json as psql_json_adapter

import re, os

from rest_framework import mixins
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from oauth2_provider.contrib.rest_framework import TokenHasReadWriteScope, TokenHasScope, OAuth2Authentication
from rest_framework import viewsets, permissions
from django.shortcuts import get_object_or_404
from django.http import Http404
from rest_framework.response import Response
from django.db.models import Q
from django.db import connection
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError

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

    **TODO:**

    * the raw SQL queries in some of the functions below that deal with
      jsonb may be replaceable with something simpler in the future

      * see https://code.djangoproject.com/ticket/29112
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

    @action(detail=True, url_path='specifications(?:/(?P<term_id>.+))?')
    def specifications(self, request, pk, term_id=None):
        """Get entire specifications, or a single term, from a package.

        * api/resources/{pk}/specifications

          * Specifications of package with id == {pk}

        * api/resources/{pk}/specifications/{term_id}

          * Get term with id == {term_id} from specifications of
            package with id == {pk}

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :param str term_id: id of term inside package specifications
        :return: One or all terms from package specifications, or
                 appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Query specified package
        queryset = self._get_resource_queryset(request)
        queryset = queryset.filter(pk=pk)

        # Unable to query any packages
        if queryset.count() == 0:
            return Response('No access to package with id %s' % pk,
                            status=status.HTTP_404_NOT_FOUND)

        # Query entire specifications or exact term
        if term_id is None:
            query = 'contents__specifications'
        else:
            query = 'contents__specifications__' + term_id
        queryset = queryset.values_list(query, flat=True)

        # If looking for a specific term, and query failed, return 404
        if term_id is not None and queryset[0] is None:
            return Response('%s not found in package with id %s'
                            % (term_id, pk),
                            status=status.HTTP_404_NOT_FOUND)

        return Response(queryset[0], status=status.HTTP_200_OK)

    @action(detail=True, url_path='delete/specifications(?:/(?P<term_id>.+))?')
    def delete_specifications(self, request, pk, term_id=None):
        """Delete entire specifications, or one term, from a package.

        * api/resources/{pk}/delete/specifications

          * Delete all terms in specifications of package with id ==
            {pk}

        * api/resources/{pk}/delete/specifications/{term_id}

          * Delete term with id == {term_id} from specifications of
            package with id == {pk}

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :param str term_id: id of term inside package specifications
        :return: Confirmation of deletion, or appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Query specified package
        queryset = self._get_modifiable_packages(request)
        queryset = queryset.filter(pk=pk)

        # Unable to query any packages
        if queryset.count() == 0:
            return Response('No permission to edit package with id %s' % pk,
                            status=status.HTTP_404_NOT_FOUND)

        # Connect to the default database service
        with connection.cursor() as cursor:
            # See https://stackoverflow.com/a/23500670 for details on
            # deletion queries used below.
            if term_id is None:
                cursor.execute("update geem_package set contents=(select "
                               "jsonb_set(contents, '{specifications}', "
                               "jsonb '{}')) where id=%s" % pk)
            else:
                # Validate 'id' key exists in package
                term_id_query = 'contents__specifications__' + term_id
                if queryset.values_list(term_id_query, flat=True)[0] is None:
                    return Response(
                        'id %s does not exist in package %s' % (term_id, pk),
                        status=status.HTTP_400_BAD_REQUEST)
                # Delete exact term
                cursor.execute("update geem_package set contents=(contents #- "
                               "'{specifications,%s}') where id=%s"
                               % (term_id, pk))

        return Response('Successfully deleted', status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='create/specifications')
    def create_specifications(self, request, pk):
        """Add a specification to a package.

        `request.data` is added to the specifications of a package with
        `id == pk`. `request.data` must be in `dict` format, and have
        an `id` attribute.

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :return: Confirmation of creation, or appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Query specified package
        queryset = self._get_modifiable_packages(request)
        queryset = queryset.filter(pk=pk)

        # Unable to query any packages
        if queryset.count() == 0:
            return Response('No permission to edit package with id %s' % pk,
                            status=status.HTTP_400_BAD_REQUEST)

        # Validate 'id' key exists in request.data
        if 'id' not in request.data:
            return Response('request.data missing id value',
                            status=status.HTTP_400_BAD_REQUEST)

        # Some of the fields with paragraphs as values (e.g.,
        # 'definition' for references to ontologies) may have
        # problematic characters (e.g., single quotes).
        psql_escaped_data = psql_json_adapter(request.data)

        # Connect to the default database service
        with connection.cursor() as cursor:
            # See https://stackoverflow.com/a/23500670 for details on
            # creation query used below.
            cursor.execute("update geem_package set contents=(jsonb_set("
                           "contents, '{specifications, %s}', jsonb %s)) "
                           "where id=%s"
                           % (request.data['id'], psql_escaped_data, pk))

        return Response('Successfully created', status=status.HTTP_200_OK)

    @action(detail=True, url_path='context(?:/(?P<prefix>.+))?')
    def get_context_response(self, request, pk, prefix=None):
        """Responds with entire @context, or one IRI, from a package.

        * api/resources/{pk}/context

          * @context of package with id == {pk}

        * api/resources/{pk}/context/{prefix}

          * Get IRI with prefix == {prefix} from @context of package
            with id == {pk}

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :param str prefix: prefix of IRI value inside package @context
        :return: One or all IRI values from package @context, or
                 appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Query specified package
        queryset = self._get_resource_queryset(request)
        queryset = queryset.filter(pk=pk)

        try:
            return Response(self.get_context(queryset, prefix),
                            status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, url_path='delete/context(?:/(?P<prefix>.+))?')
    def delete_context_response(self, request, pk, prefix=None):
        """Responds by deleting one or all IRI from a package @context.

        * api/resources/{pk}/delete/context

          * Delete all IRI values in @context of package with id ==
            {pk}

        * api/resources/{pk}/delete/context/{prefix}

          * Delete IRI with prefix == {prefix} from @context of
            package with id == {pk}

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :param str prefix: prefix of IRI value inside package @context
        :return: Confirmation of deletion, or appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Query specified package
        queryset = self._get_modifiable_packages(request)
        queryset = queryset.filter(pk=pk)

        try:
            self.delete_context(queryset, prefix)
            return Response('Successfully deleted', status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='create/context')
    def create_context_response(self, request, pk):
        """Responds by adding prefix-IRI pair to package @context.

        `request.data` must be a `dict` with two attributes: `prefix`
        and `iri`. These values are added to the @context of a package
        with `id == pk`.

        :param rest_framework.request.Request request: Front-end
                                                       request metadata
        :param str pk: id of package
        :return: Confirmation of creation, or appropriate error message
        :rtype: rest_framework.response.Response
        """
        # Validate 'prefix' key exists in request.data
        if 'prefix' not in request.data:
            return Response('request.data missing prefix value',
                            status=status.HTTP_400_BAD_REQUEST)
        # Validate 'iri' key exists in request.data
        if 'iri' not in request.data:
            return Response('request.data missing iri value',
                            status=status.HTTP_400_BAD_REQUEST)

        # Query specified package
        queryset = self._get_modifiable_packages(request)
        queryset = queryset.filter(pk=pk)

        try:
            self.create_context(queryset, request.data['prefix'],
                                request.data['iri'])
            return Response('Successfully created', status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def get_context(package, prefix=None):
        """Get entire @context, or a single IRI, from ``package``.

        :param package: queried package to get values from
        :type package: django.db.models.query.QuerySet
        :param prefix: prefix of IRI value inside package @context
        :type prefix: str
        :return: One or all IRI values from package @context
        :rtype: dict[str,str] or str
        :raises ValueError: Unable to retrieve @context somehow
        """
        if package.count() != 1:
            raise ValueError('Please query an appropriate package')

        if prefix is None:
            query = 'contents__@context'
        else:
            query = 'contents__@context__' + prefix

        ret = package.values_list(query, flat=True)[0]

        if prefix is not None and ret is None:
            raise ValueError(prefix + ' not found in package')

        return ret

    @staticmethod
    def delete_context(package, prefix=None):
        """Delete entire @context, or a single IRI, from ``package``.

        :param package: queried package to delete values from
        :type package: django.db.models.query.QuerySet
        :param prefix: prefix of IRI value inside package @context
        :type prefix: str
        :raises ValueError: Unable to delete values somehow
        """
        if package.count() != 1:
            raise ValueError('Please query an appropriate package')

        package_id = package.values_list('id', flat=True)[0]

        # Connect to the default database service
        with connection.cursor() as cursor:
            # See https://stackoverflow.com/a/23500670 for details on
            # deletion queries used below.
            if prefix is None:
                cursor.execute("update geem_package set contents=(select "
                               "jsonb_set(contents, '{@context}', "
                               "jsonb '{}')) where id=%s" % package_id)
            else:
                prefix_query = 'contents__@context__' + prefix
                if package.values_list(prefix_query, flat=True)[0] is None:
                    raise ValueError(prefix + ' not found in package')

                cursor.execute("update geem_package set contents=(contents #- "
                               "'{@context,%s}') where id=%s"
                               % (prefix, package_id))

    @staticmethod
    def create_context(package, prefix, iri):
        """Add ``prefix``-``iri`` pair to @context of ``package``.

        :param package: queried package to delete values from
        :type package: django.db.models.query.QuerySet
        :param prefix: key added to ``package`` @context
        :type prefix: str
        :param iri: value added to ``package`` @context
        :type iri: str
        :raises ValueError: Unable to add values somehow
        """
        if package.count() != 1:
            raise ValueError('Please query an appropriate package')

        try:
            URLValidator()(iri)
        except ValidationError:
            raise ValueError('Must supply a valid IRI')

        term_id_query = 'contents__@context__' + prefix
        if package.values_list(term_id_query, flat=True)[0] is not None:
            raise ValueError(prefix + ' already exists in package')

        package_id = package.values_list('id', flat=True)[0]

        # Connect to the default database service
        with connection.cursor() as cursor:
            # See https://stackoverflow.com/a/23500670 for details on
            # creation query used below.
            cursor.execute("update geem_package set contents=(jsonb_insert("
                           "contents, '{@context, %s}', jsonb '\"%s\"')) where"
                           " id=%s" % (prefix, iri, package_id))

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

    def _get_modifiable_packages(self, request):
        """Get QuerySet of packages user has permission to modify."""
        user = self.request.user

        if user.is_authenticated:
            # Return resources owned by user
            return Package.objects.filter(Q(owner=user))
        else:
            # User cannot modify any resources if they are not
            # authenticated. Return an empty queryset.
            return Package.objects.none()

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
