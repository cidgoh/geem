
function GeemAPI() {

	//https://developers.google.com/web/fundamentals/primers/promises
	//this.init = function() {}

	this.get_resources = function() {
		/* 
			Retrieves available resources for logged-in or public user to browse.
		*/
		resource_URL = 'data/resource'

		return new Promise(function(resolve, reject) {
			$.ajax({
				type: 'GET',
				url: resource_URL,
				timeout: 30000, //30 sec timeout
				success: function(resources) {
					
					top.resources = resources
					resolve(resources);
				},

				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be found: \n\n\t' + resource_URL))
					//alert('Given resource could not be found: \n\n\t' + resource_URL) 
				}
			});
		/*
		return new Promise(function(resolve, reject) {

			// AJAX FUNCTION HERE
			top.resources =	[
				{type:'ontology', name:'Genomic Epidemiology Ontology', path:"data/ontology/genepio-merged.json"},
				{type:'ontology', name:'Food Ontology (FoodOn)', path:'data/ontology/foodon-merged.json'},
				{type:'shared', name:'Demo Epi Form', path:'data/shared_packages/test.epi.json'},
				{type:'private', name:'New Demo Package', path:'data/private_packages/new_2018-04-16.json'}
			]

			// CANNED DUMMY DATA
			resolve(top.resources)
		*/
		})
	}

	this.get_resource_URL = function(entityId) {
		/* For a given entityId, checks with GEEM server about the best
		ontology or package to retrieve specification from. 

		Ontology term prefix crudely determines resource at moment
		CURRENTLY: HARD WIRED TO JUST BE GENEPIO or FOODON
		Ontology ID provided in URL: CHECK FOR VALID ENTITY REFERENCE IN SOME
		(PREFERRED?) ONTOLOGY.
	
	  	Note: we can get a dynamic list of OBOFoundry ontologies via: 
		http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json
		In the future these could be candidates for GEEM-driven standards to
		be encoded in.

		*/
		const prefix = entityId.split(':')[0].toLowerCase()

		if (prefix == 'foodon')
			return 'data/ontology/foodon-merged.json'

		return 'data/ontology/genepio-merged.json'

	}

	this.get_resource = function(resource_URL) {
		/*

		This loads the json user interface oriented version of an ontology
		returned resource  top.resource.specifications contains:
		{
			@context: {}
			metadata: {}
			specifications: {}
		}

		Resource metadata should provide content type of resource being requested: 
		GEEM ontology, shared or private package.

		*/
		return new Promise(function(resolve, reject) {
			$.ajax({
				type: 'GET',
				url: resource_URL,
				timeout: 30000, //30 sec timeout
				success: function(resource) {
					
					// Temporary correction until SPARQL query can be revised.
					//if ('value' in top.resource.metadata.date)
					//	top.resource.metadata.date = top.resource.metadata.date.value

					top.resource = resource
					resolve(resource);
				},

				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be found: \n\n\t' + resource_URL + ":" + textStatus))
					//alert('Given resource could not be found: \n\n\t' + resource_URL) 
				}
			});
			
		});


	}

	this.get_new_resource = function() {
		/* 
			Retrieves new private package record for logged-in user.
		*/

		var today = new Date();
		today = today.toISOString().substring(0, 10);

		// DUMMY DATA / TEMPLATE
		return {
			title:			'New private specification package',
			date:			today,
			type:			'private',
			status:			'draft',
			new: 			true, 
			resource: 		'',  // General link to resource separate from version IRI??
			description:	'',
			prefix:			'',
			versionIRI:		'data/private_packages/[your acct id]/package_[id]_'+today+'.json',
			license:		''
		}

	}

	this.delete_resource = function(path) {

	}

	this.update_resource = function(path) {

	}

	/* A package consists of 
	{
		name: string
		description: string
		version: int //auto-increment per update function.
		ontologies:	[
			{prefix: string // "genepio"; OBOFoundry ontology lower case name.
			version: string // identifier or if none, GEEM download date.
			}
		] 
		specifications:
			{}

	}
	*/


	this.cart_change_item = function(entity_path, action, versionIRI = null) {
		/* Sends in given specification entity path, an action to include
		or exclude it from cart, and associated version, if any. If no version
		then latest version is assumed. 
		*/
		// Add call to server if cart should be managed server side.

		return new Promise(function(resolve, reject) {
			/*
			switch (action) {
				case 'include': status = 'include'; break;
				case 'exclude': status = 'exclude'; break;
				case 'remove': status = 'remove'; break;
				case 'error': status = 'error'; break;
			}
			*/

			var ptr = entity_path.lastIndexOf('/')
			// Get last path item id.
			var entity_id = ptr ? entity_path.substr(ptr + 1) : entity_path
			var entity = top.resource.specifications[entity_id]
			
			result = {
				label: entity ? entity.uiLabel : '[UNRECOGNIZED]',
				id: entity_id,
				path: entity_path, //Ontology id is last item in path
				status: action,
				version: versionIRI
			}

			resolve(result)

			// reject()
		})
	}


}



