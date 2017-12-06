
function getdataSpecification() {
	/* 
	This is called each time a dataSpecification is loaded, and also when a
	new specificationType is selected.

	INPUT
	#specificationType <select ...>: tab user just clicked on, or one active when form loaded
	top.focusEntityId: The current entity being focused on, looked up in
                       top.specification components: specification, picklists and units 
    OUTPUT
    - #dataSpecification div loaded with textual representation.
    - #spec_download button activated if present.
	*/

	//var selected_tab = $('#specificationType > li.is-active > a[aria-selected="true"]').attr('aria-controls')
	var selected_tab = $('#specificationType').val()

	if (selected_tab) {
		var content = ''
		$("#helpDataSpecification").remove()

		switch (selected_tab) {
			case 'json_specification':
				content = JSON.stringify(getEntitySpecRoot(top.focusEntityId), null, 2)
				break; 

			case 'yml_specification':
				//content = YAML.stringify(getEntitySpec(null, top.focusEntityId), 4)  characters
				content = jsyaml.dump(getEntitySpecRoot(top.focusEntityId), 4)  //indent of 4
				break;

			case 'json_form_specification':
				content = JSON.stringify(getEntitySpecForm(top.focusEntityId), null, 2)
				break; 
				
			case 'yml_form_specification':
				//content = YAML.stringify(getEntitySpecForm(top.focusEntityId))
				content = jsyaml.dump(getEntitySpecForm(top.focusEntityId), 4) //indent of 4
				break; 
			
			case 'tsv_form_node_specification':
				content = getTabularSpecification(getEntitySpecForm(top.focusEntityId), true) // for all nodes
				break; 

			case 'tsv_form_edge_specification':
				content = getTabularSpecification(getEntitySpecForm(top.focusEntityId), false) //for all edges
				break; 

			// "Core" version strips off all choice nodes & edges
			case 'tsv_form_core_node_specification':
				content = getTabularSpecification(getEntitySpecForm(top.focusEntityId), true, false) // for core nodes
				break; 
			case 'tsv_form_core_edge_specification':
				content = getTabularSpecification(getEntitySpecForm(top.focusEntityId), false, false) //for core edges
				break;

			case 'xlsm_specification':
			case 'redcap_specification':
				// https://labkey.med.ualberta.ca/labkey/wiki/REDCap%20Support/page.view?name=crftemp
			case 'ontofox_specification':
				alert('Coming soon!')
				break; 

			// Future formats:
			// https://github.com/geneontology/obographs/
			// https://www.ebi.ac.uk/ols/docs/api#resources-terms ???
		}

		$("#dataSpecification").text(content).removeClass('hide')

		if (content.length > 0) // If something to download, activate download button
			$("#spec_download").removeClass('disabled').removeAttr('disabled')
		else 
			$("#spec_download").addClass('disabled').attr('disabled','disabled')

		return content 
	}

}


function getTabularSpecification(userSpecification, nodesFlag = true, choices = true) {
	/*
	Using recursive form hierarchy.
	Converts given flat table object of ontology entities, including each
	item's links to components, models, and choices.

	// ISSUE: NEED TO DISTINGUISH ITEMS BY PATH BECAUSE EACH NODE HAS 
	minCardinality and maxCardinality

	FUTURE: 3rd table for language lookup?
	Other possible node headers :depth, disabled, hasDbXref=[], features={}, fractionDigits, totalDigits, whiteSpace, enumeration

	*/

	var nodeHeader = ['id', 'datatype', 'uiLabel', 'definition', 'minValue', 'maxValue', 'minLength', 'maxLength', 'pattern']
	var edgeHeader = ['id', 'relation', 'child_id', 'minCardinality', 'maxCardinality']

	var nodes = []
	var edges = []
	if (choices == true)
		var parts = ['component', 'choice', 'unit']
	else
		var parts = ['component', 'unit']

	var stack = [userSpecification] // Starts with reference to root node.
	var done = []

	while (stack.length) {
		var entity = stack.shift()
		var path = ('path' in entity && entity['path'].join() ) || entity['id']
		//console.log("following", path)

		if (done.indexOf(path) == -1) { 
			done.push(path)
			//console.log('processing', '' + entity['path'])
			var record = []
			for (var fieldptr in nodeHeader) {
				var value = getTextField(entity, nodeHeader[fieldptr])
				// ADD datatype for choice
				if (value == '' && nodeHeader[fieldptr] == 'datatype')
					value = 'xmls:anyURI'
				record.push(value)
			}

			nodes.push(record)

			// Add to parts table 
			for (var ptr in parts) { //'component', 'choice', 'unit'
				var table = parts[ptr] + 's'
				if (table in entity) {

					for (var ptr2 in entity[table]) {
						var item = entity[table][ptr2]
						if (table == 'units') {

							edges.push([entity['id'], parts[ptr], item['id'], '', ''])
							stack.push(item)
						}
						else {
							var minCardinality = ('minCardinality' in item) ? item['minCardinality'] : ''
							var maxCardinality = ('maxCardinality' in item) ? item['maxCardinality'] : ''
							edges.push([entity['id'], parts[ptr], item['id'], minCardinality, maxCardinality])
							stack.push(item)
						}
					}
				}
			}
		}
		
	}

	// Sort all items by datatype, then label
	nodes.sort(function (a, b) {return a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]) }) // datatype, label
	// Then make header to 1st line
	nodes.splice(0, 0, nodeHeader); 

	edges.sort(function (a, b) {return a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) }) // 0=id, 1=relation
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

function downloadDataSpecification() {
	/* This creates dynamic file download link for a given ontology entity. 
	File generated from #dataSpecification field contents directly.
	It fires when user clicks download button of specification, immediately 
	before file is downloaded.

	INPUT
		Quick and dirty file suffix detection based on dom id: yml_ | json_ | tsv_ | xlsx_ ...

	OUTPUT
	Download file link has attributes:
		download = [ontology_id].[file type corresponding to first word of selected tab]
		href = base 64 encoding of #dataSpecification field.
	*/
	if ($("#dataSpecification").html().length) {
		var content = new Blob([ $("#dataSpecification").text() ], { type: 'text/csv' });
		var entity = top.specification[top.focusEntityId] // get name of entity.
		var selected_tab = $('#specificationType').val() // 'tsv_....' etc. file suffix.

		// File name is main ontology id component + file suffix.
		var file_name = entity['id'].split(':')[1] + '.' + selected_tab.split('_')[0]  

		$("#view_spec_download")
			.attr('download', file_name)
			.attr('href', URL.createObjectURL(content) )
			
		$("#view_spec_download")[0].click() // trigger download
	}
}

function getEntitySpecRoot(entityId = null) {
	// Adds context to given entityId specification
	var rootSpecification = {'@context': top.context }
	return getEntitySpec(rootSpecification, entityId) 
}

function getEntitySpec(spec, entityId = null, inherited = false) {
	// Recursively copy the entityId specification element and all its
	// underlings into a a single javascript object.
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
				if (parentId && parentId != 'obolibrary:OBI_0000658') 
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
	*/
	if (type in entity) {
		if (type == 'units')
			// units is an array; 
			for (var ptr in entity['units']) { 
				var partId = entity[type][ptr]
				spec[partId] = top.specification[partId] // load object
				getEntitySpec(spec, partId) // and we make sure 
			}
		else
			// models, components, which are dictionaries
			for (var partId in entity[type]) { 
				spec[partId] = top.specification[partId] // load object
				getEntitySpec(spec, partId)
			} 
	}
}

