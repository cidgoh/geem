#!/usr/bin/python
# -*- coding: utf-8 -*-

""" ***************************************************************************
	
 Author: Damion Dooley

 python jsonimo.py [owl ontology file path]

 Ontology() class __main__() reads in given ontology file and processes 
 selected axioms into a json data structure that represents standards contained
 within the ontology. This works for relatively flat (tabular or 
 tree-structured standards.)

 FUTURE: Enhance with "located in" query so that geo-related items can be
 linked in user interface.

 RDFLib: This script requires python module RDFLib.

 RDFLib sparql ISSUE: Doing a "BINDING (?x as ?y)" expression prevents ?x from 
 being output in a SELECT. bug leads to no such field being output.

******************************************************************************* 
""" 

import re
import json
import sys
import os
from pprint import pprint
import optparse
import lib.python.ontohelper as oh

import rdflib
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict


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
	CODE_VERSION = '0.0.5'

	def __init__(self):

		self.onto_helper = oh.OntoHelper()

		""" 
		Add these PREFIXES to Protege Sparql query window if you want to test a query there:

		PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> PREFIX owl: <http://www.w3.org/2002/07/owl#>
		PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX OBO: <http://purl.obolibrary.org/obo/>
		PREFIX xmls: <http://www.w3.org/2001/XMLSchema#>
		""" 

		self.queries = {
			##################################################################
			# Generic TREE "is a" hierarchy from given root.
			#
			'tree': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?label ?parent_id ?deprecated ?replaced_by
				WHERE {	
					?parent_id rdfs:subClassOf* ?root.
					?id rdfs:subClassOf ?parent_id.
					OPTIONAL {?id rdfs:label ?label}.
	 				OPTIONAL {?id GENEPIO:0000006 ?ui_label}. # for ordering
					OPTIONAL {?id owl:deprecated ?deprecatedAnnot.
						BIND(xsd:string(?deprecatedAnnot) As ?deprecated).
					}.
					OPTIONAL {?id IAO:0100001 ?replaced_byAnnot.
						BIND(xsd:string(?replaced_byAnnot) As ?replaced_by).
					}.	
				}
				ORDER BY ?parent_id ?ui_label ?label 
			""", initNs = self.onto_helper.namespace),

			# SECOND VERSION FOR ''
			##################################################################
			# RETRIEVE DATUM CARDINALITY, LIMIT FOR SPECIFICATION RELATIVE TO PARENT
			# X 'has component' [some|exactly N|min n| max n] Y 
			#
			'specification_components': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?parent (?datum as ?id) ?cardinality ?limit
				WHERE { 	
					?restriction owl:onProperty RO:0002180. # has component
					?parent rdfs:subClassOf ?restriction. 

					{?restriction owl:onClass ?datum.
					?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?limit. 
					?restriction ?cardinality ?limit.}
					UNION 
					{?restriction owl:someValuesFrom ?datum.
					?restriction ?cardinality ?datum} # Sets ?cardinality to "owl:someValuesFrom" 

					OPTIONAL {?datum rdfs:label ?label}.
				 } ORDER BY ?label

			""", initNs = self.onto_helper.namespace),

			##################################################################
			# 
			#    <owl:Class rdf:about="&obo;GENEPIO_0001627">
	        #		<rdfs:label xml:lang="en">temperature of sample</rdfs:label>
	        #		<rdfs:subClassOf rdf:resource="&obo;GENEPIO_0001628"/>
	        #		<rdfs:subClassOf>
	        #    		<owl:Restriction>
	        #        		<owl:onProperty rdf:resource="&obo;GENEPIO_0001605"/>
	        #        		<owl:someValuesFrom rdf:resource="&xsd;decimal"/>
	        #    		</owl:Restriction>
	        #		</rdfs:subClassOf>
	        #		...
	        #
			'primitives': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT (?datum as ?id) ?datatype ?constraint ?expression
				WHERE { 	
					BIND (GENEPIO:0001605 as ?hasPvaluespec).
					BIND (GENEPIO:0001655 as ?categorical).
					?restriction owl:onProperty ?hasPvaluespec. 
					?datum rdfs:subClassOf ?restriction.
					
					{?restriction owl:someValuesFrom ?datatype. FILTER ( isURI(?datatype))} 
					UNION
						{?restriction owl:someValuesFrom ?datatypeObj. 
						?datatypeObj owl:onDatatype ?datatype.
						?datatypeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
						?restrictColl ?constraint ?expression} 
					UNION # retrieve all categorical datums that are descended from a 'has primitive value spec' class. 
						{?datum rdfs:subClassOf ?categorical.
						BIND (xmls:anyURI as ?datatype)} 
					UNION # matches a single condition on 
						{?restriction owl:onDataRange ?datatype.  FILTER (! isBlank(?datatype)).
						?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?expression.
						?restriction ?constraint ?expression } 
					UNION
						{?restriction owl:onDataRange ?dataRangeObj.
						?dataRangeObj owl:onDatatype ?datatype. 
						?dataRangeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
						?restrictColl ?constraint ?expression.
						 } 
				 } 
			""", initNs = self.onto_helper.namespace),

		
			##################################################################
			# 
			#   The difference between this and below "primitives" query is that this one 
			#	returns descendant datums.  Run inherited query first to calculate inheritances; 
			#	then run "primitives" to override inherited values with more specific ones.
			# 
			#	Handle much simpler inheritance of categoricals in 'categoricals' query below

			'inherited': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT (?datum as ?id) ?datatype ?constraint ?expression
				WHERE { 	
					BIND (GENEPIO:0001605 as ?hasPvaluespec).
					?restriction owl:onProperty ?hasPvaluespec. 
					?datum rdfs:subClassOf/rdfs:subClassOf+ ?restriction.

					{?restriction owl:someValuesFrom ?datatype.} 
					UNION {?restriction owl:someValuesFrom ?datatypeObj. 
						?datatypeObj owl:onDatatype ?datatype.
						?datatypeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
						?restrictColl ?constraint ?expression.}
					UNION # matches a single condition on 
						{?restriction owl:onDataRange ?datatype.  FILTER (! isBlank(?datatype)).
						?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?expression.
						?restriction ?constraint ?expression } 
					UNION
						{?restriction owl:onDataRange ?dataRangeObj.
						?dataRangeObj owl:onDatatype ?datatype. 
						?dataRangeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
						?restrictColl ?constraint ?expression.
						 } 
					 FILTER (?datatype != xmls:anyURI)
				 } order by ?datatype
		 """, initNs = self.onto_helper.namespace),


			##################################################################
			# CATEGORICAL FIELDS
			# One must mark an ontology term as a 'categorical tree specification'
			# in order for it to have the 'xmls:anyURI' datatype.
			# This list is dumped into the specifications tree; subordinate items
			# are placed in the picklists tree.
			#
			# These root nodes for categorical tree specification go into 'specifications' table

			'categoricals': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?datatype
				WHERE { 
					BIND (GENEPIO:0001655 as ?categorical).
					BIND (xmls:anyURI as ?datatype).
					?id rdfs:subClassOf ?categorical.
				 } 
			""", initNs = self.onto_helper.namespace),

			##################################################################
			# INDIVIDUALS
			# We accept the convention that categorical picklist trees containing 
			# entities represented by proper names - like "British Columbia", 
			# "Vancouver (BC)", "Washington (DC)", etc. - may have "individual" nodes, 
			# i.e. are represented by owl:NamedIndividual.
			#
			# Multilingual selection of items in sorted order is done client side.
			# 
			'individuals': rdflib.plugins.sparql.prepareQuery("""
				
				SELECT DISTINCT ?id ?parent ?datatype
				WHERE {
					BIND (GENEPIO:0001655 as ?categorical_root).
					BIND (xmls:anyURI as ?datatype).
					?id rdf:type owl:NamedIndividual.
					?id rdf:type ?parent.
					?parent rdfs:subClassOfTLR*/rdfs:subClassOf+ ?categorical_root.

					OPTIONAL {?id GENEPIO:0000006 ?ui_label}.
					OPTIONAL {?id rdfs:label ?label}.

				}
				ORDER BY ?parent ?ui_label ?label
			""", initNs = self.onto_helper.namespace),

			##################################################################
			# ALL PRIMITIVE FIELD UNITS

			'units' :rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT (?datum as ?id)	?unit	?label ?ui_label
				WHERE { 
					BIND (GENEPIO:0001605 as ?has_primitive_value_spec). 
					BIND (IAO:0000039 as ?has_measurement_unit_label).
					?datum rdfs:subClassOf* ?restriction3.
					FILTER (isIRI(?datum)).
					?restriction3 owl:onProperty ?has_measurement_unit_label.
					?restriction3 (owl:someValuesFrom | owl:withRestrictions*/owl:someValuesFrom/owl:unionOf*/rdf:rest*/rdf:first) ?unit.
					?unit rdfs:label ?label
					FILTER ( isURI(?unit))

				 } ORDER BY ?datum ?unit ?label
			""", initNs = self.onto_helper.namespace),


			# ################################################################
			# UI FEATURES
			# A picklist item or form input or specification can be hidden or required or
			# other feature with respect to its parent, via 
			# As well, a form input datum can have UI features indicated just by annotating it directly.
			# FUTURE: a feature may be qualified by user's user type.
			#
			# Typical "lookup" UI feature axioms:
			#
			#    <owl:Class rdf:about="http://purl.obolibrary.org/obo/GENEPIO_0001742">
			#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GENEPIO_0001655"/>
			#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GEO_000000005"/>
			#        <GENEPIO:0000006 xml:lang="en">region</GENEPIO:0000006>
			#        <GENEPIO:0001763>lookup</GENEPIO:0001763>
			#		...
			#
		    #	<owl:Axiom>
		    #	    <GENEPIO:0001763>lookup</GENEPIO:0001763>
		    #	    <owl:annotatedSource rdf:resource="&obo;GENEPIO_0001740"/>
		    #	    <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
		    #	    <owl:annotatedTarget>
		    #	        <owl:Restriction>
		    #	            <owl:onProperty rdf:resource="&obo;RO_0002180"/>
		    #	            <owl:someValuesFrom rdf:resource="&obo;GENEPIO_0001287"/>
		    #	        </owl:Restriction>
		    #	    </owl:annotatedTarget>
		    #	</owl:Axiom>
		    #


			'features': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?referrer ?feature ?value 
				WHERE { 
					{# Get direct (Class annotated) features
						?id rdf:type owl:Class.  
						?id GENEPIO:0001763 ?value.  # user interface feature
						?id ?feature ?value. #
						BIND ('' as ?referrer).
					}
					UNION
					# VERIFY IF THIS IS RETURNING ANYTHING?
					{	# Get features placed on axiom if it is a simple (subClass?) someValuesFrom relation. 
						?axiom rdf:type owl:Axiom.
						?axiom owl:annotatedSource ?id.
						?axiom owl:annotatedTarget ?referrer. 
						FILTER(isURI(?referrer))
						?axiom GENEPIO:0001763 ?value.  # user interface feature
						?axiom ?feature ?value.
					}
				}
			""", initNs = self.onto_helper.namespace),

			
			# ################################################################
			# UI "MEMBER OF" STANDARD FEATURES
			#
			# A standard has datums via "has component" which can be annotated
			# with standard-specific label, definition, UI definition,
			# hasAlternateId and other attributes. Add all of these to list of
			# features above.
			# 
		    #    <owl:Axiom>
			#        <GENEPIO:0001763>lookup</GENEPIO:0001763>
			#        <owl:annotatedSource rdf:resource="&obo;OBI_0000938"/>
			#        <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
			#        <owl:annotatedTarget>
			#            <owl:Restriction>
			#                <owl:onProperty rdf:resource="&obo;GENEPIO_0001605"/>
			#                <owl:qualifiedCardinality rdf:datatype="&xsd;nonNegativeInteger">1</owl:qualifiedCardinality>
			#                <owl:onDataRange rdf:resource="&xsd;anyURI"/>
			#            </owl:Restriction>
			#        </owl:annotatedTarget>
			#    </owl:Axiom>

			'feature_annotations': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?referrer ?feature ?value 
				WHERE { 
					?axiom rdf:type owl:Axiom.
					?axiom owl:annotatedSource ?referrer.
					?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
					?restriction owl:onProperty RO:0002180. # has component
					?restriction (owl:onClass|owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality | owl:someValuesFrom) ?id
					FILTER(isURI(?id))
					#Get feature as label, definition, UI feature, alternative identifier (database field)
					?axiom (rdfs:label|IAO:0000115|GENEPIO:0001763|OBO:hasAlternativeId) ?value.
					# Not using these here: UI definition GENEPIO:0000162, UI label GENEPIO:0000006
					?axiom ?feature ?value.
				}
			""", initNs = self.onto_helper.namespace),

			# ################################################################
			# UI LABELS 
			# These are annotations directly on an entity.  This is the only place
			# that ui_label and ui_definition should really operate. Every entity
			# in OWL file is retrieved for their rdfs:label, IAO definition etc.
			#
			'entity_text': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?label ?definition ?ui_label ?ui_definition
				WHERE {  
					{?datum rdf:type owl:Class} 
					UNION {?datum rdf:type owl:NamedIndividual} 
					UNION {?datum rdf:type rdf:Description}.
					OPTIONAL {?datum rdfs:label ?label.} 
					OPTIONAL {?datum IAO:0000115 ?definition.}
					OPTIONAL {?datum GENEPIO:0000006 ?ui_label.} 
					OPTIONAL {?datum GENEPIO:0000162 ?ui_definition.}
				} ORDER BY ?label
			""", initNs = self.onto_helper.namespace),

			# ################################################################
			# CURRENTLY UNUSED: STANDARDS INFORMATION
			# A "[field] 'member of' [some standard]" can have annotations of 
			# standard-specific label, definition, hasAlternateId, etc.
			# This query retrieves them; they are loaded into the parent entity's
			# corresponding members[id] dictionary
			#
			# CURRENTLY UNUSED
			#
			'standards_information': rdflib.plugins.sparql.prepareQuery("""
				SELECT DISTINCT ?id ?referrer ?feature ?value 
				WHERE { 
					?axiom rdf:type owl:Axiom.
					?axiom owl:annotatedSource ?id.
					?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
					?restriction owl:onProperty RO:0002350. # member of
					?restriction owl:someValuesFrom ?referrer.
					FILTER(isURI(?id)).
					#Get feature as label, definition, UI feature, 
					#Not using these here: UI definition GENEPIO:0000162, UI label GENEPIO:0000006
					?axiom (rdfs:label|IAO:0000115|GENEPIO:0001763) ?value.  
					?axiom ?feature ?value.
				}
			""", initNs = self.onto_helper.namespace),


			# ################################################################
			# oboInOwl:hasDbXref (an annotation property) cross references to other terminology databases 
			'dbreferences': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?dbXref
				WHERE {  
					{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
					?datum oboInOwl:hasDbXref ?dbXref.
				}
			""", initNs = self.onto_helper.namespace),


			# ################################################################
			# oboInOwl:hasSynonym
			# Picklist items are augmented with synonyms in order for 
			# type-as-you-go inputs to return appropriately filtered phrases
			#
			# INPUT
			# 	?datum : id of term to get labels for
			# OUTPUT
			#   ?Synonym ?ExactSynonym ?NarrowSynonym
			#
			'entity_synonyms': rdflib.plugins.sparql.prepareQuery("""

				SELECT DISTINCT ?datum ?Synonym ?ExactSynonym ?NarrowSynonym ?AlternativeTerm
				WHERE {  
					{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
					{?datum oboInOwl:hasSynonym ?Synonym.} 
					UNION {?datum oboInOwl:hasExactSynonym ?ExactSynonym.}
					UNION {?datum oboInOwl:hasNarrowSynonym ?NarrowSynonym.}
					UNION {?datum IAO:0000118 ?AlternativeTerm.}
				}
			""", initNs = self.onto_helper.namespace),
		}


	def __main__(self): #, main_ontology_file

		self.onto_helper = oh.OntoHelper()

		(options, args) = self.get_command_line()

		if options.code_version:
			print self.CODE_VERSION
			return self.CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in RDF format)')

		# Accepts relative path with file name e.g. ../genepio-edit.owl
		(main_ontology_file, output_file_basename) = self.onto_helper.check_ont_file(args[0], options)
		print "Processing ", main_ontology_file, " ..."

		# Load main ontology file into RDF graph
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

		# Load self.onto_helper.struct with ontology metadata
		self.onto_helper.set_ontology_metadata()
		print "Metadata:", json.dumps(self.onto_helper.struct['metadata'],  sort_keys=False, indent=4, separators=(',', ': '))

		# Retrieve subclasses of "data representational model"(OBI:0000658) 
		# and place in self.onto_helper.struct.specifications
		print 'Doing term hierarchy query'
		specBinding = {'root': rdflib.URIRef(self.get_expanded_id('OBI:0000658'))} 
		entities = self.onto_helper.do_query_table(self.queries['tree'], specBinding )
		print 'Doing terms', len(entities)
		self.do_entities(entities, 'model')

		self.doSpecComponents(self.onto_helper.do_query_table(self.queries['specification_components'] ))
		self.doPrimitives(self.onto_helper.do_query_table(self.queries['inherited'] ))
		self.doPrimitives(self.onto_helper.do_query_table(self.queries['primitives'] ))
		self.doPrimitives(self.onto_helper.do_query_table(self.queries['categoricals'] ))


		# GENEPIO_0001655 = Class:Categorical tree specification
		# CHANGE TO: ANY categorical Value Specification 
		#	- include targets of 'specifies value of'(OBI:0001927)
		# 	- AS WELL AS ANY subClassOf expressions of categorical.
		#
		picklistBinding = {'root': rdflib.URIRef(self.get_expanded_id('GENEPIO:0001655'))}
		self.doPickLists(self.onto_helper.do_query_table(self.queries['tree'], picklistBinding ))
		self.doPickLists(self.onto_helper.do_query_table(self.queries['individuals']))

		self.doUIFeatures(self.onto_helper.do_query_table(self.queries['features']) ,'features')
		# Second call for 'member of' can override entity and 'has component' features established above.

		# doUIFeatures here because its "order" feature reorganizes some of above content.
		self.doUIFeatures(self.onto_helper.do_query_table(self.queries['feature_annotations']), 'feature_annotations')
		# This is implementing any user interface feature="preferred_unit:..." 
		self.doUnits(self.onto_helper.do_query_table(self.queries['units'] ))

		# DO NOT USE sort_keys=True on piclists etc. because this overrides OrderedDict() sort order.
		# BUT NEED TO IMPLEMENT json ordereddict sorting patch.
		self.onto_helper.do_output_json(self.struct, output_file_basename)

		#with (open('./data/ontology/' + ontology_filename + '.json', 'w')) as output_handle:
		#	output_handle.write(json.dumps(self.onto_helper.struct,  sort_keys=False, indent=4, separators=(',', ': ')))


	def do_entities(self, table, datatype):
		""" 
			Converts table of ontology terms - each having its own row of
			dictionary, into self.struct['specifications'] dictionary.
			References to parents are also pursued - on a second iteration
			so that they are primarily filled in on first pass if already
			mentioned in hierarchy, but barebones record is created for
			them if not.

			FUTURE: add "other_parents" column?

			Example output of one term conversion:
				"GENEPIO:0001677": {
		            "id": "GENEPIO:0001677",
		            "parent": "GENEPIO:0001606",
		            "ui_label": "contact specification - patient"
		            }
		        }

			
		"""

		# List of parents to process after 1st pass through table's entities.
		parents = [] 

		for myDict in table:
			self.do_entity(myDict, datatype)

			parent_id = self.onto_helper.get_parent_id(myDict) 
			if not parent_id in parents:
				parents.append(parent_id)

		# 2nd pass does parents:
		# Parent gets entry in structure too, though maybe not a label.
		# If not already mentioned in its own right, then it was parent
		# of top-level entity, and not really important.
		for parent_id in parents:
			if not parent_id in self.onto_helper.struct['specifications']:
				self.onto_helper.set_entity_default(self.onto_helper.struct, 'specifications', parent_id, {
					'id': parent_id, 
					'datatype': 'entity'
				})

	##### ISSSUE: MUST ATTACH PARENT MODELS[child_id] = []
	#self.set_struct(self.onto_helper.struct, 'specifications', parentId, 'models', myDict['id'], [])


	def do_entity(self, myDict, datatype):
		"""
		Inserts or overlays entity described by myDict into 
		self.struct['specifications']
		
		INPUT
			myDict:dict (erow from table)
			prefix:string indicates source ontology for term
		"""

		id = str(myDict['id'])
		myDict['id'] = id
		myDict['datatype'] = datatype

		if 'prefix' in self.onto_helper.struct['metadata']:
			myDict['ontology'] = self.onto_helper.struct['metadata']['prefix']

		if 'replaced_by' in myDict:
			myDict['replaced_by'] = self.onto_helper.get_entity_id(myDict['replaced_by'])

	# Addresses case where a term is in query more than once, as
	# a result of being positioned in different places in hierarchy.
	# self.struct[struct][id]['other_parent'].append(parentId)

		self.onto_helper.set_entity_default(self.onto_helper.struct, 'specifications', id, myDict)

		self.do_entity_text(id)
		self.do_entity_synonyms(id)
		self.do_entity_dbxrefs(id)


	def do_entity_text(self, id):
		"""
		For given entity, all 'labels' query fields are returned (rdfs:label, IAO 
		definition, UI label, UI definition) and added to the entity directly.

		"""
		myURI = rdflib.URIRef(self.onto_helper.get_expanded_id(id))
		rows = self.onto_helper.graph.query(
			self.queries['entity_text'],	
			initBindings = {'datum': myURI} 
		)
		# Should only be 1 row to loop through
		for row in rows: 
			myDict = row.asdict()	
			# Adds any new text items to given id's structure
			self.onto_helper.struct['specifications'][id].update(myDict) 


	def do_entity_dbxrefs(self, id):
		"""
		Adds list of hasDbXref references to given entity.
		"""
		uriID = rdflib.URIRef(self.get_expanded_id(id))
		dbreferences = self.onto_helper.graph.query(self.queries['dbreferences'], initBindings = {'datum': uriID })
		if len(dbreferences):
			dbxrefList = self.onto_helper.set_entity_default(self.onto_helper.struct, 'specifications', id, 'hasDbXref', [])		
			for row in dbreferences:
				dbxrefList.append(row['dbXref'])


	def do_entity_synonyms(self, id):
		"""
		Augment each entry in 'specifications' with array of hasSynonym etc. 
		synonyms gathered from 'entity_synonyms' query of annotations: 

			oboInOwl:hasSynonym
			oboInOwl:hasExactSynonym
			oboInOwl:hasNarrowSynonym
			IAO:0000118 AlternativeTerm

		ISSUE: 
		Not Multilingual yet.  Some synonym entries have {language: french} or
		{language: Scottish Gaelic} etc. at end. 

		INPUT
			?datum ?Synonym ?ExactSynonym ?NarrowSynonym ?AlternativeTerm
		"""

		# Add preferred label and definition for items in each table
		for id in self.onto_helper.struct['specifications']:

			uriID = rdflib.URIRef(self.get_expanded_id(id))
			synonyms = self.onto_helper.graph.query(self.queries['entity_synonyms'], initBindings={'datum': uriID })
			for row in synonyms:
				for field in ['Synonym','ExactSynonym','NarrowSynonym','AlternativeTerm']:

					if row[field]: 
						synonymTypeList = self.onto_helper.set_entity_default(self.onto_helper.struct, 'specifications', id, 'has' + field, [])
						# Clean up synonym phrases
						# Insisting on terms separated by comma+space because chemistry expressions have tight comma separated synonyms
						stringy = row[field].encode('unicode-escape').decode('utf8').replace('\\n', '\n')
						phrases = stringy.strip().replace(', ','\n').replace('"','').split('\n')
						for phrase in phrases:
							synonymTypeList.append( phrase.strip())


	def doPickLists(self, table):
		""" ################################################################
			PICKLISTS 

			This is a flat list containing every picklist item.  To advance through a given
			picklist one recursively reads through a picklist node's members.
			It is problematic for a particular picklist item to belong to several parents,
			as logically it would then inherit semantics of each parent.  However in some
			cases where no other inheritance implications are done, it is possible.

		"""
		struct = 'specifications'
		# Fashion complete picklists (flat list) of items, with parent(s) of each item, and members.
		for myDict in table:
			id = str(myDict['id'])
			parentId = self.get_parent_id(myDict)
			myDict.pop('parent_id')
			#This picklist node might already have been mentioned in another picklist 
			# node's member list so it might already be set up.
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, myDict)
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, 'datatype', 'xmls:anyURI') # MARKS PICKLIST ITEMS
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, 'member_of', [])
			self.onto_helper.get_struct(self.onto_helper.struct, struct, id, 'member_of').append(parentId)
			# ALSO ADD 'located in' as 'part of' links?????

			# Ditto for parent, if any...
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, parentId, {'id': parentId} )
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, parentId, 'choices', OrderedDict())
			self.set_struct(self.onto_helper.struct, struct, parentId, 'choices', id, []) # empty array is set of features.


	def doSpecComponents(self, table):
		""" ####################################################################
			FIELD GROUPS

			This is tricky because Cardinality and limit must be transferred to parent's children list.
			A field's parent might not be in fields yet, so have to initialise it.

			INPUTS
				?parent ?id ?cardinality ?limit

		"""
		struct = 'specifications'
		for myDict in table:

			id = str(myDict['id'])
			if not isinstance(id, basestring):
				print "Field Groups problem - missing id as string:", myDict
				return

			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, {'id': id} )
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, 'otherParent', [] )	

			parentId = self.get_parent_id(myDict)
			if parentId:
		
				if parentId == id:
					print 'ERROR: an entity mistakenly is "parent" of itself: %s ' % id
				else:
					# Ensure parent exists and with default data type of 'model' since it has components.
					self.onto_helper.set_entity_default(self.onto_helper.struct, struct, parentId, {'id': parentId, 'datatype': 'model'} )
					self.onto_helper.struct[struct][id]['otherParent'].append(parentId)

					obj = {'cardinality': myDict['cardinality']}
					if 'limit' in myDict: 
						obj.update(self.onto_helper.get_bindings(myDict['limit']))

					# First time children list populated with this id's content:
					self.onto_helper.set_entity_default(self.onto_helper.struct, struct, parentId, 'components', {})
					self.onto_helper.set_entity_default(self.onto_helper.struct, struct, parentId, 'components', id, [])
					self.onto_helper.get_struct(self.onto_helper.struct, struct, parentId, 'components', id).append(obj)

					# BNodes have no name but have expression.
					if 'expression' in myDict: 

						# E.g. myDict = {'expression': {'datatype': 'disjunction', 'data': [u'SIO:000661', u'SIO:000662', u'SIO:000663']}, u'cardinality': u'owl:maxQualifiedCardinality', u'limit': {'datatype': u'xmls:nonNegativeInteger', 'value': u'1'}, u'id': rdflib.term.BNode('N65c806e2db1c4f7db8b7b434bca58f78'), u'parent_id': u'GENEPIO:0001623'}
						print "HAS EXPRESSION: ", myDict['expression']

						expression = myDict['expression']
						self.onto_helper.struct[struct][id]['datatype'] = expression['datatype'] # disjunction usually
						self.onto_helper.struct[struct][id]['parent_id'] = parentId
						# Anonymous nodes imbedded within other classes don't get labels.
						self.onto_helper.struct[struct][id]['ui_label'] = '' 
						self.onto_helper.struct[struct][id]['components'] = {}
						# List off each of the disjunction items, all with a 'some'
						for ptr, partId in enumerate(expression['data']):
							# So far logical expression parts have no further info. (like cardinality)
							self.onto_helper.struct[struct][id]['components'][partId] = [{
		                        "datatype": "xmls:nonNegativeInteger",
		                        "cardinality": "owl:qualifiedCardinality",
		                        "value": "1"
		                    }] 


	def doPrimitives(self, table):
		""" 
		####################################################################
		PRIMITIVES
		Any field that "has primitive value spec".
		
		Sets the datatype of a field, and any range limits on primitive datums.
		Each field is allowed only one datatype.  If this routine is called a second 
		time with a different datatype it is assumed that this is a lower-level
		definition overriding an inherited one.

		The following constraints apply to the number or text of a particular datum value; they are about how many (including minimum and maximum limits) data values of a particular data type it takes - minimum sufficient criteria - to be considered an entity instance of the given ontology id.  The constraints don't necessarily reflect directly on how many items a user is actually submitting in a form or how many are held in a data store with respect to a datum that is claimed to be of the given ontology id type.  The real world of data can be incomplete - a form can be partly filled in, and returned-to later for completion.  However, these constraints can be used to VALIDATE whether an entity fulfills its overall definition.
		
		Note that all categorical pick lists inherit 'categorical measurement datum' datatype of exactly 1 xmls:anyURI .

		Some examples:
			Datum X "'has primitive value spec' exactly 1 xmls:anyURI"
			is the same as:
			Datum X "'has primitive value spec' owl:qualifiedCardinality 1 xmls:anyURI"
			These cases are typical of any datums that have 'categorical measurement datum' as an ancestor.

			Datum X "'has primitive value spec' owl:someValuesFrom xmls:anyURI"
			This case can't be an ancestor of 'categorical measurement datum' since a datum can point to only one value (or structure of values).

		To allow more than one item to be selected from a list or tree requires that the item is_a 'data representational model' that 'Has Part' [condition, e.g. > 0]   
		
		Currently sparql queries don't return a constraint property for a term that has only been marked with "has primitive value spec owl:someValuesFrom [data type]".  This default empty constraint case is currently being interpreted as
		 - If categorical selection value, it is an optional selection.
		 - If numeric or text, it is not required, but 1 field data entry is allowed.  Technically this may be challenged - it may be the default use of someValuesFrom should require at least one value entry, and perhaps more than one.

		INPUTS
			?id ?datatype 
			?constraint like constraint': u'xmls:minInclusive'
			?expression like: {'datatype': u'xmls:integer', 'value': u'0'}


		ISSUE: ANONYMOUS NODES ARE MISSING DATATYPES, LABELS, MAYBE ALL BUT FIRST NODE

		"""
		struct = 'specifications'
		for myDict in table:
			id = myDict['id']
			self.onto_helper.set_entity_default(self.onto_helper.struct, struct, id, {'id':id} )
			record = self.onto_helper.struct[struct][id]
			self.onto_helper.set_entity_default(record, 'datatype', myDict['datatype'])

			if record['datatype'] != myDict['datatype']:
				self.set_struct(record,'datatype', myDict['datatype'])
				self.set_struct(record,'constraints', []) #override past constraints.
				#print "ERROR for %s: multiple datatypes assigned: %s, %s" % (id, record['datatype']['type'], myDict['datatype'])

			if 'constraint' in myDict:

				obj = {'constraint': myDict['constraint']}	

				if 'expression' in myDict: 
					if isinstance(myDict['expression'], basestring):	
						obj['value'] = myDict['expression']
					else:
						obj.update(self.onto_helper.get_bindings(myDict['expression']))

				"""
				The use of "<" and ">" lead to minExcludes and maxExcludes constraints.
				Normalize these into minIncludes and maxIncludes so less UI hassle.
				"""
				constraint = obj['constraint']
				if constraint == 'xmls:minExclusive':
					obj['constraint'] = 'xmls:minInclusive'
					obj['value'] = int(obj['value']) + 1
				elif constraint == 'xmls:maxExclusive':
					obj['constraint'] = 'xmls:maxInclusive'
					obj['value'] = int(obj['value']) - 1

				# Terms in pick lists are inheriting the 'categorical measurement datum' condition of having only 1 xmls:anyURI value.  Leave this implicit since an xmls:anyURI can't be anything else.  Catch this in the Sparql query instead?

				# Other terms A string term may also inherit "primitive value spec exactly 1 xsd:string" but this may be overridden with more specific expression constraints on how long the string is or its regex pattern content.
				# ,'xmls:date','xmls:time','xmls:dateTime','xmls:dateTimeStamp'
				elif record['datatype'] in ['xmls:anyURI'] and constraint == 'owl:qualifiedCardinality' and int(obj['value']) == 1:
					continue

				self.onto_helper.set_entity_default(record,'constraints', [])
				self.onto_helper.get_struct(self.onto_helper.struct, struct, id, 'constraints').append(obj)


	def doUnits(self, table):
		""" 
		####################################################################
		UNITS 
		1) Add one or more allowed units to entity field. 
		2) Ensure unit entity is in specifications.

		FUTURE: utilize branches of the units ontology tree so e.g. input 
		with a general 'time unit' can have access to any of the 
		underlying units.
		"""

		for myDict in table:
			if not myDict['id'] in self.onto_helper.struct['specifications']:
				print "NOTE: field [%s] isn't listed in a specification, but a unit [%s] is attached to it" % (myDict['id'],myDict['unit'])
				continue
			else:
				self.onto_helper.set_entity_default(self.onto_helper.struct, 'specifications', myDict['id'], 'units', [])
				self.onto_helper.get_struct(self.onto_helper.struct, 'specifications', myDict['id'], 'units').append(myDict['unit'])

				# Ensure specifications has this unit
				self.set_struct(self.onto_helper.struct, 'specifications' ,myDict['unit'] , {
					'id': myDict['unit'],
					'ui_label': myDict['label'],
					'datatype': 'xmls:anyURI'
				})


	def doUIFeatures(self, table, table_name):
		""" 
		####################################################################
		User Interface Features
		
		Features are (non-reasoning) annotations pertinent to display and
		data interfacing. They enable us to describe 3rd part standard field
		specifications, as well as flags for involving user interface features
		like selection list "lookup", or "preferred_unit", or user interface 
		"help".

		In an ontology features are marked in three ways:

			1) As 'user interface feature' annotations directly on an entity.
			This is signaled in table record when no referrer id value exists.  
			These features get put in entity['features'], e.g.

			"NCIT:C87194": {
				"ui_label": "State"
        		"definition": "A constituent administrative district of a nation.",
	            "features": [
	                {
	                    "lookup":{}
	                }
	            ],...

			2) As annotations on the 'has component' parent-entity relation.
			Mainly provides cardinality, marked on parent 'components'.

			3) Once in a while a standard makes use of a component that has
			sub-components which the standard has special names or descriptions
			for.  To annotate these, a direct link between the component and the
			standard needs to exist, in order for it to carry the custom 
			annotations.  Still working on a way to best accomplish this.
	
		In the future ?value may contain a user type or other expression.  
		For now, "hidden" means not	to show item in pick-lists.

		subClassOf relations are converted into "models" list.
		has_component relations are converted into "components list.

		Features get added onto existing parent-child member or part lists. 

		Note: A feature may have a datatype AND value, e.g.
			"feature": {
                "datatype": "http://www.w3.org/2000/01/rdf-schema#Literal",
                "value": "dateFormat=ISO 8601"
            },

		FUTURE: Have a feature may be qualified by user's role or identifier?
		
		INPUT
			table: ?id ?member ?feature ?value 
			table_name: 'features' or 'feature_annotations'

		"""
		#Loop through query results; each line has one id, feature, referrer.
		for myDict in table:
			entityId = myDict['id']
			if not entityId in self.onto_helper.struct['specifications']:
				print "Error, no specification for id ", entityId, " when working on", table_name
				continue

			parent_id = myDict['referrer'] # Id of parent if applicable
			featureType = myDict['feature']

			valueObj = myDict['value']
			featureDict = {}

			if 'datatype' in valueObj: # ontology included a datatype in this.
				featureDict['datatype'] = valueObj['datatype']
				value = valueObj['value']

			else: # value is a string.
				value = valueObj 

			# User interface feature, of form [keyword] or [key:value]
			if featureType == 'GENEPIO:0001763': 
				if ':' in value: #  [key:value] 
					binding = value.split(":",1)
					feature = binding[0]
					featureDict['value'] = binding[1]

					# Special case: minimize sort parameters, which are
					# a list of ontology ids, one per line, with possible
					# hashmark comment after them.
					if feature == 'order':
						orderArray = featureDict['value'].strip().strip(r'\n').split(r'\n') #splitlines() not working!
						featureDict['value'] = [unicode(x.split('#')[0].strip()) for x in orderArray]
					elif feature == 'preferred_unit':
						# Expecting 1 value. 
						# strip comments off.
						featureDict['value'] =	unicode(featureDict['value'].split('#')[0].strip() )

				else: # keyword
					feature = value

			# Other feature-value annotations picked up in 'feature_annotations' query
			else:
				featureDict['value'] = value
				if featureType == 'rdfs:label':
					feature = 'label'
					# Issue is that entity['parent_id'] is not showing up
					#print feature, value, parentId

				elif featureType == 'IAO:0000115':
					feature = 'definition'
				elif featureType == 'OBO:hasAlternativeId':
					feature = 'field_label'
				else:
					feature = featureType

			# Feature is set at this point

			# If no parent, then just mark feature directly in entity's 
			# 'features' list.  Client side programming determines
			# what overrides what.
			if parent_id == '':
				entity = self.onto_helper.struct['specifications'][entityId]
				self.onto_helper.set_entity_default(entity, 'features', {})
				entity['features'][feature] = featureDict
				if feature == 'order':
					# Reorganize entity's components, models, and choices according to featureDict['value'] list.
					self.onto_helper.reorder(entity,'models', featureDict['value'])
					self.onto_helper.reorder(entity,'components', featureDict['value'])
					self.onto_helper.reorder(entity,'choices', featureDict['value'])

				continue

			# Here entity has feature with respect to a parent, so mark in 
			# parent's entity.  Normally use "components" link but what
			# about models?
			parent = self.onto_helper.get_struct(self.onto_helper.struct, 'specifications', parent_id)
			if not parent:
				print "Error when adding feature: couldn't locate ", parent_id
				continue
				
			featureDict['feature'] = feature
			self.onto_helper.set_entity_default(parent, 'components', OrderedDict())
			self.onto_helper.set_entity_default(parent, 'components', entityId,[])
			self.onto_helper.get_struct(parent, 'components', entityId).append(featureDict)	


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

	genepio = Ontology()
	genepio.__main__()  # "../genepio.owl"

