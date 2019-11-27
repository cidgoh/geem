import json

from rest_framework import mixins
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action, api_view
from oauth2_provider.contrib.rest_framework import TokenHasReadWriteScope, TokenHasScope, OAuth2Authentication
from rest_framework import viewsets, permissions
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from django.db.models import Q
from django.shortcuts import render
from oauth2_provider.models import Application

from geem.models import Package
from geem.forms import PackageForm
from geem import utils
from geem.serializers import ResourceSummarySerializer, ResourceDetailSerializer

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
    return render(request, 'geem/static/geem/images/favicon.ico', context={})

def login(request):
    context = {}
    context['client_id'] = Application.objects.filter(name='geem').values()[0]['client_id']
    return render(request, 'geem/login.html', context)

def modal_lookup(request):
    return render(request, 'geem/templates/modal_lookup.html', context={})

def resource_summary_form(request):

    return render(request, 'geem/templates/resource_summary_form.html', context={})


@api_view(['POST'])
def get_uploaded_validation_data(request):
    """Output data from uploaded validation file in string format.

    Should only be called by front-end method ``update_grid``.

    :param rest_framework.request.Request request: Front-end request
        containing uploaded file
    :returns: Response containing file data in string format
    :rtype: rest_framework.response.Response
    """
    uploaded_file = request.FILES['file']
    uploaded_file_str = uploaded_file.read()
    return Response(uploaded_file_str, status=status.HTTP_200_OK)


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
    def get_specifications_response(self, request, pk, term_id=None):
        """Responds with one or all specifications from a package.

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

        try:
            return Response(utils.get_specifications(queryset, term_id),
                            status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, url_path='delete/specifications(?:/(?P<term_id>.+))?')
    def delete_specifications_response(self, request, pk, term_id=None):
        """Responds by deleting one or all terms from a package.

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

        try:
            utils.delete_specifications(queryset, term_id)
            return Response('Successfully deleted', status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='create/specifications')
    def create_specifications_response(self, request, pk):
        """Responds by adding a specification to a package.

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

        try:
            utils.create_specifications(queryset, request.data)
            return Response('Successfully created', status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

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
            return Response(utils.get_context(queryset, prefix),
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
            utils.delete_context(queryset, prefix)
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
            utils.create_context(queryset, request.data['prefix'],
                                 request.data['iri'])
            return Response('Successfully created', status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='add_cart_items')
    def add_cart_items_to_package(self, request, pk):
        """Add cart items and their children to a package.

        This method is only meant to be called by
        ``geem_api.GeemAPI.add_cart_items_to_package``.

        :param request: ``data`` member is a ``dict`` containing
            information on cart items
        :type request: rest_framework.request.Request
        :param pk: ID of package to add cart items to
        :type pk: str
        :returns: Response with ``data`` member is JSON detailing
            result of each attempted addition
        :rtype: rest_framework.response.Response
        """
        response_data = {}

        user_packages = self._get_resource_queryset(request)
        target_package = user_packages.filter(pk=pk)

        for cart_item in request.data.values():
            cart_item_id = cart_item['id']
            cart_item_package_id = cart_item['package_id']
            cart_item_package = user_packages.filter(pk=cart_item_package_id)

            response_data.update(
                utils.add_cart_item_to_package(cart_item_id, cart_item_package,
                                               target_package))

            # Add path and status of top-level cart item if it
            # succeeded in its addition to the target package.
            if response_data[cart_item_id]['status'] == 200:
                utils.add_path_status_to_package(
                    target_package, cart_item['path'], cart_item['status']
                )

        return Response(response_data, status=status.HTTP_200_OK)

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
        Updates package metadata - title, description, version, etc. - per
        user request.  Also may include new dictionary key values in package
        contents (@context, specifications, and metadata) which will be MERGED
        with existing keys on server side if present.
        We want to ensure that package owner field can never be tampered with
        by direct API hacks so owner is copied from existing package.

        """
        # IF POST doesn't include a field is it dropped from package?    
        
        # Retrieve existing package for given pk id.
        package = get_object_or_404(Package, pk=pk) 
        existing_owner = package.owner
        existing_contents = package.contents # A somewhat recursive dictionary

        form = PackageForm(request.POST or None, instance=package)
        if form.is_valid():
            package = form.save(commit=False)
            # Merge POST json ".contents" field into existing package.contents
            # Or else POST.contents field will replace entire existing package
            # contents.  

            # ISSUE: How to DELETE top-level specification items???

            new_contents = json.loads(request.POST['contents'])
            self._merge(package.contents, new_contents)
            package.owner = existing_owner
            package.save()

            return Response(ResourceDetailSerializer(package, context={'request': request}).data)

        return Response(form.errors, status=status.HTTP_400_BAD_REQUEST)

        """
        https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#2xx_Success
        200 OK
        201 Created
        """

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
