/**
 * @file Functions used by validator tab.
 */


/**
 * Create grid options object for validator tab grid.
 * @returns {Object} Grid options
 */
function get_grid_options() {
	return {
		columnDefs: [],
		rowData: [],
	};
}


/**
 * Create the grid in the validator tab.
 * @param {Object} grid_options - Grid options
 */
function create_grid(grid_options) {
	const grid_div = document.querySelector('#validation_grid');
	new agGrid.Grid(grid_div, grid_options);
}


/**
 * Update the grid with new rows
 * @param {Object }grid_options - Grid options
 * @param {string} data - Matrix representation of new grid rows
 */
function update_grid(grid_options, data) {
	const data_headers = data.shift();
	const column_defs = data_headers.map(function (col) {
		return {headerName: col, field: col, editable: true}
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
