backbone-daybed
===============

Generic wrappers around Backbone-Forms for Daybed models


Dependencies
------------

* [Backbone](http://backbonejs.org)
* [Backbone-Forms](https://github.com/powmedia/backbone-forms#readme)
* [Mustache](http://mustache.github.io/)
* [URI.js](http://medialize.github.io/URI.js/)


(very) Basic Example
--------------------

Load Javascript dependencies :

```html

    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.4.2/underscore-min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.0.0/backbone-min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/backbone-forms/0.12.0/backbone-forms.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/mustache.js/0.7.0/mustache.min.js"></script>

   <div id="form-holder"></div>
```

Initalize form in ``<div>`` container :

```javascript

    Daybed.SETTINGS.SERVER = "localhost:8000";

    var form = Daybed.renderForm('#form-holder', {id: 'your-model-id'});

    form.on('success', function (record) {
        $("#form-holder").html(record.id + " was saved succesfully.");
    })

```


TODO
----

* Build bundle with dependencies (using [grunt.js](http://gruntjs.com/), [anvil.js](http://anviljs.com/))
