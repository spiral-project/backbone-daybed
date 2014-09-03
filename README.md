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
    <script type="text/javascript" src="//cdn.rawgit.com/hueniverse/hawk/v2.2.3/lib/browser.js"></script>

    <script type="text/javascript" src="backbone-daybed.js"></script>

    <div id="form-holder"></div>
```

Setup *Daybed* server connection :

In this example, we use the location hash to read Hawk *id* and *key*. If not
set, connection will be anonymous.

```javascript

    Daybed.SETTINGS.SERVER = "https://daybed.lolnet.org/v1";  // no trailing slash

    var credentials = window.location.hash.slice(1).split(':');
    Daybed.SETTINGS.credentials = {
        id: credentials[0],
        key: credentials[1],
        algorithm: "sha256"
    };

```

Initalize form in ``<div>`` container :

```javascript

    Daybed.SETTINGS.SERVER = "https://daybed.lolnet.org/v1";  // no trailing slash
    Daybed.SETTINGS.credentials = {  // Existing token
        id: "tokenId",               // (optional if not set
        key: "tokenKey",             // it will connect anonymously)
        algorithm: "sha256"
    };

    var form = Daybed.renderForm('#form-holder', {id: 'your-model-id'});

    form.on('created', function (record) {
        $("#form-holder").html(record.id + " was saved succesfully.");
    })

```


API
---

####Methods

- **`whenReady(function)`**

  Callback function when Definition is ready (i.e. fetched from the server).

- **`fieldsNames()`**

  Returns list of fields names (`Array<String>`).

- **`recordSchema()`**

  Returns the *Backbone-Forms* schema for editing and saving records for this
  model.


###Daybed.RecordList

Retrieve all records of a Daybed model

```js
var definition = new Daybed.Definition({id: 'gnah'}),
    collection = new Daybed.RecordList(definition);

definition.fetch();
collection.fetch();  // (will wait if necessary)
```

###Daybed.TableView

Shows Daybed records in a table.

Uses Definition fields names for table headers.

```js

var collection = new Daybed.RecordList(definition),
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
