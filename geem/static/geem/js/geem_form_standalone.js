
resource = {}
focusEntityId = null
formSettings = {}
form = {}

//ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='
ontologyLookupService = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function() {

  OntologyForm.initFoundation()

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
  $(window).on('hashchange', checkForHashEntity);

  $('#modalEntity').foundation()
  $('#rightbar').foundation()

  checkForHashEntity()

});


function loadResource(resource_URL) { //, resource_type
  $.ajax({
    type: 'GET',
    url: resource_URL,
    timeout: 30000, //30 sec timeout
    success: function(resource) {

      top.resource = resource;

      // loadResource() triggered if hash entity id detected 
      // but no top.resource loaded. 
      checkForHashEntity()
    },
    error:function(XMLHttpRequest, textStatus, errorThrown) {
      alert('Given resource could not be found: \n\n\t' + resource_URL) 
    }
  });
}

function checkForHashEntity() {

 if (location.hash.length > 0 && location.hash.indexOf(':') != -1) { 
    top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]

    // Returns if loading resource or if no appropriate resource found
    if (!checkEntityResource(top.focusEntityId) ) return

    loadForm()

  }

}

function loadForm() {

  top.form = new OntologyForm("#mainForm", top.resource, top.formSettings)

  top.form.renderEntity(top.focusEntityId)
  doSectionMenu()

  // Deselect specification menu.
  $('#specificationType')[0].selectedIndex = 0

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

