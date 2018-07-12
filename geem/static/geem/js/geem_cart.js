/***************************** SHOPPING CART TAB ****************************/
function init_cart_tab() {
	/* 
	The shopping cart system enables users to select term items, sections, and
	entire forms that they want from existing specification forms defined by
	ontology curators or shared by other users. These items can then be placed
	into a single package that a user can keep private, or share.

	Currently revising the code below to support a shopping list data structure
	that is not held in the dom. 

	Old solution keeps track of the necessary information for each cart item, and the status
	of each shopping cart icon.  The icon state indicates whether user wants
	to include or exclude item from their cart.

	The complex part is that a user may want to include terms from an overall
	section, but exclude particular underlying terms from that section.


	*/

	// If user clicks on Shopping Cart tab, disable buttons for empty cart.
	$('#tabPanelCartLink').on('click', shopping_list_status)

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
		$('#shoppingCart').empty()
		shopping_list_status()
	})

	// Check and update shopping cart include/exclude status of this item
	$("#tabsContent").on('click', "i.fi-shopping-cart", function(event){

		event.stopPropagation(); // Otherwise parent cart items catch same click
		cart_check(get_attr_ontology_id(this))
		return false
	})

	$("#addToPackageButton").on('mouseenter',function(){
		/* Provides a menu of packages in 'draft' mode that user manages that
		 they could add shopping cart to. 
		 Couldn't figure out foundation event for this
		 Alot like init_resource_select()
		*/
		stack = top.resources.slice(0)

		html = ['<option value="">Select a package ...</option>']
		// Skip display of ontologies and packages user doesn't manage
		while (stack.length && stack[0].type == 'ontology') stack.shift()

		// manager_filter turned on so only those items user manages are shown.
		init_resource_select_item(stack, 'shared', html, '</optgroup>\n<optgroup label="Shared Packages">', true)
		init_resource_select_item(stack, 'private', html, '</optgroup>\n<optgroup label="Private Packages">', true)
		html = html.join('\n')

		// Load menu selection
		$('#userPackages').html(html)

	})

	$("#updatePackageButton").on('click', function() {
		alert('Shopping cart package update coming soon!')
	})

}


function get_attr_ontology_id(item) {
	// Determine relevant ontology ID for given entity
	// Here ontology id is listed inside a select <option>
	if ($(item).is('i.fi-shopping-cart.option')) 
		return $(item).prev().attr('data-ontology-id')

	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}

function shopping_list_status() {
	if ($('form#shoppingCart > div.cart-item').length >0) {
		// note 'disabled' property can't be removed from button.
		$("#addToPackageButton").prop('disabled',false)
		$("#shoppingCartTrash").removeClass('disabled')
	}
	else { 
		$("#addToPackageButton").prop('disabled','disabled')
		$("#shoppingCartTrash").addClass('disabled')
	}
}


function cart_check(ontologyId) {
	/* A user can select as many entities as they like, but may find that 
	some components of some entities are undesirable.  This script enables
	the shopping list to be maintained with the ability to select entities,
	and also select underlying entities or fields to omit. 

	DOM Attribures:
		.cart-item 			: a cart item
		.data-ontology-id 	: id, including path of given cart item
		.include			: item will be marked active in user package.
		.exclude			: item will be marked inactive in user package.

	*/
	// Clear out initial help message:	
	if ($('#shoppingCart div.cart-item').length == 0)
		$("#panelCart > div.infoBox").remove()

	var dataId = '[' + render_attr_ontology_id(ontologyId) +']'
	var items = $('.cart-item' + dataId)
	var formItem = $('#mainForm .cart-item' + dataId) // CONGLOMERATE?
	var cartItem = $('#shoppingCart .cart-item' + dataId)

	if (cartItem.length == 0) {
		// ADD item to shopping list; couldn't possibly have clicked on it there.

		// Place this new item under parent in cart if it exists
		var path = ontologyId.substr(0, ontologyId.lastIndexOf('/'))
		alert(path)
		while (path.length) {
			var item = $('#shoppingCart div.cart-item[data-ontology-id="' + path+ '"]')
			if (item.length) {
				$(item).append(render_cart_item(ontologyId))
				break;
			}
			path = path.substr(0, path.lastIndexOf('/'))
		}

		if (path == '') {// item parent wasn't found
			$("#shoppingCart").prepend(render_cart_item(ontologyId))
			// Issue is that some of remaining items might be positioned under top-level
		}
		var cartItem = $('#shoppingCart div.cart-item' + dataId)
		items = items.add(cartItem)  // x.add() is immutable.

		// See if any existing items (longer ids) fit UNDER  new item
		$('#shoppingCart div.cart-item').each(function(index) {
			var id = $(this).attr('data-ontology-id')
			if (id != ontologyId) {
				if (id.substr(0, ontologyId.length) == ontologyId) 
					$(cartItem).append(this)
			}
		})

	}

	// User has displayed a different form than shoppingList selection
	// pertains to.
	if (formItem.length == 0) {
		if (cartItem.is('.include'))
			cartItem.removeClass('include').addClass('exclude')
		else if (cartItem.is('.exclude'))
			cartItem.remove()
		return
	}

	// AN ITEM has a state or INHERITS STATE OF ITS FIRST STATED ANCESTOR.
	if (! formItem.is('.exclude, .include')) {
		formItem = formItem.parents('.exclude, .include').first()
		if (formItem.length == 0) {// then this is truly unselected.
			items.addClass('include')
			dom_item_animate('#shoppingCartIcon', 'attention')
			return
		}
	}
	
	if (formItem.is('.include')) {
		// ITEM already in shopping list, so downgrade to "exclude" list.
		items.removeClass('include').addClass('exclude')

		// If item is NOT top-level in form, we're done.
		if (formItem.parent('form').length == 0 ) {
		// otherwise 
			dom_item_animate('#shoppingCartIcon', 'attention')
			return
		}
		// Otherwise, for top-level items, drop it immediately via .exclude state.
	}
	if (formItem.is('.exclude')) {
		// Item on exclusion list, so drop it entirely
		items.removeClass('exclude')
		// And remove all markings on subordinate items
		var mainFormEntity = $('#mainForm div.field-wrapper' + dataId)
		mainFormEntity.add(mainFormEntity.find('div.field-wrapper')).removeClass('include, exclude')
		cartItem.remove()
	}

}


function set_shopping_cart(formObj) {
	// UPDATE SHOPPING CART STATUS in render_entity()
	// ISSUE is foundation zurb selection lists redrawn each time, so need statuses added in that code.
	$('#tabsContent div.field-wrapper')
		.addClass('cart-item')
		.prepend('<i class="fi-shopping-cart"></i>')

	$('#shoppingCart div.cart-item').each(function(index){
		var status = ''
		if ($(this).is('.include') ) status = 'include'
		if ($(this).is('.exclude') ) status = 'exclude'

		$('#tabsContent div.field-wrapper[' + render_attr_ontology_id( $(this)[0].dataset.ontologyId ) + ']').addClass(status)
	})
}


function set_form_select_options_cart(formObj) {
	/* Adds shopping cart and magnifying glass to individual <select><option>
	item if it doesn't have one.  This has to be done runtime (via mouseover)
	because only then does foundation render it.

	FUTURE: indicate HIDDEN <option> items?.

	*/
	$('#tabsContent select.regular').on('chosen:showing_dropdown', function(event) {

		var control = $(this).next().find('ul.chosen-results')
		var select = $(this) //.parent('div').prev('select')
		var selectId = select.attr('data-ontology-id')
		var selectOptions = select.children('option')

		$(control).children('li').each(function (index) {
			if ($(this).is('.active-result')) {

				// We need to copy the value from the existing <select><option>
				// into the data-ontology-id for this <li>.
				// Chosen.js options have extra item at beginning?
				// Get corresponding option value:
				var id = selectOptions.eq(index+1).attr('value') 
				var pathId = selectId + '/' + id
				$(this).attr('data-ontology-id',pathId)
				$(this).addClass('cart-item')
				var cartItem = $('#shoppingCart [data-ontology-id="' + pathId +'"]')
				var cart = $('<i class="fi-shopping-cart option"></i>')
				if (cartItem.length>0)
					if (cartItem.is('.include') ) $(this).add(cart).addClass('include')
					else if (cartItem.is('.exclude') ) $(this).add(cart).addClass('exclude')

				// Couldn't figure out how to keep selection window open
				$(this).after(cart) //awkward, cart requires margin-top:-30px in stylesheet.
				if (formObj.settings.ontologyDetails)
					$(this).prepend('<i class="fi-magnifying-glass"></i> &nbsp;')
			}
		})

	})

}


function render_cart_item(ontologyId) {
	/* NavFlag enables display of up-arrows that user can click on
	 to navigate to an item's parent.
	*/
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.resource.specifications[entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED]'}
	return [
		'<div class="cart-item" ', render_attr_ontology_id(ontologyId), '>'
		,	'<i class="fi-shopping-cart"></i>'
		,	'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a>'
		,'</div>'
	].join('')
}


function render_cart_obj(ontologyId) {
	// This version of render_cart_item is optimized for sorting, and is used in
	// search results page.  It also provides icons for navigating to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.resource.specifications[entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED:' + entityId + ']'}
	content = ''
	if ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
		content = '<i class="fi-arrow-up dropdown member"></i>'
	var html = [
		'<div class="cart-item" ', 	render_attr_ontology_id(ontologyId), '>'
		,	'<i class="fi-shopping-cart"></i>'
		,	content
		,	'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a>'
		,'</div>'
		].join('')
	
	return [entity['uiLabel'].toLowerCase(), html]

}