/**
 * Default settings
 */
window.settings = window.settings || {
    SERVER: "localhost:8000",
    TILES: "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};

/** Until the 42 issues and pull requests are fixed in Leaflet core */
L.extend(L.GeoJSON, {
    latLngsToCoords: function (layer) {
        var coords = function coords (latlng) {
            return [latlng.lng, latlng.lat];
        };
        if (layer.getLatLng) {
            return coords(layer.getLatLng());
        }
        else if (layer instanceof L.Polygon) {
            // A polygon can theorically have holes, thus list of rings.
            return [_.map(layer.getLatLngs(), function (latlng) {
                return coords(latlng);
            })];
        }
        else if (layer instanceof L.Polyline) {
            return _.map(layer.getLatLngs(), function (latlng) {return coords(latlng);});
        }
        else throw "Could not export layer coordinates";
    },
});


var Item = Backbone.Model.extend({
    popup: function () {
        var tpl = this.definition.templatePopup();
        return tpl(this.toJSON());
    },

    getLayer: function () {
        if (!this.layer) {
            var geomfield = this.definition.geomField();
            if (!geomfield) return;
            
            var factories = {
                'point': function (coords) {return L.circleMarker([coords[1], coords[0]]);},
                'line': function (coords) {return L.polyline(L.GeoJSON.coordsToLatLngs(coords));},
                'polygon': function (coords) {return L.polygon(L.GeoJSON.coordsToLatLngs(coords[0]));},
            };

            var coords = this.get(geomfield.name);
            if (typeof coords === 'string') {
                coords = JSON.parse(coords);
            }
            this.layer = factories[geomfield.type](coords);
        }
        return this.layer;
    },

    setLayer: function (layer) {
        var geomfield = this.definition.geomField();
        if (!geomfield) return;

        var coords = L.GeoJSON.latLngsToCoords(layer)
          , attrs = {};
        attrs[geomfield.name] = JSON.stringify(coords);
        this.set(attrs);
    },
});


var ItemList = Backbone.Collection.extend({
    model: Item,

    initialize: function (definition) {
        this.definition = definition;
    },

    url: function () {
        return URI.build({hostname:settings.SERVER, path: '/data/' + this.definition.id});
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
    },
});


var Definition = Backbone.Model.extend({
    url: function () {
        return URI.build({hostname:settings.SERVER, path: 'definitions/' + this.id});
    },

    schema: {
        id:  { type: 'Hidden', title: '' },
        title: 'Text',
        description: 'Text',
        fields: { type: 'List', itemType: 'Object', subSchema: {
            name: { validators: ['required'] },
            description: { validators: ['required'] },
            type: { type: 'Select', options: ['int', 'string', 'decimal', 'boolean',
                                              'email', 'url', 'point', 'line', 'polygon'] }
        }}
    },

    isReady: function () {
        return this.attributes.fields && this.attributes.fields.length > 0;
    },

    whenReady: function (cb) {
        if (this.isReady())
            cb();
        else {
            this.once('change', function () {
                this.whenReady(cb);
            }, this);
        }
    },

    itemSchema: function () {
        if (!this.isReady())
            throw "Definition is not ready. Fetch it first.";
        var typeMapping = {
            'int': 'Number',
            'string': 'Text',
            'boolean': 'Checkbox'
        }
        var geom = function (f) {
            return {type: 'TextArea', 
                    editorAttrs: {style: 'display: none'},
                    help: f.description + ' <span>(on map)</span>'};
        };
        var fieldMapping = {
            'default': function (f) {
                var d = {help: f.description}
                  , t = typeMapping[f.type];
                if (t) d.type = t;
                return d;
            },
            'decimal': function (f) {
                var d = fieldMapping['default'](field);
                d.editorAttrs = {pattern: '[-+]?[0-9]*\.?[0-9]+'};
                return d;
            },
            'email': function (f) {
                var d = fieldMapping['default'](field);
                d.validators = ['required', 'email'];
                return d;
            },
            'url': function (f) {
                var d = fieldMapping['default'](field);
                d.validators = ['required', 'url'];
                return d;
            },
            'point': geom,
            'line': geom,
            'polygon': geom,
        };
        var schema = {};
        // Add Backbone.Forms fields from Daybed definition
        $(this.attributes.fields).each(function (i, field) {
            var defaultschema = fieldMapping['default']
              , build = fieldMapping[field.type] || defaultschema;
            schema[field.name] = build(field);
        });
        return schema;
    },

    mainFields: function () {
        var geomField = this.geomField();
        if (!geomField)
            return this.attributes.fields;
        return this.attributes.fields.filter(function (f) {
            return f.name != geomField.name;
        });
    },

    /**
     * Returns the first field whose type is Geometry.
     */
    geomField: function () {
        for (i in this.attributes.fields) {
            var f = this.attributes.fields[i];
            if (f.type == 'point' || f.type == 'line' || f.type == 'polygon')
                return f;
        }
        return null;
    },

    templatePopup: function () {
        var c = '<div>';
        $(this.mainFields()).each(function (i, f) {
            c += '<li title="' + f.description + '"><strong>' + f.name + '</strong>: {{ ' + f.name + ' }}</li>';
        });
        c += '</div>';
        return Mustache.compile(c);
    },

    tableContent: function () {
        var tpl = '<table class="table"><thead>' +
                  '{{#fields}}<th><span title="{{description}}">{{name}}</span></th>{{/fields}}'+
                  '</thead><tbody></tbody></table>';
        return Mustache.compile(tpl)({fields: this.mainFields()});
    },

    templateRow: function () {
        var c = '<tr data-id="{{ id }}">';
        $(this.mainFields()).each(function (i, f) {
            c += '<td>{{ ' + f.name + ' }}</td>'
        });
        c += '</tr>';
        return Mustache.compile(c);
    },
});


var FormView = Backbone.View.extend({
    model: null,
    tagName: "div",
    className: "well",

    template: Mustache.compile('<h2>{{ title }}</h2>' +
                               '<div id="form"></div>' +
                               '<a id="cancel" class="btn">Cancel</a> ' +
                               '<a id="submit" class="btn btn-success">Save</a>'),
    templateError: Mustache.compile('<span class="field-error">{{ msg }}</span>'),

    events: {
        "click #submit": "submit",
        "click #cancel": "cancel",
    },

    initialize: function () {
        this.instance = new this.model({});
        if (!this.instance.schema && this.options.definition) {
            this.instance.definition = this.options.definition;
            this.instance.schema = this.options.definition.itemSchema();
        }
        this.form = new Backbone.Form({
            model: this.instance
        });
    },

    render: function () {
        this.$el.html(this.template(this));
        this.$('#form').html(this.form.render().el);
        this.delegateEvents();
        this.instance.on('change', this.refresh.bind(this));
        this.instance.on('sync', this.success.bind(this));
        this.instance.on('error', this.showErrors.bind(this));
        this.instance.trigger('change');
        return this;
    },

    cancel: function (e) {
        e.preventDefault();
        return false;
    },

    submit: function(e) {
        e.preventDefault();
        this.$el.find('.field-error').remove();
        this.form.commit();
        return false;
    },

    success: function (model, response, options) {
        return false;
    },

    showErrors: function (model, xhr, options) {
        try {
            var descriptions = JSON.parse(xhr.responseText);
            $(descriptions.errors).each(L.Util.bind(function (i, e) {
                var name = e.name.split('.')[0];
                this.$el.find("[name='" + name + "']")
                    .after(this.templateError({msg: e.description}));
            }, this));
        }
        catch (e) {
            this.$el.html(this.templateError({msg: xhr.responseText}));
        }
    },

    /**
     * Refresh field values from instance attributes.
     */
    refresh: function () {
        for (f in this.instance.changed) {
            if (f == 'id') continue;
            var formfield = this.$('[name='+ f + ']');
            if (formfield.length == 0)
                console.warn("Could not find form field '" + f + "'");
            formfield.val(this.instance.get(f));
        }
    }
});
