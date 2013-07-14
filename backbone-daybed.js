/**
 * Default settings
 */
window.DAYBED_SETTINGS = window.DAYBED_SETTINGS || {
    SERVER: "localhost:8000"
};

//
//  Item : a record
//
var Item = Backbone.Model.extend({
    url: function () {
        return URI.build({hostname: window.DAYBED_SETTINGS.SERVER,
                          path: '/data/' + this.definition.id});
    }
});


var ItemList = Backbone.Collection.extend({
    model: Item,

    initialize: function (definition) {
        this.definition = definition;
    },

    url: function () {
        return URI.build({hostname: window.DAYBED_SETTINGS.SERVER,
                          path: '/data/' + this.definition.id});
    },

    parse: function(response) {
        return response.data;
    },

    /**
     * Override instanciation to link with Definition instance.
     */
    _prepareModel: function() {
        var m = Backbone.Collection.prototype._prepareModel.apply(this, arguments);
        m.definition = this.definition;
        return m;
    }
});


//
//  Definition : a model
//
var Definition = Backbone.Model.extend({
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
        return URI.build({hostname: DAYBED_SETTINGS.SERVER,
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
var FormView = Backbone.View.extend({
    model: Item,
    tagName: "div",
    className: "well",
    title: "",

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
        this.instance = new this.model({});
        if (!this.instance.schema && this.options.definition) {
            this.instance.schema = this.options.definition.itemSchema();
            this.instance.definition = this.options.definition;
        }
        else {
            console.warn("No schema found. Provide Definition object.");
        }
        this.title = "Create " + this.instance.definition.attributes.title;

        // Underlying backbone-forms object
        this.form = new Backbone.Form({
            model: this.instance
        });
    },

    render: function () {
        this.$el.html(this.template(this));
        this.$('.form').html(this.form.render().el);
        this.delegateEvents();
        this.instance.on('change', this.refresh.bind(this));
        this.instance.on('sync', this.success.bind(this));
        this.instance.on('error', this.error.bind(this));
        this.instance.trigger('change');
        return this;
    },

    cancel: function (e) {
        e.preventDefault();
        return false;
    },

    submit: function(e) {
        e.preventDefault();
        // Hide previous validation errors (if any)
        this.$('.field-error').remove();
        // Serialize form fields
        var data = this.form.getValue();
        this.trigger('submit', data);
        // Store form data into instance, and save it
        this.form.commit();
        this.instance.save();
        return false;
    },

    success: function (model, response, options) {
        this.trigger('success', model);
        return false;
    },

    error: function (model, response, options) {
        try {
            this.showErrors(JSON.parse(response.responseText));
        }
        catch (e) {
            this.$el.html(this.templateError({msg: response.responseText}));
        }

        this.trigger('error', model);
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
