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
	Updated: July 13, 2018
	
*/

/*********** ALL THE SETUP ***************************************************/

resources = []	// Ontologies and shared/private packages available to user
resource = {} 	// Current specification database being browsed and searched
focusEntityId = null // path contains unique id of resource.
formSettings = {}
form = {}
cart = []

ONTOLOGY_LOOKUP_SERVICE_URL = 'https://www.ebi.ac.uk/ols/search?q='
// Hardcode properties to show in entity detail modal dialog.
RENDER_PROPERTIES = ['hasDbXref','hasSynonym','hasExactSynonym','hasNarrowSynonym']

$( document ).ready(function($) {
	
	// Done early because form rendering (before application of foundation()
	// may reference top.settings.patterns, etc.
	OntologyForm.init_foundation_settings()

	api = new GeemAPI()

	/************************* Load Shared Templates ************************/
	// Modal_lookup is form for looking up an ontology term's underlying items
 	$.ajax('templates/modal_lookup.html').done(function(response){
		$('#template_area').append(response)
	});

	/*************** Specification resource selection area ******************/
	api.get_resources().then(init_resource_select)

	init_summary_tab()
	init_browse_tab()
	init_search_tab()
	init_cart_tab()

	/*********************** Specification focus area ***********************/

	init_form_tab()
	init_specification_tab()
	// init_discuss_tab()
	init_validation_tab()


	// See configuration: https://foundation.zurb.com/sites/docs/v/5.5.3/javascript.html
	// Initializes Zurb Foundation settings (but not foundation itself)

	$(document).foundation()
	
	//$(document).foundation('abide')

	// GEEM focuses on entities by way of a URL with hash #[entityId]
	$(window).on('hashchange', function() {
		check_entity_id_change(resource_callback, render_entity_form)
	});

	// If there's ALREADY a #ONTOLOGY:ID hash in URL then render that form.
	check_entity_id_change(resource_callback, render_entity_form)

});


function resource_callback(resource) {
	/* This function is triggered after a fetch for a particular resource by id.

	*/
	
	$('#resourceTabs').removeClass('disabled')
	//$('#resourceTabContent').show() //, #panelLibrary - don't include this or display="block" confounds tab programming
	$('#specificationSummaryTabLink').click() // Shows tab that has resource form
	// Prepare browsable top-level list of ontology items
	render_resource_form()
	render_resource_menu_init()

}


function render_entity_form() {

	$('#specificationSourceInfoBox').hide()
	//$('#content').removeClass('disabled')

	// Providing form_callback to add shopping cart to form items.
	top.form = new OntologyForm('#mainForm', top.resource.contents, top.formSettings, portal_entity_form_callback) 

	top.form.render_entity(top.focusEntityId)

	$(document).foundation()

	//$('#mainForm').foundation('abide','events');
	// See init_form_tab() for validation, submit setup.

}


/**
 * De-render form view tab,
 */
function derender_entity_form() {
	$('#mainForm').empty();
	$('#formControls').empty();
	$('#specificationSourceInfoBox').show();
}


/**
 * Reset specifications tab.
 */
function reset_specification_tab() {
	$('#specificationType')[0].selectedIndex = 0;
	$('#dataSpecification').empty().hide();
	$("#helpDataSpecification").show();
}


function portal_entity_form_callback(form) {
	/* This is executed after a new form is rendered.
	*/

	// Add the extra shopping cart icons for portal version of form
	render_entity_form_cart_icons(form) 

	$('#specificationSourceInfoBox').hide()
	reset_specification_tab();

	// Provide content area banner that shows selected entity
	const entity = get_form_specification_component(form.entityId)
	$('#formEntityLabel')
		.html(get_label(entity) + ' &nbsp; <span class="medium">**(' + entity.id + ')</span>')
	$('#mainForm > div.field-wrapper > label')
		.html(get_definition(entity) || '<span class="small float-right">(select all)</span>')

	// Content area functionality is blocked until form loaded
	//$('#content').removeClass('disabled')
	// When render_entity is called, activate its (form) tab
	// THIS ISN'T WORKING!!!!
	$('#content-tabs').foundation('selectTab', $('#panelContent') ); 
	$('#panelContent').attr('aria-hidden', false) // Not sure why above isn't working?

}


/********************* Resource Entity Tree Menu Display *******************/

function render_resource_menu_init() {
	/* Prepare browsable top-level list of ontology items
	Provide context of form to populate. Passes form_callback, name of 
	function in this module for OntologyForm to return to when complete.

	If loaded resource has a "data representation model" then display kids.
	Usually this means its an ontology.
	Otherwise display any top-level model.
	*/

	//Have to reinsert this or reload doesn't fire up menu (zurb issue?)
	//$('#panelEntities').html('<ul class="vertical menu" id="entityMenu" data-accordion-menu data-deep-link data-multi-open="true"></ul>')
	//$('#panelEntities').html('<ul class="vertical menu drilldown" data-drilldown id="entityMenu"></ul>')

	var entities = {}
	var root_id = 'OBI:0000658' //"data representation model" 
	var html = ''

	let specifications;
	if (top.resource.contents && top.resource.contents.specifications) {
		specifications = top.resource.contents.specifications
	}

	if (root_id in specifications) {
		entities = top.resource.contents.specifications[root_id].models
	}
	// Ontology
	else if (top.resource.ontology) {
		// Search for any top level model
		for (const entity_id in specifications) {
			const entity = specifications[entity_id];
			// If a model, and not subordinate to some other model
			if (entity.datatype === 'model' && (!('parent' in entity) || !(entity['parent']
				in specifications))) {
				entities[entity_id] = []
			}
		}
	}
	// Not an ontology
	else {
		for (const entity_id in specifications) {
			const entity = specifications[entity_id];

			let parents = [];
			if ('parent' in entity) {
				parents.push(entity.parent)
			}
			if ('otherParent' in entity) {
				parents = parents.concat(entity.otherParent)
			}
			if ('member_of' in entity) {
				parents = parents.concat(entity.member_of)
			}

			const specified_parents = parents.filter(parent => parent in specifications);

			if (!specified_parents.length) entities[entity_id] = []
		}
	}

	for (const entity_id in entities) {
		html += render_resource_accordion(entity_id, top.resource.ontology)
	}

	if (html == '') 
		html = '<div class="infoBox">This resource does not contain any specifications.</div>'

	$("#entityMenu").html(html)

}


/**
 * Render top-level item (accordion), and underlying hierarchic menu
 * @param {string} entity_id - ID of top-level item
 * @param {boolean} ontology - Whether top-level item comes from an
 * 	ontology or not
 * @returns {string} HTML to be rendered
 */
function render_resource_accordion(entity_id, ontology) {
	const entity = top.resource.contents.specifications[entity_id];
	const normalized_id = entity.id.replace(':','_');

	const subordinates_html = render_resource_menu(entity, undefined, ontology);

	// If there are no subordinates, accordion must direct to its
	// own page.
	if (subordinates_html === '') {
		$('#entityMenu').on('click', `[href=#menu_${normalized_id}]`, function () {
			window.location.hash = entity.id
		});
	}

	return `
		<li class="accordion-navigation small">
			<a href="#menu_${normalized_id}">${get_label(entity)}</a>
			<div id="menu_${normalized_id}" class="content">
				<ul class="side-nav">${subordinates_html}</ul>
			</div>
		</li>
	`;
}


/**
 * Recursively render subordinates under top-level items in browse-tab.
 * @param {Object} entity - Top-level item
 * @param {number} depth - Accumulator used in recursion to render
 * 	subordinates with appropriate indentation
 * @param {boolean} ontology - Whether top-level item comes from an
 * 	ontology or not
 * @returns {string} HTML to be rendered
 */
function render_resource_menu(entity=null, depth=0, ontology) {
	let html = '';

	let subordinate_ids = [];
	if (ontology) {
		// Only list item if it has components or models
		if ('models' in entity) subordinate_ids = Object.keys(entity.models)
	} else {
		if ('models' in entity) subordinate_ids = Object.keys(entity.models);
		if ('components' in entity) {
			subordinate_ids = subordinate_ids.concat(Object.keys(entity.components))
		}
	}

	// Only list item if it has components or models
	for (const subordinate_id of subordinate_ids) {
		const child = top.resource.contents.specifications[subordinate_id];
		if (child) {
			// Infinite loop possible
			if ('parent' in child && child.parent.id === entity.id) {
				console.log('Node: ' + entity.id
					+ ' is a parent of itself and so is not re-rendered');
				return ''
			}

			let child_html = '';
			let label = get_label(child);
			if ('models' in child) {
				child_html = render_resource_menu(child, depth + 1, ontology);
				label += ' <i class="fi-magnifying-glass"></i>'
			}

			html += `
				<li class="cart-item" data-ontology-id="${child.id}">
					<a href="#${child.id}">${label}</a>
					<ul class="side-nav">${child_html}</ul>
				</li>
			`;
		}
	}

	return html;
}

function render_display_context(event) {
	/* When browsing a resources entities, Provide mouseover function to see
	dropdown menu that shows given item	as well as any parent items that link
	to it via "has member" and "has part" and "is a" relations. Parents can be
	navigated to.
	*/

	var thisDiv = $(this).parents('[data-ontology-id]').first()
	var ontologyPath = thisDiv.attr('data-ontology-id')

	var pathDivider = ontologyPath.lastIndexOf('/')
	var ontologyId = (pathDivider != -1) ? ontologyPath.substr(pathDivider+1) : ontologyPath 	

	if ($(this).is('.fi-magnifying-glass')) {
		$('#displayContext').html(render_entity_detail(ontologyId) )
	}
	else //'.fi-arrow-up'
		$('#displayContext').html( '<ul>' + render_entity_relations(ontologyId) + '</ul>' )

	// Position displayContextButton glass ON TOP OF current one, thus triggering modal details view.
	var iconPosition = $(this).offset()
	$('#displayContextButton')
		.css('left', (iconPosition.left) + 'px')
		.css('top', (iconPosition.top) + 'px')

}


function render_entity_detail(ontologyId) {
	/* In popup modal, display item's ontology id and definition, and 
	synonyms, dbxrefs etc. ID is linked directly to GEEM form for this
	entity, skipping path context of its context in encompassing form.
	*/
	var entity = get_entity(ontologyId)
	var entityIdParts = entity['id'].split(':')
	var idPrefix = entityIdParts[0]
	if (idPrefix in top.resource.contents['@context']) {
		entity_url = top.resource.contents['@context'][idPrefix] + entityIdParts[1]
	}
	else
		entity_url = top.ONTOLOGY_LOOKUP_SERVICE_URL + entity['id']

	// ENTITY_ID - hyperlinked to tab/popup
	var itemHTML = '<li><span class="infoLabel">ontology id:</span><a href="' + entityId + '" target="_blank">' + entity['id'] + '</a></li>\n'

	// UI_LABEL if available
	if ('ui_label' in entity)
		itemHTML += '<li><span class="infoLabel">UI label:</span> ' + entity.ui_label + '</li>\n'

	// UI_DEFINITION if available
	if ('ui_definition' in entity)
		itemHTML += '<li><span class="infoLabel">UI definition:</span> <i>' + entity.ui_definition + '</i></li>\n'

	// LABEL - from original ontology
	itemHTML += '<li><span class="infoLabel">ontology label:</span> ' + entity.label + '</li>\n'

	// DEFINITION - from original ontology
	if (entity.definition)
		itemHTML += '<li><span class="infoLabel">ontology definition:</span> <i>' + entity.definition + '</i></li>\n'
	
	for (ptr in RENDER_PROPERTIES) {
		var item = RENDER_PROPERTIES[ptr]
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


function render_entity_relations(ontologyId) {
	// Returns relations as li links for given entity
	var entity = get_entity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += render_relation_link('parent', get_entity(entity.parent))
	}
	// Possibly organize each entity's relations under a "relations" section?
	for (const relation of ['member_of','otherParent']) {
		if (relation in entity) {
			for (const targetId of entity[relation]) {
				filling += render_relation_link(relation, get_entity(targetId))
			}
		}
	}
	return filling
}

function render_relation_link(relation, entity) {
	// Used in search results
	// Usually but not always there are links.  Performance boost if we drop this test.
	var links = ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">'
		,	relation, ': ', links ? '<i class="fi-arrow-up large"></i> ' : ''
		,	' <a href="#', entity['id'], '">'
		,		get_label(entity)
		,		' <i class="fi-magnifying-glass large"></i>'
		,	'</a>'
		,'</li>'
	].join('')
}



/***************************** TAB INITIALIZATION ***************************/



function init_summary_tab() {

	$('#resourceForm').on('click','#summary_create,#summary_copy', function() {
		// Get all form fields and pass to api.create_resource()
		var data = get_form_data($('#resourceForm'))
		if ($(this).is('#summary_copy'))
			data.name = data.name + ' - COPY'
		// #Django expecting flat format with contents 
		data.contents = JSON.stringify(data.contents)
		api.create_resource(data)
			.then(function(resource) {
				api.get_resources()
				.then(init_resource_select)
				.then(function(){
					$('#specificationType').val(resource.id) // select given resource to load it
				})

				//init_resource_select(top.resources)
				//$('#specificationType').val(resource.id) // select given resource to load it
				//return resource
			})
			//.then(resource_callback)

		return false
	})


	// Deals with #summary_delete, #summary_download, #summary_update
	$('#resourceForm').on('click','#summary_delete', function() {
		// API DELETE RESOURCE.
		var id = parseInt($('#resourceForm input[name="id"]').val())
		var message = "Confirm deletion of this package?"
		if (id && id != RESOURCE_TEMPLATE_ID && confirm(message) ) {
			api.delete_resource(id)
				.then(function(){
					api.get_resources()
					.then(init_resource_select)
				})
	
			console.log("Deleted " + id)
		}		
		return false
	})

	$('#resourceForm').on('click','#summary_download', function() {
		/* Currently this function is downloading client-side 
		representation of package or ontology json.
		*/
		var content =  {
			content: JSON.stringify(top.resource.contents),
			report_type: 'geem.json',
			id: top.resource.contents.metadata.prefix.toLowerCase()
		}
		download_data_specification(content)
		return false
	})

	$('#resourceForm').on('click', '#summary_update', function() {

		var data = get_form_data($('#resourceForm'))
		data.contents = JSON.stringify(data.contents)
		api.update_resource(data)
			.then(resource_callback)

		existing_resource = top.resources.filter(record => record.id = data.id)
		//init_resource_select(top.resources)
		//$('#specificationType').val(resources.id)
		return false
	})


}

function init_browse_tab() {
	/* Browse Specifications tab
	*/
}

function init_form_tab() {

	/* Wire form's submit button to show GEEM example form submit contents in popup.*/
	$('#mainForm').on('click', '.buttonFormSubmit', function (e) {  
		e.preventDefault();
		$('#mainForm').foundation("validateForm")
		set_modal_download(get_data_specification('form_submission.json'))
		return false
	})

	// Form validation triggers constructed once, not every time its rendered
	$('#mainForm').on('forminvalid.zf.abide,invalid,invalid.fndtn.abide', function(e) {
		e.preventDefault();
		console.log("invalid trigger"); 
		alert("invalid trigger")
	});
	$('#mainForm').on('valid,valid.fndtn.abide', function(e) {
		e.preventDefault();
		console.log("valid trigger"); 
		alert("valid trigger")
	});
	$('#mainForm').on('submit', function(e) {
		//e.preventDefault();
		console.log("submit triggered");
		// NOW VALIDATE
		$('#mainForm').foundation("validateForm")
	});

	$(document).bind('invalid.zf.abide',function(e) {
  		console.log("Sorry, "+e.target.id+" is not valid");
	});
	// to submit via ajax, add the 2 bindings below.  
	/*
	$(document)
	.bind("submit", function(e) {
	  e.preventDefault();
	  console.log("submit intercepted");
	  $('#mainForm').foundation("validateForm")
	})
	.bind("formvalid.zf.abide", function(e,$form) {
	  // ajax submit
	});
	*/

	// In form display area, when "toggle specification details" is on,
	// provides hover view of item's ontology details
	$("#tabsContent").on('mouseenter', 'i.fi-magnifying-glass', render_display_context)
	$(document).on('closed.fndtn.reveal', '#displayContext', function () { //[data-reveal]
		// Gets hidden 'details' icon off screen, if any. See render_display_context()
		$('#displayContextButton').css('left', '-30px')
	});

	// chosen <select> event triggers cart icons to be drawn in <options>
	render_entity_form_select_cart_icons()

	// Check and update shopping cart include/exclude status of this item
	$("#tabsContent").on('click', "i.fi-shopping-cart", function(event){
		// Prevents parent cart items from getting same click event
		event.stopPropagation(); 
		cart_check(get_attr_ontology_id(this))
		//return false
	})

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

	// Slightly tricky: '#spec_download' is the button, not surrounding link.
	$('#spec_download').on('click', download_data_specification) 
	
}

function init_validation_tab() {
	$(document).ready(function () {
		const grid_options = get_grid_options();
		create_grid(grid_options);
		$('#validation_download').click(function () {
			grid_options.api.exportDataAsCsv()
		});
		$('#validation_upload').change(function () {
			$('#validation_form').submit()
		})
	});
}

/******************************** UTILITY FUNCTIONS *************************/

function get_entity(ontologyId) {
	return top.resource.contents.specifications[ontologyId]
}


function get_label(entity) {
	// Label listed an entity's features label overrides ui_label
	if (entity.features && entity.features.label)
		//return entity.features.label.value
		return entity.features.label.value

	if (entity.ui_label)
		return entity.ui_label

	//TRANSITIONAL:
	if (entity.uiLabel)
		return entity.uiLabel

	return entity.label
}

function dom_item_animate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	// Enables shopping cart tab icon to flicker when new item added
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}

