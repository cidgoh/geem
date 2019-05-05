
/*********** SEARCH AND RESULTS *************************/
function init_search_tab() {

	// Provide type-as-you-go searching
	$("#searchField").on('keyup', function() {
		var text = $(this).val().toLowerCase()
		search_as_you_type(top.resource.contents.specifications, text)
	})

	$('#toggleSearchDefinition').on('change', function() {
		search_as_you_type(top.resource.contents.specifications, $("#searchField").val().toLowerCase())
	})

	// Pertains to search results. Clicking on up-arrow shows info on immediate parents of item.
	$("#searchResults").on('mouseenter','i.fi-arrow-up.dropdown', render_display_context)

	// Pertains to render_display_context() modal content. When user clicks on
	// up-arrow by modal content item, it adds parent term information to that
	// display.
	$('#displayContext').on('click','i.fi-arrow-up', function(event){
		// Insert shopping cart item 
		var target = $(event.target).parent()
		var targetId = target[0].dataset.ontologyId
		// DETECT IF ITEM HAS ALREADY HAD PARENTS ADDED?
		if ($('#displayContext ul[data-ontology-id="' + targetId + '"]').length == 0 ) {
			target.parent().wrap('<ul data-ontology-id="' + targetId + '">')
			target.parent().before(render_entity_relations(targetId))
		}
	})
}


function search_as_you_type(collection, text) {
	/* As user types text (more than 2 characters) into searchField, exact
	 substring search is conducted through top.resource.contents.specifications entities (all
	 of their numeric or textual attributes)
	*/
	text = text.toLowerCase()
	$("#searchResults").empty()
	var results = []
	if (text.length > 2) {
		var ontology_ids = search_text_filter(collection, text)
		for (id in ontology_ids) {
			results.push(render_search_result_item(ontology_ids[id]))
		}
		// Sort results alphabetically.  
		// Consider other sort metrics?
		results.sort(function(a,b){return a[0].localeCompare(b[0]) })
		resultsHTML = results.map(function(obj) {return obj[1]})
		$("#searchResults").append(resultsHTML.join('\n'))
	}

}


function search_text_filter(collection, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields, e.g.: label, 
	ui_label, definition, ui_definition, hasSynonym, hasNarrowSynonym, 
	hasExactSynonym.

	FUTURE: add wildcard searching?
	 */
	 var details = $('#toggleSearchDefinition:checked').length

    return Object.keys(collection).filter(function(key) { // key is ontology term id.
      return Object.keys(collection[key]).some(function(key2) { 
      	// key2 is name of object property like label, definition, component

      	if (typeof collection[key][key2] === "object") 
      		//i.e. skip entity components, models, features.
      		return false
      	else
      		if (!details && (key2 == 'definition' || key2 == 'ui_definition'))
      			return false
      		// What remains are string field contents to search
      		return collection[key][key2].toLowerCase().includes(searchKey);
      })
    })
}


function render_search_result_item(ontologyId) {
	// This version of render_cart_item is optimized for sorting, and is used in
	// search results page.  It also provides icons for navigating to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.resource.contents.specifications[entityId]
	if (!entity) entity = {'label':'[UNRECOGNIZED:' + entityId + ']'}
	content = ''
	if ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
		content = '<i class="fi-arrow-up dropdown member"></i>'
	var html = [
		'<div class="cart-item" ', 	render_attr_ontology_id(ontologyId), '>'
		,	content
		,	'<a href="#', ontologyId, '">',	get_label(entity), '</a>'
		,'</div>'
		].join('')
	
	return [get_label(entity).toLowerCase(), html]

}