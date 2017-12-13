
function getdataSpecification(report_type) {
	/* 
	In portal.html this is called each time a dataSpecification is loaded, 
	and also when a	new specificationType is selected.

	INPUT
	report_type: 	Desired report type, see below; also supplied by 
					#specificationType select
	top.focusEntityId: The current entity being focused on, looked up in
                       top.specification components: specification, picklists and units 
    OUTPUT
    content:		textual representation.
    report_type:	As above
    id:				top.focusEntityId

    #spec_download button activated if present.
	*/

	if (report_type) {
		var content = ''
		var entityId = top.focusEntityId
		$("#helpDataSpecification").remove()

		switch (report_type) {
			case 'raw.json':
				content = JSON.stringify(getEntitySpecRoot(entityId), null, 2)
				break; 
			case 'raw.yml':
				content = jsyaml.dump(getEntitySpecRoot(entityId), 4)  //indent of 4
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
			// "Core" version strips off all choice nodes & edges
			case 'form_core_nodes.tsv': // for core nodes
				content = getTabularSpecification(getEntitySpecForm(entityId), true, false)
				break; 
			case 'form_core_edges.tsv': //for core edges
				content = getTabularSpecification(getEntitySpecForm(entityId), false, false)
				break;

			case 'form.html':
				content = $('form#mainForm')[0].outerHTML
				break
			case 'form_submission.json':
				content = getFormData('form#mainForm')
				break

			case 'spreadsheet.xlsm':
			case 'redcap.tsv':
				// https://labkey.med.ualberta.ca/labkey/wiki/REDCap%20Support/page.view?name=crftemp
			case 'ontofox.txt':
			case 'sql.txt':
			// Future formats:
			// https://github.com/geneontology/obographs/
			// https://www.ebi.ac.uk/ols/docs/api#resources-terms ???
				alert('Coming soon!')
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

	ISSUE: NEED TO DISTINGUISH ITEMS BY PATH BECAUSE EACH NODE MAY DIFFER
	BECAUSE OF PATH FEATURES
	minCardinality and maxCardinality

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

	for (var ontology_id in userSpecification.specifications) { //So far just 1
		// specification should be
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

						var parent_path = '/' + entity['path'].slice(1,-1).join('/') // conveys hierarchy

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

								// Maintains visual order like form rendering:
								stack.splice(pointer, 0, item)
								pointer ++
							}
						}
					}
				}
			}
		}
	}

	// Sort all items by datatype, then label
	//nodes.sort(function (a, b) {return a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]) }) // datatype, label
	// Then make header to 1st line
	nodes.splice(0, 0, nodeHeader); 

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
	// Adds context to given entityId specification
	var rootSpecification = {
		'@context': top.context,
		'specifications': getEntitySpec(null, entityId)
	 }
	return rootSpecification
}

function getEntitySpec(spec, entityId = null, inherited = false) {
	/* Recursively copy the entityId specification element and all its
	   underlings into a a single javascript object. This differs from
	   getEntitySpecForm() in that entities are copied verbatim from
	   top.specification, and via reference, so no branch-specific
	   processing goes on.
	*/
	if (spec == null)
		spec = {}

	if (entityId in top.specification) {
		var entity = top.specification[entityId]
		if (entity) {
			spec[entityId] = entity // reference entity directly.
			
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
				spec[partId] = top.specification[partId] // load object
				getEntitySpec(spec, partId) // sub-units?
			}
		else
			// models, components, choices, which are dictionaries
			for (var partId in entity[type]) { 
				spec[partId] = top.specification[partId] // load object
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


function setModalCode(contentObj) {
	/* This displays given string content as an indented hierarchy of text 
	inside html <pre> tag.
	*/
	var contentPre = '<pre id="modalEntityContent">' + contentObj.content + '</pre>'
	$("#modalEntityContentContainer").empty().html(contentPre)
	$("#modalEntity").foundation('open')
	$("#spec_download")
		//.removeAttr('disabled').removeClass('disabled')
    	.off()
    	.on('click', function() { downloadDataSpecification(contentObj) })
}

function setDataSpecification(contentObj) {
	$('#dataSpecification').removeClass('hide').show().html(contentObj.content) 
	$("#spec_download")
		.removeAttr('disabled').removeClass('disabled')
    	.off()
    	.on('click', function() { downloadDataSpecification(contentObj) })

}


function downloadDataSpecification(contentObj) {
	/* This creates dynamic file download link for a given ontology entity. 
	File generated from #dataSpecification field contents directly.
	It fires when user clicks download button of specification, immediately 
	before file is downloaded.

	INPUT
		contentObj
			.content 		Textual content to download	 
			.report_type	a file name suffix string including "[file suffix].[file type]"" 
			.id				ontology term/form identifier.

	OUTPUT
	Download file link has attributes:
		download = [ontology_id]_[report_type]
		href = base 64 encoding of #dataSpecification field.
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


