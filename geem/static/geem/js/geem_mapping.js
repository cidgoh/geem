/**
 * @file Functions used by mapping tab.
 */


/**
 * TODO: document function
 */
function render_mapping_view() {
	$('#mapping_info_box').hide();
	$('#mapping_drag_drop').show();
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

function derender_mapping_view() {
	$('#mapping_save_select').hide();
	$('#mapping_drag_drop').hide();
	$('#mapping_info_box').show()
}
