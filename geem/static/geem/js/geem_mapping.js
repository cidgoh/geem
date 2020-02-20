/**
 * @file Functions used by mapping tab.
 */


/**
 * TODO: document function
 */
function render_mapping_options() {
	$('#mapping_info_box').hide();
	$('#mapping_save_select').show();
	if (get_owner_status(top.resource)) {
		$('#mapping_save').css('visibility', 'visible')
	} else {
		$('#mapping_save').css('visibility', 'hidden')
	}
}


/**
 * TODO: document function
 */
function derender_mapping_options() {
	$('#mapping_save_select').hide();
	$('#mapping_info_box').show()
}


/**
 * TODO: document function
 * @param user_grid_options
 */
function update_user_field_labels(user_grid_options) {
	$('#user_spec_field_pairs').empty();

	const user_col_defs = user_grid_options.columnApi.getAllColumns().map(x => x.colDef);

	user_col_defs.forEach(function (col_def) {
		const headerName = col_def.headerName;
		const field = col_def.field;
		$('#user_spec_field_pairs').append(`
			<div class="row">
				<div class="small-6 columns">
					<div class="user_field_label label" data-field="${field}">
						${headerName}
					</div>
				</div>
				<div class="small-6 columns droppable_spec_field_box"></div>
			</div>
		`)
	});

	// Need to connect new sortable divs
	init_mapping_tab()
}
