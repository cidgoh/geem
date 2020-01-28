#!/usr/bin/python

""" **************************************************************************
	python ontospec.py [owl ontology file path or URL]

	Converts parts of an OWL ontology file to a data specification structure 
	that can be made into forms, reports, etc. Usually starts examining 
	ontology from the OBI 'data representational model' (OBI:0000658) class.
	All subclasses that have 'has component' some | min | max [expression] are
	specifications.
 
 	Author: Damion Dooley

	Ontology() class __main__() reads in given ontology file via path or 
	URL and imports all ontology class terms, including labels, 
	definitions, and boolean axioms.  Output is produced as json or tabular tsv.
	
	The focus is on elaborating boolean axioms into their parts.

	REQUIREMENTS
	This script requires python module RDFLib.

	if --cache used, then --output folder is required in order to read where
	cached [ontology].json file is.

	EXAMPLES


	This generates a JSON file of all specifications situated under 'data 
	representational model' (OBI:0000658) in given ontology.

		python ontospec.py ../../genepio/genepio-merged.owl -r http://purl.obolibrary.org/obo/OBI_0000658

	As above, but also writes out specification datastructure for 'draft PulseNet Canada Salmonella submission standard' (GENEPIO_0001778) to a file test/spec.json

		python ontospec.py ../../genepio/genepio-merged.owl -r http://purl.obolibrary.org/obo/GENEPIO_0001778 -o test/

	As above, but also uses that test/genepio-merged.json if it exists to run rules,
	rather than generating it from scratch.

		python ontospec.py ../../genepio/genepio-merged.owl -r http://genepio.org/ontology/LEXMAPR_0000001 -i FOODON:00001286 -o test/ -c

	Fetches specs for both GENEPIO_0001778 and GENEPIO_0001000

		python ontospec.py ../../genepio/src/ontology/genepio-merged.owl -r http://purl.obolibrary.org/obo/GENEPIO_0001778,http://purl.obolibrary.org/obo/GENEPIO_0001000 -o test2/

	**************************************************************************
""" 

import json
import sys
import os
import optparse
import datetime
from copy import deepcopy

#from ontohelper import OntoHelper as oh
import ontohelper as oh

import rdflib
from rdflib.plugins.sparql import prepareQuery

# Do this, otherwise a warning appears on stdout: No handlers could be 
#found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

def stop_err(msg, exit_code = 1):
	sys.stderr.write("%s\n" % msg)
	sys.exit(exit_code)


"""
Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
"""
class MyParser(optparse.OptionParser):

	def format_epilog(self, formatter):
		return self.epilog

"""


"""
class OntoSpec(object):

	CODE_VERSION = '0.0.1'
	TEST = 0 # = 1 to test a hardcoded small subset of .owl ontology rules.
	
	def __init__(self):

		self.onto_helper = oh.OntoHelper()
		self.timestamp = datetime.datetime.now()

		self.queries = {

			##################################################################
			# A specification is made up of components, which themselves can
			# be specifications. Components may have cardinality.
			# 
			# This script returns all triples that immediately compose the
			# owl.subject (aka owl.restriction). Below is simplest case
			#
			#   <owl:Restriction>
            #      <owl:onProperty rdf:resource="obo:RO_0002180"/>
            #      <owl:someValuesFrom rdf:resource="obo:FOODON_00002196"/>
            #   </owl:Restriction>			
			#	...

			'specifications': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?label ?parent_id ?subject ?predicate ?object
				WHERE {
					BIND (OBO:RO_0002180 as ?has_component).
					
					?parent_id rdfs:subClassOf* ?root.
					?parent_id rdfs:subClassOf ?subject. # was owl:equivalentClass
					?parent_id rdfs:label ?label.
					{	?subject owl:onProperty ?has_component.
						?subject (owl:someValuesFrom | owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?object.
					}
					UNION
					{	?subject (owl:intersectionOf | owl:unionOf |  owl:complementOf) ?object.
					}
					?subject ?predicate ?object.

				 } ORDER BY ?parent_id

			""", initNs = self.onto_helper.namespace),

			# Anything is retrieved here, including annotations
			'triple_by_subject': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?predicate ?object
				WHERE {?subject ?predicate ?object}
				ORDER BY ?predicate

			""", initNs = self.onto_helper.namespace),

			# This query focuses on restriction parts and weeds out unneeded annotations.

			#(owl:onClass | owl:intersectionOf | owl:unionOf | owl:complementOf)
			'triple_by_relation': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?predicate ?object
				WHERE {
					?subject (owl:onClass) ?object.
					?subject ?predicate ?object.
				}
				ORDER BY ?subject

			""", initNs = self.onto_helper.namespace),

			'cardinality_target': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?object
				WHERE {
					?subject owl:onClass ?object.
				}
			""", initNs = self.onto_helper.namespace)
		}


	def log(self, *args):
		"""
			Show log messages and differential time between calls
		"""
		timestamp = datetime.datetime.now()
		print("time delta: ", str(timestamp - self.timestamp), "\n", str(args))
		self.timestamp = timestamp


	def __main__(self):
		"""
		LexMapr Agency Reporting Module:

		Objective: trigger/activate agency bucket in response to presentation of (a bucket of) a set of lexmapr ontology hits.  Matching is most effective if all lexmapr hits AND THEIR ontology ancestor term ids are presented in a single set.  Each rule needs to be applied to this set in turn.

		"""
		(options, args) = self.get_command_line()

		if options.code_version:
			print (self.CODE_VERSION)
			return self.CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in RDF/XML format)')

		(main_ontology_file, output_file_basename) = self.onto_helper.check_ont_file(args[0], options)

		cached_rules = False;

		if options.cache:
			# If there is a cached file to use, go for it, otherwise will have to generate it.
			if options.output_folder:
				# Output rule file takes on ontology name + .json
				json_file_path = output_file_basename + '.json'

				if os.path.isfile('./' + json_file_path):
					with (open(json_file_path)) as input_handle:
						self.log("Using cached file:", json_file_path)
						bucket_rules = json.load(input_handle);
						cached_rules = True;

			else:
				stop_err('If using the cache flag, you must specify an output folder to read .json file from (or regenerate it to)')

		if not cached_rules: 

			# Load main ontology file into RDF graph
			print ("Fetching and parsing " + main_ontology_file + " ...")

			try:
				# ISSUE: ontology file taken in as ascii; rdflib doesn't accept
				# utf-8 characters so can experience conversion issues in string
				# conversion stuff like .replace() below
				self.onto_helper.graph.parse(main_ontology_file, format='xml')

			except Exception as e:
				#urllib2.URLError: <urlopen error [Errno 8] nodename nor servname provided, or not known>
				stop_err('WARNING:' + main_ontology_file + " could not be loaded!\n", e)

			# Add each ontology include file (must be in OWL RDF format)
			self.onto_helper.do_ontology_includes(main_ontology_file)

			specifications = {}

			for term_id in options.root_uri.split(','):

				# THE ONE CALL TO GET REPORT CATEGORY BOOLEAN EXPRESSIONS
				self.log('bucket rule compilation for', term_id)

				# If user has provided a set of comparison ids then actually 
				# execute bucket rules on them and return a boolean result for
				# each rule.
				specifications.update( self.do_membership_rules(term_id) )

			# If output folder specified then write out bucket rule file 
			if (options.output_folder):
				
				self.onto_helper.do_output_json(specifications, output_file_basename)


	""" ####################################################################
		Membership Rules are boolean expressions or single entities linked
		via 'has member' relation between a parent_id entity and children.

		This script reports rule label and id (parent_id) and then sends
		triple containing "[member of] [cardinality]

		memberships_by_cardinality query returns just the cardinality part.
		From there we explore the rest of the guts.

		INPUTS
			?parent_id ?label ?subject ?predicate ?object


		OUTPUT
		specifications : a dictionary of ontology term ids and their specification details

		    "GENEPIO:0001778": {
		        "id": "GENEPIO:0001778",
		        "label": "draft PulseNet Canada Salmonella submission standard",
		        "components": [
		            {
		                "owl:qualifiedCardinality": {
		                    "limit": 1,
		                    "set": {
		                        "owl:intersectionOf": {
		                            "GENEPIO:0002468": null, # string (value specification) type
		                            "owl:someValuesFrom": {
		                                "GENEPIO:0001559": null # 'outbreak identifier'
		                            },
		 	                            "owl:onProperty": {
		                                "SIO:000482": null # SIO:is match to 
		                            },
		                            "owl:hasValue": {
		                                "GENEPIO:0002201": null # 'PulseNet Canada field: PulseNet:Outbreak'
		                            }
		                        }
		                    }
		                }
		            },
				...
	"""
	def do_membership_rules(self, term_id):

		specBinding = {'root': rdflib.URIRef(term_id)} 
		table = self.onto_helper.do_query_table(self.queries['specifications'], specBinding )

		print ("Specification components:", len(table))

		specifications = {}

		# At this level each triple is a bucket-matching rule
		for triple in table: 
		
			# The 'specifications' query triples also have a 'label' and
			# 'parent_id' field. Generally they have predicate: someValuesFrom
			spec_id = triple['parent_id']
			label = triple['label']

			if not (spec_id in specifications):
				specifications[spec_id] = {
					'id': spec_id,
					'rdfs:label': triple['label'], # Can do as second pass.
					'datatype': 'model',
					'RO:0002180':[] # 'has component'
				}

			specifications[spec_id]['RO:0002180'].append(self.do_triple(triple))

			if self.TEST == 1:
				print (label, '(' + spec_id + ')', specifications[spec_id])

		return specifications


	def do_triple(self, triple):

		bnode_predicate = triple['predicate'];
		bnode_object = triple['object'];

		# Add symbol as key.
		if bnode_predicate == 'rdf:first':
			if type(bnode_object) == str: # ISSUE: we have to ASSUME this is a value specification. 
				return {'value': bnode_object};

			# Triples have an apparent list of entity id held in triple.expression.data, but taking this prevents rdf:rest chain which can lead to other things outside the list.  triple e.g.: {'predicate': 'rdf:first', 'expression': {'datatype': 'disjunction', 'data': [... list ..]

			# Merge dictionary of complex structure:
			return self.get_component_BNode(bnode_object);

		if bnode_predicate == 'rdf:rest':
			if 'bnode_object' == 'rdf:nil':
				# End of list.  Nothing more to do here.
				return None 

			return self.get_component_BNode(bnode_object);

		if bnode_predicate == 'rdf:type':
			# and bnode_triple['object'] == 'owl:Class':
			# Currently class simply adds anonymous shell onto contents - because rules (which are anonymous classes) don't/can't hold more than one bracketed expression. 
			return self.get_component_BNode(bnode_object);

		if type(bnode_object) == str: 
			# At this point, any string object should just be
			# a dictionary predicate key to the string.
			#print ("KONSTANT:", bnode_object)
			return {bnode_predicate: bnode_object};

		# E.g. QUALIFIED {'label': 'Avian', 'parent_id': 'LEXMAPR:0000004', 'expression': {'datatype': 'disjunction', 'data': []}, 'subject': rdflib.term.BNode('N56404ec196374f5998f05241cf8e7875'), 'predicate': 'owl:minQualifiedCardinality', 'object': {'value': '1', 'datatype': 'xmls:nonNegativeInteger'}}

		# E.g. QUALIFIED {'label': 'draft PulseNet Canada Salmonella submission standard', 'parent_id': 'GENEPIO:0001778', 'expression': {'datatype': 'disjunction', 'data': []}, 'subject': rdflib.term.BNode('N1cbb8f57b0b148ee9bb171c2396068c0'), 'predicate': 'owl:maxQualifiedCardinality', 'object': {'value': '1', 'datatype': 'xmls:nonNegativeInteger'}}

		# E.g. QUALIFIED {'predicate': 'owl:maxQualifiedCardinality', 'object': {'value': '1', 'datatype': 'xmls:nonNegativeInteger'}}

		if bnode_predicate in [
			'owl:qualifiedCardinality',
			'owl:minQualifiedCardinality',
			'owl:maxQualifiedCardinality',
			'owl:someValuesFrom'
			]:

			if 'subject' in triple: # TOP LEVEL CALL.

				if bnode_predicate == 'owl:someValuesFrom':
					content = self.get_component_BNode(bnode_object);

				else:
					content = self.get_component_cardinality(triple['subject']);

				# Also applies to union
				if 'owl:intersectionOf' in content and 'value' in content['owl:intersectionOf']: 

					revised = content['owl:intersectionOf'];
					if bnode_predicate != 'owl:someValuesFrom': # Necessary?
						# Add cardinality data
						revised[bnode_predicate] = int(bnode_object['value']);

					#if 'value' in content:
					value_spec = revised['value'];
					del revised['value'];
					return {value_spec: revised}
					
				else:
					# content can be basic:
					if 'value' in content: 
						value_spec = content['value'];
						content[bnode_predicate] = int(bnode_object['value']);
						del content['value'];
						return {value_spec: content}

				if bnode_predicate != 'owl:someValuesFrom':
					content[bnode_predicate] = int(bnode_object['value'])
				
				return content 
				
			else:
				return {bnode_predicate: int(bnode_object['value'])}
			

		#print("BONODIE2:", bnode_predicate, bnode_object)
		return {bnode_predicate: self.get_component_BNode(bnode_object)};

	""" 
	Find subordinate triples that begin with given node_id as subject.

	Basically none of these are annotations.

		Rdflib structure being queried is close to OWL structure:

		<owl:Class rdf:about="&obo;GENEPIO_0001778">
        <rdfs:subClassOf rdf:resource="&obo;GENEPIO_0000106"/>
        <rdfs:subClassOf>
            <owl:Class>
                <owl:intersectionOf rdf:parseType="Collection">
                    <owl:Restriction>
                        <owl:onProperty rdf:resource="http://semanticscience.org/resource/SIO_000482"/>
                        <owl:hasValue rdf:resource="&obo;GENEPIO_0002188"/>
                    </owl:Restriction>
                    <owl:Restriction>
                        <owl:onProperty rdf:resource="&obo;RO_0002180"/>
                        <owl:maxQualifiedCardinality rdf:datatype="&xsd;nonNegativeInteger">1</owl:maxQualifiedCardinality>
                        <owl:onClass>
                            <owl:Class>
                                <owl:intersectionOf rdf:parseType="Collection">
                                    <rdf:Description rdf:about="&obo;OBI_0001930"/>
                                    <owl:Restriction>
                                        <owl:onProperty rdf:resource="&obo;OBI_0001927"/>
                                        <owl:someValuesFrom rdf:resource="&obo;GENEPIO_0000113"/>
                                    </owl:Restriction>
                                </owl:intersectionOf>
                            </owl:Class>
                        </owl:onClass>
                    </owl:Restriction>
                </owl:intersectionOf>
            </owl:Class>
        </rdfs:subClassOf>


		'triple_by_subject' query on bnodes (and entity ids) yields triples:

			[{'predicate': 'rdf:type', 'object': 'owl:Class'}, 
			{'predicate': 'owl:intersectionOf', 'expression': ...}]

			[{'predicate': 'rdf:first', 'object': 'GENEPIO:0002468'}, # STRING
			{'predicate': 'rdf:rest', 'expression': ...}]

			[{'predicate': 'rdf:first', 'expression': ...}, 
			{'predicate': 'rdf:rest', 'expression': ...}]

			# ELEVATE THIS TO: 'OBI:0001927': 'GENEPIO:0001559'  # or expression
			[{'predicate': 'rdf:type', 'object': 'owl:Restriction'}, 
			{'predicate': 'owl:onProperty', 'object': 'OBI:0001927'}, # 'specifies value of'
			{'predicate': 'owl:someValuesFrom', 'object': 'GENEPIO:0001559'}] # 'outbreak identifier'
		
			[{'predicate': 'rdf:first', 'expression': ...}, 
			{'predicate': 'rdf:rest', 'object': 'rdf:nil'}]

			# ELEVATE THIS TO: 'SIO:000482': ['GENEPIO:0002201',....]  # Ultimately many field matches.
			[{'predicate': 'rdf:type', 'object': 'owl:Restriction'}, 
			{'predicate': 'owl:hasValue', 'object': 'GENEPIO:0002201'}, # 'PulseNet Canada field: PulseNet:Outbreak'
			{'predicate': 'owl:onProperty', 'object': 'SIO:000482'}]  #  SIO:is match to 


			"owl:intersectionOf": {
                "GENEPIO:0002468": null, # string (value specification) type
                "owl:someValuesFrom": {
                    "GENEPIO:0001559": null # 'outbreak identifier'
                },
                "owl:onProperty": {
                    "SIO:000482": null # SIO:is match to 
                },
                "owl:hasValue": {
                    "GENEPIO:0002201": null # 'PulseNet Canada field: PulseNet:Outbreak'
                }
            }
	"""
	def get_component_BNode(self, node_id):

		result = {}
		triples = self.onto_helper.do_query_table(
			self.queries['triple_by_subject'], {'subject': node_id }
		)

		# In the case of a conjunction or disjunction, each array of triples
		# pertains to just one axiom/expression. We need to revise these
		# expressions.

		# First pass collects key parts of triples
		# 2nd pass assembles them into result structures.

		#print ("Triples for ", node_id, triples)
		index = {}
		for bnode_triple in triples:

			bnode_predicate = bnode_triple['predicate']; # always a URI			
			index[bnode_predicate] = bnode_triple['object'];

			result.update(self.do_triple(bnode_triple))

		# The bag of tripples collectively has all the elements we need to create some specific data structures:
		if 'owl:onProperty' in index:

			# CASE rdf:type=owl:Restriction:owl:onProperty 
			if index['owl:onProperty'] == 'SIO:000482': # 'is match to' 
				if 'owl:hasValue' in index:
					result['SIO:000482'] = result['owl:hasValue'];
					del result['owl:onProperty'];
					del result['owl:hasValue'];

			elif index['owl:onProperty'] == 'OBI:0001927': # 'specifies value of'
				result['OBI:0001927'] = result['owl:someValuesFrom']; # Assumes 'some' used in axiom
				del result['owl:onProperty'];
				del result['owl:someValuesFrom'];

		return result

	"""
	The cardinality cases all require 2nd query to fetch target class
	of restriction.
	"""
	def get_component_cardinality(self, subject_id): 

		objects = self.onto_helper.do_query_table(
			self.queries['cardinality_target'], {'subject': subject_id}
		)
		#print ("DUMP CARD TRIPLES", objects)
		# Should only be one...?!
		for row in objects:
			node_object = row['object']
			# Happens when 
			if type(node_object) == str:
				return {'value': node_object}

			# Returns things like {"owl:intersectionOf": ...}
			return self.get_component_BNode(node_object)

		return {}
	


	def render_debug(self, triple):
		return ("DEBUG:", json.dumps(triple, sort_keys=False, indent=4, separators=(',', ': ')))


	def get_component_blank(self, triple):
		return None


	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = """
				Converts parts of an OWL ontology file to a data specification structure 
	that can be made into forms, reports, etc. Usually starts examining 
	ontology from the OBI 'data representational model' (OBI:0000658) class.
	All subclasses that have 'has component' some | min | max [expression] are
	specifications.
	""",
			usage = 'ontospec.py [ontology file path or URL] [options]*',
			epilog="""  """)
		
		# first (unnamed) parameter is input file or URL
		# output to stdio unless -o provided in which case its to a file.

		# Standard code version identifier.
		parser.add_option('-v', '--version', dest='code_version', default=False, action='store_true', help='Return version of this code.')

		parser.add_option('-c', '--cache', dest='cache', default=False, action="store_true", help='Allow use of cached json rule file?')

		parser.add_option('-o', '--output', dest='output_folder', type='string', help='Path of output file to create')

		parser.add_option('-r', '--root', dest='root_uri', type='string', help='Comma separated list of full URI root entity ids to fetch underlying specifications from. Defaults to owl#Thing.', default='http://www.w3.org/2002/07/owl#Thing')

		return parser.parse_args()


if __name__ == '__main__':

	buckets = OntoSpec()
	buckets.__main__()  
