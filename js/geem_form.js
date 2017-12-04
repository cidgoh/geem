
/****************************** OntologyForm Class *********************
The OntologyForm class provides all functions needed (using jquery, Zurb 
Foundation and app.css) to render and populate an ontology-driven form.

FUTURE: MAKE USE OF BETTER TEMPLATING
WISHLIST:
	- Allow fields to take on date or dateTime formatting by providing choice
	- Allow xml datatype formats for date&time to be inherited from parent model
	- Enable 3rd party standard form definition to be presented (like label -> uiLabel)
	- Also option for 3rd party database field name for form storage
	
Author: Damion Dooley
Project: genepio.org/geem
Date: Sept 4, 2017

*/

synonymFields = ['hasSynonym', 'hasExactSynonym', 'hasNarrowSynonym', 'hasAlternativeTerm']

function OntologyForm(domId, specification, settings, callback) {
	var self = this
	//bag = {}
	self.settings = {}
	self.formDomId = $(domId)
	self.specification = specification // By reference
	self.formCallback = callback

	// Some of these defaults can be overridden by particular fields via ui_feature specification
	if (settings) self.settings = settings
	if (! 'ontologyDetails' in self.settings) self.settings.ontologyDetails = false
	if (! 'minimalForm' in self.settings) self.settings.minimalForm = false


	/*********** FORM RENDERER *************************/
	this.renderEntity = function(entityId) {

		if (entityId) {
			if (entityId.indexOf('/') != -1)
				entityId = entityId.substr(0, entityId.indexOf('/'))
			self.entityId = entityId
		}
		formDelete()
		// Deselect any other form menu item that might be open.
		$('li.active[role="menuitem"]').removeClass('active')

		if (self.entityId) {

			// Highlight any menu item that is this entity
			// Ideally open menu to this item if it isn't already open.
			$('li[role="menuitem"][data-ontology-id="'+self.entityId+'"]').addClass('active')

			//top.bag = {} // For catching entity in a loop.
			form_html = render(self.entityId)
			form_html += renderButton('View Form Submission', 'getEntityData()') 

			// Place new form html into page and activate its foundation interactivity
			self.formDomId.html(form_html) //.foundation()

			// Set up UI widget for all date inputs; using http://foundation-datepicker.peterbeno.com/example.html
			$('input[data-date-format]').fdatepicker({disableDblClickSelection: true})

			var title = 'GEEM: ' + self.entityId

			// MOVE THIS UP TO app.js ???

			var entity = self.specification[entityId]
			if (entity) {
				var uiLabel = entity['uiLabel']

				// Enable page annotation by 3rd party tools by kicking browser to 
				// understand that a #anchor and page title are different.
				title += ':' + uiLabel
		
				// A hack that provides more styled info in portal.html
				if ($('#formEntityLabel').length) {

					$('#formEntityLabel').html(uiLabel + ' &nbsp; <span class="medium">(' + self.entityId.split(':')[1] + ')</span>')
					$('#mainForm > div.field-wrapper > label').html(entity['definition'] || '<span class="small float-right">(select all)</span>')
				}
				else {
					$('#mainForm > div.field-wrapper > label').attr('id','formEntityLabel').after('<p>' + (entity['definition']  || '') + '</p>') 
				}
			}
			// SET DISCUSSION FORUM IFRAME HERE


			window.document.title = title

		 	// Actually load an existing data record
		 	//loadFormData()

			// Set required/optional status of fields and controls for adding more elements.
			setCardinality() 

			// Clear out specification tab.  THIS SHOULD BE DONE via form hook ON SHOW OF SPEC TAB INSTEAD.
		 	if (window.getdataSpecification) {
		 		$('#dataSpecification').empty()
		 		$("#spec_download").attr('disabled','disabled')
		 		$('#specification-tabs li.is-active').removeClass('is-active').find('a').removeAttr('aria-selected'); // how else?
		 	}

		 	if (self.settings.minimalForm) setMinimalForm() // Hides empty optional field content.

		 	// All of form's regular <select> inputs (e.g. NOT the ones for picking units)
		 	// get some extra smarts for type-as-you-go filtering.
		 	$('select.regular').each(configureSelect); 
		 	
			self.formDomId.foundation()

			//Setup of this class enables callback function to be supplied.  Could make an event instead.
			if (self.formCallback)
				self.formCallback(self)
		 }
		return false
	}


	formDelete = function() {
		if (self.formDomId)
			self.formDomId.off().empty()
	}

	setMinimalForm = function() {
		/* For all optional fields: shows label but hides the input-group part
		 of all input fields. 
		 For fields with content, marks them even if they are hidden?
		*/

		self.formDomId
			// EXPERIMENTAL Added .5 second delay to :hover state action
			.on('mouseenter', 'div.field-wrapper.optional:not(.open)', function(event) {
				domItem = $(this)
				timer = setTimeout(function () {
					event.stopPropagation();
					domItem.stop( true, true ).addClass('open')
					var inputGroup = domItem.children('div.input-group')
					inputGroup.show(100, 'linear')
				}, 500);
			})
			.on('mouseleave', 'div.field-wrapper.optional.open', function(event) {
				clearTimeout(timer);
				event.stopPropagation();
				// Keep open inputs that DO have content. Close other optional inputs
				var inputGroup = $(this).children('div.input-group')
				var someContent = inputGroup.children('input, select') // IMMEDIATE CHILDREN
					.filter(function() {return ! !this.value;}) // double negative yeilds boolean.

				if (someContent.length == 0) { // Ok to hide.
					$(this).removeClass('open')
					$(this).stop( true, true ).children('div.input-group').hide(100, 'linear')
				}
			})

			// By default, hide all optional section .input-group that has EMPTY content.
			// except if an input field is a .tabs-panel field its got another hiding system.
			.find('div:not(.tabs-panel) > div.field-wrapper.optional > div.input-group').hide()

	}

	configureSelect = function() {
		// Applies jQuery chosen()
 		var fieldWrapper = $(this).parents("div.field-wrapper").first()
 		var min = fieldWrapper.attr("minCardinality")
		var max = fieldWrapper.attr("maxCardinality")
		var required = fieldWrapper.is('.required')
		if (required) $(this).prop('required',true); //Should do this in setCardinality() instead?
 		singleDeselect = (!min || min == 0) ? true : false

 		$(this).chosen({
 			placeholder_text_multiple: 'Select items ...',
 			placeholder_text_single: 'Select an item ...',
 			no_results_text: "Oops, nothing found!",
 			disable_search_threshold: 10,
 			max_selected_options: max,
 			allow_single_deselect: singleDeselect, //only works on single-select where first option value is ""
 			search_contains: true, //substring search
 			inherit_select_classes: true // inherits <select class=""> css
 		})

 		// But using this doesn't allow us to keep selection list open:
 		//.on('chosen:showing_dropdown',function(event) {
 		//	console.log('showing')
 		//})

 		// Other options:
 		// width: xyz pixels.
 		// max_shown_results: only show the first (n) matching options...
 		// <option selected> , <option disabled> 

 	}


	setCardinality = function() {
		/* This renders each form element's HTML required attribute via 
		javascript.	It also adds attributes for minCardinality and 
		maxCardinality.  These are used dynamically by the form 
		processor to show user controls for adding or removing input elements.
		*/
		var cardinalityLabel = ''

		self.formDomId.find('div.field-wrapper').each(function(index) {
			var min = $(this).attr("minCardinality") // || false
			var max = $(this).attr("maxCardinality") // || false
			var required = false

			if (min || max) {
				if (min) {
					if (max) {
						if (min == max) {
							if (min > 1) {
								cardinalityLabel = min + ' required'
								required = true
							}
							else { 
								if (min == 1) {
									cardinalityLabel = 'required'
									required = true
									//console.log('got required')
								}
								else {} // 0 or less is nonsense.
							}
						}
						else {
							cardinalityLabel = 'from ' + min + ' to ' + max + ' required'
							required = true
						}
					}
					else {
						if (min == 0) 
							cardinalityLabel = 'optional' // no max
						else
							if (min > 0) {
								cardinalityLabel = min + '+ required' // some minimum was given.
								required = true
							}
						
					}
				}
				else {// No min means not required.

					if (max == 1)
						cardinalityLabel = 'optional' // no max
					else
						cardinalityLabel = '<' + (parseInt(max) + 1) + ' items'

				}

				if (required == true) {
					$(this).addClass('required')
					$(this).children('div.input-group').children('input').prop('required',true) //NOT WORKING ON INPUT
				}
				else
					$(this).addClass('optional')

				// Show optional and required status messages.
				if (self.settings.ontologyDetails && cardinalityLabel.length > 0 ) 
					$(this).children('label') //children(".fi-shopping-cart")
						.before('<span class="info label float-right">' + cardinalityLabel + '</span>')
			}
				
		})

	}


	getEntityData = function() {
		/* The hierarchic form data must be converted into minimal JSON data 
		   packet for transmission back to server.
		   ISSUE: fields like temperature that have a unit field with selections. Has to be broken up. 
		*/
		var obj = {}

		$.each(self.formDomId.find("input:not(.button), select"), function(i,item) {
			var focus = obj
			var id = $(item).attr('id')
			if (id) {
				var path = id.split('/')
				for (var ptr in path) {
					var item2 = path[ptr]
					if (!(item2 in focus) ) focus[item2] = {}
					if (ptr == path.length-1) //If at end of path, make assignment
						focus[item2] = $(item).val()
					else
						focus = focus[item2]
				}
			}
		})

		setModalCode(obj, "Example of form data conversion into a JSON data packet for submission.")

	}


	setModalCode = function (obj, header) {
		// This displays the entity json object as an indented hierarchy of text inside html <pre> tag.
		$("#modalEntityHeader").html(header)
		$("#modalEntityContent").html(JSON.stringify(obj, null, 2) )
		$("#modalEntity").foundation('open')
	}


	/*********************** FORM SPECIFICATION BUILD **********************/
	getEntitySpecForm = function(entityId, specification = [], path = [], depth = 0, inherited = false) {
		/*
		Modelled closely on OntologyForm.render(), this returns just the form 
		specification object as it is "unwound" from pure JSON specification.
		FUTURE: Have form driven from output of this function.

		INPUT
			entityId : initial or current id to build hierarchic specification from
			specification : initially empty array containing ordered form elements.
		OUTPUT
			specification: javascript object containing all form elements.
			entity['path'] : path style indication of how far down in hierarchy
				the given entity is.
		*/
		if (entityId === false) {
			return specification // Nothing selected yet.
		}

		console.log("Render Form Spec ", path, entityId, depth, inherited)

		if (depth > 20) {
			console.log ("Node: ", entityId, " loop went AWOL while rendering path", path )
			return specification
		}

		if (! (entityId in self.specification)) {
			console.log("Node: " + entityId + " has no specification entry.")
			return specification
		}

		// deepcopy specification entity so we can change it.
		var entity = $.extend(true, {}, self.specification[entityId]) 
		
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so cannot be re-rendered.")
			return specification
		}

		if (!inherited) inherited = false // NECESSARY?

		// Initialize entity

		entity['path'] = path.concat([entityId])

		entity['depth'] = depth

		//if ('features' in entity) {} else entity['features'] = {}
		getFeatures(entity)

		if ('label' in entity['features']) {
			entity['uiLabel'] = entity['features']['label']['value']
		}
		if ('definition' in entity['features']) {
			entity['uiDefinition'] = entity['features']['definition']['value']
		}

		// TESTING: Trim all definitions to first sentence
		if ('definition' in entity && entity['definition'].indexOf('.') > 0) {
			entity['definition'] = entity['definition'].split('.',1)[0] + '.'
		}

		// Certain features like label and definition ovveride component label,
		// defn.Same for definition; also option for 3rd party database field 
		// name for form storage

		setConstraints(entity)

		if (entity['depth'] > 0) {
			// When this entity is displayed within context of parent entity, that entity will 
			// indicate how many of this part are allowed.
			// ISSUE: Multihoming parent id?
			getCardinality(entity)
			// Currently showing "hidden" feature fields as disabled.??????????????
			entity['disabled'] = ('hidden' in entity['features']);
		}

		// Used for some controls for sub-parts
		var	label = entity['uiLabel']

		if (entity['datatype'] === undefined)
			
			console.log('No form part for: "' + entity['uiLabel'] + '" (' + entityId + ')')

		else {
			switch (entity['datatype']) {

				case 'disjunction':
					// CURRENTLY WE JUST LUMP 'disjunction' IN WITH 'model'
					// Assumption is that each disjunction element is not itself marked required.
					// ISSUE: having a required status on a group of items is tricky.

				case 'model':
					// If X is_a+ (subclass of) 'data representational model' it is a model.
					// If this model has parent_id, 

					// Catch is situation where M has component N, where N is a model that 
					// inherits components from an is_a ancestor. Travel up the tree,
					// incorporating ALL 'has component' Z items.
					entity['components'] = getEntitySpecFormParts(entity, inherited, depth)
					break;

				/* PRIMITIVE data types 
				Inputs as sepecified in an OWL Ontology file can have all the standard xmls data types and restrictions.
				Potentially create ZURB Foundation fields: text, date, datetime, datetime-local, email, month, number, password, search, tel, time, url, and week
				*/

				/*
				DATE DATATYPES: date dateTime duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
				*/
				case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
				case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
				case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
				case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.
				case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)

				// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
				case 'xmls:string':
				case 'xmls:normalizedString':
				case 'xmls:token':
					getEntitySpecFormUnits(entity)
					break;
		 
				// renderInteger(entity, minInclusive, maxInclusive)
				case 'xmls:integer':			getEntitySpecFormNumber(entity);	break
				case 'xmls:positiveInteger': 	getEntitySpecFormNumber(entity, 1);	break
				case 'xmls:nonNegativeInteger':	getEntitySpecFormNumber(entity, 0);	break
				case 'xmls:unsignedByte':		getEntitySpecFormNumber(entity, 0, 255); break// (8-bit)	
				case 'xmls:unsignedShort':		getEntitySpecFormNumber(entity, 0, 65535); break// (16-bit) 
				case 'xmls:unsignedInt':		getEntitySpecFormNumber(entity, 0, 4294967295);	break// (32-bit)		
				case 'xmls:unsignedLong':		getEntitySpecFormNumber(entity, 0, 18446744073709551615); break// (64-bit) 

				case 'xmls:negativeInteger':	getEntitySpecFormNumber(entity, null, -1); break
				case 'xmls:nonPositiveInteger':	getEntitySpecFormNumber(entity, null, 0); break

				case 'xmls:byte': 	getEntitySpecFormNumber(entity, -128, 127);	break// (signed 8-bit)
				case 'xmls:short': 	getEntitySpecFormNumber(entity, -32768, 32767);	break// (signed 16-bit)
				case 'xmls:int': 	getEntitySpecFormNumber(entity, -2147483648, 2147483647);	break// (signed 32-bit)
				case 'xmls:long': 	getEntitySpecFormNumber(entity, -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

				// Decimal, double and float numbers
				case 'xmls:decimal':
				 	getEntitySpecFormNumber(entity)
				 	// Add maximum # of digits.
					break;
				// Size of float/double depends on precision sought, see
				// https://stackoverflow.com/questions/872544/what-range-of-numbers-can-be-represented-in-a-16-32-and-64-bit-ieee-754-syste
				case 'xmls:float':  
					getEntitySpecFormNumber(entity, - Math.pow(2, 23), Math.pow(2, 23) - 1 )

					break;
				case 'xmls:double': 
					getEntitySpecFormNumber(entity, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
					break;


				case 'xmls:boolean': // Yes/No inputs here
					//getEntitySpecFormBoolean(entity)
					break;

				case 'xmls:anyURI': // Picklists are here
					if (entityId in self.specification) {
						getEntitySpecFormChoices(entity)
					}
					else
						console.log('ERROR: Categorical variable [', entityId, '] not marked as a "Categorical tree specification"')
					break;

				default:
					console.log('UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']' + label  )
					break;
			}


		}

		// Various fields that flat ontology has that trimmed-down JSON or YAML form view don't need.
		entity = getEntitySimplification(entity)
		specification.push(entity)

		return specification
	}

	getEntitySimplification = function(entity) {
		/* Simple view of specification dispenses with cross-references and 
		other aspects that have already been digested.
		*/
		delete (entity['parent'])
		delete (entity['otherParent'])
		//delete (entity['components']) // these form the hierarchy
		delete (entity['models'])
		//delete (entity['path'])
		delete (entity['member_of'])
		delete (entity['constraints'])
		//if ($.isEmptyObject(entity['features']))
		//	delete (entity['features'])
		if ($.isEmptyObject(entity['choices']))
			delete (entity['choices'])

		// This is a CHEAT: moves uiLabel to first param in object for display purposes
		var freshEntity = {'uiLabel': entity['uiLabel']}
		return $.extend(true, freshEntity, entity) 
	}

	getEntitySpecFormParts = function(entity, inherited, depth) {
		/*
		Convert given "specification" entity's "parts" list into a list of 
		processed entities.
		*/
		var specification = []

		// Here we go up the hierarchy to capture all inherited superclass 'has component' components.
		// Will venture upward as long as each ancestor 'has component' X.
		// ISSUE: Do we want parent's stuff APPENDED to spec, or inserted as part of this spec?
		if ('parent' in entity) {
			var parentId = entity['parent']
			if (parentId != 'obolibrary:OBI_0000658') {//Top level spec.
				var parent = self.specification[parentId]
				// console.log('found parent', parent['id'], parent['uiLabel'])
				if (parent && 'components' in parent) {
					// "true" prevents a parent's other is_a subclass models from being pursued.
					//this.getEntitySpecForm(parentId, specification, entity['path'], depth + 1, true)
					var specification = this.getEntitySpecFormParts(parent, true, depth + 1)
					// console.log('did parent', specification.length, 'items')
					//call to parent clears specification out.
				}
			}
		}


		// Whether we're going up or down, we add on ALL 'has component' items 
		for (var entityId2 in entity['components'] ) { 
			// cardinality "x has member some/one/etc y"
			// Sorting ???
			console.log(entity['uiLabel'], "has component", entityId2, self.specification[entityId2]['uiLabel'])
			this.getEntitySpecForm(entityId2, specification, entity['path'], depth + 1)
		}

		// Simple specifications don't include models via 'is_a'.  They focus on forms via 'has component'

		// Only if we're descending downward do we add all subclass models to specification
/*		if (inherited == false) {
			// Cardinality doesn't apply to models so far.
			for (var entityId in entity['models']) { 
				console.log(entity['uiLabel'], "has model", entityId)
				this.getEntitySpecForm(entityId, specification, entity['path'], depth + 1) 
			}
		}
*/


		return specification
	}

	getEntitySpecFormNumber = function(entity, minInclusive=undefined, maxInclusive=undefined) {
		getEntitySpecFormUnits(entity)
	}

	getEntitySpecFormUnits = function(entity) {
		// Convert units array id references into reference to unit object
		// itself.  Maintains order, and info like default unit.

		if ('units' in entity) {
			unitsArray = {}
			var units = entity['units']
			for (var ptr in units) {
				var unit = $.extend(true, {}, self.specification[units[ptr]] )
				unitsArray[unit['id']] = unit
			}
			entity['units'] = unitsArray
	   	}
	   	
	}


	getEntitySpecFormChoices = function(entity) {
		/* Select, radio, checkbox all get the same data structure. Here we
		know that all subordinate "subClassOf" parts are picklist choice
		items, which at most have feature annotations.
		OUTPUT
			entity.lookup if appropriate
			entity.multiple if appropriate
		*/
		if ('lookup' in entity['features']) 
			entity['lookup'] = true
		
		if (entity['minCardinality'] > 1 || (entity['maxCardinality'] != 1))
			entity['multiple'] = true

		getEntitySpecFormChoice(entity)
	}

	getEntitySpecFormChoice = function(entity, depth = 0) { 
		/* If entity already has 'choices' option, then skip this

		OUTPUT
			part['disabled'] if appropriate.  Indicates whether a certain 
			categorical selection should be ignored or hidden.
		*/
		if (depth > 20) // NCBI Taxon might go this deep?
			console.log("MAX DEPTH PROBLEM WITH " + entity['id'])

		if ('choices' in entity) {
			var newChoices = [] // Array to preserve order
			for (var memberId in entity['choices']) {
				var part = $.extend(true, {}, self.specification[memberId]) //deepcopy
				if (!part) // Should never happen.
					console.log("Error: picklist choice not available: ", memberId, " for list ", entity['id'])
				else {
					delete part['datatype'] // Unnecessary

					// TESTING: Trim all definitions to first sentence
					if ('definition' in part && part['definition'].indexOf('.') > 0) {
						part['definition'] = part['definition'].split('.',1)[0] + '.'
					}

					// Currently showing "hidden" feature as disabled.
					if (getFeature(part, 'hidden', entity['id']) )
						part['disabled'] = true;

					newChoices.push(getEntitySpecFormChoice(part , depth+1))
				}
			}
			entity['choices'] = newChoices
		}

		getEntitySimplification(entity)
		return entity
	}



	/*********************** FORM PART RENDERING **********************/


	render = function(entityId, path = [], depth = 0, inherited = false, minimal = false) {
		if (entityId === false) return '' // Nothing selected yet.

		console.log("Render", path, entityId, depth, inherited)

		if (!inherited) inherited = false
		if (!minimal) minimal = false
		var html = ''

		if (depth > 20) {
			console.log ("AWOL Loop? While rendering", path )
			return html
		}
		// Prevents an item from being rendered in loop.
		// PROBLEM: Prevents >0 of an entity even when desired.e.g. phone/cell
		//if (entityId in top.bag) {console.log('ISSUE: entity '+entityId+' is in a loop');return ""} 
		//else top.bag[entityId] = true		

		// Clone entity so we can change it.
		if (entityId in self.specification)
			var entity = $.extend(true, {}, self.specification[entityId]) 
		else {
			console.log("Node: " + entityId + " has no specification entry.")
			return html
		}

		// Initialize entity
		entity['depth'] = depth


		entity['path'] = path.concat([entityId])
		// Create a unique domId out of all the levels 
		entity['domId'] = entity['path'].join('/')
		//if ('parent' in entity && parent['id'] == entityId) {
		//	console.log("Node: " + entityId + " is a parent of itself and so cannot be re-rendered.")
		//	return html
		//}

		getFeatures(entity)

		if ('label' in entity['features']) {
			entity['uiLabel'] = entity['features']['label']['value']
		}

		// Used for some controls for sub-parts
		var	label = (minimal) ? '' : renderLabel(entity)

		setConstraints(entity)

		if (entity['depth'] > 0) {
			// When this entity is displayed within context of parent entity, that entity will 
			// indicate how many of this part are allowed.
			getCardinality(entity)
			// Currently showing "hidden" feature fields as disabled.
			entity['disabled'] = ('hidden' in entity['features']) ? ' disabled="disabled"' : '';
		}

		switch (entity['datatype']) {
			case undefined: // Anonymous node
				html += renderSection(entity, label, '<span class="small"><i>No form part for this! Is it a "categorical tree specification" or does it have a "has primitive value spec" data type?</i></span>')
				break;

			case 'disjunction':
				html += renderDisjunction(entity, label, depth)
				console.log('disjunction '  + label)
				break;

			case 'model':
				html += renderSpecification(entity, inherited, depth)
				// If specification has stuff, then wrap it:
				if (html.length > 0 && entity['uiLabel'] != '[no label]')
					return getModelWrapper(entity, label + html)
				break;

			/* PRIMITIVE data types 
			Inputs as sepecified in an OWL Ontology file can have all the standard xmls data types and restrictions.
			Potentially create ZURB Foundation fields: text, date, datetime, datetime-local, email, month, number, password, search, tel, time, url, and week
			*/

			/*
			DATE DATATYPES: date dateTime duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
			*/
			case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
			case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
			case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
			case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.

			case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)
				html += renderDateTime(entity, label)
				break;

			// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
			case 'xmls:string':
			case 'xmls:normalizedString':
			case 'xmls:token':
				html += renderInput(entity, label)
				break;
	 
			// renderInteger(entity, minInclusive, maxInclusive)
			case 'xmls:integer':			html += renderNumber(entity, label, 'integer');	break
			case 'xmls:positiveInteger': 	html += renderNumber(entity, label, 'integer', 1);	break
			case 'xmls:nonNegativeInteger':	html += renderNumber(entity, label, 'integer', 0);	break
			case 'xmls:unsignedByte':		html += renderNumber(entity, label, 'integer', 0, 255); break// (8-bit)	
			case 'xmls:unsignedShort':		html += renderNumber(entity, label, 'integer', 0, 65535); break// (16-bit) 
			case 'xmls:unsignedInt':		html += renderNumber(entity, label, 'integer', 0, 4294967295);	break// (32-bit)		
			case 'xmls:unsignedLong':		html += renderNumber(entity, label, 'integer', 0, 18446744073709551615); break// (64-bit) 

			case 'xmls:negativeInteger':	html += renderNumber(entity, label, 'integer', null, -1); break
			case 'xmls:nonPositiveInteger':	html += renderNumber(entity, label, 'integer', null, 0); break

			case 'xmls:byte': 	html += renderNumber(entity, label, 'integer', -128, 127);	break// (signed 8-bit)
			case 'xmls:short': 	html += renderNumber(entity, label, 'integer', -32768, 32767);	break// (signed 16-bit)
			case 'xmls:int': 	html += renderNumber(entity, label, 'integer', -2147483648, 2147483647);	break// (signed 32-bit)
			case 'xmls:long': 	html += renderNumber(entity, label, 'integer', -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

			// See https://www.w3.org/TR/2005/WD-swbp-xsch-datatypes-20050427/ 
			// about XML/RDF/OWL numeric representation.
			// Re. OWL/RDF storage: Note: All "minimally conforming" processors
			// "must" support decimal numbers with a minimum of 18 decimal
			// digits (i.e., with a "totalDigits" of 18).

			case 'xmls:decimal':
				html += renderNumber(entity, label, 'decimal')
				break;

			// Size of float/double depends on precision sought, see
			// https://stackoverflow.com/questions/872544/what-range-of-numbers-can-be-represented-in-a-16-32-and-64-bit-ieee-754-syste
			case 'xmls:float':  
				html += renderNumber(entity, label, 'float', - Math.pow(2, 23), Math.pow(2, 23) - 1 )

				break;
			case 'xmls:double': 
				html += renderNumber(entity, label, 'double', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
				break;

			case 'xmls:boolean': // Yes/No inputs here
				html += renderBoolean(entity)
				break;

			case 'xmls:anyURI': // Picklists are here
				if (entityId in self.specification)
					html += renderChoices(entity, label)
				else
					html += '<p class="small-text">ERROR: Categorical variable [' + entityId + '] not marked as a "Categorical tree specification"</p>'
				break;

			default:
				html += renderSection(entity, label, 'UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']')
				break;
		}
		return html
	}


	renderSpecification = function(entity, inherited, depth) {
		html = ''
		// Here we go up the hierarchy to render all (and only) components of 
		// superclass models, if any.
		if ('parent' in entity) { // aka member_of or subclass of
			var parentId = entity['parent']
			if (parentId != 'obolibrary:OBI_0000658') {//Top level spec.
				//console.log('' + depth + ": Specification "+entityId+" inheriting: " + parentId)
				html += this.render(parentId, [], depth+1, true)
			}
		}	

		// Render an item's models only if traversing downwards.  In other
		// words, if renderer asked to detail a model itself, then show
		// subclass models.
		/*
		if (inherited == false) {
			for (var entityId in entity['models']) { 
				html += this.render(entityId, entity['path'], depth+1)
			}
		}
		*/

		// Render each component
		for (var entityId in entity['components']) { 
			html += this.render(entityId, entity['path'], depth+1)
		}

		if (inherited == false && 'choices' in entity) { //no inheritance on choices
			for (var entityId in entity['choices']) { 
				// Cardinality doesn't apply to categorical pick-lists so no need to supply path.
				// Depth however is paid attention to for picklist depth cutoff option.
				html += this.render(entityId, [], depth + 1) 
				
			}
		}
		return html	
	}

	renderSection = function(entity, label, text) {
		html = [label
		,	'	<div class="input-group">\n'
		,			text
		,			renderHelp(entity)
		,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}

	renderDateTime = function(entity, label) {
		/*
		Provide datepicker with ISO 8601 date/time format which can be
		overrided by other formats via entity feature "format_..."

		ISSUE: datepicker isn't compatible with html5 <input type="date">

		FUTURE: Enable date/time formats to be inheritable from parent model.
		FUTURE: Implement data-start-view="year" data-min-view="year"

		INPUT
		entity['datatype'] = xmls:date | xmls:time | xmls:dateTime | xmls:dateTimeStamp | xmls:duration
		entity['feature'] = optional "format_date=...", "format_time=..." etc.
		*/
		// Use ISO 8601 Defaults
		// But duration selection depends on given units.
		switch (entity['datatype']) {
			case 'xmls:date': format='yyyy-mm-dd'; break; //and possibly time zone "Z" for UTC or +/-HH:MM
			case 'xmls:time': format='hh:ii:SS'; break;
			case 'xmls:dateTime': format='yyyy-mm-ddThh:ii:SS'; break;
			case 'xmls:dateTimeStamp': format='yyyy-mm-ddThh:ii:SS'; break; //+ REQUIRED time zone "Z" for UTC or +/-HH:MM
			case 'xmls:duration': format=''; break; //Should be driven by units.
		}

		html = [label
			,'	<div class="input-group">\n'
			,'		<input class="input-group-field '+entity['id']+'"'
			,		' id="'+entity['domId']+'"'
			,		' type="text"'
			,		' data-date-format="' + format + '"'
			,		getPlaceholder(entity)
			//,		getStringConstraints(entity)
			,		entity['disabled']
			,		'/>\n'
	    	,	renderUnits(entity)
			,	renderHelp(entity)
			,'	</div>\n'].join('')

		return getFieldWrapper(entity, html)
	}

	renderInput = function(entity, label) {
		/*
		Add case for paragraph / textarea?
		 <textarea placeholder="None"></textarea>
		*/

		html = [label
		,	'	<div class="input-group">\n'
		,	'		<input class="input-group-field '+entity['id']+'"'
		,			' id="'+entity['domId']+'"'
		, 			' type="text" '
		,			 getStringConstraints(entity)
		,			 entity['disabled']
		,			 getPlaceholder(entity)
		,			 '/>\n'
    	, 			renderUnits(entity)
		,			renderHelp(entity)
		,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}


	renderButton = function(text, buttonFunction) {
		// Future, could add ' type="select" '
		html = '<div>\n'
		html +=	'	<input class="button float-center" value="' + text + '" onclick="'+buttonFunction+'">\n'
		html +=	'</div>\n'

		return html
	}

	renderDisjunction = function(entity, label, depth) {
		/* This entity was made up of 'has component some (X or Y or Z ...) 
		At least one of the disjunction parts needs to be filled in.  More are
		allowed at moment. A tabbed interface is used for each component.
		*/ 
		var domId = entity['domId']
		var htmlTabs = '<ul class="tabs" data-tabs id="' + domId + '">'
		var htmlTabContent = '<div class="input-group tabs-content" data-tabs-content="' + domId + '">'

		// Could externalize this
		var activeDone = false
		for (var entityId in entity['components']) { 
			var childDomId = entityId.replace(':','_')
			var child = self.specification[entityId]
			if (activeDone == false) {
				activeDone = true
				tab_active = ' is-active '
				aria = ' aria-selected="true" '
			}
			else {
				tab_active = ''
				aria = ''
			}

			htmlTabs += '<li class="tabs-title'+tab_active+'"><a href="#panel_'+childDomId+'" ' + aria + '>' + renderLabel(child) + '</a></li>'

			htmlTabContent += '<div class="tabs-panel'+tab_active+'" id="panel_'+childDomId+'">'
			htmlTabContent += 	this.render(entityId, entity['path'], depth+1, false, true )
			htmlTabContent += '</div>\n'		
		}
		htmlTabs += '</ul>' 
		htmlTabContent += '</div>\n'

		html = '<div class="field-wrapper input-tabs">' + htmlTabs + htmlTabContent + renderHelp(entity) + '</div>\n'
		html +=	'<br/>\n'
		return html
	}

	renderInput = function(entity, label) {
		/*
		Add case for paragraph / textarea?
		 <textarea placeholder="None"></textarea>
		*/

		html = [label
			,	'	<div class="input-group">\n'
			,	'		<input class="input-group-field '+entity['id']+'"'
			,			' id="'+entity['domId']+'"'
			, 			' type="text" '
			,			 getStringConstraints(entity)
			,			 entity['disabled']
			,			 getPlaceholder(entity)
			,			 '/>\n'
	    	, 			renderUnits(entity)
			,			renderHelp(entity)
			,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}


	/* NUMERIC DATATYPES HANDLED HERE */
	renderNumber = function(entity, label, type, minInclusive=undefined, maxInclusive=undefined) {
		/*
		A general number input renderer that handles integer, decimal, double and float.
		Issue is that foundation zurb styles "type=number" and "type=text" inputs but 
		validation for number allows only integers by default; one has to supply a "step"
		parameter to get decimal increments.  Doing this is very awkward for data entry so
		resorting to "type=text" inputs with pattern catching the validation for those cases.

		FUTURE: implement a xsd:fractionDigits, and xsd:totalDigits
		
		INPUT: 
			type: integer|decimal|double|float

		*/
		if (type == 'integer') {
			var stepAttr = ' step="1"'
			var typeAttr = ' type="number"' // foundation zurb does css on this.
		}
		else {
			if ('minValue' in entity) 
				var stepAttr = ' step="' + (entity['minValue'] % 1) + '"'
			else // kludgy default
				var stepAttr = ' step="0.0001"'

			var typeAttr = ' type="number"'
		}
		html = [label,
				,'<div class="input-group">\n'
		 		,'		<input class="input-group-field ' + entity['id'] + '"'
		 		,			' id="' + entity['domId'] + '"'
		 		,			typeAttr
				,			stepAttr
				,			entity['disabled']
				,			getNumericConstraintHTML(entity, minInclusive, maxInclusive)
				,			' placeholder="' + type + '"'
				,			' pattern="' + type + '"'
				,			' />\n'
	    		,	renderUnits(entity)
				,	renderHelp(entity)
				,'</div>\n'
				].join('')

		return getFieldWrapper(entity, html)
	}


	renderBoolean = function(entity) {

		html =	'	<div class="switch small" style="float:left;margin-right:10px;margin-bottom:0">\n'
		html +=	'	  <input id="'+entity['domId']+'" class="switch-input" type="checkbox" name="'+entity['id']+'"' + entity['disabled'] + '/>\n' //class="switch-input '+entity['id'] + '" 
		html +=	'		<label class = "switch-paddle" for="'+entity['domId']+'"></label>\n'
		html +=	'	</div>\n'
		html +=	renderLabel(entity) 
		html +=	'	<br/>' + renderHelp(entity)
		return getFieldWrapper(entity, html)
	}

	renderChoices = function(entity, label) {
		/* FUTURE: OPTION FOR RENDERING AS SELECT OPTIONS, RADIOBUTTONS OR CHECKBOXES ...

		*/
		picklistId = entity['id']
		var multiple = entity['minCardinality'] > 1 || (entity['maxCardinality'] != 1) ? ' multiple' : ''
		var html = label
		html +=	'	<div class="input-group">\n'
		html +=	'		<select class="input-group-field '+ entity['id'] + ' regular" id="'+entity['domId']+'"' + entity['disabled'] + multiple + '>\n'
		if (multiple.length == 0)
			html +=	'<option value=""></option>'  //Enables no option to be selected.

		var cutDepth = getFeature(entity, 'depth') // a numeric depth or null.
		if (cutDepth !== undefined) 
			cutDepth = cutDepth.value
		else
			cutDepth == 20 // Its greater than max depth test below.

		// Because one should deliberately make a selection ... esp. when 
		// confronted with required selection list where 1st item is 
		html +=	'	<option value="" disabled>Select ...</option>'
		html +=			renderChoice(self.specification[picklistId], 0, cutDepth, 'select')
		html +=	'	</select>\n'

		if ('features' in entity && 'lookup' in entity['features']) 
			html += '		<a class="input-group-label" onclick="getChoices(this,\''+entity['id']+'\')">more choices...</a>\n'
	
		html += renderHelp(entity)
		html +=	'	</div>\n'


		return getFieldWrapper(entity, html)
	}



	renderChoice = function(entity, depth, cutDepth, inputType='select') { 
		/* 
		
		ISSUE: currently the ontologyID for each item does not include path
			   Include path, or parent?
		INPUT
			inputType = select|radio|checkbox
			cutDepth = depth to stop pursuing kids silently

		*/

		if (depth > 10) return ('MAX DEPTH PROBLEM WITH ' + entity['id'], 0)

		var html = ''

		if ('choices' in entity) {

			if (depth == cutDepth)
				return ' (' + Object.keys(entity['choices']).length + ')'

			for (var memberId in entity['choices']) {
				var part = self.specification[memberId]
				var kid_html = ''

				if (!part) // Should never happen.
					console.log("Error: picklist choice not available: ", memberId, " for list ", entity['id'])
				else {
					// Currently showing "hidden" feature as disabled.
					var disabled = getFeature(part, 'hidden', entity['id']) ? ' disabled="disabled"' : '';
					var label = part['uiLabel']
					if (!label) {
						label = ''
						console.log['Error: picklist item has no label: ' + part['label']]
					}
					
					// See if this option has any child options
					kid_html += renderChoice(part, depth+1, cutDepth, inputType)
					if (kid_html && depth == cutDepth - 1)
						label += kid_html

					switch (inputType) {

						case "checkbox": // future
							break;
						case "radio": // future
							break;
						case "select":

						default:
						/* Right now we have hacked jquery.chosen.min.js to show any synonyms if given
						 	synonymEl=this.form_field[c.options_index].attributes.getNamedItem('synonyms'),
							c.search_text=c.group?c.label:(c.html + (synonymEl==null?'':' ('+synonymEl.value+')')),
							(!c.group||this.group_search)&&(c.search_match=this.search_string_match(
							...
						*/
							var synonymArray = []

							for (var fieldptr in top.synonymFields) {

								var field = top.synonymFields[fieldptr]
								if (field in part) {
									synonymArray = synonymArray.concat(part[field])
								}
							}

							if (synonymArray.length>0) {
								// FUTURE: sort, then remove items if superstrings are already in array
								var synonyms = ' synonyms="' + synonymArray.join(',').toLowerCase() + '"'
							}
							else
								var synonyms = ''

							html += '<option value="' + part['id'] + '" class="depth' + depth + '" ' + disabled + synonyms + '>' + ' '.repeat(depth) + label + '</option>\n'  
					}

					html += kid_html

				}

			}

		}
		
		return html
	}

	renderUnits = function(entity) {
		/* User is presented with choice of data-entry units if available.
		Future: enable default unit/scale (cm, mm, m, km etc.) by placing 
		default unit first in selection list.

		NOTE: server has to unparse unit associated with particular input via
		some kind of name/unit syntax.
		INPUT
			entity: 
		OUTPUT
		For a given input the id of the "units" selection list component is 
		returned with a DOM id of "[entity domId path]-obolibrary:IAO_0000039" (unit)
		*/
		if ('units' in entity) {
			var units = entity['units']
			var label = renderLabel(self.specification[units[0]])
			if (units.length == 1) 
				return '<span class="input-group-label small">'+ label + '</span>\n'

			var html ='<div class="input-group-button" style="font-weight:700;" ><select class="units" id="'+entity['domId']+'-obolibrary:IAO_0000039">'
			for (var ptr in units) { //.slice(1)
				var unit = self.specification[units[ptr]]
				var unitLabel = unit['uiLabel'] ? unit['uiLabel'] : unit['label']
				html += '		<option value="'+ unit['id'] + '">' + unitLabel + ' &nbsp;</option>'
			}
			html += '</select></div>\n'
			return html
	   	}
	   	return ''
	}


	renderHelp = function(entity) {
		// Currently help consists of displaying a field's user interface 
		// definition, or original ontology definition.
		var help = getFeature(entity, 'help', entity['parent_id']) 
		return help ? '	<p class="helper-text">' + help + '</p>\n' : ''
	 }

	renderLabel = function(entity) {
		if (!entity) return 'ERROR: Entity not defined'

		// This links directly to form for only this entity.  Not in context of larger form.
		// Problem is that recursion to fetch parts from parent runs into parents that 
		// have no further path.

		var definition = ''
		if ('uiDefinition' in entity) definition = entity['uiDefinition'] 
		else if ('definition' in entity) definition = entity['definition']
		definition = definition.replace('"','\'\'')

		if (self.settings.ontologyDetails && entity['depth'] > 0)
			var labelURL = '<a href="#' + entity['id'] + '">' + entity['uiLabel'] + '</a>' 
		else
			var labelURL = entity['uiLabel']

		// Enable mouseover display of above.
		html = '<label data-ontology-id="'+ entity['id'] +'">'
		if (self.settings.ontologyDetails)
			html += '<i class="fi-magnifying-glass"]></i> ' + labelURL
		else 
			if (definition.length) {
				var deflen = definition.indexOf('. ')
				if (deflen>-1)
					definition = definition.substr(0,deflen)
				html += '<span data-tooltip class="has-tip right" data-disable-hover="false" data-click-open="true" data-width="250" title="' + definition + '">' + labelURL + '</span>'
			}
			else
				html += labelURL + '</span>'

		html +=  '</label>\n'

		return html
	}


	/************************** UTILITIES ************************/

	getPlaceholder = function(entity,type) {
		return (' placeholder="'+ entity['datatype'].substr(entity['datatype'].indexOf(':') + 1 )+ '"' ) 
	}

	getFieldWrapper = function(entity, html) {

		return ['<div class="field-wrapper field'
			,		('models' in entity || 'choices' in entity) ? ' children' : '' // models check needed?
			,		'" '
			,		getIdHTMLAttribute(entity['domId'])
			,		getHTMLAttribute(entity, 'minCardinality')
			,		getHTMLAttribute(entity, 'maxCardinality')
			,		'>\n'
			,		html
			,	'</div>\n'].join('')
	}

	getModelWrapper = function(entity, html) {
		return [
			'<a name="' + entity['domId'] + '"/>'
			,	'<div class="field-wrapper model children depth' + entity['depth'] + '" '
			,	getIdHTMLAttribute(entity['domId'])
			,	getHTMLAttribute(entity, 'minCardinality')
			,	getHTMLAttribute(entity, 'maxCardinality')
			,	'>\n'
			,	html
			,	'</div>\n'].join('')
	}

	getIdHTMLAttribute = function(domId) {
		return 'data-ontology-id="' + domId + '" '
	}

	getHTMLAttribute = function(entity, attribute) {
		return (attribute in entity) ? attribute +'="' + entity[attribute] + '" ' : ''
	}


	getFeatures = function(entity) {
		/* 
		An instance of a form field that has entity['features'] should have those
		enhanced by parent's route to this entity.
		*/
		var referrerId = entity['path'].slice(-2)[0]
		var referrer = self.specification[referrerId]

		if (!referrer) {console.log("ERROR: can't find entity ", referrerId, " to get feature for." ); return false }
		
		var myFeatures = {}
		for (var myList in {'models':null, 'components':null}) {
			if (myList in referrer) {
				var piecesArray = referrer[myList][entity['id']]
				if (piecesArray) {
					for (var ptr in piecesArray) {
						var myobj = piecesArray[ptr]
						if ('feature' in myobj) {
							myFeatures[myobj['feature']] = $.extend({}, myobj)
							break;
						}
					}
				}
			}
		}
		// Will this OVERRIDE dictionary items?
		if ('features' in entity) 
			$.extend(entity['features'], myFeatures)
		else
			entity['features'] = myFeatures

	}

	getFeature = function(entity, feature, referrerId=undefined) {
		/* A feature exists in either entity['features'] or 
		entity['components'][referrerId]

		*/

		if (referrerId) {

			var referrer = self.specification[referrerId]
			var parts = ['models', 'components']
			if (referrer) {
				for (ptr in parts) {
					var myList = parts[ptr]
					if (myList in referrer) {
						var pieceArray = referrer[myList][entity['id']]
						if (pieceArray) {
							for (var ptr in pieceArray) {
								if ('feature' in pieceArray[ptr] && pieceArray[ptr]['feature'] == feature) {
									return pieceArray[ptr]
								}
							}
						}
					}
				}
			}

			return false
		}

			//Features wiped out!
		if ('features' in entity && feature in entity['features']) 
			return entity['features'][feature]

	}


	setConstraints = function(entity) {
		/* 
		Adds axiom bracketed expressions of the form:
			
			'has primitive data type' exactly 1 xsd:decimal[>= -90.0 , <= 90.0,
				 totalDigits 8, fractionDigits 6]

			'has primitive data type' exactly 1 xsd:string[length 6]

		directly into entity in form [constraint without the xmls: part]:value

		Each constraints array item has "constraint", "datatype", and "value" 
		key value pairs.

		See https://books.google.ca/books?isbn=1118080602 for OWL/XML items below.

		OUTPUT
			entity[minInclusive]
			a key-value dictionary.
		*/
		if ('constraints' in entity && entity['constraints'].length) {
			var constraints = entity['constraints']
			for (var ptr in constraints) {
				var constraint = constraints[ptr]['constraint']
				var field = constraint.split(':')[1]
				var value = constraints[ptr]['value']
				switch (constraint) {
					// Numeric
					case 'xmls:minInclusive':
						entity['minValue'] = value
						break;
					case 'xmls:maxInclusive':
						entity['maxValue'] = value
						break;					
					//case 'xmls:minExclusive': // converted into minInclusive already
					//case 'xmls:maxExclusive': // ditto.
					case 'xmls:fractionDigits':
					case 'xmls:totalDigits':

					case 'xmls:length': // exact length
					case 'xmls:minLength': 
					case 'xmls:maxLength': 
						entity[field] = parseInt(value)
						break;

					// String
					case 'xmls:pattern': //reg. exp. for string or number.  
					case 'xmls:whiteSpace': // preserve|collapse|replace
					case 'xmls:enumeration': //an allowed value.
						entity[field] = value
						break;		
					default:
						break;
				}
			}
		}
	}

	getNumericConstraintHTML = function(entity, minInclusive, maxInclusive) {
		/*
		Adds numeric upper and lower tests if appropriate.
		RegEx pattern is also allowed.

		// ISSUE: is 'pattern' getting duplicated?

		OUTPUT:
			min: min=N or empty string
			max: max=N or empty string
			pattern: xmls:pattern or empty string

		*/
		if (maxInclusive === undefined || 'maxValue' in entity && maxInclusive > entity['maxValue']) 
			maxInclusive = entity['maxValue']

		if (minInclusive === undefined || 'minValue' in entity && minInclusive < entity['minValue']) 
			minInclusive = entity['minValue']

		var min = (minInclusive === undefined) ? '' : ' min='+minInclusive+' ' 
		var max = (maxInclusive === undefined) ? '' : ' max='+maxInclusive+' ' 

		return min + max + getPatternConstraint(entity)
	}


	getStringConstraints = function(entity) {
		var min 	= 'minLength' in entity ? ' minLength="'+entity['minLength']+'" ' : ''
		var max 	= 'maxLength' in entity ? ' maxLength="'+entity['maxLength']+'" ' : ''
		//size 	= 'xmls:length' in constraints ? ' size="'+constraints['xmls:length']+'" ' : ''
		return min + max + getPatternConstraint(entity)
	}

	getPatternConstraint = function(entity) {
		// Render specific RegEx "pattern" that is used to validate data entry
		var pattern = ''
		if ('pattern' in entity) {
			var value = entity['pattern']
			// Zurb Foundation accepts some preset expression names.
			if (value in Foundation.Abide.defaults.patterns)
				pattern = value
			else
				pattern = "^" + value + '$' // RegEx match input string start to finish.

			pattern = 'pattern="' + pattern + '" '
		}
		return pattern
	}

	getCardinality = function(entity) {
		/* Here we're given an entity with respect to some parent entity.  The 
		parent has a cardinality qualifier relation between the two that indicates
		how	many of	that entity can exist in it's parent entity's data structure
		and by extension, on a form that comprehensively describes the given 
		entity.	This constraint also contributes to the "required" flag for the 
		given entity.

		NOTE: limits on the data range of numeric or date values is handled 
		separately in the constraints functions above.

		EXPLANATION
		In OWL/Protege it is often stated that entity A has relation B to entity C,

			e.g.: h-antigen 'has primitive value spec' some 'xsd:string'
			
		The term "some" above is equivalent to the cardinality "min 1" aka "minQualifiedCardinality 1" 
		or in plain english, "1 or more", which is ok in many logic scenarios as it
		enforces the existence of at least one example.  The cardinality of "some" in
		a user interface would on the face of it allow the user to add more than one 
		of a particular item which is fine for things like multiple phone number and 
		alternate email datums.

		However, if we're looking for one and only one datum of a certain type in an 
		entity data structure, we actually need to say that entity A has exactly 
		"owl:qualifiedCardinality 1" aka "exactly 1" of entity B, no less and no more.  

		INPUT 
			entity: the form element being rendered
			referrerId: id of parent of entity (an entity may have more than one parent)
		
		OUTPUT
			entity['minCardinality']
			entity['maxCardinality']
		*/
		var referrerId = entity['path'].slice(-2)[0]
		var constraints = []
		var id = entity['id']
		var referrer = self.specification[referrerId]
		if ('components' in referrer) {
			// Find given entity in parent (referrer) list of parts
			for (var cptr in referrer['components'][id]) {

				// Each part will have a cardinality constraint:
				var condition = referrer['components'][id][cptr]

				// Condition's 'value' attribute indicates cardinality exact|lower|upper range.

				var limit = 'value' in condition ? parseInt(condition['value']) : 1
				switch (condition['cardinality']) {
					case 'owl:someValuesFrom': // >= 1 of ...
						entity['minCardinality'] = 1
						break 
					case 'owl:qualifiedCardinality': // exactly N ...
						entity['minCardinality'] = limit
						entity['maxCardinality'] = limit
						break 
					case 'owl:minQualifiedCardinality': // max N ...
						entity['minCardinality'] = limit
						break
					case 'owl:maxQualifiedCardinality': // min N ...
						entity['maxCardinality'] = limit
						break 
					default:
				}
			}
		}
	}


	getChoices = function(helper, selectId) {
		/*
		We can set some picklists to have a dynamic lookup feature, indicated by
		a "More choices" button next to the picklist.  When this button is 
		clicked, a dynamic fetch of subordinate items to the one the user has 
		selected is performed.  A user can then select one of the given items, if
		any.  

		The picklist's selection list tree can be dynamically extended/fetched?
		INPUT 
			entityId

		ISSUE: CURRENTLY ONLY DOING LOOKUP ON FIRST TERM OF MULTI-SELECT
		*/
		var select = $(helper).parent('div[class="input-group"]').find("select")
		var value = select.val()
		message = ''

		if (value.length == 0) {
			title = 'Selections for "' + top.specification[selectId]['uiLabel'] + '"'

			message = 'Select a "' + top.specification[selectId]['uiLabel'] + '" item, then use "more choices..." to see if there are more fine-grained choices for it.'
		}

		if (value.length > 0) {
			// select.val() is either a string, for a single-select, or an array
			// for multi-select
			var entity_id = Array.isArray(value) ? value[0] : value
			var term = entity_id.split(":")[1]
			var entity =  top.specification[entity_id]

			title = 'Selections for "' + top.specification[entity_id]['uiLabel'] + '"'
			$("#modalEntityHeader").html(title)

			var ontology = term.split("_")[0]

			// https://www.ebi.ac.uk/ols/api/ontologies/doid/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252FDOID_0050589/children
			// http://www.ebi.ac.uk/ols/api/ontologies/doid/terms?iri=http://purl.obolibrary.org/obo/DOID_77

			fetchURL = ['https://www.ebi.ac.uk/ols/api/ontologies/'
				, ontology.toLowerCase()
				, '/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252F'
				, term
				, '/children'].join('')

			$.ajax({
				type: 'GET',
				url: fetchURL,
				timeout: 10000, //10 sec timeout
				success: function( data ) {
					var msg = ''
					if ('_embedded' in data) {
						var content = data._embedded.terms
						labels = []
						for (ptr in content) {
							item = content[ptr]
							labels.push([
								item.label, 
								item.iri, 
								'<input type="checkbox" value="'+ term +'"/> <a href="' + item.iri + '" target="_words">' + item.label + '<\a><br/>'
							])
						}
						labels.sort(function(a,b) { return a[0].localeCompare(b[0]) })

						for (var ptr in labels) {
							msg += labels[ptr][2];
						}

						message = '<div style="margin:0 40px 20px 40px"><div style="border-bottom:2px solid silver"><input type="checkbox"> Select all</div>\n' + msg + '\n<button class="button" id="ChoiceExtensions">Select</button></div><div class="text-center">Lookup service: <a href="https://www.ebi.ac.uk/ols/">https://www.ebi.ac.uk/ols/</a></div>'

					}
					else 
						message = 'Your choice [' + term + '] has no underlying selections.'

	        		$("#modalEntityContentContainer").html(message) //Note: wrapper accepts HTML!
	        		$("#modalEntity").foundation('open')

				},
				error: function(XMLHttpRequest, textStatus, errorThrown) {
					message = 'Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.'
	    		    $("#modalEntityContentContainer").html(message) //Note: wrapper accepts HTML!
	     			$("#modalEntity").foundation('open')

				}
			})

			return false
		}

		$("#modalEntityHeader").html(title)
        $("#modalEntityContentContainer").html(message) //Note: wrapper accepts HTML!
        $("#modalEntity").foundation('open')
		
	}


}

// Implementing a static method for default zurb Foundation settings:
OntologyForm.initFoundation = function() {

	Foundation.Abide.defaults.live_validate = true // validate the form as you go
	Foundation.Abide.defaults.validate_on_blur = true // validate whenever you focus/blur on an input field
	focus_on_invalid : true, // automatically bring the focus to an invalid input field
	Foundation.Abide.defaults.error_labels = true, // labels with a for="inputId" will recieve an `error` class
	// the amount of time Abide will take before it validates the form (in ms). 
	// smaller time will result in faster validation
	Foundation.Abide.defaults.timeout = 1000
	Foundation.Abide.defaults.patterns = {
		alpha: /^[a-zA-Z]+$/,
		alpha_numeric : /^[a-zA-Z0-9]+$/,
		integer: /^[-+]?\d+$/,
		number:  /^[-+]?[1-9]\d*$/,
		decimal: /^[-+]?(\d+\.?\d*|\.\d+)$/,
		float:   /^[-+]?(\d+\.?\d*|\.\d+)$/,

		// http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#valid-e-mail-address
		email : /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

		url: /(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?/,
		// abc.de
		domain: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/,

		datetime: /([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))/,
		// YYYY-MM-DD
		date: /(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))/,
		// HH:MM:SS
		time : /(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}/,
		dateISO: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
	      // MM/DD/YYYY
	    month_day_year : /(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d/,
	}
}

