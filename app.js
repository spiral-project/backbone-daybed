settings.STYLES = settings.STYLES || {
    default: {color: 'green', fillColor: 'green', opacity: 0.5},
    highlight: {color: 'yellow', fillColor: 'yellow', opacity: 1.0},
};


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
        this.layer.addTo(this.map);
        this.$el.find('.map-help').remove();

        // Make it editable and save while editing
        this.layer[this.layer instanceof L.Marker ? 'dragging' : 'editing'].enable();
        this.layer.on('dragend edit', function storefield (e) {
            this.instance.setLayer(e.target);
        }, this);
        this.layer.fire('edit');  // store once
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

        var layer = item.getLayer();
        if (layer) {
            layer.setStyle(settings.STYLES.default)
                 .bindPopup(item.popup())
                 .addTo(this.map);

            // Will fit map on items
            var bounds = layer.getLatLng ? layer.getLatLng() : layer.getBounds();
            if (bounds && bounds.isValid()) this.bounds.extend(bounds);

            // Row and map items highlighting
            var row = this.$("tr[data-id='" + item.get('id') + "']");
            layer.on('mouseover', function (e) {
                this.setStyle(settings.STYLES.highlight);
                // Pop on top
                this._map.removeLayer(this).addLayer(this);
                row.addClass('success')
                   .css("opacity", "0.1")
                   .animate({opacity: 1.0}, 400);
            }, layer);
            layer.on('mouseout',  function (e) {
                this.setStyle(settings.STYLES.default);
                row.removeClass('success');
            }, layer);

            row.hoverIntent(function () {
                layer.fire('mouseover');
            },
            function () {
                layer.fire('mouseout');
            });
        }
    },

    addAll: function () {
        this.bounds = new L.LatLngBounds();
        this.collection.each(this.addOne.bind(this));
        if (this.bounds.isValid() && this.collection.length > 1)
            this.map.fitBounds(this.bounds);
    },
});


var HomeView = Backbone.View.extend({
    template: Mustache.compile('<div class="hero-unit"><h1>Daybed Map</h1>' + 
                               '<p>Join an existing map or create a new one.</p>' + 
                               '<input id="modelname" placeholder="Name"/> <a href="#" class="btn">Go</a></div>'),

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
