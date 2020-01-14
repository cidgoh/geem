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
 * Hide ontology grid and mapping information.
 */
function derender_validation_ontology_view() {
	$('#ontology_validation_grid_box').hide();
	$('#mapping_box').hide();
	$('#validation_info_box').show();
}


/**
 * Create grid options object for creating grid instances.
 * @returns {Object} Grid options object
 */
function create_grid_options() {
	return {
		columnDefs: [],
		rowData: [],
		defaultColDef: {editable: true}
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
 * @param {Object} grid_options - Ontology validation grid objects
 */
function create_ontology_grid(grid_options) {
	const grid_div = document.querySelector('#ontology_validation_grid');
	new agGrid.Grid(grid_div, grid_options);
}


/**
 * Update user validation grid with new rows
 * @param {Object } grid_options - User validation grid options
 * @param {string} data - Matrix representation of new grid rows
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
	grid_options.api.setColumnDefs(column_defs)
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
 * Should only be called by ``render_validation_ontology_view``.
 * @param {string} resource_id - Id of resource to list mappings for.
 */
function render_mapping_options(resource_id) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/',
		success: function(mappings) {
			for (const mapping in mappings) {
				if (mappings.hasOwnProperty(mapping)) {
					const opt = $('<option></option>').text(mapping);
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


function load_mapping(resource_id, mapping_name) {
	$.ajax({
		type: 'GET',
		url: API_RESOURCES_URL + resource_id + '/get_mappings/' + mapping_name + '/',
		success: function(mapping) {
			// TODO: what now?
			console.log(mapping)
		},
		error: function (jqxhr, _, error_thrown) {
			console.error('Failed to load mapping: ' + jqxhr.responseText + ' ('
				+ error_thrown + ')')
		}
	})
}
