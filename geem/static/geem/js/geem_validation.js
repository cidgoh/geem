/**
 * @file Functions used by validator tab.
 */


/**
 * Get grid options for validator tab grid.
 * @returns {Object} Grid options
 * TODO: Instead of using mock data, retrieve data from cart
 */
function get_grid_options() {
	const column_defs = [
		{headerName: 'Test Column One', field: 'test_column_one'},
		{headerName: 'Test Column Two', field: 'test_column_two'},
	];

	const row_data = [
		{test_column_one: 'foo', test_column_two: 'bar'},
		{test_column_one: 'bar', test_column_two: 'foo'},
	];

	return {
		columnDefs: column_defs,
		rowData: row_data,
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
