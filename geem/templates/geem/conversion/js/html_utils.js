

function get_field_type(select_domId) {
  let select = document.getElementById(select_domId) 
  return field_index[select.options[select.selectedIndex].value];
}


/* Populate a select input displaying groups of field type
  :param str domId: id of dom HTML select input
*/
function render_field_type(domId) {

  let select = document.getElementById(domId);

  for (let [section_name, section] of Object.entries(lang)) { 
    let group = document.createElement("optgroup");
    group.label = section_name; 
    select.appendChild(group);
    for (let [field_name, field] of Object.entries(section)) { 
      let opt = document.createElement("option");
      opt.value = field_name; // only saves string.
      opt.innerHTML = field.label; // whatever property it has
      group.appendChild(opt);
    }
  }
}

/* Populate unit menu displaying groups of units
  :param str domId: id of dom HTML select input
*/
function render_field_unit(domId) {

  let select = document.getElementById(domId);
  let option = document.createElement('optgroup');
  option.label = 'Select a unit ...';
  select.appendChild(option);

  for (let [section_uri, section] of Object.entries(unit)) {
    if (section.children) {
      option = document.createElement('optgroup');
      option.label = section.label;
      select.appendChild(option);
      render_unit_item(option, section)
    }
    else
      render_unit_item(select, section)
  }
}

// ISSUE: HTML optgroup spec is broken. Only 1 level deep allowed.
function render_unit_item(group, item, depth=0) {
  if (item.children) {
    if (depth > 0) {
      let option = make_option(group, item, depth)
      option.disabled = "disabled";
    }
    for (let [item2_uri, item2] of Object.entries(item.children)) { 
      render_unit_item(group, item2, depth + 1)
    }
  }
  else 
    make_option(group, item, depth)
}


function make_option(group, item, depth=0) {
  let option = document.createElement('option');
  option.value = item.label;  // or item.iri
  option.innerHTML = ' &nbsp;&nbsp; '.repeat(depth > 1 ? depth-1:0) + item.label;
  group.appendChild(option);
  return option;
}


// Enable regular expressions with named groups to be displayed nicely in HTML.
function escapeHTML(s) { 
    return String(s).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

function select_update(field_id) {
  let control = document.getElementById('user_field_type');
  control.value = field_id;
  control.onchange();

}
