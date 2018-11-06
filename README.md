## The Genomic Epidemiology Entity Mart

The Genomic Epidemiology Entity Mart (GEEM) is a portal for examining and downloading ontology-driven specifications for standardized data components. The portal aims to provide term reviewers and software developers with ways to utilize application ontology contents (a collection of terms and relations from other ontologies that combine to model the operation of some domain) without the need to be trained in ontology curation or querying. Ontology-driven standards benefit from features of open-source published OWL 2.0 ontologies such as globally unique identifiers for terms, multilingual label and definition functionality, and logical validation and reasoning over controlled vocabularies. Such a specification can be designed to satisfy the requirements of an environmental pH measurement, or a person's age, or a more structured entity like a contact address, or a genomic sequence repository submission for example. 

* View details of our overal project aim, description, and implementation on the [Wiki](https://github.com/GenEpiO/geem/wiki/) site.
* A working prototype of the portal is available at <http://genepio.org/geem>. This version doesn't currently incorporate the Django framework yet.

___________

### Ontology Term Fetch
We also now have a **scripts/ontofetch.py** script which will process a given OBOFoundry RDF/XML-formatted ontology (by local file reference or by URI address) into json and tabular data output.  Assuming that the ontology's terms are positioned under owl:Thing, this script fetches term id, parent_id, label, definition, deprecated status, term replaced_by id (if any), and a number of other fields, for use in software applications and databases. It is a good place to start to see what an ontology provides in a basic flat format, outside of the context of an ontology editor or RDF/XML text file. A discussion piece on basic ontology-driven vocabulary-software is available at: https://docs.google.com/document/d/1H8ch2PX-YzCw1IYv5gXPqA-Qqjc9jb_WggzzpaskkjU/edit?usp=sharing

## Creating a Development Server

### Using Docker

1. Build the GEEM docker image:

```bash
$ docker build .
```

2. Set up the database:

```bash
$ docker-compose run web python /code/manage.py makemigrations --noinput
$ docker-compose run web python /code/manage.py migrate --noinput
```

3. Create your admin user:

```bash
$ docker-compose run web python /code/manage.py createsuperuser
```

4. Load initial data:

```bash
$ docker-compose run web python /code/manage.py loaddata shared_packages
```

5. Run the development server:

```bash
$ docker-compose up
```

### Without Docker

1. Create a postgresql database and edit `config/settings.py` with connection details.

2. Create a conda environment:

```bash
$ conda create -n geem python=3.6
$ source activate geem
```

3. Install dependencies:

```bash
$ pip install -r requirements.txt
```

4. Prepare development database:

```bash
$ python manage.py migrate
```

5. Create your admin user. (Enter details when prompted)

```bash
$ python manage.py createsuperuser
```

6. Load initial data:

```bash
$ python manage.py loaddata shared_packages
```

7. Run the development server:

```
$ python manage.py runserver
```

### Setting up Social Authentication

1. Create a file `config/settings_secret.py` to contain our application secrets. This file is included in the project `.gitignore` file and should not be checked into version control.

```
SECRET_KEY = ''
SOCIAL_AUTH_GITHUB_KEY = ''
SOCIAL_AUTH_GITHUB_SECRET = ''
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = ''
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = ''
```

2. A Django `SECRET_KEY` can be generated with the following command:

```
python manage.py shell -c 'from django.core.management import utils; print(utils.get_random_secret_key())'
```

3. Register an Oauth2 application on Github: https://github.com/settings/applications/new Enter `http://localhost:8000/complete/github/` as the Authorization callback URL. Once the application is created, enter the Client ID and Client Secret into the `settings_secret.py` file as `SOCIAL_AUTH_GITHUB_KEY` and `SOCIAL_AUTH_GITHUB_SECRET`, respectively.

4. Create a new project on the Google Developers Console: https://console.developers.google.com/ . In the Library tab, find and activate the Google+ API (https://console.developers.google.com/apis/library/plus.googleapis.com). Create OAuth client ID Credentials. Select 'Web Application' as the appliction type. Enter `http://localhost:8000/complete/google-oauth2/` as the 'Authorized redirect URI'. Once the application is created, enter the Client ID and Client Secret into the `settings_secret.py` file as `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY` and `SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET`, respectively.

## Viewing the Application

 - View on a web browser at: [http://localhost:8000/index.html](http://localhost:8000/index.html)

 - The Django admin interface can be viewed at: [http://localhost:8000/admin/](http://localhost:8000/admin/). Login with the admin credentials used during the `createsuperuser` step.

 - The browsable GEEM API can be viewed at: http://localhost:8000/api/


