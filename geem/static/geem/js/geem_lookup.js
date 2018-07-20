
render_select_lookup_modal = function(helper, selectId) {
	/*
	We can set some picklists to have a dynamic lookup feature, indicated by
	a "lookup choices" button next to the picklist.  When this button is 
	clicked, a dynamic fetch of subordinate items to the one the user has 
	selected is performed.  A user can then select one of the given items, if
	any, and it will be inserted into existing selection list below parent.

	If select is a multi-select, use last term in selected items as seed for
	OLS lookup.

	ISSUE: Search for children of a term, if parent is top-level root borrowed
	from another ontology, won't return the GenEpiO coded-children. EG. NCIT Province.

	INPUT 
		selectId: ontology Id

	*/
	// Houses both <select> and <div.chosen-container>
	var select = $(helper).parent('div[class="input-group"]').find("select");
	var value = select.val();
	if (!value || value.length == 0)
		return render_select_root_search(select, helper)

	// select.val() is either a string, for a single-select, or an array
	// for multi-select
	var parent_id = Array.isArray(value) ? value[0] : value
	var parent =  top.resource.specifications[parent_id]
	var parent_label = 'Selections for "' + parent.uiLabel + '"[' + parent_id + ']'

	var lookupURL = modal_lookup_get_api_url(parent_id)

	$.ajax({
		type: 'GET',
		url: lookupURL,
		timeout: 10000, //10 sec timeout
		success: function( response ) {
			// We have an OLS data packet in data._embedded
			if (response._embedded)
				render_modal_lookup_form(helper, response._embedded.terms, parent_id, parent_label)
			else
				open_modal(parent_label, "No subordinate choices found!")
		},
		error: function(XMLHttpRequest, textStatus, errorThrown) {
			var message = 'Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.'
			open_modal(parent_label, message)
		}
	})

}

function render_select_root_search(select, helper) {
	/* Grabbing displayed label rather than top specification uiLabel since
	that doesn't reflect all customization. 

	FUTURE: A purer form of this would examine form specification directly.
	*/
	var label = select.parents('div.field-wrapper').first().find(' > label')
	var title = label.text()
	// Grab top-level selection(s) from input itself
	var selection_html = ''
	select.find('option.depth0').each(function(){
		// Asterisk signals its something that can be explored
		selection_html += '<option value="'+ $(this).attr('value') +'">' + $(this).text() + '* </option>\n' 
	}) 

	open_modal_lookup(title, selection_html)

	// open_modal_lookup creates options to add dblclick to
	$("#modalLookupSelections option").off('dblclick')
		.on('dblclick', function(){ //
		// reusing given helper reference
		select.find('option[value="' + $(this).attr('value') + '"]').prop('selected', true)
		$(select).trigger("chosen:updated");
		render_select_lookup_modal(helper, $(this).attr('value'))
	})

	$("#modalChoiceSearchButton").off('click')
	.on('click', function(){
		var parent_id = select.attr('id').split('/').pop()
		getOLSSearch(helper, parent_id, $('#modalChoiceSearchText').val() )
	})

	return
}

getOLSChoices = function(helper, parent_id, parent_label) {
	/* Like above render_select_lookup_modal(), but parent_id may not be in top specification
	since user is browsing down via external OLS ontology.
	*/

	var parent_label = 'Selections for "' + parent_label + '"[' + parent_id + ']'
	var lookupURL = modal_lookup_get_api_url(parent_id)

	$.ajax({
		type: 'GET',
		url: lookupURL,
		timeout: 10000, //10 sec timeout
		success: function( response ) {
			// We have an OLS data packet in data._embedded
			if (response._embedded && response._embedded.terms)
				render_modal_lookup_form(helper, response._embedded.terms, parent_id, parent_label)
			else
				open_modal(parent_label, "No subordinate choices found!")
		},
		error: function(XMLHttpRequest, textStatus, errorThrown) {
			var message = 'Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.'
			open_modal(parent_label, message)
		}
	})

	return false

}

function getSelectId(select) {
	return select.attr('id').split('/').pop()
}
function getOLSSearch(helper, parent_id, text) {
	/* Free text search for given items.  If selected, they will be placed
	under existing parent_id.
	Constrained by ontologies mentioned in top-level helper select.

	*/
	var select = $(helper).parent('div[class="input-group"]').find("select");
	// kludge to get feature value if exists; it will have an ontology id
	// to search within.
	var entity_id = getSelectId(select) 
	var selectEntity = top.resource.specifications[entity_id]
	if (selectEntity.features && selectEntity.features.lookup.value)
		var root_ids = '&allChildrenOf=' + [selectEntity.features.lookup.value].join(',')
	else
		var root_ids = ''

	var parent_label = 'Search for "' + text + '"'//' in [' + ontology + ']'

	// Defaults
	// fields: {iri,label,short_form,obo_id,ontology_name,ontology_prefix,description,type}
	//queryFields {label, synonym, description, short_form, obo_id, annotations, logical_description, iri}
	// ISSUE: synonym vs SYNONYMS, EBI uses both in different circumstances; both are array.

	var lookupURL = ['https://www.ebi.ac.uk/ols/api/select?q='
		, text
		//, 'ontology='
		//, ontologies
		, '&local=true'
		, root_ids 
		, '&rows=50'
		, '&fieldList=iri,label,description,synonym,deprecated,has_children,type'
	].join('')

	$.ajax({
		type: 'GET',
		url: lookupURL,
		timeout: 10000, //10 sec timeout
		success: function( response ) {

			// We have an OLS data packet in data._embedded
			if (response.response && response.response.numFound > 0) {
				render_modal_lookup_form(helper, response.response.docs, parent_id, parent_label)
			}
			else
				open_modal(parent_label, 'No results for "' + text + '"')
		},
		error: function(XMLHttpRequest, textStatus, errorThrown) {
			var message = 'Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.'
			open_modal(parent_label, message)
		}
	})

	return false


}


function render_modal_lookup_form(helper, content, parent_id, parent_label) {

	var select = $(helper).parent('div[class="input-group"]').find("select");

	options = []
	for (ptr in content) {
		item = content[ptr]
		// Fields: {iri,label,short_form,obo_id,ontology_name,ontology_prefix,description,type}
		var lookupId = item.iri.split("/").pop().replace('_',':')

		options.push({
			'iri': item.iri, 
			'id': lookupId,
			'label': item.label, 
			'parent': parent_id,
			'definition': item.description, // array
			'synonyms': item.synonyms || item.synonym, // array
			'deprecated': ('is_obsolete' in item && item.is_obsolete) || ('deprecated' in item && item.deprecated),
			'has_children': item.has_children
		})
	}
	options.sort(function(a,b) { return a.label.localeCompare(b.label) })

	var selections = ''
	for (var ptr in options) {
		var option = options[ptr]
		// Children signalled by asterisk.
		if (option.deprecated == false) {
			selections += '<option value="'+ option.id +'">' + option.label + (option.has_children ? ' *' : '') + '</option>\n' 
		}
	}

	open_modal_lookup(parent_label, selections)
	
	// "Select" button ensures calling select list has given item
	$("#modalLookupSelect").off('click')
		.on('click',function(){
			if ($("#modalLookupSelections").prop('selectedIndex') > -1)
				modal_lookup_do_selection(select, options, parent_id)						
	})

	// Provide definition when user clicks on given item.
	$("#modalLookupSelections option").off('click')
		.on('click', function(){
			var option = options[$("#modalLookupSelections").prop('selectedIndex')]
			$('#modalLookupDefinition').html('<strong>' + option.id +'</strong><br/>' + option.definition)
			$('#modalChoiceSearchText').val( $(this).text().replace('*','').trim() )
	})

	$("#modalChoiceSearchButton").off('click')
		.on('click', function(){
			getOLSSearch(helper, parent_id, $('#modalChoiceSearchText').val() )
		})

	// Double click triggers either "Select" button response, or
	// if item has children, loads form with those children.
	// NOTE: Currently no intermediate parents are included. User must
	// Manually load them.
	$("#modalLookupSelections option").off('dblclick')
		.on('dblclick', function(){
			var label = $(this).text()
			var parent_label = $(this).text()
			// Explore
			if (label.indexOf('*') > 0) {
				// Issue is selected item on helper was used as identifier
				// to search for; parent_id exists only as insertion point
				getOLSChoices(helper, $(this).attr('value'), parent_label)
			}
			// Select
			else 
				modal_lookup_do_selection(select, options, parent_id)
	})

	return false

}

function modal_lookup_do_selection(select, options, parent_id) {
	/*
	INPUT
		select: existing <select> list
		parent_id: ontology identifier
		options: array of fetched children for given parent_id
	*/
	var selectDom = select[0]
	var selectIndex = select.prop('selectedIndex')
	if (!selectIndex)  //User might not have selected anyting in
		selectIndex = 1

	// Possible multi-select array if modal popup is in edit mode
	var selections = $("#modalLookupSelections").prop('selectedIndex')
	if (!Array.isArray(selections))
		selections = [selections]

	for (ptr in selections) {
		var selection_row = selections[ptr]
		var option = options[selection_row]
		//console.log(ptr, selections, selection_row, options, option)
		var existingOption = select.find('option[value="' + option.id + '"]')
		if (existingOption.length > 0) {
			existingOption.prop('selected', true)
		}

		// User asking for new option to be added 
		else {
			var newOption = document.createElement("option");
			newOption.text = option.label;
			newOption.value = option.id;
			var parentOption = select.find('option').eq(selectIndex)
			var parentClass = $(parentOption).attr('class')
			if (parentClass) {
				var depth = parentClass.match(/\d+$/)[0]; // Find numeric depth[0-20]
				$(newOption).addClass('depth' + (parseInt(depth)+1))
			}

			selectDom.add(newOption, selectDom[selectIndex+1]);
			select.find('option').eq(selectIndex+1).prop('selected', true)
			
			// Adjust GEEM specification itself, so this lookup can be
			// propagated to user packages.
			// New entry in top specification.
			// ADD SYNONYMS????
			// POSSIBLY ALREADY THERE?
			top.resource.specifications[option.id] = {
				'datatype': "xmls:anyURI",
				'uiLabel': option.label,
				'id': option.id,
				'definition': option.description,
				'parent': parent_id
			}

			var parent = top.resource.specifications[parent_id]
			// ISSUE: parent may not be in top.resource.specifications if user has
			// browsed down a few levels on OLS
			if (!parent) parent = top.resource.specifications[ getSelectId(select) ]
			if (!parent.choices) parent.choices = {}
			parent.choices[option.id] = []

		}
	}
	if (selections.length>0) {
		select.trigger("chosen:updated"); // to select above.
		$("#modalLookup").foundation('close')
	}
}

function modal_lookup_get_api_url(entity_id) {
	/* See https://www.ebi.ac.uk/ols/docs/api for URL commands

	e.g. https://www.ebi.ac.uk/ols/api/ontologies/doid/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252FDOID_0050589/children
	*/
	var term = entity_id.replace(':','_')
	var ontology = term.split("_")[0].toLowerCase()

	return ['https://www.ebi.ac.uk/ols/api/ontologies/'
		, ontology
		, '/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252F'
		, term
		, '/hierarchicalChildren'
	].join('')
}


function open_modal_lookup(header, content) {
	/* This displays given string content and header in popup. 
	Usually called by render_select_lookup_modal()
	*/
	$('#modalChoiceSelectAll').off('click').on('click', function(){
		$(this).parent().find('option').attr('selected','selected')
	})
	$('#modalLookupDefinition').text('')
	$("#modalLookupHeaderContent").html(header)
	$("#modalLookupSelections").html(content)
	$("#modalLookup").foundation().foundation('open') // not sure why doubled.

}
