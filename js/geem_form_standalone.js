
specification = {}
focusEntityId = null
formSettings = {}
form = {}

//ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='
ontologyLookupService = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function() {

  OntologyForm.initFoundation()

  //Default load of GenEpiO
  loadResource('data/ontology/genepio-merged.json')

  // Bring in shared templates
  $.ajax('templates/modal_lookup.html').done(function(response) {
    $('body').append(response)
  });

  $('#specificationType').on('change', function() {
    setModalDownload(getdataSpecification( $(this).val() )) 
  }) 

  // Toggle to hide all optional empty input content for concise display.
  $('input#toggleMinimalForm').on('change', function() {
    top.formSettings.minimalForm = $(this).is(':checked')
    top.form.renderEntity()
  })

  // GEEM focuses on entities by way of a URL with hash #[entityId]
  // A change in browser URL #[ontologyID] will load new form
  $(window).on('hashchange', loadForm);

  $('#modalEntity').foundation()
  $('#rightbar').foundation()
});


function loadResource(resource_file) {
  $.getJSON(resource_file, function(resource) {
    // Setup Zurb Foundation user interface and form validation
    top.resource = resource;

    loadForm() // tries to get entity id from URL.

  });
}

function loadForm() {

  top.form = new OntologyForm("#mainForm", top.resource, top.formSettings)

  // PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
  var focusEntityId = document.location.hash.substr(1).split('/',1)[0]
  top.focusEntityId = focusEntityId

  if (focusEntityId && focusEntityId.indexOf(':')) {
    top.form.renderEntity(focusEntityId)
    doSectionMenu()
  }

  // Deselect specification menu.
  $('#specificationType')[0].selectedIndex = 0
  //$('#dataSpecification').empty()

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

