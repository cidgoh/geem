## The Genomic Epidemiology Entity Mart

The Genomic Epidemiology Entity Mart (GEEM) is a portal for examining and downloading ontology-driven specifications for standardized data components. The portal aims to provide term reviewers and software developers with ways to utilize application ontology contents (a collection of terms and relations from other ontologies that combine to model the operation of some domain) without the need to be trained in ontology curation or querying. Ontology-driven standards benefit from features of open-source published OWL 2.0 ontologies such as globally unique identifiers for terms, multilingual label and definition functionality, and logical validation and reasoning over controlled vocabularies. Such a specification can be designed to satisfy the requirements of an environmental pH measurement, or a person's age, or a more structured entity like a contact address, or a genomic sequence repository submission for example. 

* View details of our overal project aim, description, and implementation on the [Wiki](https://github.com/GenEpiO/geem/wiki/) site.
* A working prototype of the portal is available at <http://genepio.org/geem>

## Launching a Development Server

1. Create a conda environment:

```bash
$ conda create -n geem python=3.6
$ source activate geem
```

2. Install dependencies:

```bash
$ pip install -r requirements.txt
```

3. Prepare development database:

```bash
$ python manage.py migrate
```

4. Create your admin user. (Enter details when prompted)

```bash
$ python manage.py createsuperuser
```

5. Run the development server:

```
$ python manage.py runserver
```

6. View on a web browser at: [http://localhost:8000/index.html](http://localhost:8000/index.html)

7. The Django admin interface can be viewed at: [http://localhost:8000/admin/](http://localhost:8000/admin/). Login with the admin credentials used in step 4.
