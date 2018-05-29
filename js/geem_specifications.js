
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

			case 'raw.json':
				content = JSON.stringify(getEntitySpecRoot(entityId), null, 2)
				break; 
			case 'raw.yml':
				content = jsyaml.dump(getEntitySpecRoot(entityId), 4)  //indent of 4
				break;
			
			// Provides @context JSON-LD RDF prefix list pertinent to given entity 
			case 'context.json':
				content = JSON.stringify(getEntitySpecContext(entityId), null, 2)
				break; 

			// FEATURE: These two could have all entity.path removed, as all info
			// is already in entity.domID
			case 'form.json':
				content = JSON.stringify(getEntitySpecForm(entityId), null, 2)
				break; 
			case 'form.yml':
				content = jsyaml.dump(getEntitySpecForm(entityId), 4) //indent of 4
				break; 

			case 'form_all_nodes.tsv': // for all nodes
				content = getTabularSpecification(getEntitySpecForm(entityId), true, true)
				break; 
			case 'form_all_edges.tsv': //for all edges
				content = getTabularSpecification(getEntitySpecForm(entityId), false, true) 
				break; 
			// "Core" version strips off all categorical choice nodes & edges
			case 'form_core_nodes.tsv': // for core nodes
				content = getTabularSpecification(getEntitySpecForm(entityId), true, false)
				break; 
			case 'form_core_edges.tsv': //for core edges
				content = getTabularSpecification(getEntitySpecForm(entityId), false, false)
				break;

			case 'form.html':
				content = render(entityId);
				break

			case 'form_submission.json':
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
				var pathString = entity['path'].join('')
				if (! (pathString in done) ) {
					done[pathString] = true

					var full_path = '/' + entity['path'].slice(1,-1).join('/')

					if (entity.datatype == 'disjunction') {
						// We skip the disjunction (anonymous) nodes for now.  
						// No logic at moment to enforce cardinality restrictions



					}
					else {
						// Convey path hierarchy to entity.
						var parent_path = '/' + entity['path'].slice(1,-1).join('/') 

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
									value = '/' + entity['path'].slice(1,-2).join('/') 
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
	   getEntitySpecForm() in that entities are copied verbatim from
	   top.resource.specifications, and via reference, so no branch-specific
	   processing goes on.
	*/
	if (spec == null)
		spec = {}

	if (entityId in top.resource.specifications) {
		var entity = top.resource.specifications[entityId]
		if (entity) {
			spec[entityId] = entity // reference entity directly - flat list
			
			if (inherited == true) {
				// Entity inherits primary ancestors' parts (the ones that led
				// from start of rendering to here). 
				var parentId = entity['parent']
				// Reach up to top level OBI "data representation model"
				if (parentId && parentId != 'OBI:0000658') 
					getEntitySpec(spec, parentId, true)
			}

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



function getFormData(domId) {
	/* The hierarchic form data is converted into minimal JSON data 
	   packet for transmission back to server.
	*/
	var obj = {}

	$.each($(domId).find("input:not(.button), select"), function(i,item) {
		var focus = obj
		var id = $(item).attr('id')
		if (id) {
			var path = id.split('/')
			for (var ptr in path) {
				var item2 = path[ptr]
				if (!(item2 in focus) ) focus[item2] = {}
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


