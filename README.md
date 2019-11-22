# The Genomic Epidemiology Entity Mart

The Genomic Epidemiology Entity Mart (GEEM) is a portal for examining and 
downloading ontology-driven specifications for standardized data components. 
The portal aims to provide term reviewers and software developers with ways to 
utilize application ontology contents (a collection of terms and relations 
from other ontologies that combine to model the operation of some domain) 
without the need to be trained in ontology curation or querying. Ontology-
driven standards benefit from features of open-source published OWL 2.0 
ontologies such as globally unique identifiers for terms, multilingual label 
and definition functionality, and logical validation and reasoning over 
controlled vocabularies. Such a specification can be designed to satisfy the 
requirements of an environmental pH measurement, or a person's age, or a more 
structured entity like a contact address, or a genomic sequence repository 
submission for example. 

* View details of our overal project aim, description, and implementation on 
  the [Wiki](https://github.com/GenEpiO/geem/wiki/) site.
* A working prototype of the portal is available at <https://watson.bccdc.med.ubc.ca/geem/portal.html>. It includes OAuth2 login, and the ability of users to view and customize a variety of draft specifications we have created for the genomic epidemiology space. (An older partially-functioning version which doesn't incorporate the Django framework is at <http://genepio.org/geem>.) 

___________

## Deployment

Clone this repository.

```bash
$ git clone https://github.com/GenEpiO/geem.git
```

### Setting up social authentication

To run a local server, create the file `.envs/.local/.auth`. To run a 
production server, create the file `.envs/.production/.auth`. Neither of these 
files are tracked by Github.

Templates of both files are found at `.envs/.local/.auth.template` and 
`.envs/.production/.auth.template`.

#### SOCIAL_AUTH_GITHUB_KEY and SOCIAL_AUTH_GITHUB_SECRET

[Register an Oauth2 application on Github.][1] If you are running a local 
server, enter `http://localhost:8000/index.html` as Homepage URL, and 
`http://localhost:8000/complete/github/` as Authorization callback URL. If 
you are running a production server, enter 
`http://localhost:8888/geem/index.html` as Homepage URL, and 
`http://localhost:8888/geem/complete/github/` as Authorization callback URL.

Once the application is created, enter the Client ID and Client Secret into 
your `.auth` file as `SOCIAL_AUTH_GITHUB_KEY` and `SOCIAL_AUTH_GITHUB_SECRET` 
respectively.

#### SOCIAL_AUTH_GOOGLE_OAUTH2_KEY and SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET

[Register an Oauth2 application on the Google Developers Console.][2] Select 
_Web Application_ as the Application type. If you are running a local server, 
enter `http://localhost:8000/complete/google-oauth2/` as a value for Authorized 
redirect URIs. If you are running a production server, enter 
`http://localhost:8888/geem/complete/google-oauth2/`.

Once the application is created, enter the Client ID and Client Secret into 
your `.auth` file as `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY` and 
`SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET` respectively.

### Running a local server

Build the local docker image.

```bash
$ docker-compose --file local.yml --build
```

Set up the database.

```bash
$ docker-compose --file local.yml run web python manage.py makemigrations
$ docker-compose --file local.yml run web python manage.py migrate
```

Load initial data.

```bash
$ docker-compose --file local.yml run web python manage.py \
    loaddata sys_admin new_package_template damion_packages
```

Run the local server.

```bash
$ docker-compose --file local.yml up
```

View at [http://localhost:8000/portal.html](http://localhost:8000/portal.html).


### Running a production server

Create the files `.envs/.production/.web` and `.envs/.production/.db`, using 
`.envs/.production/.web.template` and `.envs/.production.db` as reference. 
We recommend using unique and random keys for the `DJANGO_SECRET_KEY`, 
`DJANGO_ADMIN_URL`, `POSTGRES_USER` and `POSTGRES_PASSWORD` values.

Build the production docker image.

```bash
$ docker-compose --file production.yml --build
```

Set up the database.

```bash
$ docker-compose --file production.yml run web python manage.py makemigrations
$ docker-compose --file production.yml run web python manage.py migrate
```

Load initial data.

```bash
$ docker-compose --file production.yml run web python manage.py \
    loaddata sys_admin new_package_template damion_packages
```

Run the production server.

```bash
$ docker-compose --file production.yml up
```

View at [http://localhost:8888/geem/portal.html][3].

### Running a production server on another domain

If you do not want to run a production server on `localhost`, specify 
your host under `DJANGO_ALLOWED_HOST` at `.envs/.production/.web`, and 
`server_name` at `compose/production/nginx/nginx.conf`.

[1]: https://github.com/settings/applications/new
[2]: https://console.developers.google.com/apis/credentials/oauthclient
[3]: http://localhost:8888/geem/portal.html
