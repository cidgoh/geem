
specification = {}
focusEntityId = null
formSettings = {}
//ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='
ontologyLookupService = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function() {

  //OntologyForm.initFoundation()

  // Bring in shared templates
  $.ajax('modal_lookup.html').done(function(response){$('body').append(response)});

  $('#modalEntity').foundation()

  $('#specificationType').on('change', function() {
    setModalDownload(getdataSpecification( $(this).val() )) 
  }) 

  // GEEM focuses on entities by way of a URL with hash #[entityId]
  // A change in browser URL #[ontologyID] will load new form
  $(window).on('hashchange', function(){ 

    if (location.hash.length > 0)
      if (location.hash.indexOf(':') != -1) { 
        focusEntityId = document.location.hash.substr(1)
        // NEED LOOKUP TABLE OR FUNCTION TO IDENTIFY WHICH ONTOLOGY SPEC FILE
        // TO LOAD !!!
        myForm.renderEntity(focusEntityId)
        doSectionMenu()
      }
  });

  //Default load of GenEpiO
  loadSpecification('data/ontology/genepio-merged.json')

});


function loadSpecification(specification_file) {
  $.getJSON(specification_file, function(specification) {
    // Setup Zurb Foundation user interface and form validation
    loadForm(specification)
  });
}

function loadForm(specification) {

  top.specification = specification['specifications'];

  myForm = new OntologyForm("#mainForm", specification['specifications'], top.formSettings)

  // PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
  var focusEntityId = document.location.hash.substr(1).split('/',1)[0]
  top.focusEntityId = focusEntityId
  if (focusEntityId && focusEntityId.indexOf(':')) {
    myForm.renderEntity(focusEntityId)
    doSectionMenu()
  }

  // Toggle to hide all optional empty input content for concise display.
  $('input#toggleMinimalForm').on('change', function() {
    myForm.settings.minimalForm = $(this).is(':checked')
    myForm.renderEntity()
  })

  $('#buttonFormSubmit').on('click', function () {      
    setModalDownload(getdataSpecification('form_submission.json'))
  })

}


function doSectionMenu() {
  // Provide form menu to two levels down.
  $('#formSections').empty()
  var sections = 0
  var sectionHTML = ''
  $('#mainForm .field-wrapper.model').each(function(index){
    sections += 1;
    var classes = $(this).attr('class')
    var depth = classes.substr(classes.indexOf('depth')+5)
    if (parseInt(depth) < 2) {
      var id = $(this).attr('data-ontology-id')
      var label = $(this).children('label').text()
      sectionHTML += '<li class="depth'+ depth + '"><a href="#' + id + '">' + label + '</a></li>'
    }
  });

  if (sections > 1) {
    $('#formSections').html('<h5>Form Sections</h5>\n' + '<ul class="vertical menu" id="formMenu">' + sectionHTML + '</ul>')
  }

}

