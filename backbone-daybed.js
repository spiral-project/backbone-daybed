var Item = Backbone.Model.extend({
    geometry: function () {
        var area = JSON.parse(this.get('area'));
        return L.circleMarker([area[1], area[0]], {fillColor: 'green'})
                .bindPopup(this.get('mushroom'));
    }
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
                                              'email', 'url', 'point'] }
        }}
    },

    itemSchema: function () {
        if (!this.attributes.fields)
            throw "Definition is not ready. Fetch it first.";
        var typeMapping = {
            'int': 'Number',
            'string': 'Text',
            'boolean': 'Checkbox'
        }
        var fieldMapping = {
            'default': function (f) {
                var d = {help: f.description}
                  , t = typeMapping[f.type];
                if (t) d.type = t;
                return d;
            },
            'decimal': function (f, d) {
                d.editorAttrs = {pattern: '[-+]?[0-9]*\.?[0-9]+'};
                return d;
            },
            'email': function (f, d) {
                d.validators = ['required', 'email'];
                return d;
            },
            'url': function (f, d) {
                d.validators = ['required', 'url'];
                return d;
            },
            'point': function (f) {
                return {type: 'TextArea', 
                        editorAttrs: {style: 'display: none'},
                        help: f.description + ' <span id="map-help">Click on map</span>'};
            },
        };
        var self = this
          , schema = {};
        $(this.attributes.fields).each(function (i, field) {
            var defaultschema = fieldMapping['default']
              , build = fieldMapping[field.type] || defaultschema;
            if (build) schema[field.name] = build(field, defaultschema(field));
        });
        return schema;
    }
});