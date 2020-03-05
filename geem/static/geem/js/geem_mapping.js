/**
 * @file Functions used by mapping tab.
 */


/**
 * TODO: document function
 */
function render_mapping_ontology_view() {
	$('#mapping_info_box').hide();
	$('#mapping_save_select').show();
	if (get_owner_status(top.resource)) {
		$('#mapping_save').css('visibility', 'visible')
	} else {
		$('#mapping_save').css('visibility', 'hidden')
	}

	update_spec_field_labels(top.ontology_grid_options);
	render_mapping_options(top.resource.id)
}


/**
 * TODO: document function
 */
function derender_mapping_ontology_view() {
	$('#mapping_save_select').hide();
	$('#mapping_info_box').show();

	$('#unmapped_spec_field_labels').empty()
}


/**
 * TODO: document function
 * @param user_grid_options
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
 * TODO: document function
 * @param ontology_grid_options
 */
function update_spec_field_labels(ontology_grid_options) {
	$('.spec_field_label').remove();

	const onto_col_defs = ontology_grid_options.columnApi.getAllColumns().map(x => x.colDef);

	onto_col_defs.forEach(function (col_def) {
		const headerName = col_def.headerName;
		const field = col_def.field;
		$('#unmapped_spec_field_labels').append(`
			<div class="row spec_field_label" data-field="${field}">
                  		<div class="label">${headerName}</div>
                	</div>
		`)
	});

	// Make spec field labels draggable and roppable
	$('#unmapped_spec_field_labels').sortable({
		revert: true,
		connectWith: '.spec_field_container'
	});
	$('.spec_field_container').sortable({
		revert: true,
		connectWith: '.spec_field_container, #unmapped_spec_field_labels'
	});
}


/**
 * TODO: document function
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
 * TODO: document function
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
 * Render a list of mapping options when a resource is selected.
 * @param {string} resource_id - Id of resource to list mappings for.
 */
function render_mapping_options(resource_id) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/',
		success: function(mappings) {
			let placeholder = $('<option disabled selected></option>');
			placeholder = placeholder.text('Select a mapping');
			$('#mapping_select').append(placeholder)

			for (const mapping in mappings) {
				if (mappings.hasOwnProperty(mapping)) {
					let opt = $('<option></option>').text(mapping);
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
