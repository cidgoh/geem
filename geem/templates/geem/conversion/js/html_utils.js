

function convert_formfield(source_prefix = 'user', target_prefix = 'spec') {
  let source = get_field_type(source_prefix +'_field_type');
  let target = get_field_type(target_prefix + '_field_type');
  if (source && target) {
    let value = document.getElementById(source_prefix +'_field_input').value;
    let target_Dom = document.getElementById(target_prefix + '_field_input');
    target_Dom.value = convert(source.id, value, target.id, true); //true = show messages.
  }
}


function get_field_type(select_domId) {
  let select = document.getElementById(select_domId);
  let option = select.options[select.selectedIndex]
  if (option in field_index)
    return field_index[option.value];
  else
    return false
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


//Runs tests given in #test_suite table
function render_test_suite() {
  let table = document.getElementById('test_suite');
  // Each tbody is a test on one field type to another and back.
  let clickable = ' onclick="javascript:load_test(this)"';

  test_suite.forEach(test =>  { 
    let tbody = document.createElement('tbody');
    test.user.error = [];
    test.user.class = [];
    test.spec.error = [];
    test.spec.class = [];
    test.round = {};
    test.round.value = [];
    test.round.class = [];

    for (i = 0; i <4; i++) {
      test.user.error[i] = '';
      test.user.class[i] = '';
      test.spec.error[i] = '';
      test.spec.class[i] = '';
      test.round.value[i] = '';
      test.round.class[i] = '';

      if (test.user.values[i] && test.spec.values[i]) {
        value = test.user.values[i];

        // Validate user field parse

        // Try user -> spec conversion
        if (test.spec.field) {
          let output = convert(test.user.field, value, test.spec.field);
          //let spec_value = test.spec.values[i];
          if (test.spec.values[i].localeCompare(output) == 0) {
            test.spec.class[i] = "ok";

            // Try spec -> user conversion
            if (output !== false) {
              let round = convert(test.spec.field, output, test.user.field);
              if (value.localeCompare(round) == 0) {
                test.round.class[i] = "ok";
                test.round.value[i] = '&#10004;';
              }
              else {
                test.round.class[i] = "error";
                test.round.value[i] = round;
              }
            }
          }
          else {
            test.spec.error[i] = `<br/><span class="error">${output}</span>`;
          }
        }
      }

    };
    
    tbody.innerHTML = ` 
      <tr>
        <td>user</td> 
        <td>${test.user.field}</td>
        <td class="clickable ${test.user.class[0]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[0]}','${test.spec.field}')">
          ${test.user.values[0]}${test.user.error[0]}</td>
        <td class="clickable ${test.user.class[1]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[1]}','${test.spec.field}')">
          ${test.user.values[1]}${test.user.error[1]}</td>
        <td class="clickable ${test.user.class[2]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[2]}','${test.spec.field}')">
          ${test.user.values[2]}${test.user.error[2]}</td>
        <td class="clickable ${test.user.class[3]}"  onclick="javascript:load_test('${test.user.field}','${test.user.values[3]}','${test.spec.field}')">
          ${test.user.values[3]}${test.user.error[3]}</td>
        <td>${test.user.unit}</td>
      </tr>
      <tr>
        <td>spec</td>
        <td>${test.spec.field}</td>
        <td class="${test.spec.class[0]}">${test.spec.values[0]}${test.spec.error[0]}</td>
        <td class="${test.spec.class[1]}">${test.spec.values[1]}${test.spec.error[1]}</td>
        <td class="${test.spec.class[2]}">${test.spec.values[2]}${test.spec.error[2]}</td>
        <td class="${test.spec.class[3]}">${test.spec.values[3]}${test.spec.error[3]}</td>
        <td>${test.spec.unit}</td>
      </tr>
      <tr>
        <td>round</td>
        <td></td>
        <td class="${test.round.class[0]}">${test.round.value[0]}</td>
        <td class="${test.round.class[1]}">${test.round.value[1]}</td>
        <td class="${test.round.class[2]}">${test.round.value[2]}</td>
        <td class="${test.round.class[3]}">${test.round.value[3]}</td>
        <td></td>        
      </tr>
    `;
    table.appendChild(tbody);
  })
}

// Puts given parameters into HTML form and triggers conversion.
function load_test(source_id, value, target_id) {
  let messageDom = document.getElementById('conversion');
  let source = document.getElementById('user_field_type');
  source.value = source_id;
  if (source.selectedIndex == -1)
    messageDom.innerHTML = 'ERROR: Test suite requested unavailable field type: ' + source_id;
  let source_input = document.getElementById('user_field_input');
  source_input.value = value;
  let target = document.getElementById('spec_field_type');
  target.value = target_id;
  if (target.selectedIndex == -1)
    messageDom.innerHTML = 'ERROR: Test suite requested unavailable field type: ' + target_id;
  source.onchange();

}

