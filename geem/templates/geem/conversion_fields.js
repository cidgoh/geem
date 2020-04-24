
lang = {
  day: {// day of month
    D: {
      label: "day of month",
      parse: '(?<D>[1-9]|[12][0-9]|30|31)',
      map: [...Array(31).keys()].map(x => (x + 1).toString())
    },
    DD: {
      label: "day - 2 digit",
      parse: '(?<DD>0[1-9]|[12][0-9]|30|31)',
      map: ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31']
    }
    // case: 2.5 days?
  },
  weekday: { // day of week
    weekday_int: {
      label: "weekday - integer",
      parse: '(?<weekday_int>[1-7])',
      map: ['1','2','3','4','5','6','7']
    },
    weekday_abbr: {
      label: "weekday - abbr",
      parse: '(?<weekday_abbr>(mon|tue|wed|thu|fri|sat|sun))',
      map: ['mon','tue','wed','thu','fri','sat','sun']
    },
    weekday_word: {
      label: "weekday - word",
      parse: '(?<weekday_word>(monday|tuesday|wednesday|thursday|friday|saturday|sunday))',
      map: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    },
  },
  month: { // month of year
    M: {
      label: "month - integer",
      parse: '(?<M>[1-9]|10|11|12)',
      unit: 'UO:0000035',
      map: ['1','2','3','4','5','6','7','8','9','10','11','12']
    },
    MM: {
      label: "month - 2 digit",
      parse: '(?<MM>0[1-9]|10|11|12)',
      unit: 'UO:0000035',
      map: ['01','02','03','04','05','06','07','08','09','10','11','12']
    },
    month_abbr: {
      label: "month - abbr",
      parse: '(?<month_abbr>(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))',
      unit: 'UO:0000035',
      map: ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    },
    month_word : {
      label: "month - word",
      parse: '(?<month_word>(january|february|march|april|may|june|july|august|september|october|november|december))',
      unit: 'UO:0000035',
      map: ['january','february','march','april','may','june','july','august','september','october','november','december']
    }
  },
  year : { // Gregorian year
    YYYY: {
      label: 'year - 4 digit',
      parse: '(?<YYYY>\\d{4})',
      // Just two ways to synthesize this unambiguously.
      // We locate possibly compound products with the resultant field type.
      //synth: ['{YYYY}', '19{c19YY}', '20{c20YY}'],
      unit: 'UO:0000036',
      map: function (param){return map_integer(param, 0, 9999, true)}
    },
    // If historically we don't know what millenia this is in, and it doesn't matter for analysis, we can just "pass it through".  Synth dict should report non-deterministic mappings. 
    YY: {
      label: 'year - 2 digit',
      parse: '(?<YY>\\d\\d)',
      synth: {'{c19YY}':null, '{c20YY}':null},
      unit:'UO:0000036'
      //YY is ambiguous re. Gregorian calendar, so no mapping.
    },
    'c19YY': {
      label: '19yy',
      parse: '(?<c19YY>\\d\\d)',
      synth: {'{YY}':null},
      unit:'UO:0000036',
      map: function (param){return map_integer(param, 1900, 1999, true)}
    },
    'c20YY': {
      label: "20YY",
      parse: '(?<c20YY>\\d\\d)',
      synth: {'{YY}':null},
      unit:'UO:0000036',
      map: function (param){return map_integer(param, 2000, 2099, true)}
    }
  },
  hour: {
    hh: {
      label: 'hour - 24 hh',
      parse: '(?<hh>[01]\\d|20|21|22|23)',
      unit: 'UO:0000032',
      map: function (param){return map_integer(param, 0, 23, true)},
    },
    h: {
      label: 'hour - 24 h',
      parse: '(?<hh>[0-9]|1\\d|20|21|22|23)',
      unit: 'UO:0000032',
      map: function (param){return map_integer(param, 0, 23, true)},
    }
  },
  minute: {
    mm: {
      label: 'minute - mm',
      parse: '(?<mm>[0-5]\\d)',
      unit: 'UO:0000031',
      map: function (param){return map_integer(param, 0, 59, true)},
    }
  },
  second: {
    ss: {
      label: 'second - ss',
      parse: '(?<ss>[0-5]\\d)',
      unit: 'UO:0000010',
      map: function (param){return map_integer(param, 0, 59, true)},
    }
  },
  millisecond: {
    ms_int: {
      label: 'millisecond integer',
      synth: {'{int}':null},
      unit: 'UO:0000028', // millisecond
      map: function (param){return map_integer(param, 0, 999, true)},
    },
    ms: {
      label: 'millisecond as fraction',
      parse: '(?<ms>\\.\\d\\d\\d)',
      synth: {'{fraction}':null},
      unit: 'UO:0000010', // second
      map: function (param){return map_integer(param, 0, 999, true)},
    },
  },
  timezone: {
    TZD: {
      label: 'ISO TZD',
      parse: '(?<TZD>Z|(\\+|-)\\d\\d:\\d\\d)' // Z stands for UTC
    }
  },
  date: {
    unix_date: {
      label: 'date - unix',
      synth: ['{signed_int}'],
      map: function (param){return param}
    },
    date_iso_8601: {
      label: 'date (ISO 8601)',
      synth: {'{YYYY}-{MM}-{DD}':null},
      map: function(param, lookup) { 
        // unix time map -> ISO
        if (lookup) {
          let date = new Date();
          date.setTime(param);
          return date.toISOString().split('T')[0];
        }
        // ISO -> unix time map
        return String(Date.parse(param))
      }
    },
    datetime_iso_8601: { // Like above, but NO SPLIT ON T.
      label: 'datetime (ISO 8601)',
      synth: {'{YYYY}-{MM}-{DD}T{hh}:{mm}:{ss}{ms}{TZD}':null},
      map: function(param, lookup) {
        // unix time -> ISO Full date
        if (lookup) { 
          let date = new Date();
          date.setTime(param);
          return date.toISOString(); 
        }
        // ISO Full date -> unix time
        return String(Date.parse(param)) 
      }
    },
    M_D_YYYY: {
      label: 'M/D/YYYY (US format)',
      synth: {'{M}/{D}/{YYYY}':null},
      map: function(param, lookup) {return date_time_map(param, lookup, 'en-US')}
    },
    D_M_YYYY: {
      label: 'D/M/YYYY (GB format)',
      synth: {'{D}/{M}/{YYYY}':null},
      map: function(param, lookup) {return date_time_map(param, lookup, 'en-GB')}
    }
  },
  sign: {
    sign: {
      label: '+/-',
      parse: '(?<sign>-|\\+?)'
    }
  },
  integer: {
    int: {
      label: 'integer', // unsigned
      parse: '(?<int>(0|[1-9]\\d*))',
      // Special mapping function accomodates ANY integer range > 0.
      map: map_integer
    },
    signed_int: {
      label: 'integer - signed',
      synth: {'{sign}{int}':null},
      dict: {'sign':''}, // provides default component values
      // Map accepts negative range (not default which is 0 to infinity)
      map: function (param){return map_integer(param, null, null)}
    }
  },
  decimal: {
    decimal: {
      label: 'decimal',
      synth: {'{sign}{int}{fraction}':null},
      map: function (param){return param}
    }
  },
  fraction: {
    fraction: {
      label: 'fraction',
      parse: '(?<fraction>0?\.\\d+)'
      //map: function (param){return param}
    }
  }
  boolean: {
    boolean_10: {
      label: "boolean 1/0",
      parse: '(?<boolean_10>[01])',
      map: ['0','1']
    },
    y_n: {
      label: "boolean y/n",
      parse: '(?<y_n>[yn])',
      map: ['n','y']
    },
    yes_no: {
      label: "boolean yes/no",
      parse: '(?<yes_no>yes|no)',
      map: ['no','yes']
    }
  },
  metadata: {
    n_a: {
      label: "not applicable",
      parse: '(?<n_a>n\/a)'
    },
    missing: {
      label: 'missing',
      parse: '(?<missing>missing)'
    }
  }
}

function date_time_map(param, lookup, language) {
  // linux time -> US M/D/YYYY date
  if (lookup) {
    let date = new Date();
    date.setTime(param); // UTC? Not sure why it comes short a day
    return new Intl.DateTimeFormat(language).format(date)
  }
  // US M/D/YYYY date -> linux time
  let dict = param.match(lang.date.M_D_YYYY.parse).groups;
  let date = new Date(lang.date.M_D_YYYY.synth.supplant(dict)); 
  return String(date.getTime() / 1000);
}
