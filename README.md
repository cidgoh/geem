## The Genomic Epidemiology Entity Mart

The Genomic Epidemiology Entity Mart (GEEM) is a portal for examining and downloading ontology-driven specifications for standardized data components. The portal aims to provide term reviewers and software developers with ways to utilize application ontology contents (a collection of terms and relations from other ontologies that combine to model the operation of some domain) without the need to be trained in ontology curation or querying. Ontology-driven standards benefit from features of open-source published OWL 2.0 ontologies such as globally unique identifiers for terms, multilingual label and definition functionality, and logical validation and reasoning over controlled vocabularies. Such a specification can be designed to satisfy the requirements of an environmental pH measurement, or a person's age, or a more structured entity like a contact address, or a genomic sequence repository submission for example. 

* View details of our overal project aim, description, and implementation on the [Wiki](https://github.com/GenEpiO/geem/wiki/) site.
* A working prototype of the portal is available at <http://genepio.org/geem>

___________

### Ontology Term Fetch
We also now have a **utilities/ontofetch.py** script which will process a given OBOFoundry RDF/XML-formatted ontology (by local file reference or by URI address) into json and tabular data output.  Assuming that the ontology's terms are positioned under owl:Thing, this script fetches term id, parent_id, label, definition, deprecated status, term replaced_by id (if any), and a number of other fields, for use in software applications and databases. It is a good place to start to see what an ontology provides in a basic flat format, outside of the context of an ontology editor or RDF/XML text file.
