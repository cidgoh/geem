/*
  {user: {field: '', unit: '', values: ['','','','']},
  spec:  {field: '', unit: '', values: ['','','','']}
  },
*/
// put "false" in a field if it shouldn't convert, i.e. it shouldn't even parse.
// good for testing beyond lower and upper bounds of a mappable thing.
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

  {user: {field: 'YYYY', unit: '', values: ['0','0000','1945','2020']},
  spec:  {field: 'c19YY', unit: '', values: ['false','0000','1945','2020']}
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


  {user: {field: 's_int', unit: '', values: ['0','1','59','60']},
  spec:  {field: 'ss', unit: '', values: ['00','01','59','false']}
  },

  {user: {field: 'm_int', unit: '', values: ['0','1','59','60']},
  spec:  {field: 'mm', unit: '', values: ['00','01','59','false']}
  },

  {user: {field: 'ms_int', unit: '', values: ['0','1','999','1000']},
  spec:  {field: 'ms', unit: '', values: ['.000','001','.999','false']}
  },

  {user: {field: 'TZD', unit: '', values: ['Z','+00:00','+23:59','+24:60']},
  spec:  {field: 'TZD', unit: '', values: ['Z','+00:00','+23:59','false']}
  },

  {user: {field: 'M_D_YYYY', unit: '', values: ['1/1/1970','1/3/1995','12/31/2001','']},
  spec:  {field: 'D_M_YYYY', unit: '', values: ['1/1/1970','3/1/1995','31/12/2001','']}
  },
  {user: {field: 'M_D_YYYY',  unit: '', values: ['1/1/1970','1/3/1995', '12/31/2001','']},
  spec:  {field: 'unix_date', unit: '', values: ['0',       '789091200','1009756800','']}
  },
  {user: {field: 'date_iso_8601', unit: '', values: ['1970-01-01','1995-01-03','2001-12-31','']},
  spec:  {field: 'unix_date',     unit: '', values: ['0',         '789091200', '1009756800','']}
  },
  {user: {field: 'unix_date', unit: '', values: ['0', '789091200','1009756801','']}, //note extra second
  spec:  {field: 'datetime_iso_8601', unit: '', values: ['1970-01-01T00:00:00.000Z','1995-01-03T00:00:00.000Z','2001-12-31T00:00:01+00:00','']}
  },

  {user: {field: 'boolean_10', unit: '', values: ['0','1','2','']},
  spec:  {field: 'y_n', unit: '', values: ['n','y','false','']}
  },

  {user: {field: 'y_n', unit: '', values: ['y','n','0','2']},
  spec:  {field: 'yes_no', unit: '', values: ['yes','no','false','false']}
  },
]

