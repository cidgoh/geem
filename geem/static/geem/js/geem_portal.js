/********************** Ontology Entity Mart Prototype ************************

	This script provides the engine for displaying OBOFoundry.org compatible 
	ontology .owl files that have been marked up according to the Genomic
	Epidemiology Entity Mart (GEEM) coding system (annotations and a few 
	relations), allowing one to search and browse any data representation model
	items therein, and related numeric, categorical and textual datums.
	
	This code supports a portal.html page for selecting a given ontology, 
	navigating through its various GEEM annotated specs, enabling the user to
	view html forms and tabular/json etc. specifications, and create their own 
	downloadable packages

	As well a form.html page is available for focusing on a particular spec.

    Author: Damion Dooley
	Project: genepio.org/geem
	Updated: July 15, 2018

	Note: we can get a dynamic list of OBOFoundry ontologies via: 
	http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json
	In the future these could be candidates for GEEM-driven standards to be
	encoded in
	
	TO DO:

	// FUTURE: SWITCH TO GEEM FORM RENDERING FOR RESOURCE SUMMARY FORM

	 - Disjunction tabbed interface has wrong required status shown when
	 ontology detail switch is on?
	 - FIX: contact specification - physician not inheriting first name, last
	   name etc. from person (and check cardinality).
	 - How to handle items that are not marked as datums?
	 - possibly try: http://knockoutjs.com/index.html
	 - FIX: "has component some XYZ" where XYZ is a composite entity fails to
	   be recognized. using "min 1" instead of "some" is the workaround.
	 - API: should provide content type of resource being requested: 
		GEEM ontology, shared or private package.
	 - Ontology ID provided in URL: CHECK FOR VALID ENTITY REFERENCE IN SOME
	  (PREFERRED?) ONTOLOGY. PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE
	  TO LOAD?

*/

/*********** ALL THE SETUP ***************************************************/

// Lists all the ontology, shared, and private packages available to user
// Hardcoded for testing until API operational.
// path is used as unique id of resource.
resources = []
resource = {} 	// Current specification database being browsed and searched
focusEntityId = null
formSettings = {}
form = {}
ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='

$( document ).ready(function() {

	// Initializes Zurb Foundation settings (but not foundation itself)
	OntologyForm.init_foundation()

	api = new GeemAPI()

	/************************* LOAD SHARED TEMPLATES ************************/
	$.ajax('templates/modal_lookup.html').done(function(response){
		$('#template_area').append(response)
	});

	/*************** Specification resource selection area ******************/
	top.resources = api.get_resources()
	init_resource_select(top.resources)
	init_summary_tab()
	init_browse_tab()
	init_search_tab()

	/*********************** Specification focus area ***********************/

	$("#tabsContent").on('mouseenter','i.fi-magnifying-glass', render_display_context)

	init_form_tab()
	init_specification_tab()
	// initDiscussTab()
	init_cart_tab()

	$(document).foundation()

	// GEEM focuses on entities by way of a URL with hash #[entityId]
	$(window).on('hashchange', check_for_hash_entity);

	// If there's a #ONTOLOGY:ID hash in URL then render that form
	check_for_hash_entity()  

});


/******************************** UTILITY FUNCTIONS *************************/


function navigate_to_form(ontologyId) {

	if (window.location.href.indexOf(ontologyId) == -1) {
		// not found
		window.location.replace('#' + ontologyId);
		//window.location.href = '#' + ontologyId
	}
	else
		// form already displayed, ensure tab is activated
		$('#content-tabs').foundation('selectTab', '#panelContent'); 

	return false
}


function get_entity(ontologyId) {
	return top.resource.specifications[ontologyId]
}


function dom_item_animate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}


/******************************* ACTION **************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.resource.specifications contains:
	{
		@context
		specifications
	}
*/


function do_resource_selection() {

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
		$('#resourceTabs,#content').addClass('disabled')
		$('#specificationSourceInfoBox').show()
		$('#tabsSpecification').hide()
		$('#formEntityLabel').html('')
		$('#resourceTabs').foundation('_collapseTab', $('#panelLibrary'));
	}

	else if (resource_URL == 'new') {

		data = api.get_new_resource()

		$('#resourceTabs').removeClass('disabled')
		$('#tabsSpecification').show()
		$('#specificationSummaryTabLink').click()

		do_resource_form(data, 'templates/resource_summary_form.html', true) // true=new form
	}
	else {
		load_resource(resource_URL) 

	}
}


function load_resource(resource_URL) { //, resource_type
	$.ajax({
		type: 'GET',
		url: resource_URL,
		timeout: 30000, //30 sec timeout
		success: function(resource) {

			top.resource = resource;
			do_resource_metadata(top.resource)
			// Prepare browsable top-level list of ontology items
			do_resource_browse_menu()

			$('#resourceTabs').removeClass('disabled')
			$('#tabsSpecification').show()
			$('#specificationSummaryTabLink').click()

			// load_resource() triggered if hash entity id detected 
			// but no top.resource loaded. 
			check_for_hash_entity()
		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {
			alert('Given resource could not be found: \n\n\t' + resource_URL) 
		}
	});
}



function set_form_callback(formObj) {
	//This is executed whenever a new form is rendered.
	if (window.set_shopping_cart) {
		set_shopping_cart(formObj) 
		set_form_select_options_cart(formObj)
	}

	$('#specificationSourceInfoBox').hide()

	// Clear out specification tab.
 	if (window.get_data_specification) {

 		// Deselect specification menu.
 		$('#specificationType')[0].selectedIndex = 0

 		$('#dataSpecification').empty()
 		//$("#spec_download").attr('disabled','disabled')
 		$('#specification-tabs li.is-active')
 			.removeClass('is-active')
 			.find('a').removeAttr('aria-selected'); // how else?
 	}

	// Content area functionality is blocked until form loaded
	$('#content').removeClass('disabled')

}


function do_resource_metadata(resource) { //, resource_type
	// Currently resource_type is provided as parameter but it
	// should be within specification itself. Determines which
	// fields are editable/visible.

	// Temporary correction until SPARQL query can be revised.
	//if ('value' in top.resource.metadata.date)
	//	top.resource.metadata.date = top.resource.metadata.date.value

	// Render display form appropriate to spec type:
	do_resource_form(top.resource.metadata, 'templates/resource_summary_form.html')
}


function do_resource_form(data, form_URL, new_flag = false) {
	// Feeds specification.metadata variables to copy of template

	$.ajax(form_URL).done(function(response) {

		Object.keys(data).forEach(function(key) {
			value = data[key]
			// Search and replace signalled by @[variable name]
			var re = new RegExp('@' + key ,"g");
			response = response.replace(re, value)
		}) 

		$('#resourceForm').html(response)

		// 2 select lists to select options in:
		$('#summary_type option[value="'+data.type+'"]').prop('selected', true)
		$('#summary_status option[value="'+data.status+'"]').prop('selected', true)

		// If loaded data is direct from ontology, hide certain buttons. 
		var onto_fields = $('#summary_title,#summary_resource,#summary_description,#summary_prefix')

		if (data.type != 'ontology')
			$('.summary_prefix').hide()


		if (data.type == 'private') {

			$("#summary_license").removeAttr('readonly')


			if (new_flag) {
				// new records are always private, draft packages.
				$('.summary_resource,.summary_prefix').hide()
				$('#summary_delete,#summary_download,#summary_copy').hide()
			}
			else //
				$("#summary_status,#summary_type").prop('disabled', false)
			
		}
		else {
			// FUTURE: User may own a shared package, therefore can edit.
			$('#summary_delete,#summary_update').hide()
			
			onto_fields.attr('readonly','readonly')

		}

		$('#resourceForm').foundation()

		// Deals with #summary_delete, #summary_download, #summary_update
		$('#resourceForm').on('click','#summary_delete', function() {
			// API DELETE RESOURCE.
		})

		$('#resourceForm').on('click','#summary_download', function() {
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
			//do_resource_form(data, form_URL, new_flag = false) {
			$('#summary_delete,#summary_download,#summary_copy').show()
			return false
		})

	});

}


function do_resource_browse_menu() {
	/* Prepare browsable top-level list of ontology items
	Provide context of form to populate. Passes set_form_callback, name of function in this module for OntologyForm to return to when complete.
	*/

	//Have to reinsert this or reload doesn't fire up menu (zurb issue?)
	$('#panelEntities').html('<ul class="vertical menu" id="entityMenu" data-accordion-menu data-deep-link data-multi-open="true"></ul>')

	// If it is an ontology, render its data representation model tree:
	var root_id = 'OBI:0000658'
	if (root_id in top.resource.specifications)
		$("#entityMenu").html(render_menu(root_id))
	else
		$("#entityMenu").html(render_menu())

	$("#entityMenu").foundation();

	// If it is a package ... what is the top level menu id?

}



function check_for_hash_entity() {
	/* GEEM focuses on entities by way of a URL with hash GENEPIO:[entityId]
	CURRENTLY: HARD WIRED TO JUST BE GENEPIO OR FOODON.
	FUTURE: CHECK FOR VALID ENTITY REFERENCE IN SOME ONTOLOGY.
			PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
	*/
    if (location.hash.length > 0 && location.hash.indexOf(':') != -1) { 
		top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]

		if (!check_entity_resource(top.focusEntityId)) return

		$('#specificationSourceInfoBox').hide()
		$('#content').removeClass('disabled')

		// Providing set_form_callback to add shopping cart to form items.
		top.form = new OntologyForm("#mainForm", top.resource, top.formSettings, set_form_callback) 

		top.form.render_entity(top.focusEntityId)

		// When render_entity is called, activate its tab
		$('#content-tabs').foundation('selectTab', '#panelContent'); 

		// Wire form's submit button to show GEEM example form submit contents in popup.
		$('#buttonFormSubmit').on('click', function () {  
			set_modal_download(get_data_specification('form_submission.json'))
		})

	}
}


function get_ontology_detail_html(ontologyId) {

	// This links directly to form for this entity.  Not in context of larger form.
	// Problem is that recursion to fetch parts from parent runs into parents that 
	// have no further path.
	// ALSO SELECT LIST CHOICES DON'T HAVE DEPTH STEMMING FROM PARENT ENTITY, only from ???
	var entity = get_entity(ontologyId)
	var entityIdParts = entity['id'].split(':')
	var idPrefix = entityIdParts[0]
	if (idPrefix in top.resource['@context']) {
		entityId = top.resource['@context'][idPrefix] + entityIdParts[1]
	}
	else
		entityId = top.ontologyLookupService + entity['id']

	var labelURL = '<a href="' + entityId + '" target="_blank">' + entity['uiLabel'] + '</a>' 

	/* Provide a label mouseover display of underlying ontology details
	like original ontology definition, term id, synonyms, etc.
	*/
	var itemHTML = '<li><span class="infoLabel">ontology id:</span> ' + entity['id'] + '</li>\n'

	// Label is original ontology's label, not the user interface oriented one.
	// Show if there is a difference.
	if ('label' in entity && entity['label'] != entity['uiLabel'])
		itemHTML += '<li><span class="infoLabel">ontology label:</span> ' + entity['label'] + '</li>\n'
	
	// Add original definition if different.
	if ('definition' in entity && entity['uiDefinition'] != entity['definition'])
		itemHTML += '<li><span class="infoLabel">ontology definition:</span> <i>' + entity['definition'] + '</i></li>\n'
	
	// Hardcode properties that you want to show from specification here:
	var properties = ['hasDbXref','hasSynonym','hasExactSynonym','hasNarrowSynonym']
	for (ptr in properties) {
		var item = properties[ptr]
		if (item in entity) {
			for (var ptr2 in entity[item]) {
				var val = entity[item][ptr2]
				if (val.substr(0,4) == 'http') // covers https:// too.
					val = '<a href="' + val + '" target ="_blank">'+val+'</a>'
				itemHTML += '<li><span class="infoLabel">' + item + ':</span> ' + val + '</li>\n'
			}
		}
	}


	// Enable mouseover display of above.
	itemHTML = 	[labelURL, itemHTML].join('\n')

	return itemHTML
}


function render_display_context(event) {
	// Provide mouseover function to see dropdown menu that shows given item
	//as well as any parent items that link to it via "has member" and "has part"
	//and "is a" relations. Parents can be navigated to.
	//
	parent = $('#displayContext')
	if (parent.length) {
		$('#displayContext').foundation('destroy') // or else subsequent dropdown position is fixed.
		$('#displayContextButton,#displayContext').remove()
	}
	var thisDiv = $(this).parents('[data-ontology-id]').first()
	var ontologyPath = thisDiv.attr('data-ontology-id')
	var pathDivider = ontologyPath.lastIndexOf('/')
	if (pathDivider != -1) {
		var ontologyId = ontologyPath.substr(pathDivider+1)
	}
	else
		var ontologyId = ontologyPath 	

	var content = '<div id="displayContext" class="dropdown-pane"><ul>'
	if ($(this).is('.fi-magnifying-glass')) {
		content += get_ontology_detail_html(ontologyId) 
	}
	else //'.fi-arrow-up'
		content += '<ul>' + get_relations_html(ontologyId) + '</ul>'

	// Though it is hidden, have to include button or else Foundation throws error.
	content = '<button id="displayContextButton" data-toggle="displayContext">&nbsp; &nbsp;</button>' + content // style="position:absolute"

	$('body').after(content).foundation() //Places it.

	var elem = new Foundation.Dropdown($('#displayContext'), {hover:true, hoverPane:true});
	var iconPosition = $(this).offset()
	
	//So mouseout works
	$('#displayContextButton')
		.css('left', (iconPosition.left) + 'px')
		.css('top', (iconPosition.top) + 'px')

	$('#displayContext').foundation('open')
		.css('left', (iconPosition.left + 20) + 'px')
		.css('top', (iconPosition.top) + 'px')

	if ($(this).is('.fi-arrow-up'))
		// Drop-down content is defined, now we ennervate the up-arrows.
		// each can replace content 
		$('#displayContext').on('click','i.fi-arrow-up',function(event){
			// Insert shopping cart item 
			var target = $(event.target).parent()
			var targetId = target[0].dataset.ontologyId
			// DETECT IF ITEM HAS ALREADY HAD PARENTS ADDED?
			if ($('#displayContext ul[data-ontology-id="'+targetId+'"]').length == 0 ) {
				target.parent().wrap('<ul data-ontology-id="'+targetId+'">')
				target.parent().before(get_relations_html(targetId))
			}
		})

}


function get_relations_html(ontologyId) {
	// Finds and draws relations as li links for given entity
	var entity = get_entity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += get_relation_link('parent', get_entity(entity['parent']))
	}
	// Possibly organize each entity's relations under a "relations" section?
	for (const relation of ['member_of','otherParent']) {
		if (relation in entity) {
			for (const targetId of entity[relation]) {
				filling += get_relation_link(relation, get_entity(targetId))
			}
		}
	}
	return filling
}

function get_relation_link(relation, entity) {
	// Used in search results
	// Usually but not always there are links.  Performance boost if we drop this test.
	var links = ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">'
		,	relation, ': ', links ? '<i class="fi-arrow-up large"></i> ' : ''
		,	' <a href="#', entity['id'], '">' + entity['uiLabel'] + ' <i class="fi-magnifying-glass large"></i></a>'
		,'</li>'
	].join('')
}




/*********** ENTITY MENU RENDERER *************************/
function render_menu(entityId = null, depth = 0 ) {
	// If entityId not given, display all top-level 'datatype:"model"' 
	// items in resource

	var html = ""
	var children = {}
	if (!entityId) {
		// Ordered at all?
		
		for (entity_id in top.resource.specifications) {

			entity = top.resource.specifications[entity_id]
			// If a model, and not subordinate to some other model
			if (entity.datatype == 'model' && (! (  'parent' in entity) || !( entity['parent'] in top.resource.specifications))) {
				children[entity_id] = []
			}
		}
	}
	else {
		var entity = top.resource.specifications[entityId]
		if (entity) {
			// Ran into this once ...
			if ('parent' in entity && parent['id'] == entityId) {
				console.log("Node: " + entityId + " is a parent of itself and so is not re-rendered.")
				return html
			}
			if ('models' in entity)
				children = entity['models']
		}
		
		if (depth > 0) {
			html = [
				'<li class="cart-item" data-ontology-id="',	entityId,'">'
			 	,	'<a href="#'+entityId+'">'
				,		entity['uiLabel']
				,		children.length ? ' <i class="fi-magnifying-glass"></i>' : ''
				,	'</a>'
			].join('')
		}

	}

	// See if entity has subordinate parts that need rendering:
	if (children) {
		for (var memberId in children) {
			// Top level menu items
			if (depth == 0) html += render_menu(memberId, depth + 1)
			// Deeper menu items
			else {
				// Only list item if it has components or models
				var child = top.resource.specifications[memberId]
				if (child && ('models' in child || 'components' in child))
					html += [
					'<ul class="menu vertical nested">'
					,	render_menu(memberId, depth + 1)
					,'</ul>'
					].join('')
			}
		}
	}

	if (depth > 0)
		html +=	'</li>'

	if (html == '') 
		html = '<div class="infoBox">This package does not contain any specifications.</div>'
	return html
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

/************************ TAB INITIALIZATION *******************/

function init_resource_select(resources) {
	// Assumes resources sorted.
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

function init_summary_tab() {

}

function init_browse_tab() {
	// On Browse Specifications tab, enables eye icon click to show form 
	// without opening/closing the accordion.
	// ARCHAIC: menu parent never rendered, only leafs are rendered.
	/*
	$('#panelEntities').on('click', 'i', function(event) { 
		event.stopPropagation();
		if ($(event.target).is('i.fi-magnifying-glass') ) {
			top.form.render_entity(get_attr_ontology_id(event.target))
		}
	});
	*/
}

function init_form_tab() {

	// This control toggles the visibility of ontology ID's in the given 
	// form content (for reference during content review)
	$('input#toggleIdVisibility').on('change', function() {
		top.formSettings.ontologyDetails = $(this).is(':checked')
		top.form.render_entity()
	})

	// Display all optional elements as label [+] for concise display.
	$('input#toggleMinimalForm').on('change', function() {
		top.formSettings.minimalForm = $(this).is(':checked')
		top.form.render_entity()
	})


}



function init_specification_tab() {

	// Trigger popup JSON / EXCELL / YAML view of specification
	$('#specificationType').on('change', function() {
		set_data_specification(get_data_specification( $(this).val() )) 
	}) 

	$('#spec_download').on('click', download_data_specification) // the button, not the surrounding link.
	
}
