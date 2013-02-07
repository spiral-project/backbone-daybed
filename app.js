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

	initialize: function (modelname) {
		this.modelname = modelname;
	},

	url: function () {
		return URI.build({hostname:settings.SERVER, path: '/data/' + this.modelname});
    },

    parse: function(response) {
        return response.data;
    },
});


var ItemRow = Backbone.View.extend({

    tagName: "li",
    template: Mustache.compile('{{ mushroom }}'),

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});


var AddView = Backbone.View.extend({

    tagName: "div",
    template: Mustache.compile('<form><input name="mushroom" type="text" placeholder="Mushroom"/><span id="map-help">Click on map</span><textarea name="area" style="display:none"></textarea><a href="#" id="clear">Cancel</a><button type="submit">Save</button></form>'),
    templateError: Mustache.compile('<span class="field-error">{{ msg }}</span>'),

    events: {
        "submit form": "formSubmitted",
        "click #clear": "formCancelled",
    },

    initialize: function (map, collection) {
        this.map = map;
        this.collection = collection;
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
        this.collection.create(data, {
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
        try {
			var descriptions = JSON.parse(xhr.responseText),
				self = this;
			$(descriptions.errors).each(function (i, e) {
				self.$el.find("[name='" + e.name + "']")
					.after(self.templateError({msg: e.description}));
			});
		}
		catch (e) {
			this.$el.html(this.templateError({msg: xhr.responseText}));
		}
    },
});


var DefinitionCreate = Backbone.View.extend({
	template: Mustache.compile('<h2>Create model "{{ modelname }}"</h2><form><textarea>{"title":"mushroomspots","description":"mushroom spots", "fields": [{"name":"mushroom","type":"string","description":"what"},{"name":"area","type":"point","description":"where"}]}</textarea><button id="create">Create</button></form>'),

    events: {
        "click button#create": "formSubmitted",
    },

	initialize: function (modelname) {
		this.modelname = modelname;
	},

    render: function () {
		this.$el.html(this.template({modelname: this.modelname}));
        this.delegateEvents();
        return this;
    },

    formSubmitted: function(e) {
        e.preventDefault();
        var definition = this.$el.find('textarea').val();
        $.ajax({
		  type: "PUT",
		  url: URI.build({hostname:settings.SERVER, path: 'definitions/' + this.modelname}),
		  data: definition,
		  contentType: 'application/json',
		  dataType: 'json',
		  success: this.success.bind(this),
		});
        return false;
    },

	success: function () {
		app.navigate(this.modelname + '/list', {trigger:true});
	},
});


var ListView = Backbone.View.extend({
	template: Mustache.compile('<h1>{{ modelname }}</h1><div id="toolbar"><a href="#{{ modelname }}/add">Add</a></div>' + 
	                           '<div id="list"></div><div id="footer">{{ count }} items.</div>'),

    initialize: function (map, collection) {
		this.map = map;
		this.collection = collection;

        collection.bind('add', this.addOne, this);
        collection.bind('reset', this.addAll, this);
    },

    render: function () {
		var count = this.collection.length;
        this.$el.html(this.template({modelname: this.collection.modelname, count:count}));
        return this;
    },

    addOne: function (spot) {
        var view = new ItemRow({model: spot});
        this.$('#list').append(view.render().el);
        var geom = spot.geometry();
        geom.addTo(this.map);
        this.bounds.extend(geom.getLatLng());
    },

    addAll: function () {
		this.render();
		this.bounds = new L.LatLngBounds();
        this.collection.each(this.addOne.bind(this));
        if (this.bounds.isValid()) this.map.fitBounds(this.bounds);
    }
});


var DaybedMapApp = Backbone.Router.extend({

	routes: {
		":modelname/create":   "create",
		":modelname/list":     "list",
		":modelname/add":      "add",
	},

	initialize: function () {
		this.collection = null;
		
        this.map = L.map('map').setView([0, 0], 3);
        this.map.attributionControl.setPrefix(''); 
        L.tileLayer('http://{s}.tiles.mapbox.com//v3/leplatrem.map-3jyuq4he/{z}/{x}/{y}.png').addTo(this.map);
	},

	create: function(modelname) {
		$("#content").html(new DefinitionCreate(modelname).render().el);
	},

	list: function(modelname) {
		if (!this.collection || this.collection.modelname != modelname) {
			this.collection = new ItemList(modelname);
			var createIfMissing = function (model, xhr) {
				if (xhr.status == 404) {
					app.navigate(modelname + '/create', {trigger:true});
				}
			};
			this.collection.bind('error', createIfMissing, this);
		}
		$("#content").html(new ListView(this.map, this.collection).render().el);
		this.collection.fetch();
	},

	add: function(modelname) {
		if (!this.collection|| this.collection.modelname != modelname)
			this.list(modelname);
		$("#content #list").prepend(new AddView(this.map, this.collection).render().el);
	}
});
