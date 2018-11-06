
resource = {}
focusEntityId = null
formSettings = {}
form = {}

//ONTOLOGY_LOOKUP_SERVICE_URL = 'https://www.ebi.ac.uk/ols/search?q='
ONTOLOGY_LOOKUP_SERVICE_URL = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function($) {

  OntologyForm.init_foundation_settings()

  api = new GeemAPI()

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
  $(window).on('hashchange', check_entity_id_change(render_standalone_form) );

  $(document).foundation()

  // Not sure why we don't need this
  //check_entity_id_change(render_standalone_form)

});



function render_standalone_form() {

  // No form callback currently needed
  top.form = new OntologyForm("#mainForm", top.resource, top.formSettings) 
  top.form.render_entity(top.focusEntityId, form_standalone_callback)
  render_section_menu()

  // Clear any previous specification menu selection.
  $('#specificationType')[0].selectedIndex = 0

  $('#buttonFormSubmit').on('click', function () {

    // VALIDATE!!!!!

    // Submit button on form triggers download of user's sample data entry.
    set_modal_download(get_data_specification('form_submission.json'))
  })

}

function form_standalone_callback(form){
  const entity = get_form_specification_component(form.entityId)
  $('#mainForm > div.field-wrapper > label')
    .attr('id','formEntityLabel')
    .after('<p>' + (entity.definition  || '') + '</p>') 
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
      var label = $(this).find('>.columns > label > span,>.columns > .row > label').text()
      sectionHTML += '<li class="depth'+ depth + '"><a href="#' + id + '">' + label + '</a></li>'
    }
  });

  if (sections > 1) {
    $('#formSections').html([
        '<h5>Form Sections</h5>\n'
      , '<ul class="vertical menu" id="formMenu">\n'
      , sectionHTML
      , '</ul>\n'
      ].join('')
    )
  }

}

