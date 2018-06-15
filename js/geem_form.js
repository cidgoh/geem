
/****************************** OntologyForm Class *********************
The OntologyForm class provides all functions needed (using jquery, Zurb 
Foundation and app.css) to render and populate an ontology-driven form.

WISHLIST:
	- Currently this includes zurb Foundation 6.0 specific tags. Revise to be generic
	  and have a Foundation additional rendering pass.
	- Allow xml datatype formats for date&time to be inherited from parent model
	- Enable 3rd party standard form definition to be presented (like label -> uiLabel)
	- Also option for 3rd party database field name for form storage
	- Select list values: enable to be other than ontology id.
		e.g. ui feature: values_from: ... [hasAlternateId]


Author: Damion Dooley
Project: genepio.org/geem
Updated: May 28, 2018
 
*/

// These fields are merged into select options synonyms="..." for searching.
synonymFields = ['hasSynonym', 'hasExactSynonym', 'hasNarrowSynonym', 'hasAlternativeTerm']

function OntologyForm(domId, resource, settings, callback) {
	/*
	 "resource" includes @context, metadata, and specifications
	*/
	var self = this
	self.settings = {}
	self.formDomId = $(domId)
	self.context = resource.context
	self.formCallback = callback

	// Some of these defaults can be overridden by particular fields via ui_feature specification
	if (settings) self.settings = settings
	if (! 'ontologyDetails' in self.settings) self.settings.ontologyDetails = false
	if (! 'minimalForm' in self.settings) self.settings.minimalForm = false


	/*********** FORM RENDERER *************************/
	this.renderEntity = function(entityId) {

		formDelete()

		// Deselect any other form menu item that might be open.
		$('li.active[role="menuitem"]').removeClass('active')

		if (entityId) {
			// Focuses on first entity id if path given
			if (entityId.indexOf('/') != -1)
				entityId = entityId.substr(0, entityId.indexOf('/'))
			self.entityId = entityId
		}


		// If entityId wasn't passed, then reverts to self.entityId
		// to enable re-rendering of existing object.
		if (self.entityId) {

			// Highlight any menu item that is this entity
			// FUTURE: Ideally open menu to this item if not already.
			$('li[role="menuitem"][data-ontology-id="' + self.entityId + '"]').addClass('active')

			var entity = getFormSpecificationComponent(self.entityId)
			var form_html = renderFormSpecification(entity)

			// "buttonFormSubmit" is id created for submit button, which other processes can trigger on. Could turn into event.
			if (form_html == '') {
				// Sometimes given element is not a field and has no parts.
				form_html += '<br/><p>This item has no field specification.</p>'
			}
			else {
				form_html += renderButton('View Form Submission', 'buttonFormSubmit') 
			}

			// Place new form html into page
			self.formDomId.html(form_html)

			// Set up UI widget for all date inputs; 
			// Using http://foundation-datepicker.peterbeno.com/example.html
			$('div[data-date-format]').fdatepicker({disableDblClickSelection: true}).find('input').off()

			var title = 'GEEM: ' + self.entityId
			var uiLabel = entity.uiLabel

			// Enable page annotation by 3rd party tools by kicking browser to 
			// understand that a #anchor and page title are different.
			title += ':' + uiLabel
	
			// A hack that provides more styled info about form in portal.html
			if ($('#formEntityLabel').length) {

				$('#formEntityLabel')
					.html(uiLabel + ' &nbsp; <span class="medium">(' + self.entityId + ')</span>')
				$('#mainForm > div.field-wrapper > label')
					.html(entity.definition || '<span class="small float-right">(select all)</span>')
			}
			else {
				$('#mainForm > div.field-wrapper > label')
					.attr('id','formEntityLabel')
					.after('<p>' + (entity.definition  || '') + '</p>') 
			}

			window.document.title = title

		 	// Load an existing data record
		 	//loadFormData()

			// Set required/optional status of fields and controls for adding more elements.
			setFormCardinality() 

		 	if (self.settings.minimalForm) setMinimalForm() // Hides empty optional field content.

		 	// All of form's regular <select> inputs (e.g. NOT the ones for picking units)
		 	// get some extra smarts for type-as-you-go filtering.
		 	initializeSelectInputs($('#mainForm select.regular')) 
		 	
		 	// Reinitialize form since it was deleted above.
		 	// FUTURE: UPGRADE FOUNDATION, use reInit()
			self.formDomId.foundation()

			//Setup of this class enables callback function to be supplied.  Could make an event instead.
			if (self.formCallback)
				self.formCallback(self)
		 }
		return false
	}


	formDelete = function() {
		if (self.formDomId) {
			self.formDomId.off().empty()
		}
	}

	setOptionalHidden = function() {
		/* Displays form with only required fields visible.
		
		*/
		self.formDomId.find('div:not(.tabs-panel) > div.field-wrapper.optional').hide()
	}

	setMinimalForm = function() {
		/* The minimal display of a form provides users with a display of 
		required fields ready for data input, and optional fields are shown
		only as labels with the css input-group part hidden. When a user mouses
		over such a label, the input-group part is shown and is ready for data 
		input.  Fields that have values in them are shown in editable state.

		OUTPUT
			All optional fields are shown minimized.
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

	initializeSelectInputs = function(select_inputs) {
		select_inputs.each( function() {

			// Applies jQuery chosen() 
	 		var fieldWrapper = $(this).parents("div.field-wrapper").first()
	 		var min = fieldWrapper.attr("minCardinality")
			var max = fieldWrapper.attr("maxCardinality")
			var required = fieldWrapper.is('.required')
			if (required) $(this).prop('required',true); //Should do this in setFormCardinality() instead?
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
	 	
	 	})
 	}


	setFormCardinality = function() {
		/* This renders each form element's HTML required attribute via 
		javascript.	It also adds attributes for minCardinality and 
		maxCardinality.  

		FUTURE: These are used dynamically by the form processor to
		show user controls for adding or removing input elements.

		OUTPUT:
			div.field-wrapper class annotated with .required or .optional
			div.field-wrapper gets extra label for optional/required info
		*/
		var cardinalityLabel = ''

		self.formDomId.find('div.field-wrapper').each(function(index) {
			var min = $(this).attr("minCardinality")
			var max = $(this).attr("maxCardinality")
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

				// Show optional and required information.
				if (self.settings.ontologyDetails && cardinalityLabel.length > 0 ) 
					$(this).children('label') //children(".fi-shopping-cart")
						.before('<span class="info label float-right">' + cardinalityLabel + '</span>')
			}
				
		})

	}


	/*********************** FORM PART RENDERING **********************/

	renderFormSpecification = function(entity, html = '') { //, inherited = false
		/*
		See https://www.w3.org/TR/2005/WD-swbp-xsch-datatypes-20050427/
		about XML/RDF/OWL numeric representation.

		PRIMITIVE data types 
		Inputs as sepecified in an OWL Ontology file can have all the 
		standard xmls data types and restrictions.
		Potentially create ZURB Foundation fields: text, date, datetime, 
		datetime-local, email, month, number, password, search, tel, 
		time, url, and week
		*/

		var	labelHTML = ''
		if (entity.datatype != 'disjunction')
			labelHTML = renderLabel(entity)

		switch (entity.datatype) {
			case undefined: // Anonymous node
				html += renderSection(entity, labelHTML, '<span class="small"><i>This specification component needs a "value specification" so that it can be rendered.</i></span>')
				break;

			case 'disjunction':
				html += renderDisjunction(entity, labelHTML)
				break;

			case 'model':
				html += renderSpecification(entity)
				// If specification has stuff, then wrap it:
				if (html.length > 0 && entity.uiLabel != '[no label]')
					return getModelWrapper(entity, labelHTML + html)
				break;

			/*
			DATE DATATYPES: 
			date dateTime 
			duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
			*/
			case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
			case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
			case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
			case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.
			case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)
				html += renderDateTime(entity, labelHTML)
				break;

			// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
			case 'xmls:string':
			case 'xmls:normalizedString':
			case 'xmls:token':
				html += renderInput(entity, labelHTML)
				break;
	 
			case 'xmls:integer':			html += renderNumber(entity, labelHTML, 'integer');	break
			case 'xmls:positiveInteger': 	html += renderNumber(entity, labelHTML, 'integer', 1);	break
			case 'xmls:nonNegativeInteger':	html += renderNumber(entity, labelHTML, 'integer', 0);	break
			case 'xmls:unsignedByte':		html += renderNumber(entity, labelHTML, 'integer', 0, 255); break// (8-bit)	
			case 'xmls:unsignedShort':		html += renderNumber(entity, labelHTML, 'integer', 0, 65535); break// (16-bit) 
			case 'xmls:unsignedInt':		html += renderNumber(entity, labelHTML, 'integer', 0, 4294967295);	break// (32-bit)		
			case 'xmls:unsignedLong':		html += renderNumber(entity, labelHTML, 'integer', 0, 18446744073709551615); break// (64-bit) 

			case 'xmls:negativeInteger':	html += renderNumber(entity, labelHTML, 'integer', null, -1); break
			case 'xmls:nonPositiveInteger':	html += renderNumber(entity, labelHTML, 'integer', null, 0); break

			case 'xmls:byte': 	html += renderNumber(entity, labelHTML, 'integer', -128, 127);	break// (signed 8-bit)
			case 'xmls:short': 	html += renderNumber(entity, labelHTML, 'integer', -32768, 32767);	break// (signed 16-bit)
			case 'xmls:int': 	html += renderNumber(entity, labelHTML, 'integer', -2147483648, 2147483647);	break// (signed 32-bit)
			case 'xmls:long': 	html += renderNumber(entity, labelHTML, 'integer', -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

			// Re. OWL/RDF storage: Note: All "minimally conforming" processors
			// "must" support decimal numbers with a minimum of 18 decimal
			// digits (i.e., with a "totalDigits" of 18).
			case 'xmls:decimal':
				html += renderNumber(entity, labelHTML, 'decimal'); break;

			// Size of float/double depends on precision sought, see
			// https://stackoverflow.com/questions/872544/what-range-of-numbers-can-be-represented-in-a-16-32-and-64-bit-ieee-754-syste
			case 'xmls:float':  
				html += renderNumber(entity, labelHTML, 'float', - Math.pow(2, 23), Math.pow(2, 23) - 1 ); break;

			case 'xmls:double': 
				html += renderNumber(entity, labelHTML, 'double', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER); break;

			// Yes/No inputs
			case 'xmls:boolean': 
				html += renderBoolean(entity, labelHTML); break;

			// Categorical Picklists
			case 'xmls:anyURI': 
			case 'xmls:QName':
				html += renderChoices(entity, labelHTML); break;

			default:
				html += renderSection(entity, labelHTML, 'UNRECOGNIZED: '+ entity.id + ' [' + entity.datatype  + ']'); break;
		}
		return html

	}



	renderSpecification = function(entity) {
		/*
	
		INPUTS
			
		*/
		html = ''

		// Render each component
		for (var entityId in entity.components) { 
			html += this.renderFormSpecification(entity.components[entityId]) //, html
		}

		if ('choices' in entity) {
			for (var entityId in entity.choices) { 
				html += this.renderFormSpecification(entity.choices[entityId])
			}
		}
		return html	
	}

	renderSection = function(entity, labelHTML, text) {
		html = [
		labelHTML
		,	'	<div class="input-group">\n'
		,			text
		,	'	</div>\n'
		].join('')
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
		entity.datatype = xmls:date | xmls:time | xmls:dateTime | xmls:dateTimeStamp | xmls:duration
		entity.feature = optional "format_date=...", "format_time=..." etc.
		*/
		// Use ISO 8601 Defaults
		// But duration selection depends on given units.
		switch (entity.datatype) {
			// xmls:date may have time zone "Z" for UTC or +/-HH:MM ?
			case 'xmls:date': format='yyyy-mm-dd'; break; 
			case 'xmls:time': format='hh:ii:ss'; break;
			case 'xmls:dateTime': format='yyyy-mm-ddThh:ii:ss'; break;
			// xmls:dateTimeStamp REQUIRED time zone "Z" for UTC or +/-HH:MM ?
			case 'xmls:dateTimeStamp': format='yyyy-mm-ddThh:ii:ss'; break; 

			// FUTURE:Should be driven by units.
			case 'xmls:duration': format=''; break; 
		}
		// feature allows override
		if (entity.features.format)
			format = entity.features.format.value

		html = [label
			,'	<div class="input-group date" '
			,'		id="' + entity.domId + '"'
			,'		data-date-format="' + format + '"'
			,'		>'
			,'		<div class="input-group-label prefix"><i class="fi fi-calendar"></i></div>\n'
			,'		<div><input class="input-group-field prefix ' + entity.id + '"'
			,		' id="'+entity.domId+'"'
			,		' type="text"'
			,		getHTMLInputlaceholder(entity)
			//,		getStringConstraints(entity)
			,		entity.disabled
			,		'/>\n'
	    	,		renderUnits(entity)
			,'	</div></div>\n'
		].join('')

		return getFieldWrapper(entity, html)
	}

	renderInput = function(entity, label) {
		/*
		Add case for paragraph / textarea?
		 <textarea placeholder="None"></textarea>
		*/

		html = [label
		,	'	<div class="input-group">\n'
		,	'		<input class="input-group-field '+entity.id+'"'
		,			' id="'+entity.domId+'"'
		, 			' type="text" '
		,			 getStringConstraints(entity)
		,			 entity.disabled
		,			 getHTMLInputPlaceholder(entity)
		,			 '/>\n'
    	, 			renderUnits(entity)
		,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	} 

	renderButton = function(text, buttonID) {
		return [
			'<div>\n'
		,	'	<input id="' + buttonID + '" class="button float-center" value="' + text + '">\n'
		,	'</div>\n'
		].join('')
	}

	renderDisjunction = function(entity, labelHTML) {
		/* This entity was made up of 'has component some (X or Y or Z ...) 
		At least one of the disjunction parts needs to be filled in.  More are
		allowed at moment. A tabbed interface is used for each component to 
		emphasize that only one option needs to be filled in.

		Note: LabelHTML skipped because it is not easily available for OWL 
		disjunction expressions.

		*/ 
		var domId = entity.domId
		var htmlTabs = ''
		var htmlTabContent = ''

		// Could externalize this
		var activeDone = false // Flag to activate first tab
		for (var entityId in entity.components) { 
			var childDomId = (domId + '_' + entityId).replace(/[^a-zA-Z0-9]/g,'_') //
			var child = entity.components[entityId]
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
			//htmlTabContent += 	this.render(entityId, entity.path, entity.depth+1) //, false, true 
			// Issue: tab label repeated in child field wrapper.
			htmlTabContent += this.renderFormSpecification(entity.components[entityId]) 
			htmlTabContent += '</div>\n'		
		}

		return [
			,	'<div class="field-wrapper input-tabs">'
			,		'<ul class="tabs" data-tabs id="' + domId + '">'
			,			htmlTabs
			,		'</ul>\n' 
			,		'<div class="input-group tabs-content" data-tabs-content="' + domId + '">'
			,			htmlTabContent
			,		'</div>\n'
			,	'</div>\n'
			,	'<br/>\n'
		].join('')

	}


	/* NUMERIC DATATYPES HANDLED HERE */
	renderNumber = function(entity, labelHTML, type, minInclusive=undefined, maxInclusive=undefined) {
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
			if ('minValue' in entity) {
				var step = entity.minValue % 1
				if (step == 0) 
					var stepAttr = ''
				else
					var stepAttr = ' step="' + step + '"'
			}
			else // kludgy default
				var stepAttr = ' step="0.0001"'

			var typeAttr = ' type="number"'
		}

		html = [labelHTML,
			,'<div class="input-group">\n'
	 		,'	<input class="input-group-field ' + entity.id + '"'
	 		,		' id="' + entity.domId + '"'
	 		,		typeAttr
			,		stepAttr
			,		entity.disabled
			,		getNumericConstraintHTML(entity, minInclusive, maxInclusive)
			,		' placeholder="' + type + '"'
			,		' pattern="' + type + '"'
			,		' data-validator="min_max"'
			,	' />\n'
    		,	renderUnits(entity)
			//,	renderHelp(entity)
			,'</div>\n'
		].join('')

		return getFieldWrapper(entity, html)
	}


	renderBoolean = function(entity, labelHTML) {

		html = [
			'	<div class="switch small" style="float:left;margin-right:10px;margin-bottom:0">\n'
			,'		<input id="'+entity.domId+'" class="switch-input" type="checkbox" name="' + entity.id+ '"'
			,		entity.disabled
			,		' />\n'
			,	'	<label class = "switch-paddle" for="'+entity.domId+'"></label>\n'
			,	'	</div>\n'
			,	labelHTML
			].join('')

		return getFieldWrapper(entity, html)
	}

	renderChoices = function(entity, label) {
		/* FUTURE: OPTION FOR RENDERING AS SELECT OPTIONS, RADIOBUTTONS OR CHECKBOXES ...
			ISSUE: An entity may be marked as a choice but take on the values of another categorical 
			list via its "components" part. What depth cutoff feature should be allowed?

			"components": {
                "DOID:4": [
                    {
                        "cardinality": "owl:someValuesFrom"
                    }
                ]
            },

		*/
		picklistId = entity.id
		var multiple = entity.minCardinality > 1 || (entity.maxCardinality != 1) ? ' multiple' : ''

		var cutDepth = entity.features.depth ? entity.features.depth : undefined //getFeature(entity, 'depth') // a numeric depth or null.
		if (cutDepth !== undefined) {
			cutDepth = cutDepth.value
		}
		else
			cutDepth == 20 // Its greater than max depth test below.

		var html = label
		html +=	'	<div class="input-group">\n'
		html +=	'		<select class="input-group-field '+ entity.id + ' regular" id="'+entity.domId+'"' + entity.disabled + multiple + '>\n'
		if (multiple.length == 0)
			html +=	'<option value=""></option>'  //Enables no option to be selected.

		// Because one should deliberately make a selection ... esp. when 
		// confronted with required selection list where 1st item is 
		html +=	'	<option value="" disabled>Select ...</option>'
		//console.log(entity)
		html +=			renderChoice(entity, 'choices', 0, cutDepth, 'select')
		
		// Check components list as well, as long as each item is an xmls:anyURI
		// Note: this is not recursive, i.e. no has_component some has_component ...
		// ISSUE: component can get 'feature' item 

		// ISSUE: if a categorical choice item is marked as having a datatype other than anyURI,
		// (e.g. "other material" might have a string value) Then wierd display of IAO_0000119 occurs?
		/*
		ARCHAIC???????????
		if ('components' in entity)
			for (var ontoID in entity.components) {
				html +=	renderChoice(entity.components[ontoID], 'choices', 0, cutDepth, 'select')
			}
		*/
		html +=	'	</select>\n'

		if ('features' in entity && 'lookup' in entity.features) 
			html += '		<a class="input-group-label" onclick="lookupOntologyChoices(this,\''+entity.id+'\')">lookup choices</a>\n'
	
		html +=	'	</div>\n'


		return getFieldWrapper(entity, html)
	}


	renderChoice = function(entity, table='choices', depth, cutDepth, inputType='select') { 
		/* 
		
		ISSUE: currently the ontologyID for each item does not include path
			   Include path, or parent?
		
		Right now we have hacked jquery.chosen.min.js to enable search of
		synonyms to match related options. Achieved by <option ... synonyms="">
		attribute.	

		INPUT
			inputType = select|radio|checkbox
			cutDepth = depth to stop pursuing kids silently

		*/

		var html = ''

		if (table in entity) {

			// FUTURE: Adapt this so that only shown if it has been clipped.
			// ALSO: A given term has subordinate items in its NATIVE ontology.
			// Would be great to have a count of those.
			if (depth == cutDepth)
				return ' (' + Object.keys(entity[table]).length + ')'

			for (var memberId in entity[table]) {
				var part = entity[table][memberId]
				var kid_html = ''

				part.disabled = '';

				var label = getLabel(part)
				if (!label) {
					label = ''
					console.log['Error: picklist item has no label: ' + memberId]
				}
				
				// See if this option has any child options
				kid_html += renderChoice(part, table, depth+1, cutDepth, inputType)
				if (kid_html && depth == cutDepth - 1)
					label += kid_html


				switch (inputType) {

					case "checkbox": // future
						break;
					case "radio": // future
						break;
					case "select":

					default:

						html += '<option value="' + part.id + '" class="depth' + depth + '" ' + part.disabled + getSynonyms(part) + '>' + ' '.repeat(depth) + label + '</option>\n'  
				}

				html += kid_html

			}

		}
		
		return html
	}

	getSynonyms = function(part) {

		var synonymArray = []

		for (var fieldptr in top.synonymFields) {

			var field = top.synonymFields[fieldptr]
			if (field in part) {
				synonymArray = synonymArray.concat(part[field])
			}
		}

		if (synonymArray.length>0) {
			// FUTURE: sort, then remove items if superstrings are already in array
			return ' synonyms="' + synonymArray.join(',').toLowerCase() + '"'
		}

		return ''
	}


	renderUnits = function(entity) {
		/* User is presented with choice of data-entry units if available.
		Default unit/scale (cm, mm, m, km etc.) is achieved by the 
		"preferred_unit" user interface feature which ensures that the given
		unit is placed first in list of options.

		NOTE: server has to unparse unit associated with particular input via
		name/unit syntax. One possibility is implemented below.

		INPUT
			entity: 
		OUTPUT
		For a given input the id of the "units" selection list component is 
		returned with a DOM id of "[entity domId path]-IAO:0000039" (unit)
		*/
		if (entity.units) {

			// If only one unit to choose from then we're done.
			if (entity.units.length == 1) 
				return '<span class="input-group-label small">'+ renderLabel(entity.units[0]) + '</span>\n'

			var preferred = entity.features.preferred_unit 
			var optionsHTML = ''

			for (var ptr in entity.units) {

				var unit = entity.units[ptr]
				var unitLabel = 'uiLabel' in unit ? unit.uiLabel : unit.label
				var optionHTML = '		<option value="'+ unit.id + '">' + unitLabel + ' &nbsp;</option>'
				if (!preferred || preferred.value != unit.id) // place prefered unit first.
					optionsHTML += optionHTML
				else
					optionsHTML = optionHTML + optionsHTML
			}

			return [
			'<div class="input-group-button" style="font-weight:700;">'
			,	'<select class="units" id="' + entity.domId + '-IAO:0000039">'
			,	optionsHTML	
			,	'</select>'
			,'</div>\n'].join('')
	   	}
	   	return ''
	}

	renderLabel = function(entity) {
		/* 
		
		Note definition is normalized to put into tooltip string.

		Issue is that this sometimes is called on entities that haven't
		been initialized yet, meaning they don't have a label relative
		to some parent node. At moment the only two cases are tab display
		of child of	disjunction, and unit display, so not doing more 
		currently on that issue.
		*/
		if (!entity) 
			return 'ERROR: Entity not defined'

		var label = entity.uiLabel
		var definition = entity.uiDefinition
		// Beginning, ending, and stand-alone quotes have to be replaced.
		if (definition)
			definition = definition.replace(/["""]/g, '\'\'').replace(/[^0-9a-z\\. -;,']/gi, '')

		if (self.settings.ontologyDetails && entity.depth > 0)
			var labelURL = '<a href="#' + entity.id + '">' + label + '</a>' 
		else
			var labelURL = label

		// Enable mouseover display of above.
		html = '<label data-ontology-id="'+ entity.id +'">'
		if (self.settings.ontologyDetails)
			html += '<i class="fi-magnifying-glass"]></i> ' + labelURL
		else 
			if (definition) {
				html += '<span data-tooltip class="has-tip top left" data-disable-hover="false" data-click-open="true" data-width="250" title="' + definition + '">' + labelURL + '</span>'
			}
			else
				html += labelURL

		html += renderHelp(entity)
		html +=  '</label>\n'

		return html
	}

	renderHelp = function(entity) {
		// Only entities that have been initialized have 'help' attribute.
		if (entity.help)
			return '<span data-tooltip class="has-tip float-right" data-disable-hover="false" data-click-open="true" data-width="250" title="' + entity.help + '"> <i class="fi-info blue"></i></span>'
		return ''
	 }

	/************************** UTILITIES ************************/

	getLabel = function(entity) {
		// Label listed an entity's features label overrides uiLabel
		if (entity.features && entity.features.label)
			//return entity.features.label.value
			return entity.features.label.value

		if (entity.uiLabel)
			return entity.uiLabel

		return entity.label
	}

	getDefinition = function(entity) {
		/* If an entity has a features.definition - coming from 3rd party 
		specification, then use that. Otherwise if it has a general ontology
		driven uiDefinition, use that. Otherwise use entity's IAO_0000115 definition annotation.

		NOTE: End of next sentence in definition after 140 characters is sought. 
		returned definition is clipped to that point.
		*/
		var definition = ''

		// Definition listed in link between parent and this entity overrides all.
		if (entity.features && entity.features.definition)
			definition = entity.features.definition.value

		else if (entity.uiDefinition) // Rare, but an ontology can offer this directly.
			definition = entity.uiDefinition 
		else if (entity.definition) 
			definition = entity.definition

		// Snip after first sentence found after 140 characters. A "tweet-sized" sentence.
		if (definition.length) {
			var deflen = definition.substr(140).indexOf('. ')
			if (deflen >= 1) 
				definition = definition.substr(0,140 + deflen) + '.'
		}
		return definition
	}

	getHTMLInputPlaceholder = function(entity,type) {
		// Given entity's xml datatype, return the word part for use in the form field placeholder
		return (' placeholder="'+ entity.datatype.substr(entity.datatype.indexOf(':') + 1 )+ '"' ) 
	}

	getFieldWrapper = function(entity, html) {
		/* Surrounds given field element with general DOM id, css and cardinality controls
			If the given entity has model or choice components, this adds a
			'chindren' CSS class.
		*/ 
		return ['<div class="field-wrapper field'
			,		('models' in entity || 'choices' in entity) ? ' children' : '' // models check needed?
			,		'" '
			,		getIdHTMLAttribute(entity.domId)
			,		getHTMLAttribute(entity, 'minCardinality')
			,		getHTMLAttribute(entity, 'maxCardinality')
			,		'>\n'
			,		html
			,	'</div>\n'
		].join('')
	}

	getModelWrapper = function(entity, html) {

		return [
			'<a name="' + entity.domId + '"/>'
			,	'<div class="field-wrapper model children depth' + entity.depth + '" '
			,	getIdHTMLAttribute(entity.domId)
			,	getHTMLAttribute(entity, 'minCardinality')
			,	getHTMLAttribute(entity, 'maxCardinality')
			,	'>\n'
			,	html
			,	'</div>\n'
		].join('')
	}

	getIdHTMLAttribute = function(domId) {
		return 'data-ontology-id="' + domId + '" '
	}

	getHTMLAttribute = function(entity, attribute) {
		return (attribute in entity) ? attribute +'="' + entity[attribute] + '" ' : ''
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
		if (maxInclusive === undefined || entity.maxValue && maxInclusive > entity.maxValue) 
			maxInclusive = entity.maxValue

		if (minInclusive === undefined || entity.minValue && minInclusive < entity.minValue) 
			minInclusive = entity.minValue

		var min = (minInclusive === undefined) ? '' : ' min='+minInclusive+' ' 
		var max = (maxInclusive === undefined) ? '' : ' max='+maxInclusive+' ' 

		return min + max + getPatternConstraint(entity)
	}


	getStringConstraints = function(entity) {
		// Encodes html input length limits on string.
		var min = entity.minLength ? ' minLength="'+entity.minLength+'" ' : ''
		var max = entity.maxLength ? ' maxLength="'+entity.maxLength+'" ' : ''
		//size 	= 'xmls:length' in constraints ? ' size="'+constraints['xmls:length']+'" ' : ''
		return min + max + getPatternConstraint(entity)
	}

	getPatternConstraint = function(entity) {
		/* Render specific regular expression "pattern" that is used to
		validate data entry. Zurb Foundation accepts some preset 
		expression names - see initFoundation()
		*/
		var pattern = ''
		if (entity.pattern) {
			var value = entity.pattern
			// Zurb Foundation accepts some preset expression names.
			if (value in Foundation.Abide.defaults.patterns)
				pattern = value
			else
				pattern = "^" + value + '$' // RegEx match input string start to finish.

			pattern = 'pattern="' + pattern + '" '
		}
		return pattern
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
		alpha_numeric: /^[a-zA-Z0-9]+$/,
		title: /^[a-zA-Z0-9 ]+$/,
		integer: /^[-+]?(0|[1-9]\d*)$/,
		number:  /^[-+]?(0|[1-9]\d*)(\.\d+)?$/,
		decimal: /^[-+]?(0|[1-9]\d*)(\.\d+)?$/,
		float:   /^[-+]?(0|[1-9]\d*)(\.\d+)?$/,
		//latitudeD:
		//longitudeD:
		 
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
	Foundation.Abide.defaults.validators['min_max'] = function($el,required,parent) {
		var test = true
		if ($el.attr('min'))
			test = test && (parseFloat($el.val()) >= parseFloat($el.attr('min')) )
		if ($el.attr('max'))
			test = test && (parseFloat($el.val()) <= parseFloat($el.attr('max')) )

		return test

	}
}


