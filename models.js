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
