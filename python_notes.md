To activate a python web server in order to see the index.html on your local browser as a website, type:

> python -m SimpleHTTPServer 

and then open a browser to URL: localhost:8000

to compile a GEEM version of an ontology:


This is required if rdflib is not in your default python and you have to activate a virtual environment that has rdflib in it.

> source activate _test 

Point jsonimo.py to the input ontology file.  Output will always be sent to data/ontologies/ folder.
> python jsonimo.py ../genepio/src/ontology/genepio-merged.owl

