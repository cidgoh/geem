/* Enables {squiggly} variable key in a string to be replaced by corresponding dictionary key value, just like in python.

PROTOTYPE extension has to come before functions in script file!
*/
String.prototype.supplant = function (dict) {
    return this.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = dict[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

function init_field_type() {

  // 1st pass: make an index, and set parent for each field type.
  for (let [section_name, section] of Object.entries(lang)) {
    for (let [field_name, field] of Object.entries(section)) {
      field.parent = section_name;
      if (!field.synth)
        // Every field gets at least one synth expression that enables it to
        // be matched to a component of another parse by its name.  Some
        // exceptions, e.g. 'c19YY' has generic {YY} synth.
        field.synth = '{' + field_name + '}';
      field_type_index[field_name] = field;
      field_type_parse[field_name] = field.parse;
    }
  }

  // 2nd pass: for field type missing a parse, make parse out of synth.
  // Issue: unix_date.synth = {signed_int}, but {signed_int} = {sign}{int}
  // so we have to run this a few times
  for (let step = 0; step < 3; step++) {
    for (let [field_name, field] of Object.entries(field_type_index)) {
      if (!field.parse || field.parse == field.synth) {
        field.parse = field.synth.supplant(field_type_parse);
        field_type_parse[field_name] = field.parse;
      }
    }
  }

  // 3rd pass: convert all parse fields to regex fields
  for (let [field_name, field] of Object.entries(field_type_index)) {
    field.parse = new RegExp('^' + field.parse + '$', 'i');
  } 
}

/* Populate a select input displaying groups of field type
  :param str domId: id of dom HTML select input
*/
function field_type(domId) {

  let select = document.getElementById(domId);

  for (let [section_name, section] of Object.entries(lang)) { 
    let group = document.createElement("optgroup");
    group.label = section_name; 
    select.appendChild(group);
    for (let [field_name, field] of Object.entries(section)) { 
      let opt = document.createElement("option");
      opt.value = section_name + '.' + field_name; // only saves string.
      opt.innerHTML = field.label; // whatever property it has
      group.appendChild(opt);
    }
  }
}

/* Populate unit menu displaying groups of units
  :param str domId: id of dom HTML select input
*/
function field_unit(domId) {
  let select = document.getElementById(domId);
  for (let [section_uri, section] of Object.entries(unit)) {
    if (section.children) {
      option = document.createElement('optgroup');
      option.label = section.label;
      select.appendChild(option);
      field_unit_item(option, section)
    }
    else
      field_unit_item(select, section)
  }
}

// ISSUE: optgroup spec is broken. Only 1 level deep allowed.
function field_unit_item(group, item, depth=0) {
  if (item.children) {
    if (depth > 0) {
      let option = make_option(group, item, depth)
      option.disabled = "disabled";
    }
    for (let [item2_uri, item2] of Object.entries(item.children)) { 
      field_unit_item(group, item2, depth + 1)
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


/* List regular expressions that match given field content
  :param str input_source: either 'user' or 'spec'
*/
function recognize(input_source) {
  let input_field = document.getElementById(input_source + '_field_input')
  var text = '';
  for (let [section_name, section] of Object.entries(lang)) { 
    for (let [field_name, field] of Object.entries(section)) { 
      let result = input_field.value.match(field.parse)
      if (result)
        text += `<span class="field_type">${field.label}</span> ${escapeHTML(field.parse)}<br/>`

    }
  }

  document.getElementById("message").innerHTML = text;

}

/* Validate a user or spec input field against its stated field type.

  :param str input_source: either 'user' or 'spec'
  :return whole matched regular expression
  :rtype str
*/
function validate(input_source) {

  let field_type = get_field_type(input_source + '_field_type');
  let input_field = document.getElementById(input_source + '_field_input')
  let result = null;
  let message = 'Select a field type to validate by it';

  if (field_type) {
    result = input_field.value.match(field_type.parse);
    if (result) {
      params = [];
      for (let [name, value] of Object.entries(result.groups))
        params.push(`${name}: ${value}`);
      text = params.join(', ')
    }
    else
      text = `<span class="field_error">${escapeHTML(field_type.parse)}</span><br/>`;

    message = `<span class="field_type">${field_type.label}</span><br/>` + text;

  }

  document.getElementById(input_source + "_validation").innerHTML = message;

  return result
}

function convert() {

  let source_field_type = get_field_type("user_field_type");
  let target_field_type = get_field_type("spec_field_type");
  let source_field = document.getElementById("user_field_input");
  let source_field_value = source_field.value;

  let target_field = document.getElementById("spec_field_input");
  let message = "Ok!"
  let messageDom = document.getElementById("conversion");

  if (!source_field_type || !target_field_type) {
    messageDom.innerHHTML = "Please ensure user data and specification field types have been selected";
    return false;
  }

  let source_parse_result = source_field_value.match(source_field_type.parse);
  if (source_parse_result) {
    if (target_field_type.dict)
      // Allow default components to be added to matching dictionary.
      source_parse_dict = {...target_field_type.dict,...source_parse_result.groups};
    else
      source_parse_dict = source_parse_result.groups;

    console.log(source_parse_dict);
    // DECOMPOSE ANY SOURCE DICT KEY THAT HAS MORE THAN ONE SYNTH expr.
    // I.e. if YYYY mentioned, add keys for matching parses: c19YY or c20YY

  }
  else {
    messageDom.innerHHTML = "Source is invalid";
    return false;
  }

  let source_index = null;
  let target_index = null;
  if (source_field_type.map) {
    source_index = get_map_index(source_field_type, source_field_value);
  }
  if (target_field_type.map) {
    target_index = get_map_index(source_field_type, source_field_value);
  }

  // Shortcut: if source and destination field types are identical. 
  if (source_field_type == target_field_type) {
    target_field.value = source_field_value
    messageDom.innerHTML = "Same field type";
    return target_field.value
  }


  // Conversion from multi-component to single-component field.
  // CHECK SYNTHESIS RULES HERE - is target a component of source?
  if (source_parse_result && target_field_type.synth) {
    if (Array.isArray(target_field_type.synth)) {
      var synths = target_field_type.synth;
      // Issue: multiple synthesis expressions = multiple search paths.
      //..
    }
    else {

      // TESTING: Is target synth a compound term; if so add its synthesis.
      // e.g. {signed_int} -> {sign}{int}
      var synth = target_field_type.synth.replace(/{([^{}]*)}/g,
          function (originalstr, stringrepname) {
              var r = field_type_index[stringrepname].synth;
              return typeof r === 'string' ? r : originalstr;
          }
      );

      //var synths = [target_field_type.synth];
      var synths = [synth];
    }

    for (let ptr in synths) {
      // Do string substitution on given synthesis expression according to source dict.
      value = synths[ptr].supplant(source_parse_dict);
      // A substitution has occured and no substitutions remain.
      if (value != synths[ptr]) { //  && value.indexOf('{') == -1
        target_field.value = value;
        messageDom.innerHTML = "Synthesis";
        return target_field.value
      }
      // dictionary on input side 
      // but are more than one "{}{}" taken care of on target side?
    } 
  }

  // Shortcut: if source and destination field types are in same group. 
  if (source_field_type.parent == target_field_type.parent) {

    //If both have map, then map FROM parsed value to value
    if (source_field_type.map && target_field_type.map) {
      target_field.value = get_map_value(target_field_type, source_index)
      messageDom.innerHTML = "Mapped";
      return target_field.value
    }
  }

  // Allow conversion from map field index to integer
  if (source_index && target_field_type.label == 'integer'){
    target_field.value = source_index;
    messageDom.innerHTML = "Map value index to integer";
    return target_field.value
  }

  // Allow conversion from integer as index to map field value
  if (target_index && source_field_type.label == 'integer'){
    target_field.value = get_map_value(target_field_type, source_field_value);
    messageDom.innerHTML = "Integer to map value";
    return target_field.value
  }
  messageDom.innerHTML = "No conversion done!";
  return false;
}

// Get index of value in given field type map
function get_map_index(field_type, value) {
  if (Array.isArray(field_type.map))
    return field_type.map.indexOf(value);
  return field_type.map(value);
}

// Get map value by field type map index
function get_map_value(field_type, index) {
  if (Array.isArray(field_type.map))
    return field_type.map[index];

  return field_type.map(index, true); // true = get value at index
}


function escapeHTML(s) { 
    return String(s).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

function get_field_type(select_domId) {
  let select = document.getElementById(select_domId);
  let value = select.options[select.selectedIndex].value;
  if (value) {
    labels = value.split('.') // value is string in form of day.dd
    value = lang[labels[0]][labels[1]];
  }
  return value;
}

/* This is a simple mapping function that lets us define an acceptable range 
of integers rather than having to spell out an array [0,1,2,... n].  It also
provides int field types with an easy mapping with upper and lower bounds if
necessary. Default behavour is that integers range from 0 to infinity. 

  :param str param: An integer in string form
  :param int lower: null or some negative limit
  :param int upper: null or some positive limit
  :param boolean padding: whether to pad number according to upper range digits
  :return: Validated string conversion of integer
  :rtype: str
*/
function map_integer(param, lower = 0, upper = null, padding = false) {
  let value = parseInt(param);
  if (lower !== null)
    if (value < lower) 
      return NaN;
    if (lower === 0)
      value = Math.abs(value); // drops leading "+" if any
  if (upper !== null)
    if (value > upper) 
      return NaN;

  value = String(value);
  if (padding && upper) {
    value = value.padStart(String(upper).length, '0');
  }
  return value;
}

