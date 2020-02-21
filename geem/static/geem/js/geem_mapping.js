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

	update_spec_field_labels(top.ontology_grid_options)
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

	// Need to connect new sortable divs
	init_mapping_tab()
}


/**
 * TODO: document function
 * @param ontology_grid_options
 */
function update_spec_field_labels(ontology_grid_options) {
	$('#unmapped_spec_field_labels').empty();

	const onto_col_defs = ontology_grid_options.columnApi.getAllColumns().map(x => x.colDef);

	onto_col_defs.forEach(function (col_def) {
		const headerName = col_def.headerName;
		const field = col_def.field;
		$('#unmapped_spec_field_labels').append(`
			<div class="row spec_field_label" data-field="${field}">
                  		<div class="label">${headerName}</div>
                	</div>
		`)
	})
}
