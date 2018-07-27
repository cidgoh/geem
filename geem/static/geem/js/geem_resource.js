/* contains functions needed for portal.html resource selection and reporting section */

function render_resource_form() {
	// Feeds specification.metadata variables to copy of template

	$.ajax('templates/resource_summary_form.html').done(function(response) {

		const metadata = top.resource.metadata
		$('#resourceForm').html( do_template_fill(response, metadata) )

		// 2 select lists to select options in:
		$('#summary_type option[value="' + metadata.type + '"]').prop('selected', true)
		$('#summary_status option[value="' + metadata.status + '"]').prop('selected', true)

		// If loaded data is direct from ontology, hide certain buttons. 
		var onto_fields = $('#summary_title, #summary_resource, #summary_description, #summary_prefix')

		if (metadata.type != 'ontology')
			$('.summary_prefix').hide()

		if (metadata.type == 'private') {

			$("#summary_license").removeAttr('readonly')

			if (metadata.new) {
				// new records are always private, draft packages.
				$('.summary_resource, .summary_prefix').hide()
				$('#summary_delete, #summary_download, #summary_copy').hide()
			}
			else //
				$("#summary_status, #summary_type").prop('disabled', false)
			
		}
		else {
			// FUTURE: User may own a shared package, therefore can edit.
			$('#summary_delete, #summary_update').hide()
			
			onto_fields.attr('readonly','readonly')

		}

		$('#resourceForm').foundation()



		// Deals with #summary_delete, #summary_download, #summary_update
		$('#resourceForm').on('click','#summary_delete', function() {
			// API DELETE RESOURCE.
			alert('Coming soon!')
		})

		$('#resourceForm').on('click','#summary_download', function() {
			/* Currently this function is downloading client-side 
			representation of package or ontology json.
			*/
			var content =  {
				content: JSON.stringify(top.resource),
				report_type: 'geem.json',
				id: top.resource.metadata.prefix.toLowerCase()
			}
			download_data_specification(content)
			return false
		})

		$('#resourceForm').on('click', '#summary_update', function() {
			alert('Coming soon!')
			return


			var path = $('#resourceForm #summary_path').val()
			var content =  {
				type: 'private',
				name: $('#resourceForm #summary_title').val(),
				path: path
				
				//...

			}

			// USE API To send into server
			top.resources.push(content)
			init_resource_select(top.resources)
			$('#specificationType').val(path)
			//render_resource_form(data, form_URL, new_flag = false) {
			$('#summary_delete,#summary_download,#summary_copy').show()
			return false
		})




	});

}

function do_template_fill(template_html, data) {
	/* Currently template has a primitive key value substitution scheme.

	*/
	Object.keys(data).forEach(function(key) {
		value = data[key]
		// Search and replace signalled by @[variable name]
		var re = new RegExp('@' + key ,"g");
		template_html = template_html.replace(re, value)
	}) 

	return template_html
}



function init_resource_select(resources) {
	/* Populates resource selection list. Assumes resources are sorted.

	*/
	stack = resources.slice(0)

	html = ['<option value="">Select a specification resource ...</option>']
	init_resource_select_item(stack, 'ontology', html, '<optgroup label="Ontologies">')
	init_resource_select_item(stack, 'shared', html, '</optgroup>\n<optgroup label="Shared Packages">')
	init_resource_select_item(stack, 'private', html, '</optgroup>\n<optgroup label="My Packages (login required)">')

	html.push('\n<option value="new">Add new package ...</option>\n</optgroup>')
	html = html.join('\n')

	// When a new ontology is selected:
	$('#selectResource').html(html).on('change', do_resource_selection)

}

function init_resource_select_item(stack, type, html, header, manager_filter=false) {
	/* Provide sections to display of Resource types.
	Filter options if manager_filter supplied to just those user manages
	which are in draft mode.
	*/
	html.push('\n' + header)
	while (stack.length && stack[0].type == type && ((manager_filter && stack[0].manager && stack[0].status=='draft') || true)) {
		html.push('\n<option value="' + stack[0].path + '">' + stack[0].name + '</option>')
		stack.shift()
	}
}


function do_resource_selection() {
	/* Fetch user's chosen ontology or package for display
	*/
	resource_URL = $('#selectResource').val()

	// This wasn't URL triggered, so clear out existing form
	location.hash = ''
	
	/* Not clearing out rightside panel so that user can switch to their 
	package after filling shopping cart, to fill it up (though this can be
	done with shopping cart selection pulldown too).

	if (top.form.formDelete) top.form.form_delete()
	$('#resourceTabs,#content').addClass('disabled')
	$('#shoppingCart').empty()
	*/

	if (resource_URL.length == 0) {
		$('#resourceTabs, #content').addClass('disabled')
		$('#specificationSourceInfoBox').show()
		$('#tabsSpecification').hide()
		$('#formEntityLabel').html('')
		$('#resourceTabs').foundation('_collapseTab', $('#panelLibrary'));
		return
	}

	if (resource_URL == 'new')
		// User requesting to make a new package
		resource_callback(api.get_new_resource())
	else {
		api.get_resource(resource_URL).then(resource_callback)
	}


}
