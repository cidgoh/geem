/***************************** SHOPPING CART TAB ****************************/
function init_cart_tab() {
	/* 
	The shopping cart system enables users to select term items, sections, and
	entire forms that they want from existing specification forms defined by
	ontology curators or shared by other users. These items can then be placed
	into a single package that a user can keep private, or share.

	A cart icon state reflects top.cart entry, i.e.	whether user wants to
	include or exclude item from their cart.

	The complex part is that a user may want to include terms from an overall
	section, but exclude particular underlying terms from that section.
	*/

	top.cart = {}

	// If user clicks on Cart tab, update tab elements that depend on cart items.
	$('#tabPanelCartLink').on('click', render_cart_controls)

	$("#shoppingCart")
		.on("click", 'div.cart-item', function(event) {
			event.stopPropagation(); // otherwise parent cart items catch same click

			if ($(event.target).is('i.fi-shopping-cart'))
				// Change state of shopping cart item as indicated by div.cart-item.data-ontology-Id
				cart_check(this.dataset.ontologyId)
			else
				// Follow link if user didn't click
				return navigate_to_form(this.dataset.ontologyId)

			return false
		})

	$("#shoppingCartTrash").on('click', function() {
		$('form#mainForm div[data-ontology-id]')
			.removeClass('include exclude')
		top.cart = []
		$('#shoppingCart').empty()
		render_cart_controls()
	})

	$("#addToPackageButton").on('mouseenter', render_cart_package_selection_modal)

	$("#updatePackageButton").on('click', function() {
		alert('Shopping cart package update coming soon!')
	})

}


function navigate_to_form(ontologyId) {
	/* Load and/or navigate to given ontology item
	*/
	if (window.location.href.indexOf(ontologyId) == -1)
		// Triggers form load.
		window.location.replace('#' + ontologyId);
	else
		// form already displayed, ensure tab is activated
		$('#content-tabs').foundation('selectTab', '#panelContent'); 

	return false
}


function get_attr_ontology_id(item) {
	// Determine relevant ontology ID for given entity
	// Case: ontology id is listed inside a select <option>
	if ($(item).is('i.fi-shopping-cart.option')) 
		return $(item).prev().attr('data-ontology-id')

	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}


function render_cart_controls() {
	/* Enables/disables shopping cart controls based on empty cart state
	*/
	if ($('form#shoppingCart > div.cart-item').length >0) {
		// note 'disabled' property can't be removed from button.
		$("#addToPackageButton").prop('disabled', false)
		$("#shoppingCartTrash").removeClass('disabled')
	}
	else { 
		$("#addToPackageButton").prop('disabled', 'disabled')
		$("#shoppingCartTrash").addClass('disabled')
	}
}


function cart_check(entity_path) {
	/* A user can select as many entities as they like, but may find that 
	some components of some entities are undesirable.  This script enables
	the shopping list to be maintained with the ability to select entities,
	and also select underlying entities or fields to omit. 
	*/
	
	// Code assumes top.cart state is current, but if it is out of sync then
	// api call should at least get it back into sync. 
	const entity_path_status = top.cart[entity_path]
	var action = null
	var path_parent = entity_path.split('/')
	path_parent.pop()

	switch (entity_path_status) {
		case undefined: 	// If item doesn't exist in cart, add it.
			action = 'add'; 	
			break
		case 'include': 	
			// Normally include -> exclude
			// If shopping list has no parent then -> remove
			found = true
			/*while (path_parent.length) {
				if (top.cart[path_parent]) {
					found = true; break
				}
				path_parent.pop()
			}*/
			action = found ? 'exclude' : 'remove'
			break
		case 'exclude': 	// exclude -> remove
			action = 'remove'; 	
			break
		default: break
	}

	if (action)
		api.cart_change_item(entity_path, action)
			.then(render_cart_change)

}


function render_cart_change(result) {
	/*
	When an entity is selected, all underlying entities are selected visually
	via CSS.  In that case, when an underlying entity is selected that is
	interpreted as a request to exclude that item AND its underlings.

	DOM Attribures:
		.cart-item 			: a cart item
		.data-ontology-id 	: id, including path of given cart item
		.include			: item will be marked active in user package.
		.exclude			: item will be marked inactive in user package.

	*/

	if (result.success) {

		// Cart icon on tab flickers to indicate shopping cart action occured
		dom_item_animate('#shoppingCartIcon', 'attention')

		const entity_path = result.entity_path
		const dom_entity_path_selector = '[' + render_attr_ontology_id(entity_path) +']'
		const dom_form_item = $('#mainForm .cart-item' + dom_entity_path_selector) // li, div
		const dom_cart_item = $('#shoppingCart .cart-item' + dom_entity_path_selector)

		switch (result.action) {
			case 'add':
				top.cart[result.entity_path] = 'include' 
				new_item = render_cart_add_item(entity_path)
				new_item.addClass('include')
				dom_form_item.removeClass('exclude').addClass('include')
				break;

			case 'exclude':
				top.cart[result.entity_path] = 'exclude'
				dom_form_item.removeClass('include').addClass('exclude')
				dom_cart_item.removeClass('include').addClass('exclude')
				break;

			case 'remove':
				var stuff = $.extend({}, top.cart)
				$.each(stuff,function(entity_path2) {
					// The item and all its subordinate items should be removed.
					if (entity_path2.indexOf(result.entity_path) === 0) {
						delete(top.cart[entity_path2])
						$('#shoppingCart .cart-item[' + render_attr_ontology_id(entity_path2) + ']').remove()
						$('#mainForm .cart-item[' + render_attr_ontology_id(entity_path2) + ']').removeClass('include exclude')
					}
				})
				break;

		}
	}
}


function render_cart_add_item(entity_path) {
	/* Adds new entity_path into cart such that it is tucked between any 
	existing superior or subordinate paths.
	*/

	// Place this new item under parent in cart if it exists
	var parent_path = entity_path.substr(0, entity_path.lastIndexOf('/'))
	while (parent_path.length) {
		var item = $('#shoppingCart div.cart-item[data-ontology-id="' + parent_path + '"]')
		if (item.length) {
			$(item).append(render_cart_item(entity_path))
			break;
		}
		parent_path = parent_path.substr(0, parent_path.lastIndexOf('/'))
	}

	// Here item parent wasn't found, so render item at top level of cart.
	if (parent_path == '') {
		$("#shoppingCart").prepend(render_cart_item(entity_path))
	}

	var dom_cart_item = $('#shoppingCart div.cart-item[' + render_attr_ontology_id(entity_path) + ']')

	// See if any existing item paths fit UNDER new item
	$('#shoppingCart div.cart-item').each(function() {
		var id = $(this).attr('data-ontology-id')
		if (id != entity_path) {
			if (id.substr(0, entity_path.length) == entity_path) 
				$(dom_cart_item).append(this)
		}
	})

	return dom_cart_item

}


function render_entity_form_cart_icons(formObj) {
	/* Add shopping cart icon to each content form field with appropriate
	include/exclude status

	Is there an advantage to loading dom with icons first, then setting their
	status, or should status be done within loop?

	*/

	$('#tabsContent div.field-wrapper')
		.addClass('cart-item') // Just for styling
		.prepend('<i class="fi-shopping-cart"></i>')

	$.each(top.cart, function(entity_path) {
		var status = null
		switch (top.cart[entity_path]) {
			case 'include': status = 'include'; break
			case 'exclude': status = 'exclude'; break
		}
		if (status) {
			const attr_id = render_attr_ontology_id(entity_path)
			$('#tabsContent div.field-wrapper[' + attr_id + ']').addClass(status)
		}
	})

}


function render_entity_form_select_cart_icons() {
	/* In setup of CONTENT FORM tab, adds mouseover EVENT on jQuery Chosen
	<select> inputs to display shopping cart and magnifying glass to each
	<option> item if it doesn't have one.  This has to be done 
	because only then does foundation render it.

	ISSUE: cart supplied single ontology identifier for each option, rather
	than complete path in case where option has hierarchic parents.
	*/
	$('#tabsContent').on('chosen:showing_dropdown', function(event) {
		const select = $(event.target)
		const chosen_control = select.next().find('ul.chosen-results')
		//const select_path = select.attr('data-ontology-id')
		const select_options = select.children('option')

		// Loop through each <option> provided in Chosen select control input
		$(chosen_control).children('li').each(function (index) {
			if ($(this).is('.active-result')) {

				// We need to copy the existing <select><option value="X">
				// into the data-ontology-id for this <li>.
				// Chosen.js options have extra item at beginning?
				// Get corresponding option value:
				var option_id = select_options.eq(index+1).attr('value') 
				// Originally hierarchy within select was not being represented
				// But having value contain full path is wiser?
				// var entity_path = select_path + '/' + option_id
				var entity_path = option_id

				$(this).attr('data-ontology-id', entity_path)
				$(this).addClass('cart-item')

				var cart_icon = $('<i class="fi-shopping-cart option"></i>')
				$(this).after(cart_icon) //awkward, cart requires margin-top:-30px in stylesheet.

				switch (top.cart[entity_path]) {
					case 'include': 
						cart_icon.addClass('include'); 
						break
					case 'exclude':	
						cart_icon.addClass('exclude');
						break
					default:
				}

				// Piggybacking ability to display ontology details for an <option>
				if (top.form.settings.ontologyDetails)
					$(this).prepend('<i class="fi-magnifying-glass"></i> &nbsp;')
			}
		})

	})

}


function render_cart_item(entity_path) {
	/* 
	*/
	var ptr = entity_path.lastIndexOf('/')
	// Get last path item id.
	var entity_id = ptr ? entity_path.substr(ptr + 1) : entity_path
	var entity = top.resource.specifications[entity_id]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED]'}
	return [
		'<div class="cart-item" ', render_attr_ontology_id(entity_path), '>'
		,	'<i class="fi-shopping-cart"></i>'
		,	'<a href="#', entity_path, '">', entity['uiLabel'], '</a>'
		,'</div>'
	].join('')
}

function render_cart_package_selection_modal() {
	/* Provides a menu of packages in 'draft' mode that user manages that
	 they could add shopping cart to. 
	 Couldn't figure out foundation event for this
	 A lot like init_resource_select()
	*/
	stack = top.resources.slice(0)

	html = ['<option value="">Select a package ...</option>']
	// Skip display of ontologies and packages user doesn't manage
	while (stack.length && stack[0].type == 'ontology') 
		stack.shift()

	// manager_filter turned on so only those items user manages are shown.
	init_resource_select_item(stack, 'shared', html, '</optgroup>\n<optgroup label="Shared Packages">', true)
	init_resource_select_item(stack, 'private', html, '</optgroup>\n<optgroup label="Private Packages">', true)
	html = html.join('\n')

	// Load menu selection
	$('#userPackages').html(html)
}

// reiterated here outside context of form
render_attr_ontology_id = function(domId) {
	return 'data-ontology-id="' + domId + '" '
}