
function check_for_hash_entity() {

 if (location.hash.length > 0 && location.hash.indexOf(':') != -1) { 
    top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]

    // Returns if loading resource or if no appropriate resource found
    if (!check_entity_resource(top.focusEntityId) ) return

    // load_standalone_form()
	// render_portal_form()
  }

}

function check_entity_resource(entityId) {
	// Ensure appropriate resource is loaded for given entity id 

	if (!top.resource.specifications || ! entityId in top.resource.specifications) {

		// Ontology term prefix crudely determines resource at moment
		var prefix = entityId.split(':')[0].toLowerCase()

		// CURRENTLY: HARD WIRED TO JUST BE GENEPIO or FOODON
		// If no resource loaded, or resource ontology prefix doesn't match given URL prefix ...
		if (!top.resource.specifications || top.resource.metadata.prefix.toLowerCase() != prefix) {
			if (prefix == 'genepio') {
				load_resource('data/ontology/genepio-merged.json').then(check_for_hash_entity)
				// rechecks hash
				return false
			}

			else if (prefix == 'foodon') {
				load_resource('data/ontology/foodon-merged.json')
				// rechecks hash
				return false
			}
		}
	}
	return true
}



function load_resource(resource_URL) { //, resource_type
	return new Promise(function(resolve, reject) {
		$.ajax({
			type: 'GET',
			url: resource_URL,
			timeout: 30000, //30 sec timeout
			success: function(resource) {
				resolve(resource);
			},
			error:function(XMLHttpRequest, textStatus, errorThrown) {
				reject(Error('Given resource could not be found: \n\n\t' + resource_URL)
				//alert('Given resource could not be found: \n\n\t' + resource_URL) 
			}
		});
		
	});

}

/*
function load_resource(resource_URL) { //, resource_type
	$.ajax({
		type: 'GET',
		url: resource_URL,
		timeout: 30000, //30 sec timeout
		success: function(resource) {

		  top.resource = resource;

		  // load_resource() triggered if hash entity id detected 
		  // but no top.resource loaded. 
		  check_for_hash_entity()
		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {
		  alert('Given resource could not be found: \n\n\t' + resource_URL) 
		}
	});
}
*/