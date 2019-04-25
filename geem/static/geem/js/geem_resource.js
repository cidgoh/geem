/* Contains functions needed for portal.html resource selection and reporting section 
	- Render resource form
	- Create new resource
	- Update existing resource
	- Delete resource

*/

RESOURCE_TEMPLATE_ID = '"5"';

function render_resource_form() {
	/* 
	Populates resource form template with a resource record which user *may*
	be the owner of. Implements various view/edit/hide field logic depending
	on status of record.
		
	*/
	$.ajax('templates/resource_summary_form.html').done(function(response) {

		const resource = top.resource
		$('#resourceForm').html( do_template_fill(response, resource) )

		// By default, all form elements are disabled / read-only
		$('#resourceForm select').prop('disabled', true)
		$('#resourceForm input').attr('readonly','readonly')

		// 2 select lists to select options in:
		$('#summary_public option[value="' + resource.public + '"]').prop('selected', true)
		$('#summary_ontology option[value="' + resource.ontology + '"]').prop('selected', true)
		$('#summary_curation option[value="' + resource.curation + '"]').prop('selected', true)

		// If loaded data is direct from ontology, hide/disable certain buttons/fields. 
		var onto_fields = $('#summary_name, #summary_version, #summary_resource, #summary_description, #summary_prefix')

		// Packages don't have prefixes.
		if (!resource.ontology)
			$('.summary_prefix').hide() 

		const resource_owner = get_owner_status(resource)

		if (resource_owner) {
			$('#summary_curation, #summary_public').prop('disabled', false)
		}

		// Public resources can't be deleted or updated.
		if (resource.public && resource.curation != 'draft') {
			
			$('#summary_delete, #summary_update, #summary_create').hide()

		}
		else {
			$("#summary_license").removeAttr('readonly')

			if (resource.new) {
				// new records are always private, draft packages.
				$('.summary_resource, .summary_prefix').hide()
				$('#summary_delete, #summary_download, #summary_copy, #summary_update').hide()
			}
			else {// Existing record can be copied
				$('#summary_create').hide()
				$("#summary_public, #summary_ontology, #summary_curation").prop('disabled', false)
			}
		}

		$('#resourceForm').foundation() // Enables tool tips 

	});

}

function get_owner_status(resource) {

	// Move this over to geem_portal.js ?
	var current_user_id = $('#userInfo').data('userId')

	var resource_user_id = 0
	if (resource.owner) {
		// Django delivers resource owner formatted as '.../api/users/[digits]/?format=json'
		resource_user_id = resource.owner.match(/\/api\/users\/(\d+)/)
		if (resource_user_id) 
			resource_user_id = resource_user_id[1]
	}

	return (resource_user_id == current_user_id)

}


function get_form_data(domId) {
	/*
	A GEEM resource record has top level fields id, name, description, created,
	updated, etc., some of which are used just in the Django context of
	managing the record, and a "contents" field that holds the entire JSON 
	dictionary structure, that holds the specifications derived from ontology
	or composed by the user.
	ISSUE: 

	*/
	var data = {
		'contents': {
			'@context': 		{},
			'specifications': 	{},
			'metadata': 		{}
		}
	}

	domId.find('input,select,textarea').each(function() {
		var field = $(this).attr('name')
		if (field.indexOf('.') > 0) {
			var dotted_reference = field.split('.')
			var focus = data;
			while (dotted_reference.length) {
				key = dotted_reference.shift()
				if (dotted_reference.length) {
					if (!key in focus) {
						focus[key] = {}
					}
					focus = focus[key]
				}
				else {
					if ($(this).is('textarea'))
						focus[key] = $(this).text()
					else
						focus[key] = $(this).val()
				}
			}
		}
		else 
			data[field] = $(this).val()
	})

	return data
}

function do_template_fill(template_html, data) {
	/* Currently template has a primitive key value substitution scheme.
	If substituted key's value has "@..." these are ignored.
	*/
	return template_html.replace(/@([a-zA-Z_0-9\.]+)(["<])/g,  
		function(match, parenth_1, parenth_2, offset, value) {
			var focus = data
			var dotted_reference = parenth_1.split('.')
			while (dotted_reference.length) {
				key = dotted_reference.shift()
				if (key in focus) {
					focus = focus[key]
					if (dotted_reference.length && typeof focus !== 'object')
						return 'unmatched reference: @' + parenth_1 + parenth_2	
				}
				else {
					return 'unmatched reference: @' + parenth_1 + parenth_2
				}
			}
			return focus + parenth_2
		} 
	)
}

function init_resource_select(resources) {
	/* Populates resource selection list.
	This can be switched to agGrid for better usability as more items exist in database.
	*/

	html = ['<option value="">Select a specification resource ...</option>']
	init_resource_select_item(resources, html, '<optgroup label="Ontologies">', true)
	init_resource_select_item(resources, html, '</optgroup>\n<optgroup label="Public Packages">', false, true)
	init_resource_select_item(resources, html, '</optgroup>\n<optgroup label="My Private Packages (login required)">', false, false)

	html.push(`\n<option value=${RESOURCE_TEMPLATE_ID}>Add new package ...</option>\n</optgroup>`) // Resource #5 is template for package
	html = html.join('\n')

	// When a new ontology is selected:
	$('#selectResource').html(html).on('change', do_resource_selection)

/*************** PROBLEM??? **************/
	clear_resource_summary()

}

function init_resource_select_item(resources, html, header, ontology=null, public=null, draft=null) {
	/* Provide select input of Resource types.
	resources = [
		{
			"id":3,
			"owner":null,
			"created":"2018-10-17T17:45:35.561474Z",
			"updated":"2018-10-17T17:45:35.561509Z",
			"name":"New Resource",
			"file_base_name":"new_resource",
			"version":"2018-04-17",
			"ontology":true,
			"public":false,
			"curation":"draft"
		},
		{"id":1,"owner":"http://localhost:8000/api/2"},
		...
		]
	*/
	html.push('\n' + header)

	var resource_list = resources
	if (ontology != null)
		resource_list = resource_list.filter(resource => resource.ontology == ontology)
	if (public != null)
		resource_list = resource_list.filter(resource => resource.public == public)
	if (draft == true)
		resource_list = resource_list.filter(resource => resource.curation == 'draft')

	for (ptr in resource_list) {
		var resource = resource_list[ptr]
		// FUTURE: With agGrid, show draft/public, etc.
		html.push('\n<option value="' + resource.id + '">' + resource.name + ' (' + resource.version + ')</option>')
	}
}

function clear_resource_summary() {
	$('#resourceTabs, #content').addClass('disabled')
	$('#specificationSourceInfoBox').show()
	$('#tabsSpecification').hide()
	$('#formEntityLabel').html('')
	$('#resourceTabs').foundation('_collapseTab', $('#panelLibrary'));
}

function do_resource_selection() {
	/* Fetch user's chosen ontology or package for display
	*/
	const resource_id = $('#selectResource').val()

	// This wasn't URL triggered, so clear out existing form
	location.hash = ''
	
	/* Not clearing out rightside panel so that user can switch to their 
	package after filling shopping cart, to fill it up (though this can be
	done with shopping cart selection pulldown too).

	if (top.form.formDelete) top.form.form_delete()
	$('#resourceTabs,#content').addClass('disabled')
	$('#shoppingCart').empty()
	*/

	if (resource_id.length == 0) {
		clear_resource_summary()
		return
	}

	if (resource_id == 5) { //Special package id for template
		// User requesting to make a new package
		api.get_resource(5)
			.then(init_new_resource)
			.then(resource_callback)
	}
	else {
		api.get_resource(resource_id)
			.then(resource_callback)
	}


}

function init_new_resource(resource) {

	var today = new Date();
	resource.new = true
	resource.contents.metadata.date = today.toISOString().substring(0, 10);
	return resource

}