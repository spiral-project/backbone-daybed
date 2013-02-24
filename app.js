var DefinitionCreate = FormView.extend({
    model: Definition,

    initialize: function () {
        FormView.prototype.initialize.call(this);
        this.modelname = this.options.modelname;
        this.title = 'Create ' + this.modelname;
        this.instance.set({id: this.modelname,
                           title: this.modelname,
                           description: this.modelname});
        return this;
    },

    cancel: function () {
        app.navigate('', {trigger:true});
    },

    submit: function() {
        FormView.prototype.submit.apply(this, arguments);
        this.instance.save({wait: true});
    },

    success: function () {
        app.navigate(this.modelname, {trigger:true});
    },
});


var AddView = FormView.extend({
    model: Item,

    initialize: function () {
        FormView.prototype.initialize.call(this);
        this.map = this.options.map;
        this.collection = this.options.collection;
        this.definition = this.options.definition;
        this.layer = null;
        
        var handlers = {
            'point': new L.Draw.Marker(this.map),
            'line': new L.Draw.Polyline(this.map),
            'polygon': new L.Draw.Polygon(this.map)
        };
        var geomField = this.definition.geomField();
        if (!geomField) return;
        this.handler = handlers[geomField.type];
        this.map.on('draw:created', this.onDraw, this);
    },

    render: function () {
        FormView.prototype.render.apply(this, arguments);
        if (this.handler) {
            this.handler.enable();
            this.$el.append('<span class="map-help alert alert-info">Click on map</span>');
        }
        return this;
    },

    close: function (e) {
        if (this.handler) {
            this.handler.disable();
            if (this.layer) this.map.removeLayer(this.layer);
            this.layer = null;
        }
        this.trigger('close');
        this.remove();
        return false;
    },

    cancel: function () {
        this.close();
    },

    success: function () {
        this.close();
    },

    submit: function(e) {
        FormView.prototype.submit.apply(this, arguments);
        this.collection.create(this.instance, {wait: true});
    },

    onDraw: function (e) {
        this.layer = e.layer;
        this.$el.find('.map-help').remove();
        this.instance.setLayer(this.layer);
    },
});


var ListView = Backbone.View.extend({
    template: Mustache.compile('<div id="map"></div>' + 
                               '<h1>{{ definition.title }}</h1><p>{{ definition.description }}</p><div id="toolbar"><a id="add" class="btn">Add</a></div>' + 
                               '<div id="stats"><span class="count">0</span> items in total.</div>' +
                               '<div id="list"></div>'),

    events: {
        "click a#add": "addForm",
    },

    initialize: function (definition) {
        this.definition = definition;
        this.map = null;

        this.collection = new ItemList(definition);
        this.collection.bind('add', this.addOne, this);
        this.collection.bind('reset', this.addAll, this);
        this.collection.fetch();
    },

    render: function () {
        this.$el.html(this.template({definition: this.definition.attributes}));
        this.$("#list").html(this.definition.tableContent());

        this.map = L.map(this.$("#map")[0]).setView([0, 0], 3);
        this.map.attributionControl.setPrefix(''); 
        L.tileLayer(settings.TILES).addTo(this.map);

        return this;
    },

    addForm: function (e) {
        e.preventDefault();
        
        this.addView = new AddView({map:this.map,
                                    definition:this.definition,
                                    collection:this.collection});
        this.addView.on('close', function () {
            this.$("a#add").show();
        }, this);
        this.$("a#add").hide();
        this.$("a#add").after(this.addView.render().el);
    },

    addOne: function (item) {
        var tpl = this.definition.templateRow();
        this.$('table tbody').prepend(tpl(item.toJSON()));
        this.$('span.count').html(this.collection.length);

        var geom = item.getLayer();
        if (geom) {
            geom.addTo(this.map);
            this.bounds.extend(geom.getLatLng());
        }

        // Row and map items highlighting
        this.$('table tbody tr').first()
        .hover(function () {
            $(this).addClass('success');
            item.highlight(true);
        },
        function () {
            $(this).removeClass('success');
            item.highlight(false);
        })
        .css("opacity", "0.1")
        .animate({opacity: 1.0}, 1000);
    },

    addAll: function () {
        this.bounds = new L.LatLngBounds();
        this.collection.each(this.addOne.bind(this));
        if (this.bounds.isValid() && this.collection.length > 1)
            this.map.fitBounds(this.bounds);
    },

    highlight: function (e) {
        var i = this.collection.get(e.data('id'));
        i.highlight();
    },
});


var HomeView = Backbone.View.extend({
    template: Mustache.compile('<h1>Daybed Map</h1><input id="modelname" placeholder="Name"/> <a href="#" class="btn">Go</a>'),

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
    },

    home: function() {
        $("#content").html(new HomeView().render().el);
    },

    create: function(modelname) {
        $("#content").html(new DefinitionCreate({modelname: modelname}).render().el);
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
        var self = this;
        this.definition.whenReady(function () {
            var view = new ListView(self.definition);
            $("#content").html(view.el);  // Leaflet needs its container in DOM
            view.render();
        });
    },
});
