function init() {

    //
    // By default, load todo model anonymously
    //
    Daybed.SETTINGS.SERVER = "https://daybed.lolnet.org/v1";

    var hash = window.location.hash.slice(1) || 'todo';
    window.location.hash = hash;

    var credentials = hash.split(':');
    var modelId = credentials[0];
    Daybed.SETTINGS.credentials = {
        id: credentials[1],
        key: credentials[2],
        algorithm: "sha256"
    };

    //
    // Instantiate Models and Views
    //
    var definition = new Daybed.Definition({id: modelId});
    var recordList = new Daybed.RecordList(definition);

    // Instantiate views
    var listView = new Daybed.TableView({collection: recordList});
    var formView = new Daybed.RecordFormView({definition: definition});

    // Wait for definition to be fetched from server
    // in order to populate form fields and list headers
    definition.whenReady(function () {
        $('#records-list').html(listView.render().el);
        $('#form-holder').html(formView.render().el);
    });

    // Fetch definition !
    definition.fetch();

    // Fetch records !
    recordList.fetch();

    //
    // Cable list and form events
    //
    // Rebuild the form with bound instance on edit.
    listView.on('edit', function (record, row) {
        $('tr.info').removeClass('info');
        row.$el.addClass('info');
        formView.setup(record);
        formView.render();
    });

    // On creation, add to the collection.
    formView.on('created', function (record) {
        recordList.add(record);
    });

    // After cancel or edition, empty the form.
    formView.on('cancel saved created', function () {
        formView.setup(null);
        formView.render();
        $('tr.info').removeClass('info');
    });
}

init();
window.onhashchange = init;
