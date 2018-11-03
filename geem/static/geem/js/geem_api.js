API_RESOURCES_URL = 'api/resources/' 


function GeemAPI() {

	// non-anonymous user GET and POST methods depend on Django csrftoken.
	// May have to check logged-in status.
	// See https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
	$.ajaxSetup({
	    beforeSend: function(xhr, settings) {
	        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
	            xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
	        }
	    }
	});


	//this.init = function() {}

	this.get_resources = function() {
		/* 
			Retrieves available resources for logged-in or public user to browse.
		*/

		//https://developers.google.com/web/fundamentals/primers/promises
		return new Promise(function(resolve, reject) {
			$.ajax({
				type: 'GET',
				url: API_RESOURCES_URL + '?format=json',
				timeout: 30000, //30 sec timeout
				success: function(resources) {
					
					top.resources = resources
					resolve(resources);
				},

				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resources list could not be loaded: \n\n\t' + API_RESOURCES_URL))
					return false
				}
			});

		})
	}

	this.get_resource_URL = function(entityId) {
		/* For a given entityId, checks with GEEM server about the best
		ontology or package to retrieve specification from. 

		Ontology term prefix crudely determines resource at moment
		CURRENTLY: HARD WIRED TO JUST BE GENEPIO or FOODON
		FUTURE: LOOKUP APPROPRIATE ONTOLOGY FOR ENTITY REFERENCE.
	  	Note: we can get a dynamic list of OBOFoundry ontologies via: 
		http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json
		In the future these could be candidates for GEEM-driven standards to
		be encoded in.

		*/

		switch (entityId.split(':')[0].toLowerCase()) {
			case 'foodon': return '6'
			case 'genepio': return '3'
			default: return '3'
		}
	}

	this.get_resource = function(resource_id) {
		/*

		This loads the json user interface oriented version of an ontology
		returned resource  top.resource.contents contains:
		{
			@context: {}
			metadata: {}
			specifications: {}
		}

		Resource metadata should provide content type of resource being requested: 
		GEEM ontology, shared or private package.

		*/
		return new Promise(function(resolve, reject) {
			var resource_URL = API_RESOURCES_URL + resource_id + '?format=json'
			$.ajax({
				type: 'GET',
				url: resource_URL,
				timeout: 30000, //30 sec timeout
				success: function(resource) {
					
					top.resource = resource
					resolve(resource);
				},

				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be found: \n\n\t' + resource_URL))
					//alert('Given resource could not be found: \n\n\t' + resource_URL) 
				}
			});
			
		});


	}

	this.create_resource = function(data) {
		/*
		*/
		return new Promise(function(resolve, reject) {
			console.log("creating record:",data);
	 		$.ajax({
	            type: "POST",
	            url: API_RESOURCES_URL,
	            data: data,
	            success: function (response) {
	                console.log(response);
	                if (! ('id' in response)) {
	                	alert(JSON.stringify(response))
	                	reject(Error(JSON.stringify(response)))
	                }
	                else
	                	resolve(response);
	            },
				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be created: \n\n\t' + data))
				}
	        });
	    });
	 }

	this.delete_resource = function(resource_id) {
		/*
		*/
		return new Promise(function(resolve, reject) {

			$.ajax({
				type: "DELETE",
				url: API_RESOURCES_URL + resource_id,
				success: function(response){
				    resolve(response);
				},
				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be deleted: \n\n\t' + resource_id))
					//alert('Given resource could not be found: \n\n\t' + resource_URL) 
				}
			});
		})
	}

	// NEED PARTIAL UPDATE CALL.
	this.update_resource = function(data) {
		/*

		*/
		return new Promise(function(resolve, reject) {

	 		$.ajax({
	            type: "POST",
	            url: API_RESOURCES_URL + data.id + '/', // Record id to be updated
	            data: data,
	            success: function (response) {
	                console.log('Updated' , response);
	                top.resource = response;
	                resolve(response);
	            },
				error: function(XMLHttpRequest, textStatus, errorThrown) {
					reject(Error('Given resource could not be updated: \n\n\t' + JSON.stringify(data) ))
				}
	        });
	    });
	}


	this.cart_change_item = function(entity_path, action, versionIRI = null) {
		/* 
		FUTURE: Add call to server if cart should be managed server side.

		Sends in given specification entity path, an action to include
		or exclude it from cart, and associated version, if any. If no version
		then latest version is assumed. 
		*/

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
			var entity = top.resource.contents.specifications[entity_id]
			
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


	function csrfSafeMethod(method) {
	    // These HTTP methods do not require Django CSRF protection
	    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
	}


	function getCookie(name) {
		// From https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
	    var cookieValue = null;
	    if (document.cookie && document.cookie !== '') {
	        var cookies = document.cookie.split(';');
	        for (var i = 0; i < cookies.length; i++) {
	            var cookie = jQuery.trim(cookies[i]);
	            // Does this cookie string begin with the name we want?
	            if (cookie.substring(0, name.length + 1) === (name + '=')) {
	                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
	                break;
	            }
	        }
	    }
	    return cookieValue;
	}

}



