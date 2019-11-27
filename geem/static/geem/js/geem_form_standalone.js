
resource = {}
focusEntityId = null
formSettings = {}
form = {}

//ONTOLOGY_LOOKUP_SERVICE_URL = 'https://www.ebi.ac.uk/ols/search?q='
ONTOLOGY_LOOKUP_SERVICE_URL = 'http://purl.obolibrary.org/obo/'

$( document ).ready(function($) {

  OntologyForm.init_foundation_settings()

  $(document).foundation({abide : top.settings})

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
  // AS LONG AS #[ontologyID] contains a ":" - a very specific format
  // for now.
  //FOR SOME REASON $(window).bind(...) or $(window).on(...) don't work
  //$(window).on('hashchange', check_entity_id_change(null, render_standalone_form) );

  window.onhashchange = function() {check_entity_id_change(null, render_standalone_form)}
  // On first visit, if there's ALREADY a #ONTOLOGY:ID hash in URL then render that form.
  check_entity_id_change(null, render_standalone_form)

});



function render_standalone_form() {

  // No form callback currently needed
  top.form = new OntologyForm("#mainForm", top.resource, top.formSettings);
  top.form.render_entity(top.focusEntityId, form_standalone_callback);
  top.form.formDomId.bind('valid.fndtn.abide,formvalid.zf.abide', function (e) {
      // Valid form submit triggers display of user's sample data entry.
      set_modal_download(get_data_specification('form_submission.json'));
  });
  top.form.formDomId.bind('submit', function (e) {
      // Otherwise if URL is like form.html#ONTOLOGY:ID it will reload with a 
      // ? like "form.html?#ONTOLOGY:ID" thus shortcutting set_modal_download()
      return false;
  });

  render_section_menu();

  // Clear any previous specification menu selection.
  $('#specificationType')[0].selectedIndex = 0;

}

function form_standalone_callback(form){
  // Slip form definition into new leading paragraph
  const entity = get_form_specification_component(form.entityId);
  $('#mainForm > div.field-wrapper > label')
    .attr('id','formEntityLabel')
    .after('<p>' + (entity.definition  || '') + '</p>') 
}

function render_section_menu() {
  // Provide form menu that echoes form specification to two levels down of
  // model. If only one model, skips display since form title already relays
  // model title if it is a model.
  $('#formSections').empty()
  var sections = 0
  var sectionHTML = ''
  $('#mainForm .field-wrapper.model').each(function(index){
    sections += 1;
    var classes = $(this).attr('class')
    var depth = classes.substr(classes.indexOf('depth')+5)
    if (parseInt(depth) < 2) {
      var id = $(this).attr('data-ontology-id')

      var entity = top.resource.contents.specifications[id.split('/').pop()]
      var label = entity ? get_label(entity) : '(entity not found)' 
      sectionHTML += '<li class="depth'+ depth + '"><a href="#' + id + '">' + label + '</a></li>'

    }
  });

  // Only display if there is more than one model to display
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

