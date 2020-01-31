/********************** Ontology Entity Mart Prototype ************************

	This script provides the engine for displaying ontology .owl file and user 
	package specifications that have been marked up according to the Genomic
	Epidemiology Entity Mart (GEEM) coding system (annotations and a few 
	relations), allowing one to search and browse any data representation model
	items therein, and related numeric, categorical and textual datums.
	
	This code supports a portal.html page for selecting a given ontology, 
	navigating through its various GEEM annotated specs, enabling the user to
	view html forms and tabular/json etc. specifications, and create their own 
	downloadable packages.

	As well a form.html page is available for focusing on a particular spec.

    Author: Damion Dooley, Ivan Gill
	Project: genepio.org/geem

*/

/*********** ALL THE SETUP ***************************************************/

resources = []	// Ontologies and shared/private packages available to user
resource = {} 	// Current specification database being browsed and searched
focusEntityId = null // path contains unique id of resource.
formSettings = {}
form = {}
cart = []

// OBI data representation model class.
ROOT_ID = 'OBI:0000658'

/**
 * List of GEEM specific classes under 'data representation model'
 * All user packages should include these three classes for organizational purposes.
 *   NCIT_C103180 - Data Standard
 *   GENEPIO_0000106 - Draft Data Standard
 *   GENEPIO_0001342 - Data Standard Component
*/
ROOT_SPECIFICATION_IDS = ['NCIT:C103180','GENEPIO:0000106','GENEPIO:0001342']

ONTOLOGY_LOOKUP_SERVICE_URL = 'https://www.ebi.ac.uk/ols/search?q='

// Hardcode properties to show in entity detail modal dialog.
RENDER_PROPERTIES = ['hasDbXref','hasSynonym','hasBroadSynonym','hasExactSynonym','hasNarrowSynonym']

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


	// Initializes Zurb Foundation according to GEEM settings
	// See configuration: https://foundation.zurb.com/sites/docs/v/5.5.3/javascript.html
	$(document).foundation({abide : top.settings})
	
	// GEEM focuses on entities by way of a URL with hash #[entityId]
	$(window).on('hashchange', function() {
		check_entity_id_change(resource_callback, render_entity_form)
	});

	// If there's ALREADY a #ONTOLOGY:ID hash in URL then render that form.
	check_entity_id_change(resource_callback, render_entity_form)
});

/**
 * This function is triggered after a fetch for a particular resource by id.
*/
function resource_callback(resource) {

	$('#resourceTabs').removeClass('disabled')
	//$('#resourceTabContent').show() //, #panelLibrary - don't include this or display="block" confounds tab programming
	$('#specificationSummaryTabLink').click() // Shows tab that has resource form
	render_resource_form()
	// Prepare browsable top-level list of ontology items
	render_resource_menu_init('#entityMenu')

}


function render_entity_form() {

	$('#specificationSourceInfoBox').hide()

	// Providing form_callback to add shopping cart to form items.
	top.form = new OntologyForm('#mainForm', top.resource.contents, top.formSettings, portal_entity_form_callback) 

	top.form.render_entity(top.focusEntityId)

	// Wire submit button to show GEEM example form submit contents in popup.
	top.form.formDomId
		.bind('valid.fndtn.abide,formvalid.zf.abide', function (e) {
	    	set_modal_download(get_data_specification('form_submission.json'));
		})
		.bind('submit', function (e) {
	    	// Otherwise if URL is like form.html#ONTOLOGY:ID it will reload with a 
	    	// ? like "form.html?#ONTOLOGY:ID" thus shortcutting set_modal_download()
	    	return false;
	  	});
}


/**
 * De-render form view tab,
 */
function derender_entity_form() {
	$('#mainForm').empty();
	//$('#formControls').hide(); // Need form controls for full exploration of a form
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

	// Set up ontology view in validation tab
	let components;
	if (entity.hasOwnProperty('components')) {
		components = entity.components
	} else {
		// If the form has no defined components, than the
		// top-level item itself is a component.
		components = [{'label': entity.label, 'id': entity.id}]
	}
	render_validation_ontology_view(components);

	// Content area functionality is blocked until form loaded
	//$('#content').removeClass('disabled')
	// When render_entity is called, activate its (form) tab
	// THIS ISN'T WORKING!!!!
	$('#content-tabs').foundation('selectTab', $('#panelContent') ); 
	$('#panelContent').attr('aria-hidden', false) // Not sure why above isn't working?

}


/********************* Resource Entity Tree Menu Display *******************/

/** 
 * Prepare browsable top-level list of ontology items
 * For all ontologies and user packages, shows OBI "data representation model" 
 * classes that GEEM uses (ROOT_SPECIFICATION_IDS), as well as any top-level
 * items users may have that are not set as subclasses of above.
 *
 * @param {string} domId - id of ul menu element to initialize.
*/
function render_resource_menu_init(domId) {

	let html = render_data_standard_menu(ROOT_SPECIFICATION_IDS, 'ontology-spec')

	/* For all items in specifications that don't fall under above data 
	   standard classes, add root ancestor to stack. If parent can be added,
	   remove child. Then render stack based on items.
	*/
	if (!top.resource.ontology && top.resource.contents && top.resource.contents.specifications) {
		
		let entities = [];
		let specifications = top.resource.contents.specifications;

		for (const entity_id in specifications) {
			const entity = specifications[entity_id];

			let parents = [];
			if (entity.parent) {
				parents.push(entity.parent);
			}
			if (entity.otherParent) {
				parents = parents.concat(entity.otherParent);
			}
			if (entity.member_of) {
				parents = parents.concat(entity.member_of);
			}

			// Winnow parents list down to those that have key in specifications
			const specified_parents = parents.filter(parent => parent in specifications);

			// If entity is top level, i.e. no viable parents, add it to menu
			if (specified_parents.length == 0) {
				entities.push(entity_id);
			}
		}

		html += render_data_standard_menu(entities, 'user-spec')

	}

	if (html == '') 
		html = '<div class="infoBox">This resource does not contain any specifications.</div>'

	$(domId).html(html);

	// Add jquery control to toggle menu, begining with hidden menu
	$(domId).children('li').find('ul').hide();
	$(domId).off().on('click', 'li', function (event) {
		event.stopPropagation();
		$(this).toggleClass('open').children('ul').toggle('fast','linear');
		$(this).siblings().removeClass('open').find('ul:visible').toggle('fast','linear');
	})

}

/**
 * Render top-level ROOT_SPECIFICATION_IDS items and underlying hierarchic menu
 * @param {boolean} grouping - add li.grouping class to item for styling.
 * @returns {string} HTML to be rendered
 */
function render_data_standard_menu(entity_ids, css_class=null) {

	let html = '';

	for (const entity_id of entity_ids) {
		const entity = top.resource.contents.specifications[entity_id];
		if (entity) {
			let child_icon = '';
			let menu_content = render_resource_menu(entity.id);
			if (menu_content)
				child_icon = '<i class="fi-play"></i>';
			let css_class2 = css_class ? ` class="${css_class}"` : '';
			html += 
				`<li role="menuitem"${css_class2}>
					${child_icon}<a href="#${entity.id}">${get_label(entity)}</a>
					<ul class="side-nav" id="menu_${entity.id}" role="navigation">
						${menu_content}
					</ul>
				</li>
			`;
		}
	}
	return html;
}


/**
 * Recursively render subordinates under given item in browse-tab.
 * @param {string} entity_id - a specification item.
 * @param {number} depth - Accumulator used in recursion to render
 * 	subordinates with appropriate indentation
 * @returns {string} HTML to be rendered
 */
function render_resource_menu(entity_id, depth=0) {

	const entity = top.resource.contents.specifications[entity_id];
	if (!entity)
		return '';

	let html = '';
	let subordinate_ids = [];

	// List item if it has components or models
	if ('models' in entity) 
		subordinate_ids = Object.keys(entity.models)

	if (!top.resource.ontology) {
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
				console.log('Node: ' + entity.id + ' is a parent of itself and so is not re-rendered');
				return ''
			}
			let componentless = !child.components || child.components.length == 0;
			if (!child.models && componentless) {
				continue
			}

			let child_html = null;
			let label = get_label(child);
			let prefix = '';
			let children = '';
			let child_icon = '';
			let linkable = '';

			// If an item doesn't have components, then its link should just pertain to opening menu.
			normalized_id = entity.id.replace(':','_');

			child_html = render_resource_menu(child.id, depth + 1);
			if (child_html) {
				children = ' children';
				child_icon = '<i class="fi-play"></i>';
				child_html = `<ul class="side-nav" role="navigation">${child_html}</ul>`;
			}

			if (componentless) {
				prefix = 'menu_';
				if (!child_html)
					continue;
			}
			else {
				linkable = ' linkable';
			}

			html += `
				<li role="menuitem" class="${linkable}${children}">
					${child_icon}<a href="#${prefix}${child.id}">${label}</a>
					${child_html}
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

	Issue: currently sometimes entity ids don't have recognized prefix, so
	instead have full URL.  It is difficult to split up a path that contains
	this: [ontology:id]/[http://a.b/stuff/ontology:id]
	We make the assumption that if a full http entity ID happens it is at the
	end of a path, which should work ok.  Can phase this code out when all
	entities have recognized prefix.
	*/

	var thisDiv = $(this).parents('[data-ontology-id]').first()
	var ontologyPath = thisDiv.attr('data-ontology-id')

	var ontologyId = ontologyPath
	var pathDivider = ontologyPath.lastIndexOf('http')
	if (pathDivider != -1) // Here last item
		ontologyId = ontologyPath.substr(pathDivider)
	else {
		pathDivider = ontologyPath.lastIndexOf('/')
		if (pathDivider != -1)
			ontologyId = ontologyPath.substr(pathDivider+1)
	}

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

function split_path(path) {

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


function render_entity_detail(ontologyId) {
	/* In popup modal, display item's ontology id and definition, and 
	synonyms, dbxrefs etc. ID is linked directly to GEEM form for this
	entity, skipping path context of its context in encompassing form.
	*/
	var entity = get_entity(ontologyId)
	if (entity) {
		var entityIdParts = entity['id'].split(':')
		var idPrefix = entityIdParts[0]
		if (idPrefix in top.resource.contents['@context']) {
			// Provide term's full namespace URL
			entity_URL = top.resource.contents['@context'][idPrefix] + entityIdParts[1]
		}
		else // Alternately use ontology lookup service to resolve term
			entity_URL = top.ONTOLOGY_LOOKUP_SERVICE_URL + entity['id']
	}
	else {
		// Case where we don't have a lookup on @context prefix for this
		entity_URL = top.ONTOLOGY_LOOKUP_SERVICE_URL + ontologyId
	}

	// ENTITY_ID - hyperlinked to tab/popup
	var itemHTML = `<ul><li><span class="infoLabel">ontology id: </span><a href="${entity_URL}" target="_blank">${ontologyId}</a></li>\n`

	if (!entity) return itemHTML + '</ul>'

	// UI_LABEL if available
	if (entity.ui_label)
		itemHTML += `<li><span class="infoLabel">UI label: </span>${entity.ui_label}</li>\n`

	// TRANSITIONAL uiLabel
	if (entity.uiLabel)
		itemHTML += `<li><span class="infoLabel">UI label: </span>${entity.uiLabel}</li>\n`

	// UI_DEFINITION if available
	if (entity.ui_definition)
		itemHTML += `<li><span class="infoLabel">UI definition: </span><i>${entity.ui_definition}</i></li>\n`

	// TRANSITIONAL UI_DEFINITION if available
	if (entity.uiDefinition)
		itemHTML += `<li><span class="infoLabel">UI definition: </span><i>${entity.uiDefinition}</i></li>\n`

	if (entity.label)
		// LABEL - from original ontology
		itemHTML += `<li><span class="infoLabel">ontology label: </span>${entity.label}</li>\n`

	// DEFINITION - from original ontology
	if (entity.definition)
		itemHTML += `<li><span class="infoLabel">ontology definition: </span><i>${entity.definition}</i></li>\n`
	
	// Show other things like dbXref, and link them
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

	itemHTML += `</ul>`

	// Enable mouseover display of above.
	//itemHTML = 	[entity_URL, itemHTML].join('\n')

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

	if (!entity)
		return ''

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
		top.user_grid_options = create_grid_options();
		create_user_grid(top.user_grid_options);

		top.ontology_grid_options = create_grid_options();
		create_ontology_grid(top.ontology_grid_options);

		$('#user_validation_download').click(function () {
			const file = $('#user_validation_upload').prop('files')[0];

			if (file) {
				download_grid(top.user_grid_options, file.type)
			}
		});

		$('#user_validation_upload').change(function () {
			const file = $('#user_validation_upload').prop('files')[0];
			const accepted_file_types =
				new Set(['text/csv', 'text/tab-separated-values']);
			if (!accepted_file_types.has(file.type)) {
				alert('Uploads are limited to .csv and .tsv files');
				return
			}

			const data = new FormData();
			data.append('file', file);
			$.ajax({
				type: 'POST',
				url: 'get_uploaded_validation_data',
				data: data,
				processData: false,
				contentType: false,
				success: function (data) {
					update_user_grid(top.user_grid_options, data)
				},
				error: function (_, text_status, error_thrown) {
					alert(text_status + ': ' + error_thrown)
				}
			})
		});

		// Will be stored in saved mappings
		top.linked_user_cols = {};
		// Only used to make the construction of
		// ``top.linked_user_cols`` easier.
		top.linked_onto_cols = {};
		// Color-coordinate linked cols
		top.next_linked_col_color = 0;

		// Map columns by linking them via drag/drop, and then
		// naming/creating a mapping.
		top.dragged_col = undefined;
		top.user_grid_options.api.addEventListener('dragStarted', function() {
			const cols = top.user_grid_options.columnApi.getAllColumns();
			top.dragged_col = cols.filter(x => x['moving'])[0]['colId'];

			const onto_cols = $('#ontology_validation_grid .ag-header-cell');
			onto_cols.addClass('drag_drop_grid_hover')
		});
		top.ontology_grid_options.api.addEventListener('dragStarted', function() {
			const cols = top.ontology_grid_options.columnApi.getAllColumns();
			top.dragged_col = cols.filter(x => x['moving'])[0]['colId'];

			const user_cols = $('#user_validation_grid .ag-header-cell');
			user_cols.addClass('drag_drop_grid_hover')
		});
		top.user_grid_options.api.addEventListener('dragStopped', function() {
			const receiving_onto_col_header =
				$('#ontology_validation_grid .ag-header-cell.ag-column-hover');
			const receiving_onto_col = receiving_onto_col_header.attr('col-id');
			if (receiving_onto_col) {
				link_grid_cols(top.dragged_col, receiving_onto_col)
			}

			const onto_cols = $('#ontology_validation_grid .ag-header-cell');
			onto_cols.removeClass('drag_drop_grid_hover')
		});
		top.ontology_grid_options.api.addEventListener('dragStopped', function() {
			const receiving_user_col_header =
				$('#user_validation_grid .ag-header-cell.ag-column-hover');
			const receiving_user_col = receiving_user_col_header.attr('col-id');
			if (receiving_user_col) {
				link_grid_cols(receiving_user_col, top.dragged_col);
			}

			const user_cols = $('#user_validation_grid .ag-header-cell');
			user_cols.removeClass('drag_drop_grid_hover');
		});

		$('#mapping_create_confirm').click(function() {
			const mapping_name_input = $('#mapping_name_input').val();
			if (mapping_name_input === '') return;

			let user_field_order =
				top.user_grid_options.columnApi.getAllGridColumns();
			user_field_order = user_field_order.map(x => x.getColDef().field);

			let ontology_field_order =
				top.ontology_grid_options.columnApi.getAllGridColumns();
			ontology_field_order = ontology_field_order.map(x => x.getColDef().field);

			create_mapping(mapping_name_input, user_field_order, ontology_field_order,
				top.resource.id)
		});

		$('#mapping_load').click(function () {
			const mapping_name = $('#mapping_select').val();
			load_mapping(top.resource.id, mapping_name)
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

