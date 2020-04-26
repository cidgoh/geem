/*
  {user: {field: '', unit: '', values: ['','','']},
  spec:  {field: '', unit: '', values: ['','','']}
  },
*/

test_suite = [
  {user: {field: 'M_D_YYYY', unit: '', values: ['1/1/1970','1/3/1995','12/31/2001']},
  spec:  {field: 'D_M_YYYY', unit: '', values: ['1/1/1970','3/1/1995','31/12/2001']}
  },
  {user: {field: 'M_D_YYYY', unit: '', values: ['1/1/1970','1/3/1995','12/31/2001']},
  spec:  {field: 'unix_date', unit: '', values: ['0','789091200','1009756800']}
  },
  {user: {field: 'date_iso_8601', unit: '', values: ['1970-01-01','1995-01-03','2001-12-31']},
  spec:  {field: 'unix_date', unit: '', values: ['0','789091200','1009756800']}
  },
  {user: {field: 'unix_date', unit: '', values: ['0', '789091200','1009756801']}, //note extra second
  spec:  {field: '', unit: '', values: ['1970-01-01T00:00:00.000Z','1995-01-03T00:00:00.000Z','2001-12-31T00:00:01+00:00']}
  },
]


//Runs tests given in #test_suite table
function get_test_suite() {
  let table = document.getElementById('test_suite');
  // Each tbody is a test on one field type to another and back.
  let tbodies = table.getElementsByTagName('tbody');
  for (ptr in tbodies) { 
    if (ptr > 0) {
      let rows = tbodies[ptr].getElementsByTagName('tr');
      let user_tds = get_tds(rows[0]);
      let spec_tds = get_tds(rows[1]);
      let round_tds = get_tds(rows[2]);
      //user_tds[0].dom.style.color="red";
    }
  }
}

function get_tds(row) {
  // tds are array of [type, unit, field_type, value1, value2, value3]
  // each cell has reference to original dom element, and its textual value
  var tds = row.getElementsByTagName('td');
  var array = [];
  for (let td of tds) {
    array.push(
    { 
      dom: td, 
      value: td.innerText ? td.innerText.trim() : ''
    });
  }
  return array;
}

/*
  tds[0].bgColor="red"
// Set multiple styles in a single statement
elt.style.cssText = "color: blue; border: 1px solid black"; 
// Or
elt.setAttribute("style", "color:red; border: 1px solid blue;");

// Set specific style while leaving other inline style values untouched
elt.style.color = "blue";
*/


