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

	top.cart = makeOrderedHash()

	// If user clicks on Cart tab, update tab elements that depend on cart items.
	//$('#tabPanelCartLink').on('click', render_cart_controls)

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
		$('#mainForm div[data-ontology-id]')
			.removeClass('include exclude')
		top.cart.reset()
		$('#shoppingCart').empty()
		render_cart_controls()
	})

	$('#userPackages').on('change', function() {
		// Set cart_target_resource_id to package user selected
		top.cart_target_resource_id = this.value;
	});

	$("#addToPackageButton").on('mouseenter', render_cart_package_selection_modal)

	$("#addToPackageButton").on('click', function() {
		// User-selected draft package to add cart items to
		top.cart_target_resource_id = "";
	});

	$("#updatePackageButton").on('click', function() {
		const package_to_update_id = top.cart_target_resource_id;
		const cart_items = top.cart.values();

		// Return if user did not select a package
		if (package_to_update_id === "") {
			alert('Please select a package first!');
			return;
		}

		const prefixes_promise = get_cart_items_full_prefixes(cart_items);
		const specifications_promise = get_cart_items_specifications(cart_items);
		Promise.all([prefixes_promise, specifications_promise])
			.then(function([cart_items_full_prefixes, cart_items_specifications]) {
				return Promise.all([
					add_full_prefixes_to_package(package_to_update_id,
						cart_items_full_prefixes),
					add_specifications_to_package(package_to_update_id,
						cart_items_specifications)
				]);
			})
			.then(function(resolve) {
				alert('Successfully added');
			})
			.catch(function(err_msg) {
				alert(err_msg);
			})
	})

}


function get_cart_items_full_prefixes(cart_items) {
	/*
	TODO: ...
	 */
	// Perform context API call for each cart_item
	const cart_items_full_prefixes_promises = [];
	for (let key in cart_items) {
		let cart_item = cart_items[key];
		cart_items_full_prefixes_promises
			.push(api.get_cart_item_full_prefix(cart_item));
	}

	return Promise.all(cart_items_full_prefixes_promises);
}


function add_full_prefixes_to_package(package_id, full_prefixes) {
	/*
	TODO: ...
	 */
	return new Promise(function(resolve, reject) {
		reject(Error('stub'));
	})
}


function get_cart_items_specifications(cart_items) {
	/*
	TODO: ...
	 */
	// Perform specifications API call for each cart_item
	const cart_items_specifications_promises = [];
	for (let key in cart_items) {
		let cart_item = cart_items[key];
		cart_items_specifications_promises
			.push(api.get_cart_item_specification(cart_item));
	}

	return Promise.all(cart_items_specifications_promises);
}


function add_specifications_to_package(package_id, specifications) {
	/*
	TODO: ...
	 */
	return new Promise(function(resolve, reject) {
		reject(Error('stub'));
	})
}


function render_cart_controls() {
	/* Enables/disables shopping cart controls based on empty cart state
	*/
	if ($('form#shoppingCart > div.cart-item').length > 0) {
		// note 'disabled' property can't be removed from button.
		$("#addToPackageButton").prop('disabled', false)
		$("#shoppingCartTrash").removeClass('disabled')
		$('#cartInfoBox').hide()
	}
	else { 
		$("#addToPackageButton").prop('disabled', 'disabled')
		$("#shoppingCartTrash").addClass('disabled')
		$('#cartInfoBox').show()
	}
}


function makeOrderedHash() {
	/* Customized from https://stackoverflow.com/questions/2798893/ordered-hash-in-javascript
	Here keys exist in a sorted array. This is important visually because
	
	*/
    var keys = [];
    var values = {};
    return {
    	/*
        push: function(k,v) { // not used
            if (!values[k]) keys.push(k);
            values[k] = v;
        },
        insert: function(pos,k,v) { // not used
            if (!values[k]) {
                values[k] = v;
                keys.splice(pos,0,k);
            }
        },
        */
        order: function(k,v) {
        	// Future: sort function could be a bit more sophisticated - 
        	// factoring in parent, but then alpha sort among siblings.
        	if (!values[k]) {
        		keys.push(k);
        		keys.sort(function(a,b) {return a.localeCompare(b)});
        		values[k] = v
        	}
        	else
            	if (!(values[k] == v)) values[k] = v;
        },
        remove: function(k) {
        	const ptr = keys.indexOf(k)
        	if (ptr > -1) {
        		keys.splice(ptr,1)
        		delete(values[k]) // works?
        	}
        },
        get: function(k) {return values[k]},
        get_index: function(k) {return keys.indexOf(k)},
        get_parent: function (entity_path) {
			// Return first parent in cart, if any
			var path_parent = entity_path.split('/')
			path_parent.pop()
			while (path_parent.length) {
				var path_string = path_parent.join('/')
				var parent = this.get(path_string)
				if (parent) {
					return parent
				}
				path_parent.pop()
			}
			return false
		},
        length: function(){return keys.length},
        keys: function(){return keys},
        values: function(){return values},
        reset: function() {keys=[];values={}}
    };
};


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
	/* Determine relevant ontology ID for given entity from UI element.
	Relies upon the 'data-ontology-id' attribute.
	*/
	// case: ontology id is listed inside a select <option>
	if ($(item).is('i.fi-shopping-cart.option')) 
		return $(item).prev().attr('data-ontology-id')
	// case: ontology item is given by first .cart-item parent
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}


function cart_check(entity_path) {
	/* A user can select as many entities as they like, but may find that 
	some components of some entities are undesirable.  This script enables
	the shopping list to be maintained with the ability to select entities,
	and also select underlying entities or fields to omit. 
	*/
	const cart_item = top.cart.get(entity_path)
	const cart_parent = top.cart.get_parent(entity_path)
	var action = null

	if (!cart_item) { // If item doesn't exist in cart, include it. 
		action = 'include'
	}
	else
		switch (cart_item.status) {  
			case 'include': //  include -> exclude
				// But if item is top level already then include -> remove
				action = cart_parent ? 'exclude' : 'remove'; 
				break;
			case 'exclude': // exclude -> remove
				action = 'remove'; 
				break; 
		}

	if (action)
		api.cart_change_item(entity_path, action, top.resource.id, top.resource.contents.metadata.versionIRI)
			.then(cart_change)

}


function cart_change(result) {
	if (result) {
		switch (result.status) {
			case 'include':	top.cart.order(result.path, result); break;
			case 'exclude':	top.cart.order(result.path, result); break;
			case 'remove': top.cart.remove(result.path); break;
		}
		render_cart(result)
	}
}


function render_cart(result) {
	/* Adjusts visual display of cart, taking into account change in top.cart
	structure. Positions new cart item such that it is tucked between any 
	existing superior or subordinate paths. Removal of a cart item causes
	subordinate item indentation to be adjusted appropriately.

	Note that an item may be marked as included simply to have other custom
	annotations set by user.

	DOM CSS class for a cart item mirrors its status states:
		.include			: item will be marked active in user package.
		.exclude			: item will be marked inactive in user package.
	Other CSS or data attribute
		.data-ontology-id 	: attribute: cart entity id, includes path
		.cart-item 			: a cart item
	*/
	
	// Cart icon on tab flickers to indicate shopping cart action occured
	dom_item_animate('#shoppingCartIcon', 'attention')

	// Cursor at first shopping cart item, if any
	var item = null // top.cart item
	var cart_item = null
	var cart_path = null
	var keyPtr = 0
	var cartPtr = 0
	const keys = top.cart.keys()

	while (keyPtr == cartPtr) {
		// Ensure that top.cart and #shoppingCart are synchronized line-for-line.

		item = top.cart.get(keys[keyPtr])
		cart_item = $('#shoppingCart > .cart-item:eq('+cartPtr+')')

		if (item && cart_item && cart_item.length > 0) {

			var cart_path = cart_item.attr('data-ontology-id')

 			switch (item.path.localeCompare(cart_path)) {

 				case -1:
 					cart_item.before(render_cart_item(item))
 					render_cart_css(cart_item.prev(), item.path, 'exclude', 'include')
 					keyPtr += 1
 					cartPtr = keyPtr
					break

 				case 0:
					switch (item.status) {
						case 'include':
							render_cart_css(cart_item, cart_path, 'exclude', 'include')
							break;
					
						case 'exclude':
							render_cart_css(cart_item, cart_path, 'include', 'exclude')
							break;	
					}
 					// Advance both
 					keyPtr += 1
 					cartPtr = keyPtr
 					break

 				case 1:
 					remove_cart_item(cart_item)
					break
			}

		}
		else {
			if (item) {
				// append item to cart since no cart spot for it
				cart_item = $(render_cart_item(item))
				$('#shoppingCart').append(cart_item)
				render_cart_css(cart_item, item.path, 'exclude', 'include')
			 	keyPtr += 1
				cartPtr += 1
				continue
			}

			if (cart_item && cart_item.length > 0) { // cart item only
				remove_cart_item(cart_item)
				continue
			}

			break // nothing more to process so exit completely

		}
	}

	render_cart_controls()
}


function render_cart_css(cart_item, cart_path, style1, style2) {
	// Content area form cart item
	var form_item = $('#mainForm .cart-item[data-ontology-id="' + cart_path + '"]')
	form_item.removeClass(style1).addClass(style2);
	cart_item.removeClass(style1).addClass(style2);
}

function remove_cart_item (cart_item) {
	var cart_path = cart_item.attr('data-ontology-id')
	var form_item = $('#mainForm .cart-item[data-ontology-id="' + cart_path + '"]')
	form_item.removeClass('include exclude')
	var next_cart_item = cart_item.next()
	cart_item.remove()
	// animation breaks cartPtr test
	//cart_item.slideUp().promise().done(function() {$(this).remove()})
	//return next_cart_item
}

function character_count(string, char, ptr = 0, count = 0) {
	while (ptr = string.indexOf(char, ptr) + 1) {count ++}
	return count
}

function render_cart_item(entity) {
	/* Display item in cart, including ontology/package version #
	*/
	var version = entity.version.substr(entity.version.indexOf('releases/')+9)
	var depth = character_count(entity.path, '/')
	return [
		'<div class="cart-item depth', depth, '" ', render_attr_ontology_id(entity.path), '>'
		,	'<i class="fi-shopping-cart"></i>'
		,	'<a href="#', entity.path, '">', entity.label, '</a><div class="small">/' + version + '</div>'
		,'</div>'
	].join('')
}


function render_entity_form_cart_icons(formObj) {
	/* Add shopping cart icon to each content form field with appropriate
	include/exclude status.  

	Is there a rendering advantage to loading dom with icons first, then 
	setting their status, or should status be done within loop?
	*/

	top.cart.keys().forEach(function(item_path) {
		const item = top.cart.get(item_path)
		const attr_id = render_attr_ontology_id(item_path)
		$('#tabsContent div.field-wrapper[' + attr_id + ']').addClass(item.status)
	})

	$('#tabsContent div.field-wrapper:not(.disjunction)')
		.addClass('cart-item') // Just for styling
		.find('> div.columns > div.row')
		.prepend('<i class="fi-shopping-cart"></i>')

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
				var entity_path = select_options.eq(index+1).attr('value') 
				// Originally hierarchy within select was not being represented
				// But having value contain full path is wiser?
				// var entity_path = select_path + '/' + option_id

				$(this).attr('data-ontology-id', entity_path)
				$(this).addClass('cart-item')

				var cart_icon = $('<i class="fi-shopping-cart option"></i>')
				$(this).after(cart_icon) //awkward, cart requires margin-top:-30px in stylesheet.
				
				// Reflect current shopping cart status of item
				cart_item = top.cart.get(entity_path)
				if (cart_item)
					cart_icon.addClass(cart_item.status); 

				// Piggybacking ability to display ontology details for an <option>
				if (top.form.settings.ontologyDetails)
					$(this).prepend('<i class="fi-magnifying-glass"></i> &nbsp;')
			}
		})

	})

}


function render_cart_package_selection_modal() {
	/* Provides a menu of packages in 'draft' mode that user manages that
	 they could add shopping cart to. 
	 Couldn't figure out foundation event for this
	 A lot like init_resource_select()
	*/

	html = ['<option value="">Select a package ...</option>']
	// manager_filter turned on so only those items user manages are shown.
	init_resource_select_item(top.resources, html, '</optgroup>\n<optgroup label="Draft Packages">', null, null, true)
	html = html.join('\n')

	// Load menu selection
	$('#userPackages').html(html)
}

// reiterated here outside context of form
render_attr_ontology_id = function(domId) {
	return 'data-ontology-id="' + domId + '" '
}