
function checkEntityResource(entityId) {
	// Ensure appropriate resource is loaded for given entity id 
	// FUTURE - make this an API call.

	if (!top.resource.specifications || ! entityId in top.resource.specifications) {

		// Ontology term prefix crudely determines resource at moment
		var prefix = entityId.split(':')[0].toLowerCase()

		// CURRENTLY: HARD WIRED TO JUST BE GENEPIO or FOODON
		if (!top.resource.specifications || top.resource.metadata.prefix.toLowerCase() != prefix) {
			if (prefix == 'genepio') {
				loadResource('data/ontology/genepio-merged.json')
				// rechecks hash
				return false
			}

			else if (prefix == 'foodon') {
				loadResource('data/ontology/foodon-merged.json')
				// rechecks hash
				return false
			}
		}
	}
	return true
	}