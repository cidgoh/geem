/* Enables {squiggly} variable key in a string to be replaced by corresponding dictionary key value, just like in python.

PROTOTYPE extension has to come before functions in script file.
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

  // Dictionary of field name -> regex parse.
  let field_parse_index = {}; 

  // Every field that has a mapping will be member of 'integer' group.
  field_equivalence['integer']={} 

  // 1st pass: make an index, and set parent for each field type.
  for (let [section_id, section] of Object.entries(lang)) {
    for (let [field_id, field] of Object.entries(section)) {
      // Some fields are in sections but have a separate mapping group, e.g.
      // hour types that are under time section.
      if (!field.group)
        field.group = section_id;
      field.id = field_id;
      if (field.map) {
        // If this field has a map, add field to map index by parent group
        if (!field_equivalence[field.group])
          field_equivalence[field.group] = {};
        field_equivalence[field.group][field_id] = field.decompose;
      }
      if (!field.synth) {
        field.synth = ['{' + field_id + '}'];
      }
      field_index[field_id] = field;
      field_parse_index[field_id] = field.parse;
    }

  }

  // Every field_equivalence set has "int" as member since generally int can
  // be used as an input index on any of them to fetch a value.
  for (let [group, equivalence_dict] of Object.entries(field_equivalence)) {
    equivalence_dict['int'] = null;
    // POSSIBLY ADD FLAG TO field to indicate whether mapping should be 'int' or 'natural'
    equivalence_dict['natural'] = null;
  }

  /* 2nd pass: For a field type that is missing a parse, or has a parse 
  temporarily set to a synth expression that can be decomposed further, do
  the decomposition of synth expression.
  Issue: e.g. 
    unix_date.synth = ['{signed_int}']
    signed_int.synth = ['{sign}{int}'] but this isn't always done in time!
  We have to run this a few times so field_type_parse gets populated with 
  signed_int.parse, then unix_date.synth dict lookup can work.

  ONLY decomposes FIRST synth[0]. OK?
  */
  for (let step = 0; step < 3; step++) {
    for (let [field_id, field] of Object.entries(field_index)) {
      if (!field.parse || (field.synth && field.parse == field.synth[0])) {
        field.parse = field.synth[0].supplant(field_parse_index);
        field_parse_index[field_id] = field.parse;
      }

    }
  }

  // 3rd pass: convert all parse fields to regex fields
  for (let [field_id, field] of Object.entries(field_index)) {
    field.parse = new RegExp('^' + field.parse + '$', 'i');
  } 
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

    let text = null;
    if (result) {
      let params = [];
      for (let [name, value] of Object.entries(result.groups))
        params.push(`${name}: ${value}`);
      text = params.join(', ');
    }
    else
      text = `<span class="field_error">${escapeHTML(field_type.parse)}</span><br/>`;

    message = `<span class="field_type">${field_type.label}</span><br/>` + text;

  }

  document.getElementById(input_source + "_validation").innerHTML = message;

  return result;
}
// Purpose is to find an equivalent expression (as a list) 
// Prime tumbler with onel element, the target field type id.
// Issue: map would find just one match in input.


function convert(source='user', target='spec') {

  let source_field_type = get_field_type(source +'_field_type');
  let target_field_type = get_field_type(target + '_field_type');
  let source_value = document.getElementById(source +'_field_input').value;
  let target_field_Dom = document.getElementById(target + '_field_input');
  let message = 'Ok!';
  let messageDom = document.getElementById('conversion');

  if (!source_field_type || !target_field_type) {
    messageDom.innerHTML = 'Please ensure user data and specification field types have been selected';
    return false;
  }

  // We accept the granularity of source input components as present in source_dict
  let source_parse_result = source_value.match(source_field_type.parse);
  if (source_parse_result) 
    source_dict = source_parse_result.groups;
  else {
    messageDom.innerHTML = 'Source is invalid';
    return false;
  }

  // Allow target default components to be added to source component 
  // dictionary.  They are superceded by any source matched components.
  if (target_field_type.default)
    source_dict = {...target_field_type.default,...source_dict};

  // Ensure whole parse available by id too.
  // e.g. unix_date in source dict {sign:-,int:2342,...,unix_date:-2342}
  source_dict[source_field_type.id] = source_parse_result[0];

  // If a source field is in a mapping group, and one of that group's members
  // mentions field.detail = true, add its parse to the source field mapping 
  // so that target has more exposed source components to match. There is at
  // most one detail field per group.

  // This is a bit of a hack? Why not do this for every source component that 
  // could be decomposed too?
  if (source_field_type.map && (source_field_type.group in field_equivalence)) {
    //FIND field type in map set that has .detail == true: 
    for (let [detail_id, detail] of Object.entries(field_equivalence[source_field_type.group])) {
      if (detail == true) {
        // Add detail_id field's parse of source value to to source_dict
        mapped_value = field_map(source_field_type.id, source_dict[source_field_type.id], detail_id);
        detail_dict = mapped_value.match(field_index[detail_id].parse);
        source_dict = {...source_dict,...detail_dict.groups};
      }
    }
  }

  console.log('Parsed source:', source_dict);

  /* We need the synthesis parts of a field type in ADVANCE of applying 
   .parse() (that might not match and populate dict) since we first have to
   carry out a search to find compatible components by mapping/transformation.
  */

  /* Default mapping assumes target field type will occur in source dict. This
  will be typical of mapping between fields in datasets defined by pure 
  ontology specs.
   e.g. mapping = {'{date_iso_8601}':'{date_iso_8601}'}
  */
  let synth = '{'+target.id+'}';
  let mapping = {[synth]: target.id}; 
  message = '';

  // The simple case:
  if (source_field_type == target_field_type) {
    message += "Field type match";
  }

  else {
    console.log("Field type mismatch.")
    // Q: is target a mapping of source?
    map_set = field_equivalence[target_field_type.group];
    if (map_set && target.id in map_set) {

      console.log("equivalency for "+target.id,":", map_set)
      for (let [key, map_val] of Object.entries(map_set)) { 
        if (key in source_dict) {
          mapping = {[synth]: key}
          break;
        }
      }
    }
 
  }
  console.log("source parse", source_dict)
  console.log("Mapping raw:", mapping)

  let source_index = null;

  // IMPLEMENT MAPPING VIEW:
  for (let [synth, field_id] of Object.entries(mapping)) {
    // Handle case {{fraction}: "fraction"}: substitution leads to ...

    // If a field has a map
    if (field_index[field_id].map) {
      if (field_id in source_dict) {
        // E.g. {{month_abbr}: "MM"} -> {{month_abbr}: "jan"} by way of equivalence
        // Issue: {{M_D_YYYY}: "D_M_YYYY"} -> {{M_D_YYYY}: "1/2/1923"}
        //{M: "2", D: "1", YYYY: "1923", M_D_YYYY: "2/1/1923", MM: "02", …}
        field_value = field_map(target.id, source_dict[field_id], field_id)
        field_value2 = 
        mapping[synth] = {[field_id]: field_value};
        //mapping[synth] = field_value;
      }
    }
    
  }

  console.log("Mapping substitute", mapping)
  messageDom.innerHTML = JSON.stringify(mapping, undefined, 4); 

  return
}


function field_map(source_id, value, target_id) {
  // ANY TWO FIELDS SHOULD ALWAYS BE CONVERTED VIA INT mapping, not directly
  // value, M_D_YYYY: "2/1/1923", MM: "02", …}
  let source_type = field_index[source_id];
  let source_index = get_map_index(source_type, value);

  let target_type = field_index[target_id];
  return get_map_value(target_type, source_index);
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

/* This is a simple "identity" mapping function that allows a field type to
return given "param" (an integer as a string) as an integer rather than having
to spell out an array map: [0,1,2,... n].  It also provides int field types 
with an easy mapping with upper and lower bounds if necessary. Default 
behavour is that integers range from 0 to infinity. 

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








function unused() {
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

  // CASES:
  // D: 1, M: 1, YYYY: 2034 --> DD , or MM, or YY.


  // TESTING: Is target synth a compound term; if so add its synthesis.
  // e.g. {signed_int} -> {sign}{int}
  synth = target_field_type.synth.replace(/{([^{}]*)}/g,
      function (originalstr, stringrepname) {
          var r = field_index[stringrepname].synth;
          return typeof r === 'string' ? r : originalstr;
      }
  );


  for (let ptr in synths) {
    // Do string substitution on given synthesis expression according to source dict.
    value = synths[ptr].supplant(source_dict);
    // A substitution has occured and no substitutions remain.
    if (value != synths[ptr]) { //  && value.indexOf('{') == -1
      target_field.value = value;
      messageDom.innerHTML = "Synthesis";
      return target_field.value
    }
    // dictionary on input side 
    // but are more than one "{}{}" taken care of on target side?
  } 

  // Shortcut: if source and destination field types are in same group. 
  if (source_field_type.group == target_field_type.group) {

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


  let synth = []
  for (let [ptr, item] in target_field_type.synth.match(/{([^{}]*)}/g))
    synth.push(item.substr(1,item.length-2)); //strips off {}.


}
