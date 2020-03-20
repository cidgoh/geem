/**
 * @file Functions used by mapping tab.
 *
 * @typedef {Object} mapping
 * 	Connects user and validation grid headers.
 * @property {Array.<string>} user_field_order
 * 	Order of user headers.
 * @property {Object.<string, Array.<string>>} mapped_user_spec_fields
 * 	One-to-many mapping of user to validation grid headers.
 */


/**
 * Render divs used for loading and saving mappings.
 */
function render_mapping_ontology_view() {
	$('#mapping_info_box').hide();
	$('#mapping_save_select').show();
	if (get_owner_status(top.resource)) {
		$('#mapping_save').css('visibility', 'visible')
	} else {
		$('#mapping_save').css('visibility', 'hidden')
	}

	render_mapping_options(top.resource.id)
}


/**
 * Derender divs used for loading and saving mappings.
 */
function derender_mapping_ontology_view() {
	$('#mapping_save_select').hide();
	$('#mapping_info_box').show();

	$('#unmapped_spec_field_labels').empty()
}


/**
 * Render draggable user field labels.
 * @param {Object} user_grid_options
 * 	User validation grid options
 */
function update_user_field_labels(user_grid_options) {
	$('#mapped_user_spec_field_containers').empty();

	const user_col_defs = user_grid_options.columnApi.getAllColumns().map(x => x.colDef);

	user_col_defs.forEach(function (col_def) {
		const headerName = col_def.headerName;
		const field = col_def.field;
		$('#mapped_user_spec_field_containers').append(`
			<div class="row mapped_user_spec_field_container">
				<div class="small-6 columns user_field_container">
					<div class="user_field_label label" data-field="${field}">
						${headerName}
					</div>
				</div>
				<div class="small-6 columns spec_field_container"></div>
			</div>
		`)
	});

	// Make user field labels draggable and droppable
	$('.user_field_container').sortable({
		connectWith: '.user_field_container',
		placeholder: 'hidden_placeholder',
		over: function (_, ui) {
			$(this).css('background-color', 'lightyellow');

			const drag_container = ui.item.parent();
			const drop_container = $(this);
			if (drag_container[0] !== drop_container[0]) {
				// Send the label in the droppable to
				// where the draggable was.
				const drop_label =
					drop_container.children().not('.ui-sortable-placeholder');
				drop_label.appendTo(drag_container)
			}
		},
		out: function (_, ui) {
			$(this).css('background-color', '');

			const drag_container = ui.item.parent();
			const drop_container = $(this);
			if (drag_container[0] !== drop_container[0]) {
				// Send the original label in the
				// droppable back.
				const drop_label =
					drag_container.children().not('.ui-sortable-helper');
				drop_label.appendTo(drop_container)
			}
		},
		receive: function (_, ui) {
			if ($(this).children().length > 1) {
				$(ui.sender).sortable('cancel')
			}
		}
	})
}


/**
 * Render draggable spec field labels.
 * @param {Object} ontology_grid_options
 * 	Ontology validation grid options
 */
function update_spec_field_labels(ontology_grid_options) {
	$('.spec_field_label').remove();

	const onto_col_defs = ontology_grid_options.columnApi.getAllColumns().map(x => x.colDef);

	onto_col_defs.forEach(function (col_def) {
		const headerName = col_def.headerName;
		const field = col_def.field;
		$('#unmapped_spec_field_labels').append(`
			<div class="row spec_field_label" data-field="${field}">
                  		<div class="secondary label">${headerName}</div>
                	</div>
		`)
	});

	// Make spec field labels draggable and droppable
	$('#unmapped_spec_field_labels').sortable({
		connectWith: '.spec_field_container',
		helper: 'clone',
		appendTo: '#panelMapping'
	});
	let in_sortable;
	$('.spec_field_container').sortable({
		connectWith: '.spec_field_container, #unmapped_spec_field_labels',
		over: function () {
			$(this).css('background-color', 'lightyellow');
			in_sortable = true
		},
		out: function () {
			$(this).css('background-color', '');
			in_sortable = false
		},
		beforeStop: function (_, ui) {
			if (!in_sortable) {
				ui.item.appendTo($('#unmapped_spec_field_labels'));
			}
		},
		stop: function () {
			_equalize_user_spec_field_containers($(this))
		}
	});
}


/**
 * Make the user and spec field containers in a row the same height.
 * @param {Array<HTMLDivElement>} spec_field_container
 * @private
 */
function _equalize_user_spec_field_containers(spec_field_container) {
	const user_field_container = spec_field_container.siblings('.user_field_container');
	if (spec_field_container.children().length) {
		user_field_container.height(spec_field_container.height());
	} else {
		user_field_container.height('auto')
	}
}


/**
 * Get mapping object representing arrangement of labels on screen.
 * @returns {mapping}
 */
function get_current_mapping() {
	const user_field_order = [];
	const mapped_user_spec_fields = {};

	$('.mapped_user_spec_field_container').each(function() {
		const user_field = $(this).find('.user_field_label').data('field');

		user_field_order.push(user_field);
		mapped_user_spec_fields[user_field] = [];

		$(this).find('.spec_field_label').each(function () {
			const spec_field = $(this).data('field');
			mapped_user_spec_fields[user_field].push(spec_field)
		});
	});

	return {
		'user_field_order': user_field_order,
		'mapped_user_spec_fields': mapped_user_spec_fields
	}
}

/**
 * Save mapping to server.
 * @param {string} mapping_name
 * 	Name of mapping
 * @param {mapping} mapping
 * 	Mapping object
 * @param {number} resource_id
 * 	Resource to save mapping to
 */
function save_mapping(mapping_name, mapping, resource_id) {
	const data = JSON.stringify({
		'mapping_name': mapping_name,
		'mapping': mapping,
	});

	$.ajax({
		type: 'POST',
		url: API_RESOURCES_URL + resource_id + '/add_mapping/',
		data: {'data': data},
		success: function(data) {
			$('#mapping_save_form').foundation('reveal', 'close');
			render_mapping_options(resource_id)
		},
		error: function (jqxhr, _, error_thrown) {
			alert(error_thrown + ': ' + jqxhr.responseText)
		}
	})
}


/**
 * Load mapping from server.
 * This re-arranges the labels in the mapping tab.
 * @param {string} mapping_name
 * 	Name of mapping to load
 * @param {number} resource_id
 * 	Resource containing mapping to load
 */
function load_mapping(mapping_name, resource_id) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/' + mapping_name + '/',
		success: function(mapping) {
			// Clear current mappings
			$('.spec_field_label').each(function () {
				$(this).detach().appendTo('#unmapped_spec_field_labels')
			});

			// Resize containers
			$('.spec_field_container').each(function () {
				_equalize_user_spec_field_containers($(this))
			});

			// Iterate over user fields in order
			for (let i=0; i<mapping.user_field_order.length; i++) {
				const user_field = mapping.user_field_order[i];

				// Move user field's container to
				// bottom.
				let query = `.user_field_label[data-field='${user_field}']`;
				const user_field_label = $(query);
				query = '.mapped_user_spec_field_container';
				const user_spec_field_container = user_field_label.parents(query);
				query = '#mapped_user_spec_field_containers';
				user_spec_field_container.detach().appendTo(query);

				// Map appropriate spec fields to user
				// field.
				const spec_fields = mapping.mapped_user_spec_fields[user_field];
				for (let j=0; j<spec_fields.length; j++) {
					const spec_field = spec_fields[j];
					query = `.spec_field_label[data-field='${spec_field}']`;
					const spec_field_label = $(query);
					query = '.spec_field_container';
					const spec_field_container =
						user_spec_field_container.children(query);

					spec_field_label.detach().appendTo(spec_field_container)
				}
			}
		},
		error: function (jqxhr, _, error_thrown) {
			console.error('Failed to load mapping: ' + jqxhr.responseText + ' ('
				+ error_thrown + ')')
		}
	})
}


/**
 * Render a list of mapping options when a resource is selected.
 * @param {string} resource_id
 * 	Id of resource to list mappings for.
 */
function render_mapping_options(resource_id) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/',
		success: function(mappings) {
			$('#mapping_select').empty();
			let placeholder = $('<option disabled selected></option>');
			placeholder = placeholder.text('Select a mapping');
			$('#mapping_select').append(placeholder);

			for (const mapping in mappings) {
				if (mappings.hasOwnProperty(mapping)) {
					let opt = $('<option></option>').text(mapping);
					opt = opt.val(mapping);
					$('#mapping_select').append(opt)
				}
			}
		},
		error: function (jqxhr, _, error_thrown) {
			console.error('Failed to load mappings: ' + jqxhr.responseText + ' ('
				+ error_thrown + ')')
		}
	})
}
