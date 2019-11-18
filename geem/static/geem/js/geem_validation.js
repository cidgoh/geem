/**
 * @file Functions used by validator tab.
 */

function create_grid() {
	const column_defs = [
		{headerName: 'Test Column One', field: 'test_column_one'},
		{headerName: 'Test Column Two', field: 'test_column_two'},
	];

	const row_data = [
		{test_column_one: 'foo', test_column_two: 'bar'},
		{test_column_one: 'bar', test_column_two: 'foo'},
	];

	const grid_options = {
		columnDefs: column_defs,
		rowData: row_data,
		domLayout: 'autoHeight',
	};

	const grid_div = document.querySelector('#validationGrid');
	new agGrid.Grid(grid_div, grid_options);
}