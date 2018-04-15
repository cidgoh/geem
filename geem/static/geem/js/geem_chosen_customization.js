/* This modification enables a search to be conducted on both an 
<option>[textual label]</option> 
AND on
<option synonyms="any synonym text for this item">[textual label]</option>
The secondary search kicks in on 3rd character typed.

See: https://github.com/harvesthq/chosen/issues/2928

I went and hacked a solution directly into chosen.jquery.min.js . If you are wondering why - its because I'm not really familiar with the chosen development environment. So here is the code as proof of concept... beginning and ending lines are snip points in chosen.jquery.min.js . Basically it takes a look at original select to see if it has a synonym attribute, and if so, searches that if user has typed more than 3 characters in. If there's a match, it includes synonym text into viewed option, in italics. Existing chosen code then goes and inserts <em> around search hit in string - which will highlight hit in synonym text if it wasn't found in original content. Does the trick for what I need.

*/
c.search_text=c.group?c.label:c.html,

	//c.search_text2=c.group?c.label:(c.html + (synonymEl==null?'':' ('+synonymEl.value+')')),
	(!c.group||this.group_search)&&(
		c.search_match=this.search_string_match(c.search_text,d),

        synonymEl=this.form_field[c.options_index].attributes.getNamedItem('synonyms'),
        synonymEl=synonymEl?synonymEl:false,

        search_synonyms=(synonymEl)?this.search_string_match(synonymEl.value, d):false,
        (search_synonyms&&g.length>2)&&(c.search_match=true),
		(c.search_match||search_synonyms)&&!c.group&&(e+=1),

		(c.search_match||search_synonyms)?(
			(c.classes=c.classes.replace('depthReset','')),
			g.length&&(
				c.search_text += (search_synonyms&&g.length>1)?' <i>(' + synonymEl.value + ')</i>':'',
				(g.length>0&&c.classes.indexOf('depthReset')==-1)&&(c.classes += ' depthReset'),
				h=c.search_text.search(b),
				i=c.search_text.substr(0,h+g.length)+"</em>"+c.search_text.substr(h+g.length),
				c.search_text=i.substr(0,h)+"<em>"+i.substr(h)),

				null!=f&&(f.group_match=!0)):null!=c.group_array_index&&this.results_data[c.group_array_index].search_match&&(c.search_match=!0)
...

	);return this.result_clear_highlight(),1>e&&g.length?(