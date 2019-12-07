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
 * @param {Object} grid_options - Ontology validation grid options
 */
function update_ontology_grid(grid_options) {
	const column_defs = top.form.components.map(function(component) {
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
	let data_str = grid_options.api.getDataAsCsv();
	let file_name;

	if (file_type === 'text/tab-separated-values') {
		data_str = data_str.replace(/,/g, '\t');
		file_name = 'export.tsv'
	} else {
		file_name = 'export.csv'
	}

	// https://stackoverflow.com/a/33542499/11472358
	const blob = new Blob([data_str], {type: file_type});
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
