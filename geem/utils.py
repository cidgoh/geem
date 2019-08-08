from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import connection
from psycopg2.extras import Json as PsqlJsonAdapter


def get_specifications(package, term_id=None):
    """Get one or all specifications from ``package``.

    :param package: queried package to get values from
    :type package: django.db.models.query.QuerySet
    :param term_id: ID of term inside package specifications
    :type term_id: str
    :return: One or all terms from package specifications
    :rtype: dict
    :raises ValueError: Unable to retrieve specifications somehow
    """
    if package.count() != 1:
        raise ValueError('Please query an appropriate package')

    if term_id is None:
        query = 'contents__specifications'
    else:
        query = 'contents__specifications__' + term_id

    ret = package.values_list(query, flat=True)[0]

    if term_id is not None and ret is None:
        raise ValueError(term_id + ' not found in package')

    return ret


def delete_specifications(package, term_id=None):
    """Delete one or all specifications from ``package``.

    :param package: queried package to delete values from
    :type package: django.db.models.query.QuerySet
    :param term_id: ID of term inside package specifications
    :type term_id: str
    :raises ValueError: Unable to delete specifications somehow
    """
    if package.count() != 1:
        raise ValueError('Please query an appropriate package')

    package_id = package.values_list('id', flat=True)[0]

    # Connect to the default database service
    with connection.cursor() as cursor:
        # See https://stackoverflow.com/a/23500670 for details on
        # deletion queries used below.
        if term_id is None:
            cursor.execute("update geem_package set contents=(select "
                           "jsonb_set(contents, '{specifications}', "
                           "jsonb '{}')) where id=%s" % package_id)
        else:
            term_id_query = 'contents__specifications__' + term_id
            if package.values_list(term_id_query, flat=True)[0] is None:
                raise ValueError(term_id + ' not found in package')

            cursor.execute("update geem_package set contents=(contents #- "
                           "'{specifications,%s}') where id=%s"
                           % (term_id, package_id))


def create_specifications(package, term):
    """Add ``term`` to specifications of ``package``.

    :param package: queried package to add values to
    :type package: django.db.models.query.QuerySet
    :param term: term to add to specifications
    :type term: dict
    :raises ValueError: Unable to add specification somehow
    """
    if package.count() != 1:
        raise ValueError('Please query an appropriate package')

    if 'id' not in term:
        raise ValueError('Term must have an ID value')

    package_id = package.values_list('id', flat=True)[0]

    # Some of the fields with paragraphs as values (e.g.,
    # 'definition' for references to ontologies) may have
    # problematic characters (e.g., single quotes).
    psql_escaped_data = PsqlJsonAdapter(term)

    # Connect to the default database service
    with connection.cursor() as cursor:
        # See https://stackoverflow.com/a/23500670 for details on
        # creation query used below.
        cursor.execute("update geem_package set contents=(jsonb_set("
                       "contents, '{specifications, %s}', jsonb %s)) "
                       "where id=%s"
                       % (term['id'], psql_escaped_data, package_id))


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


def create_context(package, prefix, iri):
    """Add ``prefix``-``iri`` pair to @context of ``package``.

    :param package: queried package to add values to
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
        # Already exists in package
        return

    package_id = package.values_list('id', flat=True)[0]

    # Connect to the default database service
    with connection.cursor() as cursor:
        # See https://stackoverflow.com/a/23500670 for details on
        # creation query used below.
        cursor.execute("update geem_package set contents=(jsonb_insert("
                       "contents, '{@context, %s}', jsonb '\"%s\"')) where"
                       " id=%s" % (prefix, iri, package_id))


def add_path_status_to_package(package, path, status):
    """Add ``path``-``status`` pair to customization of ``package``.

    :param package: queried package to add path and status to
    :type package: django.db.models.query.QuerySet
    :param path: key added to ``package`` customization
    :type path: str
    :param status: value added to ``package`` customization
    :type status: str
    :raises ValueError: Unable to add path and status somehow
    """
    if package.count() != 1:
        raise ValueError('Please query an appropriate package')

    package_id = package.values_list('id', flat=True)[0]

    # Connect to the default database service
    with connection.cursor() as cursor:
        # See https://stackoverflow.com/a/23500670 for details on
        # creation query used below.
        cursor.execute("update geem_package set contents=(jsonb_set("
                       "contents, '{customization, %s}', jsonb '\"%s\"')) "
                       "where id=%s" % (path, status, package_id))


def add_cart_item_to_package(cart_item_id, cart_item_package, target_package):
    """Add cart item and its children to package.

    :param cart_item_id: cart item id value
    :type cart_item_id: str
    :param cart_item_package: cart item package
    :type cart_item_package: django.db.models.query.QuerySet
    :param target_package: package to add cart item to
    :type target_package: django.db.models.query.QuerySet
    :returns: response for addition of cart item and all its nested
        children, detailing success or failure
    :rtype: dict[str,dict]
    """
    cart_item_prefix = cart_item_id.split(':')[0]

    try:
        cart_item_iri = get_context(cart_item_package, cart_item_prefix)

        cart_item_term = get_specifications(cart_item_package, cart_item_id)

        create_context(target_package, cart_item_prefix, cart_item_iri)

        create_specifications(target_package, cart_item_term)
    except ValueError as e:
        return {cart_item_id: {'status': 400, 'message': str(e)}}

    ret = {cart_item_id: {'status': 200, 'message': 'ok'}}

    if 'choices' in cart_item_term:
        for child_id in cart_item_term['choices'].keys():
            ret.update(add_cart_item_to_package(child_id, cart_item_package,
                                                target_package))

    if 'components' in cart_item_term:
        for child_id in cart_item_term['components'].keys():
            ret.update(add_cart_item_to_package(child_id, cart_item_package,
                                                target_package))

    return ret
