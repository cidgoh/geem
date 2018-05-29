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
 being output in a SELECT bug leads to no such field being output.

******************************************************************************* 
""" 

import re
import json
import sys
import os
from pprint import pprint
import optparse

import rdflib
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict


CODE_VERSION = '0.0.5'

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

	def __init__(self):

		self.graph=rdflib.Graph()

		self.struct = OrderedDict()
		# JSON-LD @context markup, also used by jsonimo.py to make compact URI's.
		# This enables output .json file to have shorter URI's using prefixes.

		# SHOULD AUTO-GENERATE THIS BASED ON MERGED ONTOLOGY'S ENTITY PREFIXES
		self.struct['@context'] = {
			'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
			'owl': 'http://www.w3.org/2002/07/owl/',
			'xmls': 'http://www.w3.org/2001/XMLSchema#',
			'vcard': 'http://www.w3.org/2006/vcard/ns#',
			'vcf': 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl#',
			'dc': 'http://purl.org/dc/elements/1.1/',
			'oboInOwl': 'http://www.geneontology.org/formats/oboInOwl#',
			'MESH': 'http://purl.bioontology.org/ontology/MESH/',
			'SIO': 'http://semanticscience.org/resource/SIO_',
			'typon': 'http://purl.phyloviz.net/ontology/typon#',
			'NDF-RT':'http://evs.nci.nih.gov/ftp1/NDF-RT/NDF-RT.owl#',

			# OBOFoundry ontologies:
			"AGRO": "http://purl.obolibrary.org/obo/AGRO_",
			'ancestro': 'http://purl.obolibrary.org/obo/ancestro_',  
			"BFO": "http://purl.obolibrary.org/obo/BFO_",
 			"CHEBI": "http://purl.obolibrary.org/obo/CHEBI_",
 			"DOID": "http://purl.obolibrary.org/obo/DOID_",
 			"ENVO": "http://purl.obolibrary.org/obo/ENVO_",
 			'EFO': 'http://www.ebi.ac.uk/efo/EFO_',
 			'EO': "http://purl.obolibrary.org/obo/EO_",
 			'ERO': "http://purl.obolibrary.org/obo/ERO_",
 			'ExO': 'http://purl.obolibrary.org/obo/ExO_',
            "FOODON": "http://purl.obolibrary.org/obo/FOODON_",
			"GEO": "http://purl.obolibrary.org/obo/GEO_",
            "GENEPIO": "http://purl.obolibrary.org/obo/GENEPIO_",
			"GAZ": "http://purl.obolibrary.org/obo/GAZ_",
			"HP": "http://purl.obolibrary.org/obo/HP_",
			"IAO": "http://purl.obolibrary.org/obo/IAO_",
        	"IDO": "http://purl.obolibrary.org/obo/IDO_",
        	"MPATH": "http://purl.obolibrary.org/obo/MPATH_",
 			'NCBITaxon' : 'http://purl.obolibrary.org/obo/NCBITaxon_',
			"NCIT": "http://purl.obolibrary.org/obo/NCIT_",
			"OBI": "http://purl.obolibrary.org/obo/OBI_",
			'OMIABIS': 'http://purl.obolibrary.org/obo/OMIABIS_',
			"OMP": "http://purl.obolibrary.org/obo/OMP_",
			'PATO': "http://purl.obolibrary.org/obo/PATO_",
     		"PO": "http://purl.obolibrary.org/obo/PO_",
        	"RO": "http://purl.obolibrary.org/obo/RO_",
        	"SO": "http://purl.obolibrary.org/obo/SO_",
            "STATO": "http://purl.obolibrary.org/obo/STATO_",
			"SYMP": "http://purl.obolibrary.org/obo/SYMP_",
			"TRANS": "http://purl.obolibrary.org/obo/TRANS_",
			"UBERON": "http://purl.obolibrary.org/obo/UBERON_",
			"UO": "http://purl.obolibrary.org/obo/UO_"

			# metadata needs its field/URI mapping too. 
		}
		self.struct['specifications'] = {}
		self.struct['metadata'] = {}


	def __main__(self): #, main_ontology_file

		(options, args) = self.get_command_line()

		if options.code_version:
			print CODE_VERSION
			return CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in RDF format)')

		# Accepts relative path with file name e.g. ../genepio-edit.owl
		main_ontology_file = args[0] 

		main_ontology_file = self.check_folder(main_ontology_file, "Ontology file")
		if not os.path.isfile(main_ontology_file):
			stop_err('Please check the OWL ontology file path')			

		print "PROCESSING " + main_ontology_file + " ..."

		# Get ontology core filename, without .owl suffix
		ontology_filename = os.path.basename(main_ontology_file).rsplit('.',1)[0]
		
		# Get ontology version, and add to core filename
		#...

		# Load main ontology file into RDF graph
		# ISSUE: ontology file taken in as ascii; rdflib doesn't accept utf-8 characters
		# so can experience conversion issues in string conversion stuff like .replace() below
		self.graph.parse(main_ontology_file)

		# Add each ontology include file (must be in OWL RDF format)
		self.ontologyIncludes(os.path.dirname(main_ontology_file) + '/imports')

		# load self.struct with ontology metadata
		self.ontologyMetadata(self.doQueryTable('metadata'))

		# Retrieve all subclasses of 'data representational model'
		specBinding = {'root': rdflib.URIRef(self.expandId('OBI:0000658'))} 
		self.doSpecifications(self.doQueryTable('tree', specBinding ))
		
		# ALSO GET OTHER TOP-LEVEL TERMS?
		# ... 

		self.doSpecComponents(self.doQueryTable('specification_components' ) )	
		self.doPrimitives(self.doQueryTable('inherited') )		
		self.doPrimitives(self.doQueryTable('primitives') )
		self.doPrimitives(self.doQueryTable('categoricals') )


		# GENEPIO_0001655 = Class:Categorical tree specification
		picklistBinding = {'root': rdflib.URIRef(self.expandId('GENEPIO:0001655'))}
		self.doPickLists(self.doQueryTable('tree', picklistBinding ))
		self.doPickLists(self.doQueryTable('individuals') )

		self.doUIFeatures(self.doQueryTable('features') ,'features')
		# Second call for 'member of' can override entity and 'has component' features established above.

		self.doLabels(['specifications']) 
		
		# doUIFeatures here because its "order" feature reorganizes some of above content.
		self.doUIFeatures(self.doQueryTable('feature_annotations'), 'feature_annotations')
		# This is implementing any user interface feature="preferred_unit:..." 
		self.doUnits(self.doQueryTable('units') )

		# DO NOT USE sort_keys=True on piclists etc. because this overrides OrderedDict() sort order.
		# BUT NEED TO IMPLEMENT json ordereddict sorting patch.

		with (open('./data/ontology/' + ontology_filename + '.json', 'w')) as output_handle:
			output_handle.write(json.dumps(self.struct,  sort_keys=False, indent=4, separators=(',', ': ')))


	def ontologyMetadata(self, table):
		# Should only be 1 row.
		print
		print "Metadata:", table
		for myDict in table: 
			self.struct['metadata'] = myDict
		self.struct['metadata']['type'] = 'ontology'
		self.struct['metadata']['status'] = 'release'
		self.struct['metadata']['date'] = self.struct['metadata']['date']['value']


	def doSpecifications(self, table):
		""" ####################################################################
			SPECIFICATIONS

			A specification is a subClassOf 'data representational model', and is
			basically a complex entity that defines a form, record or report. 

			* The 'has_member' relation specifies what component entities it has
			  and include the cardinality restrictions on how many of a given 
			  component type are allowed (some, > 0, = 1, < n).
			* A component entity may have a "has primitive data type".  

			For example one can specify that a contact can have up to 3 phone numbers.

			When an entity "is a" subclass of a specification, it means that in addition to
			all of the entity's own 'has_value_specification' attributes, it inherits those
			of its parent(s).  WHERE TO PLACE THEM?

			In example below, a "contact specification - patient" (GENEPIO:0001677) inherits 
			attributes from "contact specification - person" (GENEPIO:0001606)

			Example:
				"GENEPIO:0001677": {
		            "id": "GENEPIO:0001677",
		            "parent": "GENEPIO:0001606",
		            "prefLabel": "contact specification - patient"
		            }
		        }

		"""
		struct = 'specifications'
		for myDict in table:
			myDict['id'] = str(myDict['id'])
			myDict['datatype'] = 'model'
			self.setDefault(self.struct, struct, myDict['id'], myDict)

			parentId = self.getParentId(myDict) # primary parent according to data rep hierarchy

			self.setDefault(self.struct, struct, parentId, {
				'id': parentId, 
				'datatype': 'model',
				'models': OrderedDict()
			})

			self.setStruct(self.struct, struct, parentId, 'models', myDict['id'], [])


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
			parentId = self.getParentId(myDict)
			myDict.pop('parent')
			#This picklist node might already have been mentioned in another picklist 
			# node's member list so it might already be set up.
			self.setDefault(self.struct, struct, id, myDict)
			self.setDefault(self.struct, struct, id, 'datatype', 'xmls:anyURI') # MARKS PICKLIST ITEMS
			self.setDefault(self.struct, struct, id, 'member_of', [])
			self.getStruct(self.struct, struct, id, 'member_of').append(parentId)
			# ALSO ADD 'located in' as 'part of' links?????

			# Ditto for parent, if any...
			self.setDefault(self.struct, struct, parentId, {'id': parentId} )
			self.setDefault(self.struct, struct, parentId, 'choices', OrderedDict())
			self.setStruct(self.struct, struct, parentId, 'choices', id, []) # empty array is set of features.


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

			self.setDefault(self.struct, struct, id, {'id': id} )
			self.setDefault(self.struct, struct, id, 'otherParent', [] )	

			parentId = self.getParentId(myDict)
			if parentId:
		
				if parentId == id:
					print 'ERROR: an entity mistakenly is "parent" of itself: %s ' % id
				else:
					# Ensure parent exists and with default data type of 'model' since it has components.
					self.setDefault(self.struct, struct, parentId, {'id': parentId, 'datatype': 'model'} )
					self.struct[struct][id]['otherParent'].append(parentId)

					obj = {'cardinality': myDict['cardinality']}
					if 'limit' in myDict: 
						obj.update(self.getBindings(myDict['limit']))

					# First time children list populated with this id's content:
					self.setDefault(self.struct, struct, parentId, 'components', {})
					self.setDefault(self.struct, struct, parentId, 'components', id, [])
					self.getStruct(self.struct, struct, parentId, 'components', id).append(obj)

					# BNodes have no name but have expression.
					if 'expression' in myDict: 

						# E.g. myDict = {'expression': {'datatype': 'disjunction', 'data': [u'SIO:000661', u'SIO:000662', u'SIO:000663']}, u'cardinality': u'owl:maxQualifiedCardinality', u'limit': {'datatype': u'xmls:nonNegativeInteger', 'value': u'1'}, u'id': rdflib.term.BNode('N65c806e2db1c4f7db8b7b434bca58f78'), u'parent': u'GENEPIO:0001623'}
						print "HAS EXPRESSION: ", myDict['expression']

						expression = myDict['expression']
						self.struct[struct][id]['datatype'] = expression['datatype'] # disjunction usually
						self.struct[struct][id]['parent'] = parentId
						# Anonymous nodes imbedded within other classes don't get labels.
						self.struct[struct][id]['uiLabel'] = '' 
						self.struct[struct][id]['components'] = {}
						# List off each of the disjunction items, all with a 'some'
						for ptr, partId in enumerate(expression['data']):
							# So far logical expression parts have no further info. (like cardinality)
							self.struct[struct][id]['components'][partId] = [{
		                        "datatype": "xmls:nonNegativeInteger",
		                        "cardinality": "owl:qualifiedCardinality",
		                        "value": "1"
		                    }] 

#			else:
				# If entity has no parent , case can't happen?!?!?!
				# was only a 'component of' some other component.
#				self.setDefault(self.struct, struct, id, 'datatype', 'model')

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
			self.setDefault(self.struct, struct, id, {'id':id} )
			record = self.struct[struct][id]
			self.setDefault(record, 'datatype', myDict['datatype'])

			if record['datatype'] != myDict['datatype']:
				self.setStruct(record,'datatype', myDict['datatype'])
				self.setStruct(record,'constraints', []) #override past constraints.
				#print "ERROR for %s: multiple datatypes assigned: %s, %s" % (id, record['datatype']['type'], myDict['datatype'])

			if 'constraint' in myDict:

				obj = {'constraint': myDict['constraint']}	

				if 'expression' in myDict: 
					if isinstance(myDict['expression'], basestring):	
						obj['value'] = myDict['expression']
					else:
						obj.update(self.getBindings(myDict['expression']))

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

				self.setDefault(record,'constraints', [])
				self.getStruct(self.struct, struct, id, 'constraints').append(obj)


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
			if not myDict['id'] in self.struct['specifications']:
				print "NOTE: field [%s] isn't listed in a specification, but a unit [%s] is attached to it" % (myDict['id'],myDict['unit'])
				continue
			else:
				self.setDefault(self.struct, 'specifications', myDict['id'], 'units', [])
				self.getStruct(self.struct, 'specifications', myDict['id'], 'units').append(myDict['unit'])

				# Ensure specifications has this unit
				self.setStruct(self.struct, 'specifications' ,myDict['unit'] , {
					'id': myDict['unit'],
					'uiLabel': myDict['label'],
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
				"uiLabel": "State"
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
			if not entityId in self.struct['specifications']:
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
					# Issue is that entity['parent'] is not showing up
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
				entity = self.struct['specifications'][entityId]
				self.setDefault(entity, 'features', {})
				entity['features'][feature] = featureDict
				if feature == 'order':
					# Reorganize entity's components, models, and choices according to featureDict['value'] list.
					self.reorder(entity,'models', featureDict['value'])
					self.reorder(entity,'components', featureDict['value'])
					self.reorder(entity,'choices', featureDict['value'])

				continue

			# Here entity has feature with respect to a parent, so mark in 
			# parent's entity.  Normally use "components" link but what
			# about models?
			parent = self.getStruct(self.struct, 'specifications', parent_id)
			if not parent:
				print "Error when adding feature: couldn't locate ", parent_id
				continue
				
			featureDict['feature'] = feature
			self.setDefault(parent, 'components', OrderedDict())
			self.setDefault(parent, 'components', entityId,[])
			self.getStruct(parent, 'components', entityId).append(featureDict)	


	def reorder(self, entity, part, orderedKeys = None):
		""" Order given entity part dictionary by given order array of ids, or alphabetically if none.
			# components, models, choices are all orderedDict already.
		"""
		if part in entity:
			if orderedKeys:
				# Each entity[part] item is given a rank by the index location of its id in given orderedKeys list
				entity[part] = OrderedDict(sorted(entity[part].items(), key=lambda item: orderedKeys.index(item[0]) if item[0] in orderedKeys else False))
			else:
				print "ordering", entity[part].items()
				entity[part] = OrderedDict(sorted(entity[part].items(), key=attrgetter('uiLabel')) )


	def doLabels(self, list):
		""" ####################################################################
			For given list of entity dictionaries, augment each dictionary with onto
			term label and definition.
			ALSO lookup 
				synonyms = ?datum ?synonym ?exactSynonym ?narrowSynonym
				rdfs:DbXRefs = reference

			FUTURE: handle multi-lingual content
			ISSUE: Not Multilingual yet.  Some synonym entries have {language: french} or {language: Scottish Gaelic} etc. at end. 

			INPUTS
				 ?datum ?Synonym ?ExactSynonym ?NarrowSynonym ?AlternativeTerm
		"""

		# Add preferred label and definition for items in each table
		for table in list:
			for id in self.struct[table]:
				self.doALabel(table, id)
				uriID = rdflib.URIRef(self.expandId(id))
				dbreferences = self.graph.query(self.queries['dbreferences'], initBindings = {'datum': uriID })
				if len(dbreferences):
					dbxrefList = self.setDefault(self.struct, table, id, 'hasDbXref', [])		
					for row in dbreferences:
						dbxrefList.append(row['dbXref'])

				synonyms = self.graph.query(self.queries['synonyms'], initBindings={'datum': uriID })
				if len(synonyms):	
					for row in synonyms:

						for field in ['Synonym','ExactSynonym','NarrowSynonym','AlternativeTerm']:
	
							if row[field]: 
								synonymTypeList = self.setDefault(self.struct, table, id, 'has' + field, [])
								# Clean up synonym phrases
								# Insisting on terms separated by comma+space because chemistry expressions have tight comma separated synonyms
								stringy = row[field].encode('unicode-escape').decode('utf8').replace('\\n', '\n')
								phrases = stringy.strip().replace(', ','\n').replace('"','').split('\n')
								for phrase in phrases:
									synonymTypeList.append( phrase.strip())


	def doALabel(self, table, id):
		"""
		For given entity, all 'labels' query fields are returned (label, IAO 
		definition, UI label, UI definition) and added to the entity directly.

		In order to do a sparql query to get back the label fields for an item,
		we have to supply the query with initBindings which includes the 
		binding for [prefix]:id so query can succeed for that item.  
		E.g. GENEPIO:GENEPIO_12345 -> purl.obolibrary.org/obo/GENEPIO/GENEPIO_12345
		"""
		rows = self.graph.query(self.queries['labels'],	initBindings={'datum': rdflib.URIRef(self.expandId(id) ) } )
		for row in rows: # Only one row returned per idRef / entity.
			myDict = row.asdict()	
			self.doLabel(myDict)
			self.struct[table][id].update(myDict) #Adds new text items to given id's structure


	def doLabel(self, myDict):
		""" 
			All ontology items have and need a rdfs:Label, but this is often
			not nice to display to users. If no uiLabel, uiLabel is created as
			a copy of Label. Then uiLabel always exists, and is displayed on
			form. If label <> uiLabel, drop label field for efficiency's sake.

			label, definition etc. annotations on an entity 'member of' parent
			are kept in parent's 'components'.
		"""
		if not 'uiLabel' in myDict: 
			if not 'label' in myDict: # a data maintenance issue
				myDict['label'] = '[no label]'
				
			myDict['uiLabel'] = myDict['label']
		if 'label' in myDict:
			if myDict['label'] == myDict['uiLabel']: myDict.pop('label')

	############################## UTILITIES ###########################

	def getBindings(self, myDict):
		obj = {}
		for entity in myDict:
			obj[entity] = myDict[entity]

		return obj

	def getParentId(self, myDict):
		if 'parent' in myDict: 
			return str(myDict['parent']) # Sometimes binary nodes are returned
		return None

	def setStruct(self, focus,*args):
		# Create a recursive dictionary path from focus ... to n-1 args, and 
		# set it to value provided in last argument
		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			if not arg in focus: focus[arg]={}
			if ptr == len(args)-2:
				focus[arg] = value 
			else:
				focus = focus[arg]


	def setDefault(self, focus,*args):
		""" 
			Same as setStruct() but won't create path; it will only use existing path.
		"""
		if not focus:
			print ( "ERROR: in setDefault(), no focus for setting: %s" % str(args[0:-1]) )
			return None

		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			#arg = str(arg) # binary nodes are objects
			if not arg: stop_err( "ERROR: in setDefault(), an argument isn't set: %s" % str(args[0:-1]) ) 
			if ptr == len(args)-2:
				if not arg in focus:
					focus[arg] = value
				return focus[arg]

			elif not arg in focus: 
				print ( "ERROR: in setDefault(), couldn't find %s" % str(args[0:-1]) )
				return False
			else:
				focus = focus[arg]

	def getStruct(self, focus, *args):
		"""
			Navigate from focus object dictionary hierarchy down through 
			textual keys, returning value of last key.
		"""
		try:
			for arg in args:
				focus = focus[arg]
		except:
			print "ERROR: in getStruct(), couldn't find '%s' key or struct in %s" % (str(arg), str(args) )
			return None
		return focus


	def extractId(self, URI):
		"""
		 If URI's fragment has a recognized value from @context, return
		 shortened version, e.g.
		 
		 	URI: http://purl.obolibrary.org/obo/GENEPIO_0001234
		 	@context item: "GENEPIO": "http://purl.obolibrary.org/obo/GENEPIO_",
		 """
		if '_' in URI:
			(path, fragment) = URI.rsplit('_',1)
		elif '#' in URI: # Need '#' test first!    path#fragment
			(path, fragment) = URI.rsplit('#',1)
		elif '/' in URI:
			(path, fragment) = URI.rsplit('/',1)
		else:
			path = False

		if path:

			for prefix, context_prefix in self.struct['@context'].iteritems():
				if path == context_prefix[0:-1]: # snips last separation character 
					return prefix + ":" + fragment
			
		return URI 


	def expandId(self, URI):
		# If a URI has a recognized prefix, create full version
		if ':' in URI: 
			(prefix, myid) = URI.rsplit(':',1)
			for key, value in self.struct['@context'].iteritems():
				if key == prefix: return value + myid
			
		return URI 


	def ontologyIncludes(self, ontology_file_path='./imports/'):
		"""
		Detects all the import files in a loaded OWL ontology graph and adds them to the graph.
		Currently assumes imports are sitting in a folder called "imports" in parent folder of this script. 
		"""
		imports = self.graph.query("""
			SELECT distinct ?import_file
			WHERE {?s owl:imports ?import_file.}
			ORDER BY (?import_file)
		""")		

		print("It has %s import files ..." % len(imports))

		for result_row in imports: # a rdflib.query.ResultRow
			file = result_row.import_file.rsplit('/',1)[1]
			file_path = ontology_file_path + '/' + file
			try:
				if os.path.isfile( file_path):
					self.graph.parse(file_path)	
				else:
					print ('WARNING:' + file_path + " could not be loaded!  Does its ontology include purl have a corresponding local file? \n")

			except rdflib.exceptions.ParserError as e:
				print (file_path + " needs to be in RDF OWL format!")			


	def doQueryTable(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 query, returns a list of objects, one for each row result
		Simplifies XML/RDF URI http://... reference down to a known ontology entity code defined in 
		"""

		query = self.queries[query_name]

		try:
			result = self.graph.query(query, initBindings=initBinds) #, initBindings=initBindings
		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		# Can't get columns by row.asdict().keys() because columns with null results won't be included in a row.
		# Handles "... SELECT DISTINCT (?something as ?somethingelse) ?this ?and ?that WHERE ....""
		#columns = re.search(r"(?mi)\s*SELECT(\s+DISTINCT)?\s+((\?\w+\s+|\(\??\w+\s+as\s+\?\w+\)\s*)+)\s*WHERE", query)
		#columns = re.findall(r"\s+\?(?P<name>\w+)\)?", columns.group(2))

		STRING_DATATYPE = rdflib.term.URIRef('http://www.w3.org/2001/XMLSchema#string')
		table = []
		for ptr, row in enumerate(result):
			rowdict = row.asdict()
			newrowdict = {}

			for column in rowdict:

				# Each value has a datatype defined by RDF Parser: URIRef, Literal, BNode
				value = rowdict[column]
				valType = type(value) 
				if valType is rdflib.term.URIRef : 
					newrowdict[column] = self.extractId(value)  # a plain string

				elif valType is rdflib.term.Literal :
					literal = {'value': value.replace('\n', r'\n')} # Text may include carriage returns; escape to json
					#_invalid_uri_chars = '<>" {}|\\^`'

					if hasattr(value, 'datatype'): #rdf:datatype
						#Convert literal back to straight string if its datatype is simply xmls:string
						if value.datatype == None or value.datatype == STRING_DATATYPE:
							literal = literal['value']
						else:
							literal['datatype'] = self.extractId(value.datatype)															

					elif hasattr(value, 'language'): # e.g.  xml:lang="en"
						#A query Literal won't have a language if its the result of str(?whatever) !
						literal['language'] = self.extractId(value.language)
					
					else: # WHAT OTHER OPTIONS?
						literal = literal['value']

					newrowdict[column] = literal

				elif valType is rdflib.term.BNode:
					"""
					Convert a variety of BNode structures into something simple.
					E.g. "(province or state or territory)" is a BNode structure coded like
					 	<owl:someValuesFrom> 
							<owl:Class>
								<owl:unionOf rdf:parseType="Collection">
                    			   <rdf:Description rdf:about="&resource;SIO_000661"/> 
                    			   <rdf:Description rdf:about="&resource;SIO_000662"/>
                    			   ...
                    """
                    # Here we fetch list of items in disjunction
					disjunction = self.graph.query(
						"SELECT ?id WHERE {?datum owl:unionOf/rdf:rest*/rdf:first ?id}", 
						initBindings={'datum': value} )		
					results = [self.extractId(item[0]) for item in disjunction] 
					newrowdict['expression'] = {'datatype':'disjunction', 'data':results}

					newrowdict[column] = value

				else:

					newrowdict[column] = {'value': 'unrecognized column [%s] type %s for value %s' % (column, type(value), value)}

			table.append(newrowdict)

		return table



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

		return parser.parse_args()


	def check_folder(self, file_path, message = "Directory for "):
		"""
		Ensures file folder path for a file exists.
		It can be a relative path.
		"""
		if file_path != None:

			path = os.path.normpath(file_path)
			if not os.path.isdir(os.path.dirname(path)): 
				# Not an absolute path, so try default folder where script launched from:
				path = os.path.normpath(os.path.join(os.getcwd(), path) )
				if not os.path.isdir(os.path.dirname(path)):
					stop_err(message + "[" + path + "] does not exist!")			
					
			return path
		return None


	""" 
	Add these PREFIXES to Protege Sparql query window if you want to test a query there:

	PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> PREFIX owl: <http://www.w3.org/2002/07/owl#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX OBO: <http://purl.obolibrary.org/obo/>
	PREFIX xmls: <http://www.w3.org/2001/XMLSchema#>
	""" 
	namespace = { 
		'owl': rdflib.URIRef('http://www.w3.org/2002/07/owl#'),
		'rdfs': rdflib.URIRef('http://www.w3.org/2000/01/rdf-schema#'),
		'rdf':	rdflib.URIRef('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
		'xmls': rdflib.URIRef('http://www.w3.org/2001/XMLSchema#'),
		'dc': rdflib.URIRef('http://purl.org/dc/elements/1.1/'),
		'oboInOwl': rdflib.URIRef('http://www.geneontology.org/formats/oboInOwl#'),
		'OBO': rdflib.URIRef('http://purl.obolibrary.org/obo/'), # shortcut for all OBOFoundry purls
		'IAO':	rdflib.URIRef('http://purl.obolibrary.org/obo/IAO_'),
		'GENEPIO':rdflib.URIRef('http://purl.obolibrary.org/obo/GENEPIO_'),
		'RO':	rdflib.URIRef('http://purl.obolibrary.org/obo/RO_'),
		'OBI':	rdflib.URIRef('http://purl.obolibrary.org/obo/OBI_')
	}

	queries = {
		##################################################################
		# Generic TREE "is a" hierarchy from given root.
		# FUTURE: ADD SORTING OPTIONS, CUSTOM ORDER.
		#
		'tree': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?parent
			WHERE {	
				?parent rdfs:subClassOf* ?root.
				?id rdfs:subClassOf ?parent.
				OPTIONAL {?id rdfs:label ?label}.
				OPTIONAL {?id GENEPIO:0000006 ?uiLabel}.
			}
			ORDER BY ?parent ?uiLabel ?label 
		""", initNs = namespace),

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

		""", initNs = namespace),

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
		""", initNs = namespace),

	
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
	 """, initNs = namespace),


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
		""", initNs = namespace),

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

				OPTIONAL {?id GENEPIO:0000006 ?uiLabel}.
				OPTIONAL {?id rdfs:label ?label}.

			}
			ORDER BY ?parent ?uiLabel ?label
		""", initNs = namespace),

		##################################################################
		# ALL PRIMITIVE FIELD UNITS

		'units' :rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT (?datum as ?id)	?unit	?label ?uiLabel
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
		""", initNs = namespace),


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
		""", initNs = namespace),

		
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
		""", initNs = namespace),

		# ################################################################
		# UI LABELS 
		# These are annotations directly on an entity.  This is the only place
		# that uiLabel and uiDefinition should really operate. Every entity
		# in OWL file is retrieved for their rdfs:label, IAO definition etc.
		#
		'labels': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?label ?definition ?uiLabel ?uiDefinition
			WHERE {  
				{?datum rdf:type owl:Class} 
				UNION {?datum rdf:type owl:NamedIndividual} 
				UNION {?datum rdf:type rdf:Description}.
				OPTIONAL {?datum rdfs:label ?label.} 
				OPTIONAL {?datum IAO:0000115 ?definition.}
				OPTIONAL {?datum GENEPIO:0000006 ?uiLabel.} 
				OPTIONAL {?datum GENEPIO:0000162 ?uiDefinition.}
			} ORDER BY ?label
		""", initNs = namespace),

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
		""", initNs = namespace),


		# ################################################################
		# oboInOwl:hasDbXref (an annotation property) cross references to other terminology databases 
		'dbreferences': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?dbXref
			WHERE {  
				{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
				?datum oboInOwl:hasDbXref ?dbXref.
			}
		""", initNs = namespace),


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
		'synonyms': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?datum ?Synonym ?ExactSynonym ?NarrowSynonym ?AlternativeTerm
			WHERE {  
				{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
				{?datum oboInOwl:hasSynonym ?Synonym.} 
				UNION {?datum oboInOwl:hasExactSynonym ?ExactSynonym.}
				UNION {?datum oboInOwl:hasNarrowSynonym ?NarrowSynonym.}
				UNION {?datum IAO:0000118 ?AlternativeTerm.}
			}
		""", initNs = namespace),


		#Get ontology metadata. Currently the listed annotations are included.
	    #<owl:Ontology rdf:about="http://purl.obolibrary.org/obo/genepio.owl">
	    #
	    #    <owl:versionIRI rdf:resource="http://purl.obolibrary.org/obo/genepio/releases/2018-02-28/genepio.owl"/>
	    #   <oboInOwl:default-namespace rdf:datatype="http://www.w3.org/2001/XMLSchema#string">GENEPIO</oboInOwl:default-namespace>
	    #    <dc:title xml:lang="en">Genomic Epidemiology Ontology</dc:title>
	    #    <dc:description xml:lang="en">The Ontology for Biomedical Investigations (OBI) is build in a ...</dc:description>
	    #    <dc:license rdf:resource="http://creativecommons.org/licenses/by/3.0/"/>
	    #    <dc:date rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2018-02-28</dc:date>

	    #owl:Ontology rdf:about ?resource.
        'metadata': rdflib.plugins.sparql.prepareQuery("""
			SELECT distinct ?resource ?title ?description ?versionIRI ?prefix ?license ?date 
			WHERE {
				
				OPTIONAL {?resource dc:title ?title.}
				OPTIONAL {?resource dc:description ?description.}
				OPTIONAL {?resource owl:versionIRI ?versionIRI.}
				OPTIONAL {?resource oboInOwl:default-namespace ?prefix.}
				OPTIONAL {?resource dc:license ?license.}
				OPTIONAL {?resource dc:date ?date.}
			}

        """, initNs = namespace)

}

if __name__ == '__main__':

	genepio = Ontology()
	genepio.__main__()  # "../genepio.owl"

