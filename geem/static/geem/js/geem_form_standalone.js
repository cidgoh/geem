
resource = {}
focusEntityId = null
formSettings = {}
form = {}

//ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='
ontologyLookupService = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function() {

  OntologyForm.init_foundation()

  // Bring in shared templates
  $.ajax('templates/modal_lookup.html').done(function(response) {
    $('body').append(response)
  });

  $('#specificationType').on('change', function() {
    set_modal_download(get_data_specification( $(this).val() )) 
  }) 

  // Toggle to hide all optional empty input content for concise display.
  $('input#toggleMinimalForm').on('change', function() {
    top.formSettings.minimalForm = $(this).is(':checked')
    top.form.render_entity()
  })

  // GEEM focuses on entities by way of a URL with hash #[entityId]
  // A change in browser URL #[ontologyID] will load new form
  $(window).on('hashchange', check_for_hash_entity);

  $('#modalEntity').foundation()
  $('#rightbar').foundation()

  check_for_hash_entity()

});


function load_resource(resource_URL) { //, resource_type
  $.ajax({
    type: 'GET',
    url: resource_URL,
    timeout: 30000, //30 sec timeout
    success: function(resource) {

      top.resource = resource;

      // load_resource() triggered if hash entity id detected 
      // but no top.resource loaded. 
      check_for_hash_entity()
    },
    error:function(XMLHttpRequest, textStatus, errorThrown) {
      alert('Given resource could not be found: \n\n\t' + resource_URL) 
    }
  });
}

function check_for_hash_entity() {

 if (location.hash.length > 0 && location.hash.indexOf(':') != -1) { 
    top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]

    // Returns if loading resource or if no appropriate resource found
    if (!check_entity_resource(top.focusEntityId) ) return

    loadForm()

  }

}

function loadForm() {

  top.form = new OntologyForm("#mainForm", top.resource, top.formSettings)

  top.form.render_entity(top.focusEntityId)
  render_section_menu()

  // Deselect specification menu.
  $('#specificationType')[0].selectedIndex = 0

  $('#buttonFormSubmit').on('click', function () {    
    set_modal_download(get_data_specification('form_submission.json'))
  })

}


function render_section_menu() {
  // Provide form menu that echoes form specification to two levels down of
  // model
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

