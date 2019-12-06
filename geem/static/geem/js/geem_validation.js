/**
 * @file Functions used by validator tab.
 */


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
		return {headerName: col, field: col}
	});
	grid_options.api.setColumnDefs(column_defs);

	const row_data = data.map(function (row) {
		const ret = {};

		// The minimum function is used to prevent errors due
		// to incomplete or overflowing rows.
		for (let i = 0; i < Math.min(column_defs.length, row.length); i++) {
			const col = column_defs[i]['field'];
			ret[col] = row[i]
		}

		return ret
	});
	grid_options.api.setRowData(row_data)
}


/**
 * Update ontology grid headers.
 * Must be called in ``portal_entity_form_callback``.
 * @param grid_options - Ontology validation grid options
 */
function update_ontology_grid(grid_options) {
	const column_defs = top.form.components.map(function(component) {
		return {headerName: component.label, field: component.id}
	})
	grid_options.api.setColumnDefs(column_defs)
}
