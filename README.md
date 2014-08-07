backbone-daybed
===============

Generic wrappers around Backbone-Forms for [Daybed](http://github.com/spiral-project/daybed).

Basically, it gives you :

* Some Backbone models for Daybed concepts
* A simple form *View* to create and edit Daybed model records
* A helper to embed a Daybed form with one line of code
* A basic list view (table) for Daybed records

Have a look at the [Demo](http://spiral-project.github.io/backbone-daybed/) !


Dependencies
------------

* [jQuery](http://jquery.com)
* [Underscore](http://underscorejs.org)
* [Backbone](http://backbonejs.org)
* [Backbone-Forms](https://github.com/powmedia/backbone-forms#readme)
* [Mustache](http://mustache.github.io/)


(very) Basic Example
--------------------

Load Javascript dependencies :

```html

    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.4.2/underscore-min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.0.0/backbone-min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/backbone-forms/0.12.0/backbone-forms.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/mustache.js/0.7.0/mustache.min.js"></script>

    <script type="text/javascript" src="libs/daybed.js"></script>
    <script type="text/javascript" src="libs/hawk.js"></script>

    <script type="text/javascript" src="backbone-daybed.js"></script>

    <div id="form-holder"></div>
```

Initalize form in ``<div>`` container :

```javascript

    Daybed.SETTINGS.SERVER = "http://daybed.lolnet.org";  // no trailing slash
    Daybed.SETTINGS.credentials = {  // Existing token 
        id: "tokenId",               // (optional if not set
        key: "tokenKey",             // it will create a new one)
        algorithm: "sha256"
    };

    var form = Daybed.renderForm('#form-holder', {id: 'your-model-id'});

    form.on('created', function (record) {
        $("#form-holder").html(record.id + " was saved succesfully.");
    })

```


API
---


###Daybed.Definition

Daybed model definition.

```js

Daybed.getOrCreateToken(Daybed.SETTINGS.SERVER, {
    id: sessionStorage.DaybedMapTokenId,
    key: sessionStorage.DaybedMapTokenKey,
    algorithm: "sha256"
}).then(function(credentials) {
    sessionStorage.geDaybedMapTokenId = credentials.id;
    sessionStorage.DaybedMapTokenKey = credentials.key;

    var session = new Daybed.Session(Daybed.SETTINGS.SERVER, credentials);

    var definition = new Daybed.Definition({session:session, id: 'gnah'});

    definition.fetch();

    definition.whenReady(function () {
        console.log(JSON.stringify(definition.attributes));
    });
});
```

####Methods

- **`whenReady(function)`**

  Callback function when Definition is ready (i.e. fetched from the server).

- **`fieldsNames()`**

  Returns list of fields names (`Array<String>`).

- **`itemSchema()`**

  Returns the *Backbone-Forms* schema for editing and saving records for this
  model.


###Daybed.ItemList

Retrieve data item of Daybed model

```js
var definition = new Daybed.Definition({id: 'gnah'}),
    collection = new Daybed.ItemList(definition);

definition.fetch();
collection.fetch();  // (will wait if necessary)
```

###Daybed.TableView

Shows Daybed records in a table.

Uses Definition fields names for table headers.

```js

var collection = new Daybed.ItemList(definition),
    tableView = new Daybed.TableView(collection);

definition.whenReady(function () {
    $("#container").html(tableView.render().$el);
});
definition.fetch();
```

###Daybed.FormView

A form for creating and editing Daybed records.

```js
var formView = new Daybed.FormView({definition: definition});

definition.whenReady(function () {
    $("#panel").html(formView.render().$el);
});
definition.fetch();

formView.on('created saved', function () {
    window.alert('Done !');
});
```

####Options

TODO

####Methods

TODO


TODO
----

* Build bundle with dependencies (using [grunt.js](http://gruntjs.com/), [anvil.js](http://anviljs.com/))
* File fields