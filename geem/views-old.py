#ONTOLOGY_PATH = 'data/ontology/'
#SHARED_PATH   = 'data/shared/'
#PRIVATE_PATH  = 'data/private/'

package_regex = re.compile(r'\.(json)') # |owl

def file_listing(path, type, owner = None):
    """
    Return catalog.json as cached listing of folder's .json file metadata.
    Test datestamp change in any relevant .owl or .json file and compare
    against cached display file timestamp, which should be = or > any one
    of the files. If cache is behind folder file timestamp, read metadata
    for that file into cached listing. If file not in cache, add listing. 
    Operates on file name only. Use 'touch' command on a file to force 
    update.
    If owner provided, filter files by owner.

    """

    catalog_file = ROOT_PATH + path + 'catalog.json'
    if (os.path.isfile(catalog_file)):
        catalog = json.load(open(catalog_file))
        catalog_timestamp = os.path.getmtime(catalog_file)
    else:
        catalog = {}
        catalog_timestamp = 0

    #file_names = [x for x in os.listdir(path) if package_regex.search(x)]
    # Check if any file listing needs updating in catalog
    # Would OS sort by file date be even faster? or skip this and do manual 
    # refresh of catalog.json?
    refresh = False
    for file_name in sorted(os.listdir(ROOT_PATH + path)):
        if file_name != 'catalog.json' and package_regex.search(file_name):
            file_timestamp = os.path.getmtime(ROOT_PATH + path + file_name)

            # File name is [ontology/package].[version].[suffix], with version
            # possibly missing
            file_name_array = file_name.split('.')
            if (len(file_name_array) == 3):
                (root_name, version, suffix) = file_name_array
            else:
                (root_name, suffix) = file_name_array
                version = ''

            if not root_name in catalog or file_timestamp > catalog_timestamp:
                # Item timestamp triggers update in catalog.json
                package = json.load(open(ROOT_PATH + path + file_name))
                if not root_name in catalog:
                    catalog[root_name] = {'versions': {}}
                catalog[root_name]['versions'][version] = package['metadata']
                catalog[root_name]['versions'][version]['local_URL'] = path + file_name

                refresh = True

    if refresh == True:
        with (open(catalog_file, 'w')) as output_handle:
            output_handle.write(json.dumps(catalog,  sort_keys=False, indent=4, separators=(',', ': ')))

    return catalog



# Names should never conflict, regardless of "type"
"""
def resources(request):
    data = {
        'ontology': file_listing(ONTOLOGY_PATH, 'ontology'),
        'shared': file_listing(SHARED_PATH, 'shared'),
        'private': file_listing(PRIVATE_PATH, 'private')
    }

    return HttpResponse(json.dumps(data), content_type='application/json')


def ontologies(request):
    queryset = _get_package_queryset(request, ontology=True)
    data = PackageSummarySerializer(queryset, context={'request': request}, many=True).data # returns array

    return HttpResponse(json.dumps(data), content_type='application/json')

def ontology(request, file_name):
    queryset = _get_package_queryset(request, ontology=True)  #.values()[0]['content']
    #data = PackageSummarySerializer(queryset, context={'request': request}).data 
    return HttpResponse(json.dumps(queryset), content_type='application/json')


def shared_packages(request):
    queryset = _get_package_queryset(request, ontology=False, public=True)
    data = PackageSummarySerializer(queryset, context={'request': request}, many=True).data 
    return HttpResponse(json.dumps(data), content_type='application/json')

def shared_package(request, file_name):
    queryset = _get_package_queryset(request, ontology=False, public=True)
    data = PackageSummarySerializer(queryset, context={'request': request}).data 
    return HttpResponse(json.dumps(data), content_type='application/json')


def private_packages(request):
    queryset = _get_package_queryset(request, ontology=False, public=False)
    PackageSummarySerializer(queryset, context={'request': request}, many=True).data 
    return HttpResponse(json.dumps(data), content_type='application/json')

def private_package(request, file_name):
    # Need security check here

    if request.user.is_authenticated:
        data = json.load(open(ROOT_PATH + PRIVATE_PATH + file_name))
        if (data.metadata.owner == request.user.username):
            data = {}
    else:
        data = {}
    return HttpResponse(json.dumps(data), content_type='application/json')
"""
