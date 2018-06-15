
function getdataSpecification(report_type) {
	/* 
	In portal.html this is called each time a dataSpecification is loaded, 
	and also when a	new specificationType is selected.

	FUTURE: resource.metadata needs to be tailored to only what is in returned spec?
	FUTURE: units array will be ordered so that favoured (default) unit is first.

	INPUT
	report_type: 	Desired report type, see below; also supplied by 
					#specificationType select
	top.focusEntityId: The current entity being focused on, looked up in
                       top.resource.specifications components: specification, picklists and units 
    OUTPUT
    content:		textual representation.
    report_type:	As above
    id:				top.focusEntityId

    #spec_download button activated if present.
	*/

	if (report_type) {
		var content = ''

		var entityId = top.focusEntityId

		// For now, specification only returns first, all encompassing item
		if (entityId.indexOf('/') > 0) {
			var path = entityId.split('/')
			entityId = path[0] // last item: path.length-1
		}

		$("#helpDataSpecification").remove()

		switch (report_type) {

			// These are flat formats, i.e. each ontology element is in a top-level
			// specification dictionary.
			case 'raw.json':
				content = JSON.stringify(getEntitySpecRoot(entityId), null, 2)
				break; 
			case 'raw.yml':
				content = jsyaml.dump(getEntitySpecRoot(entityId), 4)  //indent of 4
				break;
			
			// Provides only the @context JSON-LD RDF prefix list pertinent to given entity 
			case 'context.json':
				content = JSON.stringify(getEntitySpecContext(entityId), null, 2)
				break; 

			// FUTURE: These two could have all entity.path removed, as all info
			// is already in entity.domID
			case 'form.json':
				content = JSON.stringify(getFormSpecification(entityId), null, 2)
				break; 
			case 'form.yml':
				content = jsyaml.dump(getFormSpecification(entityId), 4) //indent of 4
				break; 

			case 'form_all_nodes.tsv': // for all nodes
				content = getTabularSpecification(getFormSpecification(entityId), true, true)
				break; 
			case 'form_all_edges.tsv': //for all edges
				content = getTabularSpecification(getFormSpecification(entityId), false, true) 
				break; 
			// "Core" version strips off all categorical choice nodes & edges
			case 'form_core_nodes.tsv': // for core nodes
				content = getTabularSpecification(getFormSpecification(entityId), true, false)
				break; 
			case 'form_core_edges.tsv': //for core edges
				content = getTabularSpecification(getFormSpecification(entityId), false, false)
				break;

			case 'form.html':
				content = render(entityId);
				break

			case 'form_submission.json':
				// Provides a json structure of field identifiers and values that user has entered.
				content = getFormData('form#mainForm')
				break

			case 'redcap.tsv':
				// https://labkey.med.ualberta.ca/labkey/wiki/REDCap%20Support/page.view?name=crftemp
			case 'ontofox.txt':
			case 'sql.txt':

			// Future formats:
			// https://github.com/geneontology/obographs/
			// https://www.ebi.ac.uk/ols/docs/api#resources-terms ???

				content = '<strong>This feature is coming soon!</strong>'
				break; 
		}

		if (content.length > 0) // If something to download, activate download button
			$("#spec_download").removeClass('disabled').removeAttr('disabled')
		else 
			$("#spec_download").addClass('disabled').attr('disabled','disabled')

		return {
			'id': top.focusEntityId,
			'report_type': report_type,
			'content': content
		} 
	}

	return null

}


function getTabularSpecification(userSpecification, nodesFlag = true, choices = true) {
	/*
	Using recursive form hierarchy.
	Converts given flat table object of ontology entities, including each
	item's links to components, models, and choices.

	ISSUE: NEED TO DISTINGUISH ITEMS BY PATH BECAUSE EACH NODE MAY DIFFER, BECAUSE OF PATH FEATURES
	e.g. two "Organism" lists, but one has certain items filtered 
	or, e.g. minCardinality and maxCardinality differ on lists of same entity.

	FUTURE: 3rd table for language lookup?

	Other possible node headers :depth, disabled, hasDbXref=[], features={}, fractionDigits, totalDigits, whiteSpace, enumeration

	*/

	var nodeHeader = ['datatype', 'path', 'id', 'uiLabel', 'uiDefinition', 'help', 'minValue', 'maxValue', 'minLength', 'maxLength', 'pattern', 'format', 'preferred_unit']
	var edgeHeader = ['relation', 'path', 'child_id', 'minCardinality', 'maxCardinality']

	var nodes = []
	var edges = []

	if (choices == true) // Add search of choices table.
		var parts = ['component', 'unit', 'choice']
	else
		var parts = ['component', 'unit']

	for (var ontology_id in userSpecification.specifications) { 
		// So far just 1 specification id should be provided
		var stack = [userSpecification.specifications[ontology_id]] // Starts with reference to root node.
		var done = {}

		while (stack.length) {
			var entity = stack.shift()
			if ('path' in entity)  {
				var pathString = entity.path.join('')
				if (! (pathString in done) ) {
					// FUTURE: Verify that done[] is needed. How would duplicates show up?
					done[pathString] = true

					var full_path = '/' + entity.path.slice(1,-1).join('/')

					// We skip the disjunction (anonymous) nodes for now 
					// but their components are pursued via parts loop below
					// No logic at moment to enforce cardinality restrictions
					if (entity.datatype == 'disjunction') {
					}
					else {
						// Convey path hierarchy to entity.
						var parent_path = '/' + entity.path.slice(1,-1).join('/') 

						var record = []
						for (var fieldptr in nodeHeader) {
							var field = nodeHeader[fieldptr]

							var value = getTextField(entity, field)
							// ADD datatype for choice
							if (field == 'datatype' && value == '') //obsolete?
								value = 'xmls:anyURI'
							else if (field == 'path') {
								// How else to tell if parent is NOT anonymous node?
								if ('parent' in entity && entity['parent'].indexOf(':') > 0 ) 
									value = '/' + entity.path.slice(1,-2).join('/') 
								else
									value = parent_path
							}
							record.push(value)
						}
						nodes.push(record)		

					}

					var pointer = 0
					// Add to parts table 
					// 'component', 'choice', 'unit' are displayed as link type (rather than plural)
					for (var ptr in parts) { 
						var table = parts[ptr] + 's'
						if (table in entity) {

							for (var ptr2 in entity[table]) { // ARRAY OF OBJECT
								var item = entity[table][ptr2] // This should always be an object 
								var minCardinality = ('minCardinality' in item) ? item['minCardinality'] : ''
								var maxCardinality = ('maxCardinality' in item) ? item['maxCardinality'] : ''
								edges.push([parts[ptr], full_path, item['id'], minCardinality, maxCardinality])

								// Insert this component or choice or unit into stack at beginning. 
								// This maintains visual order to support form rendering.
								stack.splice(pointer, 0, item)
								pointer ++
							}
						}
					}
				}
			}
		}
	}

	// On hold: Sort all items by datatype, then label. Issue is then sorting of field order is lost.
	//nodes.sort(function (a, b) {return a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]) }) // datatype, label

	// Then make header to 1st line
	nodes.splice(0, 0, nodeHeader); 

	// On hold, as above.
	//edges.sort(function (a, b) {return a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) }) // 0=id, 1=relation
	// Then make header to 1st line
	edges.splice(0, 0, edgeHeader); 

	return getTabularTable(nodesFlag ? nodes : edges)
}


function getTextField (obj, field) {
	var text = obj[field]
	if (text)
		// convert numbers to text, and clean up carriage returns and tabs.
		text = ('' + text).replace('\n',' ').replace('\t',' ') 
	else 
		text = ''
	return text
}


function getTabularTable(dataArray) {
	// Convert given array to tabular text.
	var data = ''
	for (ptr in dataArray) {
		data +=	dataArray[ptr].join('\t') + '\n'
	}

	return data
}


function getEntitySpecRoot(entityId = null) {

	// Return only entityId specification from resource.specifications
	if (entityId) {
		spec = getEntitySpec(null, entityId)
		return {
			'@context': getEntitySpecContext(spec),
			'specifications': spec,
			'metadata': top.resource.metadata // Inherited from resource
		 }
	}
	// Return everything in top.resource - @context, specifications, and metadata
 	return top.resource
}

function getEntitySpecContext(entity_dict = null) {
	/* A GEEM resource file has all the @context prefixes required for 
	identifiers in its specifications
	    "@context": {
	        "DOID": "http://purl.obolibrary.org/obo/DOID_",
	        "owl": "http://www.w3.org/2002/07/owl/",
	        "EO": "http://purl.obolibrary.org/obo/EO_",
	        "ancestro": "http://www.ebi.ac.uk/ancestro/ancestro_",
	        ...

	Check entity_dict content to make a new @context dictionary subset for it.
	    Check id, datatype,
	    array: member_of, units, otherParent
	    dict: , components, models, choices
		*/

	if (entity_dict) {
		var context = {'owl':'http://www.w3.org/2002/07/owl/'} // 'owl:' shows up in cardinality statements
		var resContext = top.resource['@context']
		// Cycle through content, adding all pertinent prefixes.
		for (var entity_id in entity_dict) {
			var entity = entity_dict[entity_id]
			setContext(entity_id, context, resContext)
			if (entity.datatype && entity.datatype.indexOf(':') > 0) // e.g. xsd:string 
				setContext(entity.datatype, context, resContext)

			if ('components' in entity) 
				for (entity_id in entity.components) setContext(entity_id, context, resContext) 
			if ('models' in entity) 
				for (entity_id in entity.models) setContext(entity_id, context, resContext)
			if ('choices' in entity) 
				for (entity_id in entity.models) setContext(entity_id, context, resContext)
			if ('member_of' in entity) 
				for (ptr in entity.member_of) setContext(entity.member_of[ptr], context, resContext)
			if ('units' in entity) 
				for (ptr in entity.units) setContext(entity.units[ptr], context, resContext)
			if ('otherParent' in entity) 
				for (ptr in entity.otherParent) setContext(entity.otherParent[ptr], context, resContext)
		}

		return context
	}

	return top.resource['@context']
}

function setContext(ref, context, resContext) {
	// If context doesn't have prefix, add it.

	if (ref && ref.indexOf(':') > 0) {
		var prefix = ref.split(':')[0]

		if (! (prefix in context))
			context[prefix] = resContext[prefix]
	}
	else
		console.log('No prefix for: ', ref) 
}

function getEntitySpec(spec, entityId = null, inherited = false) {
	/* Recursively copy the entityId specification element and all its
	   underlings into a a single javascript object. This differs from
	   getFormSpecification() in that entities are copied verbatim from
	   top.resource.specifications, and via reference, so no branch-specific
	   processing goes on.
	*/
	if (spec == null)
		spec = {}

	if (entityId in top.resource.specifications) {
		var entity = top.resource.specifications[entityId]
		if (entity) {
			spec[entityId] = entity // reference entity directly - flat list
			
			/* NOT CURRENTLY CALLED
			if (inherited == true) {
				// Entity inherits primary ancestors' parts (the ones that led
				// from start of rendering to here). 
				var parentId = entity['parent']
				// Reach up to top level OBI "data representation model"
				if (parentId && parentId != 'OBI:0000658') 
					getEntitySpec(spec, parentId, true)
			}
			*/

			getEntitySpecItems(spec, entity, 'components')
			getEntitySpecItems(spec, entity, 'models') 
			getEntitySpecItems(spec, entity, 'units')
			getEntitySpecItems(spec, entity, 'choices')
		}
	}

	return spec
}

function getEntitySpecItems(spec, entity, type) {
	/*
	FUTURE: units array will be ordered so that favoured unit is first.
	Currently entity's preferred_unit field indicates preference.
	*/
	if (type in entity) {
		if (type == 'units')
			// units is an array; 
			for (var ptr in entity['units']) { 
				var partId = entity[type][ptr]
				spec[partId] = top.resource.specifications[partId] // load object
				getEntitySpec(spec, partId) // sub-units?
			}
		else
			// models, components, choices, which are dictionaries
			for (var partId in entity[type]) { 
				spec[partId] = top.resource.specifications[partId] // load object
				getEntitySpec(spec, partId)
			} 
	}
}


/*********************** FORM SPECIFICATION BUILD **********************/

getFormSpecification = function(entityId) {
	/*
	This is a simplified JSON-LD structure much like OntologyForm.render(),
	this returns just the form specification object as it is "unwound" 
	from pure JSON specification. At the top level it is an array of form
	elements. The first element is the form item itself, and it contains 
	a components [] array, a choices [] array and a units [] array.
	Each item in these arrays are copies of the top.resource.specifications object,
	trimmed down.

	The complexity occurs in that some form elements may inherit components
	from their superclass entities.  These are inserted	onto beginning of
	"components" array.
	
	FUTURE: Have form driven from output of this function.

	INPUT
		entityId : entity id to build out hierarchic specification from
	OUTPUT
		specification: javascript object containing all form elements and JSON-LD @context
	*/
	var rootSpecification = {
		'@context': self.context,
		'specifications': {[entityId]: getFormSpecificationComponent(entityId) }
	}
	return rootSpecification
}

getFormSpecificationComponent = function(entityId, path = [], depth = 0) { //, inherited = false
	/*
	Modelled closely on OntologyForm.render(), this returns just the form 
	specification object as it is "unwound" from pure JSON specification.
	
	See https://www.w3.org/TR/2005/WD-swbp-xsch-datatypes-20050427/ 
	about XML/RDF/OWL numeric representation.

	INPUT
		entityId : entity id to build out hierarchic specification from
		specification : initially empty array containing ordered form elements.
	OUTPUT
		specification: javascript object containing all form elements.
		entity.path : path style indication of how far down in hierarchy
			the given entity is.
	*/
	if (entityId === false) {
		return {} //specification // Nothing selected yet.
	}

	console.log("Get Form Component Specification: ", path.join('/')+'/'+entityId, ' depth:', depth)

	if (depth > 20) {
		console.log ("Node: ", entityId, " loop went AWOL while rendering path", path )
		return {} //specification
	}

	if (! (entityId in top.resource.specifications)) {
		console.log("Node: " + entityId + " has no specification entry.")
		return {} //specification
	}

	// deepcopy specification entity so we can change it.
	var entity = $.extend(true, {}, top.resource.specifications[entityId]) 

	initializeEntity(entity, entityId, path, depth)

	switch (entity['datatype']) {
		case undefined:

			console.log('This specification component needs a "value specification" so that it can be rendered: "' + entity['uiLabel'] + '" (' + entityId + ')')

		case 'disjunction':
			// CURRENTLY WE JUST LUMP 'disjunction' IN WITH 'model'
			// Assumption is that each disjunction element is not itself marked required.
			// ISSUE: having a required status on a group of items is tricky.

		case 'model':
			// If X is_a+ (subclass of) 'data representational model' it is a model.
			// If this model has parent_id, 

			// Catch is situation where M has component N, where N is a model that 
			// inherits components from an is_a ancestor. Travel up the tree,
			// incorporating ALL 'has component' Z items.
			entity.components = getEntitySpecFormParts(entity, depth)
			break;

		/* PRIMITIVE data types 
		Inputs as sepecified in an OWL Ontology file can have all the standard xmls data types and restrictions.
		Potentially create ZURB Foundation fields: text, date, datetime, datetime-local, email, month, number, password, search, tel, time, url, and week
		*/

		/*
		DATE DATATYPES: date dateTime duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
		*/
		case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
		case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
		case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
		case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.
		case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)

		// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
		case 'xmls:string':
		case 'xmls:normalizedString':
		case 'xmls:token':
			getEntitySpecFormUnits(entity)
			break;
																						
		case 'xmls:integer':			getEntitySpecFormNumber(entity);	break
		case 'xmls:positiveInteger': 	getEntitySpecFormNumber(entity, 1);	break
		case 'xmls:nonNegativeInteger':	getEntitySpecFormNumber(entity, 0);	break
		case 'xmls:unsignedByte':		getEntitySpecFormNumber(entity, 0, 255); break// (8-bit)	
		case 'xmls:unsignedShort':		getEntitySpecFormNumber(entity, 0, 65535); break// (16-bit) 
		case 'xmls:unsignedInt':		getEntitySpecFormNumber(entity, 0, 4294967295);	break// (32-bit)		
		case 'xmls:unsignedLong':		getEntitySpecFormNumber(entity, 0, 18446744073709551615); break// (64-bit) 

		case 'xmls:negativeInteger':	getEntitySpecFormNumber(entity, null, -1); break
		case 'xmls:nonPositiveInteger':	getEntitySpecFormNumber(entity, null, 0); break

		case 'xmls:byte': 	getEntitySpecFormNumber(entity, -128, 127);	break// (signed 8-bit)
		case 'xmls:short': 	getEntitySpecFormNumber(entity, -32768, 32767);	break// (signed 16-bit)
		case 'xmls:int': 	getEntitySpecFormNumber(entity, -2147483648, 2147483647);	break// (signed 32-bit)
		case 'xmls:long': 	getEntitySpecFormNumber(entity, -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

		// Decimal, double and float numbers
		case 'xmls:decimal':
		 	getEntitySpecFormNumber(entity)
		 	// Add maximum # of digits.
			break;
		// Size of float/double depends on precision sought, see
		// https://stackoverflow.com/questions/872544/what-range-of-numbers-can-be-represented-in-a-16-32-and-64-bit-ieee-754-syste
		case 'xmls:float':  
			getEntitySpecFormNumber(entity, - Math.pow(2, 23), Math.pow(2, 23) - 1 )

			break;
		case 'xmls:double': 
			getEntitySpecFormNumber(entity, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
			break;


		case 'xmls:boolean': // Yes/No inputs here
			//getEntitySpecFormBoolean(entity)
			break;

		case 'xmls:anyURI': // Picklists are here
			if (entityId in top.resource.specifications) {
				getEntitySpecFormChoices(entity)
			}
			else
				console.log('ERROR: Categorical variable [', entityId, '] not marked as a "Categorical tree specification"')
			break;

		default:
			console.log('UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']' + entity['uiLabel']  )
			break;
	}

	// Various fields that flat ontology has that simplified JSON or YAML form view don't need.
	return getEntitySimplification(entity)
}




initializeEntity = function(entity, entityId, path, depth) {
	// Initialize entity
	entity['depth'] = depth

	// Created entity takes on whatever parent involks it.
	if (depth > 0) {
		entity['parent'] = path[path.length - 1]
		//console.log('Assigning parent', entity['parent'], ' to ', entityId )
	}

	entity.path = path.concat([entityId])
	// Create a unique domId out of all the levels 
	entity.domId = entity.path.join('/')

	getEntityFeatures(entity) // Guarantees that entity.features exists

	// These may depend on above features fetch.
	entity['uiLabel'] = getLabel(entity)
	entity['uiDefinition'] = getDefinition(entity)

	if (entity.features.help)
		entity['help'] = entity.features.help.value

	// Future: do only with some kinds of datatype
	if (entity.features.preferred_unit) 
		entity['preferred_unit'] = entity.features.preferred_unit.value

	setEntityConstraints(entity)

	if (entity['depth'] > 0) {
		// When this entity is displayed within context of parent entity, that entity will 
		// indicate how many of this part are allowed.
		getEntityCardinality(entity)
	}

	entity.disabled = ''
}


getEntityFeatures = function(entity, parentId = null) {
	/* 
	An instance of a form field that has entity.features should have those
	enhanced by parent's route to this entity. But if entity doesn't have This is getting features ONLY
	with respect to immediate parent.

	OUTPUT
		entity.features
	*/
	if (parentId)
		var referrerId = parentId
	else
		var referrerId = entity['parent']

	var referrer = top.resource.specifications[referrerId]

	if (!referrer) {
		console.log("ERROR: can't find entity ", referrerId, " to get feature for." ); 

		entity.features = {}
		return false
	}
	
	var myFeatures = {}
	for (var myList in {'models':null, 'components':null}) {
		if (myList in referrer) {
			var piecesArray = referrer[myList][entity.id]
			if (piecesArray) {
				for (var ptr in piecesArray) {
					var myobj = piecesArray[ptr]
					if ('feature' in myobj) {
						myFeatures[myobj['feature']] = $.extend({}, myobj)
					}
				}
			}
		}
	}
	// Will this OVERRIDE dictionary items?
	if ('features' in entity) 
		$.extend(entity.features, myFeatures)
	else
		entity.features = myFeatures
}

/*
	getFeature = function(entity, feature, referrerId=undefined) {
		// A feature exists in either entity.features or 
		entity.components[referrerId] or entity['models'][referrerId]

		if (referrerId) {

			var referrer = top.resource.specifications[referrerId]
			var parts = ['models', 'components']
			if (referrer) {
				for (ptr in parts) {
					var myList = parts[ptr]
					if (myList in referrer) {
						var pieceArray = referrer[myList][entity.id]
						if (pieceArray) {
							for (var ptr in pieceArray) {
								if ('feature' in pieceArray[ptr] && pieceArray[ptr]['feature'] == feature) {
									return pieceArray[ptr]
								}
							}
						}
					}
				}
			}

			return false
		}
		else if ('features' in entity && feature in entity.features) 
			return entity.features[feature]

	}
*/



setEntityConstraints = function(entity) {
	/* 
	Adds axiom bracketed expressions of the form:
		
		'has primitive data type' exactly 1 xsd:decimal[>= -90.0 , <= 90.0,
			 totalDigits 8, fractionDigits 6]

		'has primitive data type' exactly 1 xsd:string[length 6]

	directly into entity in form [constraint without the xmls: part]:value

	Each constraints array item has "constraint", "datatype", and "value" 
	key value pairs.

	See https://books.google.ca/books?isbn=1118080602 for OWL/XML items below.

	OUTPUT
		entity[minInclusive]
		a key-value dictionary.
	*/
	if (entity.constraints && entity.constraints.length) {
		var constraints = entity.constraints
		for (var ptr in constraints) {
			var constraint = constraints[ptr].constraint
			var field = constraint.split(':')[1]
			var value = constraints[ptr].value
			switch (constraint) {
				// Numeric
				case 'xmls:minInclusive':
					entity.minValue = value
					break;
				case 'xmls:maxInclusive':
					entity.maxValue = value
					break;					

				// These are converted into minInclusive/maxInclusive already in jsonimo.py
				//case 'xmls:minExclusive' 
				//case 'xmls:maxExclusive'

				case 'xmls:fractionDigits':
				case 'xmls:totalDigits':

				case 'xmls:length': // exact length
				case 'xmls:minLength': 
				case 'xmls:maxLength': 
					entity[field] = parseInt(value)
					break;

				// String
				case 'xmls:pattern': //reg. exp. for string or number.  
				case 'xmls:whiteSpace': // preserve|collapse|replace
				case 'xmls:enumeration': //an allowed value.
					entity[field] = value
					break;		
				default:
					break;
			}
		}
	}
}

getEntityCardinality = function(entity) {
	/* Here we're given an entity with respect to some parent entity.  The 
	parent has a cardinality qualifier relation between the two that indicates
	how	many of	that entity can exist in it's parent entity's data structure
	and by extension, on a form that comprehensively describes the given 
	entity.	This constraint also contributes to the "required" flag for the 
	given entity.

	NOTE: limits on the data range of numeric or date values is handled 
	separately in the constraints functions above.

	EXPLANATION
	In OWL/Protege it is often stated that entity A has relation B to entity C,

		e.g.: h-antigen 'has primitive value spec' some 'xsd:string'
		
	The term "some" above is equivalent to the cardinality "min 1" aka "minQualifiedCardinality 1" 
	or in plain english, "1 or more", which is ok in many logic scenarios as it
	enforces the existence of at least one example.  The cardinality of "some" in
	a user interface would on the face of it allow the user to add more than one 
	of a particular item which is fine for things like multiple phone number and 
	alternate email datums.

	However, if we're looking for one and only one datum of a certain type in an 
	entity data structure, we actually need to say that entity A has exactly 
	"owl:qualifiedCardinality 1" aka "exactly 1" of entity B, no less and no more.  

	INPUT 
		entity: the form element being rendered
		referrerId: id of parent of entity (an entity may have more than one parent)
	
	OUTPUT
		entity.minCardinality
		entity.maxCardinality
	*/
	var referrerId = entity.path.slice(-2)[0]
	var constraints = []
	var id = entity.id
	var referrer = top.resource.specifications[referrerId]
	if (referrer.components) {
		// Find given entity in parent (referrer) list of parts
		for (var cptr in referrer.components[id]) {

			// Each part will have a cardinality constraint:
			var condition = referrer.components[id][cptr]

			// Condition's 'value' attribute indicates cardinality exact|lower|upper range.

			var limit = 'value' in condition ? parseInt(condition.value) : 1
			switch (condition.cardinality) {
				case 'owl:someValuesFrom': // >= 1 of ...
					entity.minCardinality = 1
					break 
				case 'owl:qualifiedCardinality': // exactly N ...
					entity.minCardinality = limit
					entity.maxCardinality = limit
					break 
				case 'owl:minQualifiedCardinality': // max N ...
					entity.minCardinality = limit
					break
				case 'owl:maxQualifiedCardinality': // min N ...
					entity.maxCardinality = limit
					break 
				default:
			}
		}
	}
}


getEntitySimplification = function(entity) {
	/* Simple view of specification dispenses with cross-references and 
	other aspects that have already been digested.
	*/
	delete (entity.parent)
	delete (entity.otherParent)
	delete (entity.models)
	delete (entity.member_of)
	delete (entity.constraints)
	if ($.isEmptyObject(entity.choices))
		delete (entity.choices)

	// This is a CHEAT: moves uiLabel to first param in object for display purposes
	var freshEntity = {'uiLabel': entity['uiLabel']}
	return $.extend(true, freshEntity, entity) 
}

getEntitySpecFormParts = function(entity, depth) { //, inherited = false
	/*
	Convert given "specification" entity's "parts" list into a list of 
	processed entities.
	INPUT
		inherited: UNUSED
		depth: integer, used to track number of parent components.
	*/
	var components = []
	for (var entityId in entity.components ) { 
		components.push( this.getFormSpecificationComponent(entityId, entity.path, depth + 1) )
	}

	return components
}

getEntitySpecFormNumber = function(entity, minInclusive=undefined, maxInclusive=undefined) {
	getEntitySpecFormUnits(entity)
}

getEntitySpecFormUnits = function(entity) {
	// Convert units array id references into reference to unit object
	// itself.  Maintains order, and info like default unit.

	if ('units' in entity) {
		unitsArray = []
		var units = entity['units']
		for (var ptr in units) {
			// Make deep copy of unit
			unitsArray.push( $.extend(true, {path:entity.path}, top.resource.specifications[units[ptr]] ) )
		}
		entity['units'] = unitsArray
   	}
   	
}


getEntitySpecFormChoices = function(entity) {
	/* 
	REPLACE entity.choices dictionary with ARRAY of choices.

	Select, radio, checkbox all get the same data structure. Here we
	know that all subordinate "subClassOf" parts are picklist choice
	items, which at most have feature annotations.

	ISSUE: Should this pay attention to cut depth?

	OUTPUT
		entity.lookup if appropriate
		entity.multiple if appropriate
	*/
	if (entity.features.lookup) 
		entity['lookup'] = true
	
	if (entity.minCardinality > 1 || (entity.maxCardinality != 1))
		entity['multiple'] = true

	getEntitySpecFormChoice(entity)
	// entity.choices is now an array.
	
	// An entity might only have components:
	if ('components' in entity) {
		if ('choices' in entity) {} 
		else entity.choices = []

		// The datatype of entity is xmls:anyURI, but if it has components, they will still
		// be as key-value of ontology_id-entity
		for (var ontoID in entity.components) {
			// In path we silently skip name of component.
			var part = $.extend(true, {path:entity.path}, top.resource.specifications[ontoID]) //deepcopy
			 
			entity.choices.push( getEntitySpecFormChoice(part) )				
		}
	}
	
}

getEntitySpecFormChoice = function(entity, depth = 0) { 
	/* Convert entity.choices{dictionary} into entity.choices[array]

	OUTPUT
		part['disabled'] if appropriate.  Indicates whether a certain 
		categorical selection should be ignored or hidden.
	*/
	if (depth > 20) // NCBI Taxon might go this deep?
		console.log("MAX DEPTH PROBLEM WITH " + entity.id)

	if ('choices' in entity) {
		var newChoices = [] // Array to preserve order
		for (var choiceId in entity.choices) {
			var part_path = entity.path.concat([choiceId])
			var part = $.extend(true, {'path' : part_path }, top.resource.specifications[choiceId]) //deepcopy
			if (!part) // Should never happen.
				console.log("Error: picklist choice not available: ", choiceId, " for list ", entity.id)
			else {

				// TESTING: Trim all definitions to first sentence
				if ('definition' in part && part['definition'].indexOf('.') > 0) {
					part['definition'] = part['definition'].split('.',1)[0] + '.'
				}

				part['disabled'] = '';

				newChoices.push(getEntitySpecFormChoice(part , depth+1))
			}
		}
		// Convert entity.choices{} to array.
		entity.choices = newChoices
	}

	getEntitySimplification(entity)
	return entity
}


function getFormData(domId) {
	/* The hierarchic form data is converted into minimal JSON data 
	   packet for transmission back to server.

	   OUTPUT
	   	json string representation of html input and select values,
	   	organized by hierarchy of ontology ids as they appear in 
	   	input id attribute (separated by forward slashes)
	*/
	var obj = {}

	$.each($(domId).find("input:not(.button), select"), function(i,item) {
		var focus = obj
		var id = $(item).attr('id')
		if (id) {
			var path = id.split('/')
			for (var ptr in path) {
				var item2 = path[ptr]
				if (!(item2 in focus) ) 
					focus[item2] = {}
				if (ptr == path.length-1) //If at end of path, make assignment
					focus[item2] = $(item).val()
				else
					focus = focus[item2]
			}
		}
	})

	return JSON.stringify(obj, null, 2)

}

function openModal(header, content) {
	/* This displays given string content and header in popup. 
	Usually called by getChoices()
	*/
	$("#modalEntityHeaderContent").html(header).show()
	$("#modalEntityContentContainer").html(content)
	$("#spec_download").hide() // hide download button.
	$("#modalEntity").foundation('open')
}



function setModalDownload(contentObj) {
	/* Used on form.html to download stuff.
	*/
	$("#modalEntityHeaderContent").hide()
	var contentPre = '<pre id="modalEntityContent">' + contentObj.content + '</pre>'
	$("#modalEntityContentContainer").empty().html(contentPre)
	$("#modalEntity").foundation('open')
	$("#spec_download")
    	.off()
    	.on('click', function() { downloadDataSpecification(contentObj) })
    	.show()
}

function setDataSpecification(contentObj) {
	// Used on portal.html page, not as popup.
	$('#dataSpecification').removeClass('hide').show().html(contentObj.content) 
	$("#spec_download")
    	.off()
    	.on('click', function() { downloadDataSpecification(contentObj) })
		.removeAttr('disabled').removeClass('disabled')
}


function downloadDataSpecification(contentObj) {
	/* This creates dynamic file download link for a given ontology entity. 
	File generated from contentObj contents directly.
	It fires when user clicks download button (#spec_download) of 
	specification, immediately before file is downloaded.

	INPUT
		contentObj
			.content 		Textual content to download	 
			.report_type	a file name suffix string formatted as "[file suffix].[file type]"
			.id				ontology term/form identifier.

	OUTPUT
	Download file link has attributes:
		download = [ontology_id]_[file suffix].[file type]
		href = base 64 encoding of contentObj.content
	*/
	if (contentObj.content.length) {

		// File name is main ontology id component + file suffix.
		var file_name = (contentObj.id).replace(':','_') + '_' + contentObj.report_type  
		var content = new Blob([ contentObj.content ], { type: 'text/csv' });

		$("#view_spec_download")
			.attr('download', file_name)
			.attr('href', URL.createObjectURL(content) )
			
		$("#view_spec_download")[0].click() // trigger download
	}
}





		/*
		if (inherited == false && 'parent' in entity) { // aka member_of or subclass of
			var parentId = entity['parent']
			if (parentId != 'OBI:0000658') {//Top level spec.
				var parent = top.resource.specifications[parentId]
				if (!parent) console.log("MISSING:", parentId)
				if ('datatype' in parent && parent['datatype'] == 'model' && 'components' in parent) {
					for (componentId in parent['components']) {
						if (entity.id != componentId)
							html += this.render(componentId, entity.path, depth+1)
					}		
				}
			}
		}	
		*/

		/*
		// Here we go up the hierarchy to capture all inherited superclass 'has component' components.
		// Will venture upward as long as each ancestor is a model and 'has component' X.
		if ('parent' in entity) {
			var parentId = entity['parent']
			if (parentId != 'OBI:0000658') {//Top level spec.
				var parent = top.resource.specifications[parentId]
				if (!parent) console.log("MISSING:", parentId)

				if (parent && parent['datatype'] == 'model' && 'components' in parent) {
					for (componentId in parent['components']) {
						if (entity.id != componentId) {
							var component = top.resource.specifications[componentId]
							// "true" prevents a parent's other is_a subclass models from being pursued.
							//components.push ( this.getEntitySpecFormParts(component, depth + 1, true) )
							components.push( this.getFormSpecificationComponent(componentId, entity.path, depth + 1) )
						}
					}	
				}
			}
		}
		*/

