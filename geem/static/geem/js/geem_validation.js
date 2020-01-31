/**
 * @file Functions used by validator tab.
 */


/**
 * Display ontology grid and mapping information.
 * Must be called after a resource is selected, in
 * ``portal_entity_form_callback``.
 * @param {Array<Object>} components: Ontology grid headers, with each
 * 	object containing a ``label`` and ``id`` attribute
 */
function render_validation_ontology_view(components) {
	update_ontology_grid(components, top.ontology_grid_options);
	$('#validation_info_box').hide();
	$('#ontology_validation_grid_box').show();

	render_mapping_options(top.resource.id);
	$('#mapping_box').show();
	if (get_owner_status(top.resource)) {
		$('#mapping_create').css('visibility', 'visible')
	} else {
		$('#mapping_create').css('visibility', 'hidden')
	}
}


/**
 * Clear, hide ontology grid and mapping information.
 */
function derender_validation_ontology_view() {
	$('#ontology_validation_grid_box').hide();
	$('#mapping_box').hide();
	$('#no_mappings_warning').hide();
	$('#non_matching_mapping_warning').hide();
	$('#mapping_select').empty();
	$('#validation_info_box').show();
	top.ontology_grid_options.api.setRowData([]);
	top.ontology_grid_options.api.setColumnDefs();
}


/**
 * Create grid options object for creating grid instances.
 * @returns {Object} Grid options object
 */
function create_grid_options() {
	return {
		columnDefs: [],
		rowData: [],
		defaultColDef: {editable: true},
		suppressDragLeaveHidesColumns: true
	};
}


/**
 * Create the user validation grid.
 * @param {Object} grid_options - User validation grid options
 */
function create_user_grid(grid_options) {
	const grid_div = document.querySelector('#user_validation_grid');
	new agGrid.Grid(grid_div, grid_options);
}


/**
 * Create the ontology validation grid.
 * @param {Object} grid_options - Ontology validation grid options
 */
function create_ontology_grid(grid_options) {
	const grid_div = document.querySelector('#ontology_validation_grid');
	new agGrid.Grid(grid_div, grid_options);
}


/**
 * Update user validation grid with new rows
 * @param {Object } grid_options - User validation grid options
 * @param {Array<Array>} data - Matrix representation of new grid rows
 */
function update_user_grid(grid_options, data) {
	const data_headers = data.shift();
	const column_defs = data_headers.map(function (col) {
		return {headerName: col.trim(), field: col.trim()}
	});
	grid_options.api.setColumnDefs(column_defs);

	const row_data = data.map(function (row) {
		const ret = {};

		// The minimum function is used to prevent errors due
		// to incomplete or overflowing rows.
		for (let i = 0; i < Math.min(column_defs.length, row.length); i++) {
			const col = column_defs[i]['field'];
			ret[col] = row[i].trim()
		}

		return ret
	});
	grid_options.api.setRowData(row_data)
}


/**
 * Update ontology grid headers.
 * Must be called in ``portal_entity_form_callback``.
 * @param {Array<Object>} components: Ontology grid headers, with each
 * 	object containing a ``label`` and ``id`` attribute
 * @param {Object} grid_options - Ontology validation grid options
 */
function update_ontology_grid(components, grid_options) {
	const column_defs = components.map(function(component) {
		return {headerName: component.label, field: component.id}
	});
	grid_options.api.setColumnDefs(column_defs);
}


/**
 * Download data from a grid instance.
 * @param {Object} grid_options - Grid options of grid to download from
 * @param {('text/csv'|'text/tab-separated-values')} file_type - MIME
 * 	type of file to download
 */
function download_grid(grid_options, file_type) {
	let csv_str = grid_options.api.getDataAsCsv();

	if (file_type === 'text/tab-separated-values') {
		$.ajax({
			type: 'POST',
			url: 'csv_str_to_matrix',
			data: {'csv_str': csv_str},
			success: function (data) {
				let tsv_str = data.map(function(row) {
					return row.join('\t')
				});
				tsv_str = tsv_str.join('\n');
				download_str(tsv_str, 'export.tsv', file_type)
			},
			error: function (_, text_status, error_thrown) {
				alert(text_status + ': ' + error_thrown)
			}
		});
	} else {
		download_str(csv_str, 'export.csv', file_type)
	}
}


/**
 * Download a file containing a specified string as content.
 * @param {string} str - Content of downloaded file
 * @param {string} file_name - Name of downloaded file; should include
 * 	extension
 * @param {string} file_type - MIME type of file to download
 */
function download_str(str, file_name, file_type) {
	// https://stackoverflow.com/a/33542499/11472358
	const blob = new Blob([str], {type: file_type});
	if(window.navigator.msSaveOrOpenBlob) {
		window.navigator.msSaveBlob(blob, file_name);
	}
	else{
		var elem = window.document.createElement('a');
		elem.href = window.URL.createObjectURL(blob);
		elem.download = file_name;
		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);
	}
}


/**
 * TODO: ...
 * @param user_col
 * @param onto_col
 */
function link_grid_cols(user_col, onto_col) {
	const user_col_header = $(`.ag-header-cell[col-id='${user_col}']`);
	const onto_col_header = $(`.ag-header-cell[col-id='${onto_col}']`);

	// user_col already mapped to >= 1 onto cols
	if (user_col in top.linked_user_cols) {
		// user_col already mapped to onto_col
		if (top.linked_user_cols[user_col].includes(onto_col)) {
			return;
		// user_col not mapped to onto_col yet
		} else {
			top.linked_user_cols[user_col].push(onto_col);

			const user_col_header_color = user_col_header.css('background-color');
			onto_col_header.css('background-color', user_col_header_color)
		}
	// user_col not mapped to anything yet
	} else {
		top.linked_user_cols[user_col] = [onto_col];

		const next_color = get_next_mapping_color();
		user_col_header.css('background-color', next_color);
		onto_col_header.css('background-color', next_color)
	}

	// onto_col was already mapped to another user col
	if (onto_col in top.linked_onto_cols) {
		const old_user_col = top.linked_onto_cols[onto_col];

		// Remove onto_col from old mapping
		top.linked_user_cols[old_user_col] =
			top.linked_user_cols[old_user_col].filter(x => x !== onto_col);
		// onto_col was old_user_col's only mapping
		if (!top.linked_user_cols[old_user_col].length) {
			delete top.linked_user_cols[old_user_col];

			const old_user_col_header = $(`.ag-header-cell[col-id='${old_user_col}']`);
			old_user_col_header.css('background-color', '')
		}
	}

	top.linked_onto_cols[onto_col] = user_col
}


/**
 * TODO: ...
 */
function get_next_mapping_color() {
	const colors = [
		'#F08080',
		'#90EE90',
		'#ADD8E6',
		'#F0E68C',
		'#FF7F50',
		'#DDA0DD',
		'#D2B48C',
		'#8FBC8B',
		'#B0C4DE'
	];

	const ret = colors[top.next_linked_col_color];

	top.next_linked_col_color += 1;
	top.next_linked_col_color %= 9;

	return ret
}


/**
 * Create a mapping for a specified package.
 * Mapping refers to the a specific order of user and ontology grid
 * headers for a package.
 * @param {string} mapping_name - Name of mapping to store in package
 * @param {Array<string>} user_field_order - User column fields in
 * 	specific order
 * @param {Array<string>} ontology_field_order - Ontology column
 * 	fields in specific order
 * @param {string} resource_id - Id of package to store mapping in
 */
function create_mapping(mapping_name, user_field_order, ontology_field_order,
			resource_id) {
	const data = JSON.stringify({
		'mapping_name': mapping_name,
		'user_field_order': user_field_order,
		'ontology_field_order': ontology_field_order
	});

	$.ajax({
		type: 'POST',
		url: API_RESOURCES_URL + resource_id + '/add_mapping/',
		data: {'data': data},
		success: function(data) {
			$('#mapping_select').empty();
			render_mapping_options(resource_id);
			$('#mapping_create_form').foundation('reveal', 'close')
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
			if ($.isEmptyObject(mappings)) {
				$('#no_mappings_warning').show();
			} else {
				$('#no_mappings_warning').hide();
				for (const mapping in mappings) {
					if (mappings.hasOwnProperty(mapping)) {
						const opt = $('<option></option>').text(mapping);
						$('#mapping_select').append(opt)
					}
				}
			}
		},
		error: function (jqxhr, _, error_thrown) {
			console.error('Failed to load mappings: ' + jqxhr.responseText + ' ('
				+ error_thrown + ')')
		}
	})
}

/**
 * Align the user and ontology grid headers to a mapping.
 * @param {string} resource_id - Id of resource to get mapping from.
 * @param {string} mapping_name - Name of mapping in resource.
 */
function load_mapping(resource_id, mapping_name) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/' + mapping_name + '/',
		success: function(mapping) {
			// Check if user submitted data has the same
			// fields as the mapping's user fields.
			let user_fields = top.user_grid_options.columnApi.getAllGridColumns();
			user_fields = user_fields.map(x => x.getColDef().field).sort().join();
			const mapping_user_fields = mapping.user_field_order.sort().join();
			if (user_fields !== mapping_user_fields) {
				$('#non_matching_mapping_warning').show()
			} else {
				$('#non_matching_mapping_warning').hide()
			}

			// Move columns to match mapping
			top.user_grid_options.columnApi.moveColumns(
				mapping.user_field_order,
				0
			);
			top.ontology_grid_options.columnApi.moveColumns(
				mapping.ontology_field_order,
				0
			)
		},
		error: function (jqxhr, _, error_thrown) {
			console.error('Failed to load mapping: ' + jqxhr.responseText + ' ('
				+ error_thrown + ')')
		}
	})
}
