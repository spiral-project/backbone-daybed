(function (Backbone, _, $, undefined) {
"use strict";

Backbone.$ = $;

window.Daybed = window.Daybed || {};

/**
 * Default settings
 */
Daybed.SETTINGS = {
    SERVER: "localhost:8000"
};

//
//  Item : a record
//
Daybed.Item = Backbone.Model.extend({
    url: function () {
        return URI.build({hostname: Daybed.SETTINGS.SERVER,
                          path: '/data/' + this.definition.id});
    },

    /**
     * Fields values
     */
    fieldsValues: function () {
        var columns = this.definition.fieldsNames(),
            fields = _.pick.apply(_, ([this.attributes]).concat(columns));
        return _.values(fields);
    }
});


Daybed.ItemList = Backbone.Collection.extend({
    model: Daybed.Item,

    initialize: function (definition) {
        this.definition = definition;
    },

    url: function () {
        return URI.build({hostname: Daybed.SETTINGS.SERVER,
                          path: '/data/' + this.definition.id});
    },

    parse: function (response) {
        return response.data;
    },

    /**
     * Fetch only once Definition is ready.
     */
    fetch: function () {
        var args = Array.prototype.slice.call(arguments);
        this.definition.whenReady((function () {
            Backbone.Collection.prototype.fetch.apply(this, args);
        }).bind(this));
    },

    /**
     * Override instanciation to link with Definition instance.
     */
    _prepareModel: function () {
        var m = Backbone.Collection.prototype._prepareModel.apply(this, arguments);
        m.definition = this.definition;
        return m;
    }
});


//
//  Definition : a model
//
Daybed.Definition = Backbone.Model.extend({
    /**
     * Backbone.forms schema for Definition forms
     */
    schema: {
        id:  { type: 'Hidden', title: '' },
        title: 'Text',
        description: 'Text',
        fields: { type: 'List', itemType: 'Object', subSchema: {
            name: { validators: ['required'] },
            description: 'Text',
            required: { type: 'Checkbox', editorAttrs: { 'checked' : 'checked' } },
            type: { type: 'Select', options: ['int', 'string', 'decimal', 'boolean',
                                              'email', 'url', 'point', 'line', 'polygon'] }
        }}
    },

    /**
     * Meta-types are fake types. Daybed does not know them.
     */
    metaTypes: {
        'text': 'string'
    },

    initialize: function () {
        // Add meta types to schema choice list
        var choices = this.schema.fields.subSchema.type.options;
        for (var metatype in this.metaTypes) {
            if (!_.contains(choices, metatype))
                choices.push(metatype);
        }
    },

    save: function () {
        // Substitute meta types by daybed types
        $(this.attributes.fields).each((function (i, field) {
            var meta = this.metaTypes[field.type];
            if (meta) {
                field.meta = field.type;
                field.type = meta;
            }
        }).bind(this));
        Backbone.Model.prototype.save.apply(this, arguments);
    },

    url: function () {
        return URI.build({hostname: Daybed.SETTINGS.SERVER,
                          path: 'definitions/' + this.id});
    },

    /**
     * @returns {boolean} True if *Definition* is initialized (fetched from server)
     */
    isReady: function () {
        return this.attributes.fields && this.attributes.fields.length > 0;
    },

    /**
     * Calls ``cb`` when *Definition* was fetched from server.
     * @param {function} cb
     */
    whenReady: function (cb) {
        if (this.isReady())
            cb();
        else {
            this.once('change', function () {
                this.whenReady(cb);
            }, this);
        }
    },

    /**
     * Fields names
     */
    fieldsNames: function () {
        return _.pluck(this.attributes.fields, 'name');
    },

    /**
     * Builds a Backbone.forms schema from the *Definition* record, 
     * for {Item} forms.
     * For each model field, add a Backbone.forms declaration.
     * @returns {Object}
     */
    itemSchema: function () {
        if (!this.isReady())
            throw "Definition is not ready. Fetch it first.";
        var typeMapping = {
            'int': 'Number',
            'string': 'Text',
            'boolean': 'Checkbox'
        };
        var fieldMapping = {
            'default': function (f) {
                var d = {help: f.description},
                    t = typeMapping[f.type];
                if (t) d.type = t;
                return d;
            },
            'text': function () {
                return { type: 'TextArea' };
            },
            'decimal': function (f) {
                var d = fieldMapping['default'](f);
                d.editorAttrs = {pattern: '[-+]?[0-9]*\\.?[0-9]+'};
                return d;
            },
            'email': function (f) {
                var d = fieldMapping['default'](f);
                d.validators = ['required', 'email'];
                return d;
            },
            'url': function (f) {
                var d = fieldMapping['default'](f);
                d.validators = ['required', 'url'];
                return d;
            }
        };
        var schema = {};
        // Backbone.Forms fields from this Daybed definition
        $(this.attributes.fields).each(function (i, field) {
            var build = fieldMapping[field.meta || field.type];
            schema[field.name] = (build ?
                                  build(field) : fieldMapping['default'](field));
        });
        return schema;
    }
});


//
// FormView : Generic Backbone form
//
Daybed.FormView = Backbone.View.extend({
    model: Daybed.Item,
    tagName: "div",
    className: "well",

    template: Mustache.compile('<h2>{{ title }}</h2>' +
                               '<div class="form"></div>' +
                               '<a class="btn cancel" href="#">Cancel</a> ' +
                               '<a class="btn submit btn-success" href="#">Save</a>'),
    templateError: Mustache.compile('<span class="field-error">{{ msg }}</span>'),

    events: {
        "click .submit": "submit",
        "click .cancel": "cancel"
    },

    initialize: function () {
        this.definition = this.options.definition || this.options.instance.definition;
        this.definition.whenReady(this.setup.bind(this));
    },

    setup: function (instance) {
        this.instance = instance || this.options.instance || new this.model({});
        this.instance.definition = this.instance.definition || this.definition;
        this.instance.schema = this.instance.schema || this.definition.itemSchema();

        this.instance.on('change', this.refresh.bind(this));
        this.instance.on('sync', this.success.bind(this));
        this.instance.on('error', this.error.bind(this));

        this.creation = this.instance.attributes.id === undefined;

        this.title = this.options.title ||
                     (this.creation ? "Create " : "Edit ") + this.definition.attributes.title;

        // Underlying backbone-forms object
        this.form = new Backbone.Form({
            model: this.instance
        });

        this.refresh();
    },

    render: function () {
        this.$el.html(this.template(this));
        this.$('.form').html(this.form.render().el);
        this.delegateEvents();
        return this;
    },

    cancel: function (e) {
        if (e) e.preventDefault();
        this.trigger('cancel');
        this.reset();
        return false;
    },

    reset: function () {
        this.$('form')[0].reset();
    },

    submit: function(e) {
        if (e) e.preventDefault();
        // Serialize form fields
        var data = this.form.getValue();
        this.trigger('submit', data);
        this.save();
        return false;
    },

    save: function () {
        // Hide previous validation errors (if any)
        this.$('.field-error').remove();
        // Store form data into instance, and save it
        this.form.commit();
        this.instance.save();
    },

    success: function (model, response, options) {
        this.trigger((this.creation ? 'created' : 'saved'), model);
        return false;
    },

    error: function (model, response, options) {
        var descriptions = [];
        try {
            descriptions = JSON.parse(response.responseText);
            this.showErrors(descriptions);
        }
        catch (e) {
            this.$el.html(this.templateError({msg: response.responseText}));
        }
        this.trigger('error', {model: model,
                               errors: descriptions});
        return false;
    },

    /**
     * Show each error along its field
     */
    showErrors: function (descriptions) {
        $(descriptions.errors).each((function (i, e) {
            var name = e.name.split('.')[0];
            this.$("[name='" + name + "']")
                .after(this.templateError({msg: e.description}));
        }).bind(this));
    },

    /**
     * Refresh field values from instance attributes.
     */
    refresh: function () {
        for (var f in this.instance.changed) {
            if (f == 'id') continue;
            var formfield = this.$("[name='"+ f + "']");
            if (formfield.length === 0)
                console.warn("Could not find form field '" + f + "'");
            formfield.val(this.instance.get(f));
        }
    }
});


/**
 * Form rendering helper
 */
Daybed.renderForm = function (selector, options) {
    var definition = new Daybed.Definition(options),
        formView = new Daybed.FormView({definition: definition});

    definition.whenReady(function () {
        $(selector).html(formView.render().el);
    });

    definition.fetch();
    return formView;
};


})(Backbone,  _, jQuery);