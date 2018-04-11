
/*********** SEARCH AND RESULTS *************************/
function initSearchTab() {

	// Provide type-as-you-go searching
	$("#searchField").on('keyup', function() {
		var text = $(this).val().toLowerCase()
		searchAsYouType(top.specification, text)
	})

	$('#toggleSearchDefinition').on('change', function() {
		searchAsYouType(top.specification, $("#searchField").val().toLowerCase())
	})

	$("#searchResults").on('mouseenter','i.fi-arrow-up.dropdown', displayContext)
}


function searchAsYouType(collection, text) {
	/* As user types text (more than 2 characters) into searchField, exact
	 substring search is conducted through top.specification entities (all
	 of their numeric or textual attributes)
	*/
	text = text.toLowerCase()
	$("#searchResults").empty()
	var results = []
	if (text.length > 2) {
		var ontology_ids = filterIt(collection, text)
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		// Sort results alphabetically.  
		// Consider other sort metrics?
		results.sort(function(a,b){return a[0].localeCompare(b[0]) })
		resultsHTML = results.map(function(obj) {return obj[1]})
		$("#searchResults").append(resultsHTML.join('\n'))
	}

}


function filterIt(collection, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields, e.g.: label, 
	uiLabel, definition, uiDefinition, hasSynonym, hasNarrowSynonym, 
	hasExactSynonym.
	 */
	 var details = $('#toggleSearchDefinition:checked').length

    return Object.keys(collection).filter(function(key) { // key is ontology term id.
      return Object.keys(collection[key]).some(function(key2) { 
      	// key2 is name of object property like label, definition, component

      	if (typeof collection[key][key2] === "object") 
      		//i.e. skip entity components, models, features.
      		return false
      	else
      		if (!details && (key2 == 'definition' || key2 == 'uiDefinition'))
      			return false
      		// FUTURE: add wildcard searching?
      		return collection[key][key2].toLowerCase().includes(searchKey);
      })
    })
}
