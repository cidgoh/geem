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

ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='

$( document ).ready(function() {

	// Initializes Zurb Foundation settings (but not foundation itself)
	OntologyForm.init_foundation()

	api = new GeemAPI()

	/************************* LOAD SHARED TEMPLATES ************************/
	// Modal_lookup is form for looking up an ontology term's underlying items
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
	// In form display area, provides hover view of item's ontology details
	$("#tabsContent").on('mouseenter','i.fi-magnifying-glass', render_display_context)

	init_form_tab()
	init_specification_tab()
	// initDiscussTab()
	init_cart_tab()

	$(document).foundation()

	// GEEM focuses on entities by way of a URL with hash #[entityId]
	$(window).on('hashchange', function() {
		check_entity_id_change(resource_callback, render_entity_form)
	});

	// If there's ALREADY a #ONTOLOGY:ID hash in URL then render that form.
	check_entity_id_change(resource_callback, render_entity_form)

});


function resource_callback(resource) {

	$('#resourceTabs').removeClass('disabled')
	$('#tabsSpecification').show()
	$('#specificationSummaryTabLink').click() // Shows tab that has resource form

	// Prepare browsable top-level list of ontology items
	render_resource_form()
	render_resource_menu_init()

}


function render_entity_form() {

	$('#specificationSourceInfoBox').hide()
	$('#content').removeClass('disabled')

	// Providing form_callback to add shopping cart to form items.
	top.form = new OntologyForm('#mainForm', top.resource, top.formSettings, portal_entity_form_callback) 

	top.form.render_entity(top.focusEntityId)

	// When render_entity is called, activate its (form) tab
	$('#content-tabs').foundation('selectTab', '#panelContent'); 

	// Wire form's submit button to show GEEM example form submit contents in popup.
	$('#buttonFormSubmit').on('click', function () {  
		set_modal_download(get_data_specification('form_submission.json'))
	})

}

function portal_entity_form_callback(form) {
	/* This is executed whenever a new form is rendered.
	*/
	render_entity_form_cart_icons(form) 

	$('#specificationSourceInfoBox').hide()

	// Clear out specification tab. Deselect specification menu.
	$('#specificationType')[0].selectedIndex = 0
	$('#dataSpecification').empty()
	$('#specification-tabs li.is-active')
		.removeClass('is-active')
		.find('a').removeAttr('aria-selected'); // how else?

	// Provide content area banner that shows selected entity
	const entity = get_form_specification_component(form.entityId)
	$('#formEntityLabel')
		.html(entity.uiLabel + ' &nbsp; <span class="medium">**(' + entity.id + ')</span>')
	$('#mainForm > div.field-wrapper > label')
		.html(entity.definition || '<span class="small float-right">(select all)</span>')

	// Content area functionality is blocked until form loaded
	$('#content').removeClass('disabled')

}


/********************* Resource Entity Tree Menu Display *******************/

function render_resource_menu_init() {
	/* Prepare browsable top-level list of ontology items
	Provide context of form to populate. Passes form_callback, name of function in this module for OntologyForm to return to when complete.

	If it is a package ... what is the top level menu id?
	*/

	//Have to reinsert this or reload doesn't fire up menu (zurb issue?)
	$('#panelEntities').html('<ul class="vertical menu" id="entityMenu" data-accordion-menu data-deep-link data-multi-open="true"></ul>')

	// If it is an ontology, render its data representation model tree:
	var root_id = 'OBI:0000658'
	if (root_id in top.resource.specifications)
		$("#entityMenu").html(render_resource_menu(root_id))
	else
		$("#entityMenu").html(render_resource_menu())

	$("#entityMenu").foundation();

}

function render_resource_menu(entityId = null, depth = 0 ) {
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
			if (depth == 0) html += render_resource_menu(memberId, depth + 1)
			// Deeper menu items
			else {
				// Only list item if it has components or models
				var child = top.resource.specifications[memberId]
				if (child && ('models' in child || 'components' in child))
					html += [
					'<ul class="menu vertical nested">'
					,	render_resource_menu(memberId, depth + 1)
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


function render_entity_detail(ontologyId) {

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

	var labelURL = '<a href="' + entityId + '" target="_blank">' + entity.uiLabel + '</a>' 

	/* Provide a label mouseover display of underlying ontology details
	like original ontology definition, term id, synonyms, etc.
	*/
	var itemHTML = '<li><span class="infoLabel">ontology id:</span> ' + entity.id + '</li>\n'

	// Label is original ontology's label, not the user interface oriented one.
	// Show if there is a difference.
	if (entity.label && entity.label != entity.uiLabel)
		itemHTML += '<li><span class="infoLabel">ontology label:</span> ' + entity.label + '</li>\n'
	
	// Add original definition if different.
	if (entity.definition && entity.uiDefinition != entity.definition)
		itemHTML += '<li><span class="infoLabel">ontology definition:</span> <i>' + entity.definition + '</i></li>\n'
	
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
	/* When browsing a resources entities, Provide mouseover function to see
	dropdown menu that shows given item	as well as any parent items that link
	to it via "has member" and "has part" and "is a" relations. Parents can be
	navigated to.
	*/
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
		content += render_entity_detail(ontologyId) 
	}
	else //'.fi-arrow-up'
		content += '<ul>' + render_entity_relations(ontologyId) + '</ul>'

	// Though it is hidden, have to include button or else Foundation throws error.
	content = '<button id="displayContextButton" data-toggle="displayContext">&nbsp; &nbsp;</button>' + content

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
				target.parent().before(render_entity_relations(targetId))
			}
		})

}


function render_entity_relations(ontologyId) {
	// Returns relations as li links for given entity
	var entity = get_entity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += get_relation_link('parent', get_entity(entity['parent']))
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
		,		entity['uiLabel']
		,		' <i class="fi-magnifying-glass large"></i>'
		,	'</a>'
		,'</li>'
	].join('')
}



/***************************** TAB INITIALIZATION ***************************/



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
	// chosen <select> event triggers cart icons to be drawn in <options>
	render_entity_form_select_cart_icons()

	// Check and update shopping cart include/exclude status of this item
	$("#tabsContent").on('click', "i.fi-shopping-cart", function(event){
		// Prevents parent cart items from getting same click event
		event.stopPropagation(); 
		cart_check(get_attr_ontology_id(this))
		return false
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


/******************************** UTILITY FUNCTIONS *************************/

function get_entity(ontologyId) {
	return top.resource.specifications[ontologyId]
}

function dom_item_animate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	// Enables shopping cart tab icon to flicker when new item added
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}

