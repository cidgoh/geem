#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
 example.py
 Author: Damion Dooley

 This is an example script that shows how to load an ontology and its include
 files using rdflib, and how to query it by sparql query below. It depends on
 ontohelper.py library.

 Example command line when run in a folder under main ontology file.

 python example.py ../genepio.owl

**************************************************** 
""" 

import json
import optparse
import sys
import rdflib
import python.ontohelper as oh

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict


CODE_VERSION = '0.0.0'

def stop_err( msg, exit_code=1 ):
	sys.stderr.write("%s\n" % msg)
	sys.exit(exit_code)

class MyParser(optparse.OptionParser):
	"""
	Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
	"""
	def format_epilog(self, formatter):
		return self.epilog

class Ontology(object):
	"""
	Read in an ontology and its include files. Run Sparql 1.1 queries which retrieve:
	- ontology defined fields, including preferred label and definition 

	"""
	CODE_VERSION = '0.0.2'

	def __init__(self):

		self.onto_helper = oh.OntoHelper()

		self.queries = {
			##################################################################
			# Generic TREE "is a" hierarchy from given root.
			# FUTURE: ADD SORTING OPTIONS, CUSTOM ORDER.
			#
			'tree': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?parent ?label ?ui_label ?definition
				WHERE {	
					?parent rdfs:subClassOf* ?root.
					?id rdfs:subClassOf ?parent.
					OPTIONAL {?id rdfs:label ?label}.
					OPTIONAL {?id GENEPIO:0000006 ?ui_label}.
					OPTIONAL {?id IAO:0000115 ?definition.}
				}
				ORDER BY ?label ?ui_label
			""", initNs = self.onto_helper.namespace),

			# ################################################################
			# ... add other queries here in same formula as above, 
			# including a unique name like 'tree'

		}

	def __main__(self): #, main_ontology_file

		(options, args) = self.get_command_line()

		if options.code_version:
			print self.CODE_VERSION
			return self.CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file path or URL (file must be in XML/RDF format)')

		(main_ontology_file, output_file_basename) = self.onto_helper.check_ont_file(args[0], options)

		# Load main ontology file into RDF graph
		print "Fetching and parsing " + main_ontology_file + " ..."

		try:
			# ISSUE: ontology file taken in as ascii; rdflib doesn't accept
			# utf-8 characters so can experience conversion issues in string
			# conversion stuff like .replace() below
			self.onto_helper.graph.parse(main_ontology_file, format='xml')

		except URLError as e:
			#urllib2.URLError: <urlopen error [Errno 8] nodename nor servname provided, or not known>
			stop_err('WARNING:' + main_ontology_file + " could not be loaded!\n")

		# Add each ontology include file (must be in OWL RDF format)
		self.onto_helper.do_ontology_includes(main_ontology_file)

		# Get stuff under OBI data_representational_model
		print 'Doing term hierarchy query'
		specBinding = {'root': rdflib.URIRef(self.onto_helper.get_expanded_id('owl:Thing'))} 
		struct = self.onto_helper.do_query_table(self.queries['tree'], specBinding )

		self.onto_helper.do_output_json(struct, output_file_basename)

	
	############################## UTILITIES ###########################

	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = 'GenEpiO JSON field specification generator.  See https://github.com/GenEpiO/genepio',
			usage = 'jsonimo.py [ontology file path] [options]*',
			epilog="""  """)
		
		# Standard code version identifier.
		parser.add_option('-v', '--version', dest='code_version', default=False, action='store_true', help='Return version of this code.')

		parser.add_option('-o', '--output', dest='output_folder', type='string', help='Path of output file to create')

		return parser.parse_args()


if __name__ == '__main__':

	example = Ontology()
	example.__main__()

