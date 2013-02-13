var Item = Backbone.Model.extend({

    defaults: function() {
        return {
            mushroom: "Unknown",
            area: [0.0, 0.0]
        };
    },

    initialize: function() {
        if (!this.get("mushroom")) {
            this.set({"mushroom": this.defaults.mushroom});
        }
    },

    geometry: function () {
        var area = JSON.parse(this.get('area'));
        return L.circleMarker([area[1], area[0]], {fillColor: 'green'})
                .bindPopup(this.get('mushroom'));
    }
});


var ItemList = Backbone.Collection.extend({
    model: Item,

    initialize: function (definition) {
        this.modelname = definition.id;
    },

    url: function () {
        return URI.build({hostname:settings.SERVER, path: '/data/' + this.modelname});
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
    }
});