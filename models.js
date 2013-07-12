var MapItem = Item.extend({
    /**
     * Returns instance layer, if its model has a geometry field.
     * It basically builds a Leaflet layer, from the coordinates values
     * stored in daybed record.
     * @returns {L.Layer}
     */
    getLayer: function () {
        if (!this.layer) {
            var geomfield = this.definition.geomField();
            if (!geomfield) return;

            var factories = {
                'point': function (coords) {return L.circleMarker([coords[1], coords[0]]);},
                'line': function (coords) {return L.polyline(L.GeoJSON.coordsToLatLngs(coords));},
                'polygon': function (coords) {return L.polygon(L.GeoJSON.coordsToLatLngs(coords[0]));}
            };

            var coords = this.get(geomfield.name);
            if (typeof coords === 'string') {
                coords = JSON.parse(coords);
            }
            this.layer = factories[geomfield.type](coords);
        }
        return this.layer;
    },

    /**
     * Sets record geometry field from a Leaflet layer.
     * @param {L.Layer} layer
     */
    setLayer: function (layer) {
        var geomfield = this.definition.geomField();
        if (!geomfield) return;

        var coords = layer.toGeoJSON().geometry.coordinates,
            attrs = {};
        attrs[geomfield.name] = JSON.stringify(coords);
        this.set(attrs);
    }
});


var MapItemList = ItemList.extend({
    model: MapItem
});


var MapModel = Definition.extend({
    metaTypes: {
        'text': 'string',
        'color': 'string',
        'icon': 'string'
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
        $(this.attributes.fields).each(L.Util.bind(function (i, field) {
            var meta = this.metaTypes[field.type];
            if (meta) {
                field.meta = field.type;
                field.type = meta;
            }
        }, this));
        Definition.prototype.save.apply(this, arguments);
    },

    itemSchema: function () {
        var fieldMapping = {
            'text': function () {
                return { type: 'TextArea' };
            },
            'color': function () {
                return { type: 'Select', options: [
                    'red', 'blue', 'orange', 'green', 'purple',
                    'darkred', 'darkgreen', 'darkblue', 'darkpurple', 'cadetblue'
                ] };
            },
            'icon':  function () {
                return { type: 'Select', options: [
                    {group: 'Location',
                     options: ['home', 'music', 'medkit', 'camera-retro',
                               'info-sign', 'plane', 'shopping-cart']},
                    {group: 'Food & Drink',
                     options: ['food', 'glass', 'coffee']},
                    {group: 'Symbols',
                     options: ['flag', 'star', 'suitcase', 'comments']}
                ] }; }
        };
        var schema = Definition.prototype.itemSchema.call(this);
        $(this.attributes.fields).each(function (i, field) {
            if (field.meta) {
                var build = fieldMapping[field.meta];
                if (build)
                    schema[field.name] = build(field);
            }
        });
        return schema;
    },

    /**
     * Override Defintion.mainFields() to remove color and icon (metaTypes)
     * from list, except if the model has no geometry field.
     */
    mainFields: function () {
        var mainFields = Definition.prototype.mainFields.call(this);
        if (!this.geomField())
            return mainFields;
        return _.filter(mainFields, function (f) {
            return f.meta === undefined;
        });
    },

    _getField: function (metatype) {
        return _.filter(this.attributes.fields,
                        function(f) { return f.meta == metatype; })[0];
    },

    colorField: function () {
        return this._getField('color');
    },

    iconField: function () {
        return this._getField('icon');
    }
});
