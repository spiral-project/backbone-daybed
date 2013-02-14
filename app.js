var ItemRow = Backbone.View.extend({

    tagName: "li",
    template: Mustache.compile('{{ mushroom }}'),

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});


var FormView = Backbone.View.extend({
    templateError: Mustache.compile('<span class="field-error">{{ msg }}</span>'),

    events: {
        "click #submit": "submit",
        "click #cancel": "cancel",
    },

    render: function () {
        this.$el.html(this.template(this));
        this.delegateEvents();
        return this;
    },

    cancel: function (e) {
        e.preventDefault();
        return false;
    },

    submit: function(e) {
        e.preventDefault();
        this.$el.find('.field-error').remove();
        return false;
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

    success: function (model, response, options) {
        return false;
    },
});


var AddView = FormView.extend({

    tagName: "div",
    template: Mustache.compile('<a href="#" id="cancel">Cancel</a><button id="submit">Save</button>'),

    initialize: function (map, collection) {
        this.map = map;
        this.collection = collection;
        this.form = null;
        this.marker = null;
    },

    render: function () {
        FormView.prototype.render.apply(this, arguments);
        this.form = new Backbone.Form({
            schema: this.collection.definition.itemSchema()
        })
        this.$el.prepend(this.form.render().el);
        this.map.on('click', this.onMapClick.bind(this));
        return this;
    },

    close: function (e) {
        if (this.marker) this.map.removeLayer(this.marker);
        this.map.off('click');
        this.remove();
        return false;
    },

    cancel: function (e) {
        FormView.prototype.cancel.apply(this, arguments);
        this.close();
        return false;
    },

    submit: function(e) {
        var data = this.form.getValue();
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
        var lnglat = [e.latlng.lng, e.latlng.lat]
          , geomfield = this.collection.definition.geomField();
        this.$el.find('[name='+ geomfield + ']').val(JSON.stringify(lnglat));
    },

    success: function (model, response, options) {
        this.close();
    },
});


var DefinitionCreate = FormView.extend({
    template: Mustache.compile('<h2>Create "{{ modelname }}"</h2>' +
                               '<div id="form"></div>' +
                               '<a id="submit" class="btn">Create</button>'),

    initialize: function (modelname) {
        this.modelname = modelname;
        this.instance = new Definition({id: modelname,
                                        title: modelname,
                                        description: modelname});
        this.instance.on('sync', this.success.bind(this));
        this.instance.on('error', this.showErrors.bind(this));
        this.form = new Backbone.Form({
            model: this.instance
        });
        return this;
    },

    render: function () {
        FormView.prototype.render.apply(this, arguments);
        this.$('#form').html(this.form.render().el);
        return this;
    },

    submit: function() {
        FormView.prototype.submit.apply(this, arguments);
        this.form.commit();
        this.instance.save({wait: true});
        return false;
    },
    
    success: function () {
        app.navigate(this.modelname, {trigger:true});
    }
});


var ListView = Backbone.View.extend({
    template: Mustache.compile('<h1>{{ definition.title }}</h1><p>{{ definition.description }}</p><div id="toolbar"><a id="add" class="btn">Add</a></div>' + 
                               '<div id="list"></div><div id="footer">{{ count }} items.</div>'),

    events: {
        "click a#add": "addForm",
    },

    initialize: function (map, definition) {
        this.map = map;
        this.definition = definition;

        this.collection = new ItemList(definition);
        this.collection.bind('add', this.addOne, this);
        this.collection.bind('reset', this.addAll, this);
        this.collection.fetch();

        this.addView = new AddView(map, this.collection);
    },

    render: function () {
        var count = this.collection.length;
        this.$el.html(this.template({definition: this.definition.attributes, count:count}));
        return this;
    },

    addForm: function (e) {
        e.preventDefault();
        this.$el.find("#list").prepend(this.addView.render().el);
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



var HomeView = Backbone.View.extend({
    template: Mustache.compile('<h1>Daybed Map</h1><input id="modelname" placeholder="Name"/><a href="#" class="btn">Go</a>'),

    events: {
        "keyup input#modelname": "setLink",
    },

    render: function () {
        this.$el.html(this.template({}));
        return this;
    },

    setLink: function (e) {
        this.$el.find("a").attr("href", '#' + $(e.target).val());
    }
});


var DaybedMapApp = Backbone.Router.extend({

    routes: {
        "":                    "home",
        ":modelname/create":   "create",
        ":modelname":          "list",
    },

    initialize: function () {
        this.definition = null;
        
        this.map = L.map('map').setView([0, 0], 3);
        this.map.attributionControl.setPrefix(''); 
        L.tileLayer('http://{s}.tiles.mapbox.com//v3/leplatrem.map-3jyuq4he/{z}/{x}/{y}.png').addTo(this.map);
    },

    home: function() {
        $("#content").html(new HomeView().render().el);
    },

    create: function(modelname) {
        $("#content").html(new DefinitionCreate(modelname).render().el);
    },

    list: function(modelname) {
        if (!this.definition || this.definition.modelname != modelname) {
            this.definition = new Definition({id: modelname});
            var createIfMissing = function (model, xhr) {
                if (xhr.status == 404) {
                    app.navigate(modelname + '/create', {trigger:true});
                }
            };
            this.definition.fetch({error: createIfMissing});
        }
        $("#content").html(new ListView(this.map, this.definition).render().el);
    },
});
