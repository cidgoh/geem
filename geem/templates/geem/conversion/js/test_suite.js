/*

Four columns of values are provided but not all need be filled in.  However,
for those field types that are mappable to integers, the first and last test
values are meant to test lower and upper out-of-range values, while the 2nd
and 3rd values are meant to test valid lower and upper bounds. 

* Put "false" in spec values[x] if that column shouldn't convert because 
input is wrong syntax, i.e. it shouldn't even parse.

* Put "n/a" in optional "round:" values[x] field if that column shouldn't 
have a reverse test from spec to user field.  This is the case where a spec
field is only matching to some component of a user field.

Prototype:

  {
  user: {field: '', unit: '', values: ['','','','']},
  spec:  {field: '', unit: '', values: ['','','','']}
  },

And in the case where a round trip conversion shouldn't be attempted:
  {
  user: {field: '', unit: '', values: ['','','','']},
  spec:  {field: '', unit: '', values: ['','','','']},
  round: {field: '', unit: '', values: ['','n/a','n/a','']},  
  },

*/

test_suite = [
  {user: {field: 'D', unit: '', values: ['0','1','31','32']},
  spec:  {field: 'DD', unit: '', values: ['false','01','31', 'false']}
  },
  {user: {field: 'weekday_int', unit: '', values: ['0','1','7','8']},
  spec:  {field: 'weekday_abbr', unit: '', values: ['false','mon','sun', 'false']}
  },
  {user: {field: 'M', unit: '', values: ['0','1','12','13']},
  spec:  {field: 'MM', unit: '', values: ['false','01','12','false']}
  },
  {user: {field: 'month_abbr', unit: '', values: ['junk','jan','dec','2']},
  spec:  {field: 'month_word', unit: '', values: ['false','january','december','false']}
  },
  {user: {field: 'natural', unit: '', values: ['0','1','12','13']},
  spec:  {field: 'M', unit: '', values: ['false','1','12','false']}
  },
  {user: {field: 'int', unit: '', values: ['-1','0','11','12']},
  spec:  {field: 'M', unit: '', values: ['false','1','12','false']}
  },
  {user: {field: 'YYYY', unit: '', values: ['0000','1900','1999','2000']},
  spec:  {field: 'c19YY', unit: '', values: ['false','00','99','false']}
  },
  {user: {field: 'c19YY', unit: '', values: ['0','00','45','101']},
  spec:  {field: 'YYYY', unit: '', values: ['false','1900','1945','false']}
  },
  {user: {field: 'c20YY', unit: '', values: ['0','00','45','101']},
  spec:  {field: 'YYYY', unit: '', values: ['false','2000','2045','false']}
  },

  {user: {field: 'hh', unit: '', values: ['0','00','23','24']},
  spec:  {field: 'h', unit: '', values: ['false','0','23','false']}
  },
  {user: {field: 'h', unit: '', values: ['0','1','23','24']},
  spec:  {field: 'h12ap', unit: '', values: ['0a','1a','11p','false']}
  },


  {user: {field: 's_int', unit: '', values: ['0',  '1', '59',    '60']},
  spec:  {field: 'ss', unit: '', values:   ['00', '01', '59', 'false']}
  },

  {user: {field: 'm_int', unit: '', values:  ['0',  '1', '59',    '60']},
  spec:  {field: 'mm', unit: '', values:    ['00', '01', '59', 'false']}
  },

  // ISSUE: Should this be forced to be just 3 digits?
  {user: {field: 'ms_int',      unit: '', values: [   '0',    '1',  '999', '1000']},
  spec:  {field: 'ms_fraction', unit: '', values: ['.000', '.001', '.999',  'false']}
  },

  {user: {field: 'TZD', unit: '', values: ['Z','+00:00','+23:59','+24:60']},
  //spec:  {field: 'TZD', unit: '', values: ['Z','+00:00','+23:59','false']}
  },

  {user: {field: 'M_D_YYYY', unit: '', values: ['1/1/1970','1/3/1995','12/31/2001','2001']},
  spec:  {field: 'YYYY',     unit: '', values: ['1970','1995','2001','false']},
  round:  {field: '',         unit: '', values: ['n/a','n/a','n/a']}
  },

  {user: {field: 'M_D_YYYY', unit: '', values: ['1/1/1970','1/3/1995','12/31/2001','']},
  spec:  {field: 'D_M_YYYY', unit: '', values: ['1/1/1970','3/1/1995','31/12/2001','']}
  },

  {user: {field: 'D_M_YYYY',  unit: '', values: ['1/1/1970','3/1/1995', '31/12/2001','']},
  spec:  {field: 'unix_date', unit: '', values: ['0',       '789091200','1009756800','']}
  },
  
  {user: {field: 'M_D_YYYY',  unit: '', values: ['1/1/1970','1/3/1995', '12/31/2001','']},
  spec:  {field: 'unix_date', unit: '', values: ['0',       '789091200','1009756800','']}
  },

  {user: {field: 'date_iso_8601', unit: '', values: ['1970-01-01','1995-01-03','2001-12-31','']},
  spec:  {field: 'unix_date',     unit: '', values: ['0',         '789091200', '1009756800','']}
  },
  
  {user: {field: 'unix_date', unit: '', values: ['0', '789091200','1009756801','']}, //note extra second
  spec:  {field: 'datetime_iso_8601', unit: '', values: ['1970-01-01T00:00:00.000Z','1995-01-03T00:00:00.000Z','2001-12-31T00:00:01.000Z','']}
  },

  {  user:  {field: 'datetime_iso_8601', unit: '', values: ['1970-01-01T00:00:00.000+00:00','1995-01-03T00:00:00.000+00:00', '2001-12-31T00:00:01.000+23:59', '2001-12-31T00:00:01.000+24:00']},
    spec: {field: 'unix_date', unit: '', values: ['0', '789091200','1009670461','false']}

  },

  {user: {field: 'boolean_10', unit: '', values: ['-1','0','1','2']},
  spec:  {field: 'y_n', unit: '', values: ['false','n','y','false']}
  },

  {user: {field: 'y_n', unit: '', values: ['0','n','y','2']},
  spec:  {field: 'yes_no', unit: '', values: ['false','no','yes','false']}
  },
]

