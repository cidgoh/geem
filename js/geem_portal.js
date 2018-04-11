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
	Updated: Apr 10, 2018

	Note: we can get a dynamic list of OBOFoundry ontologies via: 
	http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json   //&timeout=0&debug=on

	TO DO:

	 - Disjunction tabbed interface has wrong required status shown when
	 ontology detail switch is on?
	 - FIX: contact specification - physician inherits first name, last name etc from person, but cardinality not shown.
	 - How to handle items that are not marked as datums?
	 - possibly try: http://knockoutjs.com/index.html
	 - FIX: "has component some XYZ" where XYZ is a composite entity fails to be recognized. using "min 1" instead of "some" is the workaround.
	 - API: should provide content type of resource being requested: 
		GEEM ontology, shared or private package.
	 - Ontology ID provided in URL: CHECK FOR VALID ENTITY REFERENCE IN SOME (PREFERRED?) ONTOLOGY. PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?

*/

/*********** ALL THE SETUP ***************************************************/

specification = {} // Current specification database being browsed and searched
context = {} // JSON-LD context for loaded form
focusEntityId = null
formSettings = {}
ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='

$( document ).ready(function() {

	// ************* LOAD SHARED TEMPLATES ****************
	$.ajax('parts/modal_lookup.html').done(function(response){
		$('body').append(response)
	});

	// Initializes Zurb Foundation settings (but not foundation itself)
	OntologyForm.initFoundation()

	// GEEM focuses on entities by way of a URL with hash #[entityId]
	$(window).on('hashchange', doNewHash);

	/********* Specification resource selection area ********/

	// When a new ontology is selected:
	$('#selectResource').on('change', doResourceSelection)

	initSummaryTab()
	initSearchTab()

	/********* Specification focus area *********************/

	$("#tabsContent").on('mouseenter','i.fi-magnifying-glass', displayContext)

	initFormTab()
	initSpecificationTab()
	// initDiscussTab()
	initCartTab()

});


/******************** UTILITY FUNCTIONS ********************/
// FUTURE: convert into class


function getIdHTMLAttribute(id) {
	return 'data-ontology-id="' + id + '" '
}


function navigateToForm(ontologyId) {
	console.log('looking for: '+ontologyId)
	// PROBLEM SELECTING CART ITEM, NOT FINDING IT AGAIN IN 
	// URL AND INSTEAD RELOADING FORM?






	if (window.location.href.indexOf(ontologyId) == -1) {
		// not found
		window.location.replace('#' + ontologyId);
		//window.location.href = '#' + ontologyId
		console.log('reloaded')
		// ISSUE: SEEMS TO BE RELOADING WITHOUT REASON
	}
	else
		// form already displayed, ensure tab is activated
		$('#content-tabs').foundation('selectTab', '#panelContent'); 


	return false
}


function getEntity(ontologyId) {
	var entity = top.specification[ontologyId]
	//if (!entity)
	//	entity = top.specification['units'][ontologyId]
	return entity
}

function getEntityId(item) {
	// Determine relevant ontology ID for given entity
	if ($(item).is('i.fi-shopping-cart.option')) 
		return $(item).prev().attr('data-ontology-id')
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}

function itemAnimate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}


/*********** ACTION *****************************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.specification contains:
	{
		@context
		specifications
	}
*/


function doResourceSelection() {

		spec_URL = $('#selectResource').val()

		// This wasn't URL triggered, so clear out existing form
		location.hash = ''

		if (spec_URL.length == 0) {
			$('#specificationSourceTabs,#content').addClass('disabled')
			$('#specificationSourceInfoBox').show()
			$('#tabsSpecification').hide()
			$('#formEntityLabel').html('')
			$('#specificationSourceTabs').foundation('_collapseTab', $('#panelLibrary'));

		}
		else {
			// Future: API provides spec_type 
			var spec_type = $('#selectResource option:selected').parents('optgroup').first().attr('type')
			loadSpecification(spec_URL, spec_type)
			$('#specificationSourceTabs').removeClass('disabled')

			$('#tabsSpecification').show()
			// Issue: foundation re-applied to menus after load?
			setTimeout("$('#specificationSummaryTabLink').click()",500 )

		}

	}

function loadSpecification(specification_file, spec_type) {
	$.ajax({
		type: 'GET',
		url: specification_file,
		timeout: 30000, //30 sec timeout
		success: function( specification ) {

			// Setup Zurb Foundation user interface and form validation

			top.specification = specification['specifications'];
			top.context = specification['@context'];

			doSpecificationMetadata(specification, spec_type)

			// Prepare browsable top-level list of ontology items
			doResourceBrowseMenu()

			// Provide context of form to populate. Passes formCallback, name of function in this module for 
			// OntologyForm to return to when complete.
			myForm = new OntologyForm("#mainForm", top.specification, top.formSettings, formCallback) 


			// If browser URL indicates a particular entity, render it:
			if (location.hash.indexOf(':') != -1) { 
				top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]
				// CHECK FOR VALID ENTITY REFERENCE IN SOME ONTOLOGY.
				// PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
				myForm.renderEntity(top.focusEntityId)
			}

			$(document).foundation()

			$('#buttonFormSubmit').on('click', function () {  
				setModalDownload(getdataSpecification('form_submission.json'))
			})

		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {
			alert('Given resource could not be found: \n\n\t' + specification_file) 
		}
	});
}


function doNewHash() {
	// GEEM focuses on entities by way of a URL with hash #[entityId]
    if (location.hash.length > 0)
    	// Better entity id detection?
	   	if (location.hash.indexOf(':') != -1) { 
			top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]
			// CHECK FOR VALID ENTITY REFERENCE IN SOME ONTOLOGY.
			// PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
			myForm.renderEntity(top.focusEntityId)

			// When renderEntity is called, activate its tab
			$('#content-tabs').foundation('selectTab', '#panelContent'); 

			// FUTURE: Resolve repeated code below.
			$('#buttonFormSubmit').on('click', function () {  
				setModalDownload(getdataSpecification('form_submission.json'))
				})
		}
}

function formCallback(formObj) {
	//This is executed whenever a new form is rendered.
	if (window.setShoppingCart) {
		setShoppingCart(formObj) 
		setFormSelectOptionsCart(formObj)
	}
	$('#specificationSourceInfoBox').hide()


	// Content area functionality is blocked until form loaded
	$('#content').removeClass('disabled')

}


function doSpecificationMetadata(specification, spec_type) {
	// Currently spec_type is provided as parameter but it
	// should be within specification itself. Determines which
	// fields are editable/visible.
	top.metadata = specification['metadata'];
	top.metadata.type = spec_type;

	// Temporary correction until SPARQL query can be revised.
	if ('value' in top.metadata.date)
		top.metadata.date = top.metadata.date.value

	// Render display form appropriate to spec type:
	doResourceForm(top.metadata, 'parts/resource_summary_form.html', spec_type)
}



function doResourceForm(data, form_URL, spec_type) {
	// Feeds specification.metadata variables to copy of template

	$.ajax(form_URL).done(function(response) {

		Object.keys(data).forEach(function(key) {
			value = data[key]
			var re = new RegExp('@' + key ,"g");
			response = response.replace(re, value)
		}) 

		$('#specificationSourceForm').html(response)

		// If loaded data is direct from ontology, hide certain buttons. 
		var onto_fields = $('#summary_title,#summary_resource,#summary_description,#summary_prefix')

		if (spec_type == 'private') {
			$('#summary_delete,#summary_update').show()
			
		}
		else {
			$('#summary_delete,#summary_update').hide()

		 	if (spec_type == 'ontology') {
		 		onto_fields.attr('readonly','readonly')
		 	}
		 	else {
				onto_fields.removeAttr('readonly')
		 	}

		}


	});

}



function doResourceBrowseMenu() {
	/* Prepare browsable top-level list of ontology items
	Provide context of form to populate. Passes formCallback, name of function in this module for OntologyForm to return to when complete.
	*/
	myForm = new OntologyForm("#mainForm", top.specification, top.formSettings, formCallback) 

	//Have to reinsert this or reload doesn't fire up menu (zurb issue?)
	$('#panelEntities').html('<ul class="vertical menu" id="entityMenu" data-accordion-menu data-deep-link data-multi-open="true"></ul>')


	// If it is an ontology, render its data representation model tree:
	$("ul#entityMenu").html(renderMenu('OBI:0000658') + '<hr/>')

	// If it is a package ... 


	// On Browse Specifications tab, enables eye icon click to show form without opening/closing the accordion.
	$('ul#entityMenu *').on('click', function(event) { 
		event.stopPropagation();
		if ($(event.target).is('i.fi-magnifying-glass') ) {
			myForm.renderEntity(getEntityId(event.target))
		}
	});
}





function getOntologyDetailHTML(ontologyId) {

	// This links directly to form for this entity.  Not in context of larger form.
	// Problem is that recursion to fetch parts from parent runs into parents that 
	// have no further path.
	// ALSO SELECT LIST CHOICES DON'T HAVE DEPTH STEMMING FROM PARENT ENTITY, only from ???
	var entity = getEntity(ontologyId)
	var entityIdParts = entity['id'].split(':')
	var idPrefix = entityIdParts[0]
	if (idPrefix in top.context) {
		entityId = top.context[idPrefix] + entityIdParts[1]
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


function displayContext(event) {
	/* Provide mouseover function to see dropdown menu that shows given item
	as well as any parent items that link to it via "has member" and "has part"
	and "is a" relations. Parents can be navigated to.
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
		content += getOntologyDetailHTML(ontologyId) 
	}
	else //'.fi-arrow-up'
		content += '<ul>' + getRelationsHTML(ontologyId) + '</ul>'

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
				target.parent().before(getRelationsHTML(targetId))
			}
		})

}


function getRelationsHTML(ontologyId) {
	// Finds and draws relations as li links for given entity
	var entity = getEntity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += getRelationLink('parent', getEntity(entity['parent']))
	}
	// Possibly organize each entity's relations under a "relations" section?
	for (const relation of ['member_of','otherParent']) {
		if (relation in entity) {
			for (const targetId of entity[relation]) {
				filling += getRelationLink(relation, getEntity(targetId))
			}
		}
	}
	return filling
}

function getRelationLink(relation, entity) {
	// Used in search results
	// Usually but not always there are links.  Performance boost if we drop this test.
	var links = ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">', relation, ': ',
		links ? '<i class="fi-arrow-up large"></i> ' : '',
		' <a href="#', entity['id'], '">' + entity['uiLabel'] + ' <i class="fi-magnifying-glass large"></i></a>',

		'</li>'].join('')
}




/*********** ENTITY MENU RENDERER *************************/
function renderMenu(entityId, depth = 0 ) {

	var html = ""
	var entity = top.specification[entityId]
	if (entity) {
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so is not re-rendered.")
			return html
		}

		var hasChildren = ('models' in entity)

		if (depth > 0) {

			html = ['<li class="cart-item" data-ontology-id="',	entityId,'">',
			//hasChildren ? '<a href="#">' : '<a href="#'+entityId+'">',
			 '<a href="#'+entityId+'">',
			entity['uiLabel'],
			hasChildren ? ' <i class="fi-magnifying-glass"></i>' : '',
			'</a>'].join('')
		}

		// See if entity has subordinate parts that need rendering:
		if (hasChildren) {
			for (var memberId in entity['models']) {
				// Top level menu items
				if (depth == 0) html += renderMenu(memberId, depth + 1)
				// Deeper menu items
				else {
					// Only list item if it has components or models
					var child = top.specification[memberId]
					if ('models' in child || 'components' in child)
						html += '<ul class="menu vertical nested">' + renderMenu(memberId, depth + 1) + '</ul>'
				}
			}
		}

		html +=	'</li>'
	}
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


function initSummaryTab() {
	// Deals with #summary_delete, #summary_download, #summary_update

	$('#specificationSourceForm').on('click','#summary_download', function() {
			var content =  {
				content: JSON.stringify(top.specification),
				report_type: 'geem.json',
				id: top.specification.metadata.prefix
			}
			downloadDataSpecification(content)
	})
}

function initFormTab() {

	// This control toggles the visibility of ontology ID's in the given 
	// form content (for reference during content review)
	$('input#toggleIdVisibility').on('change', function() {
		top.formSettings.ontologyDetails = $(this).is(':checked')
		myForm.renderEntity()
	})

	// Display all optional elements as label [+] for concise display.
	$('input#toggleMinimalForm').on('change', function() {
		top.formSettings.minimalForm = $(this).is(':checked')
		myForm.renderEntity()
	})

	// Check and update shopping cart include/exclude status of this item
	$("#tabsContent").on('click', "i.fi-shopping-cart", function(event){

		event.stopPropagation(); // otherwise parent cart items catch same click
		cartCheck(getEntityId(this))
		return false
	})

}


function initSpecificationTab() {

	// Trigger popup JSON / EXCELL / YAML view of specification
	$('#specificationType').on('change', function() {
		setDataSpecification(getdataSpecification( $(this).val() )) 
	}) 

	$('#spec_download').on('click', downloadDataSpecification) // the button, not the surrounding link.
	
}
