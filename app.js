var MushroomSpot = Backbone.Model.extend({

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

var MushroomSpotList = Backbone.Collection.extend({
    url: URI.build({hostname:settings.SERVER, path: '/data/mushroomspot'}),
    model: MushroomSpot,

    parse: function(response) {
        return response.data;
    },
});

var MushroomSpots = new MushroomSpotList;


var MushroomSpotRow = Backbone.View.extend({

    tagName: "li",
    template: Mustache.compile('{{ mushroom }}'),

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});


var MushroomSpotCreate = Backbone.View.extend({

    tagName: "div",
    template: Mustache.compile('<form><input name="mushroom" type="text" placeholder="Mushroom"/><span id="map-help">Click on map</span><textarea name="area" style="display:none"></textarea><a href="#" id="clear">Cancel</a><button type="submit">Save</button></form>'),
    templateError: Mustache.compile('<span class="field-error">{{ msg }}</span>'),

    events: {
        "submit form": "formSubmitted",
        "click #clear": "formCancelled",
    },

    initialize: function (map) {
        this.map = map;
        this.marker = null;
    },

    render: function () {
        this.$el.html(this.template({}));
        this.delegateEvents();
        this.map.on('click', this.onMapClick.bind(this));
        return this;
    },

    close: function (e) {
        if (this.marker) this.map.removeLayer(this.marker);
        this.map.off('click');
        this.remove();
        return false;
    },

    formCancelled: function (e) {
        e.preventDefault();
        this.close();
        return false;
    },

    formSubmitted: function(e) {
        e.preventDefault();
        this.$el.find('.field-error').remove();

        var data = Backbone.Syphon.serialize(this);
        MushroomSpots.create(data, {
            wait: true,
            error: this.showErrors.bind(this),
            success: this.success.bind(this),
        });
        return false;
    },

    onMapClick: function (e) {
        this.marker = L.marker(e.latlng).addTo(this.map);
        this.$el.find('#map-help').remove();
        var lnglat = [e.latlng.lng, e.latlng.lat];
        this.$el.find('[name=area]').val(JSON.stringify(lnglat));
    },

    success: function (model, response, options) {
        this.close();
    },

    showErrors: function (model, xhr, options) {
        var descriptions = JSON.parse(xhr.responseText),
            self = this;
        $(descriptions.errors).each(function (i, e) {
            self.$el.find("[name='" + e.name + "']")
                .after(self.templateError({msg: e.description}));
        });
    },
});


var DefinitionCreate = Backbone.View.extend({
	template: Mustache.compile('<h2>Create definition</h2><form><textarea>{"title":"mushroomspots","description":"mushroom spots", "fields": [{"name":"mushroom","type":"string","description":"what"},{"name":"area","type":"point","description":"where"}]}</textarea><button id="create">Create</button></form>'),

    events: {
        "click button#create": "formSubmitted",
    },

    render: function () {
		this.$el.html(this.template({}));
        this.delegateEvents();
        return this;
    },

    formSubmitted: function(e) {
        e.preventDefault();
        var definition = this.$el.find('textarea').val();
        $.ajax({
		  type: "PUT",
		  url: URI.build({hostname:settings.SERVER, path: '/definitions/mushroomspot'}),
		  data: definition,
		  contentType: 'application/json',
		  dataType: 'json',
		  success: this.success,
		});
        return false;
    },

	success: function () {
		window.location = '/';  // Use backbone routers :)
	},
});


var AppView = Backbone.View.extend({

    el: $('#content').parent(),
    statsTemplate: Mustache.compile('{{ count }} items.'),

    events: {
        "click #create": "createOne",
    },

    initialize: function () {
        this.map = L.map('map').setView([0, 0], 3);
        this.map.attributionControl.setPrefix(''); 
        L.tileLayer('http://{s}.tiles.mapbox.com//v3/leplatrem.map-3jyuq4he/{z}/{x}/{y}.png').addTo(this.map);
        this.bounds = new L.LatLngBounds();

        this.footer = $('#footer');
        this.createView = new MushroomSpotCreate(this.map);
        MushroomSpots.bind('add', this.addOne, this);
        MushroomSpots.bind('reset', this.addAll, this);
        MushroomSpots.bind('all', this.render, this);
        MushroomSpots.bind('error', this.handleError, this);
        MushroomSpots.fetch();
    },

    handleError: function(model, error) {
        if (error.status == 404) {
            this.$("#content").html(new DefinitionCreate().render().el);
        }
    },

    render: function () {
        var count = MushroomSpots.length;
        if (count > 0) {
            this.map.fitBounds(this.bounds);
            this.footer.show();
            this.footer.html(this.statsTemplate({count: count}));
        }
        else {
            this.footer.hide();
        }
        return this;
    },

    createOne: function(e) {
        this.$("#content").prepend(this.createView.render().el);
    },

    addOne: function (spot) {
        self = App; // WTF ?
        var view = new MushroomSpotRow({model: spot});
        this.$('#content').append(view.render().el);
        var geom = spot.geometry();
        geom.addTo(self.map);
        self.bounds.extend(geom.getLatLng());
    },

    addAll: function () {
        MushroomSpots.each(this.addOne);
    }
});
