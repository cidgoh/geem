
function GeemAPI() {

	//this.init = function() {}

	this.get_resources = function() {
		/* 
			Retrieves available resources for logged-in or public user to browse.
		*/

		// DUMMY DATA
		return	[
			{type:'ontology', name:'Genomic Epidemiology Ontology', path:"data/ontology/genepio-merged.json"},
			{type:'ontology', name:'Food Ontology (FoodOn)', path:'data/ontology/foodon-merged.json'},
			{type:'shared', name:'Demo Epi Form', path:'data/shared_packages/test.epi.json'},
			{type:'private', name:'New Demo Package', path:'data/private_packages/new_2018-04-16.json'}
		]	
	}

	this.get_resource = function(path) {

	}

	this.get_new_resource = function() {
		/* 
			Retrieves new private package record for logged-in user.
		*/

		var today = new Date();
		today = today.toISOString().substring(0, 10);

		// DUMMY DATA / TEMPLATE
		return {
			title:			'New private specification package',
			date:			today,
			type:			'private',
			status:			'draft',
			resource: 		'',  // General link to resource separate from version IRI??
			description:	'',
			prefix:			'',
			versionIRI:		'data/private_packages/[your acct id]/package_[id]_'+today+'.json',
			license:		''
		}

	}


}