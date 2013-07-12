window.DAYBED_SETTINGS.TILES = (window.DAYBED_SETTINGS.TILES || "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

window.DAYBED_SETTINGS.STYLES = L.Util.extend((window.DAYBED_SETTINGS.STYLES || {}), {
    'default': {color: 'green', fillColor: 'green', opacity: 0.5},
    'highlight': {color: 'yellow', fillColor: 'yellow', opacity: 1.0}
});


var DaybedMapApp = Backbone.Router.extend({

    routes: {
        "":                    "home",
        ":modelname/create":   "create",
        ":modelname":          "list"
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
        // If no definition loaded or model changed, fetch from server !
        if (!this.definition || this.definition.modelname != modelname) {
            this.definition = new MapModel({id: modelname});

            // Redirect to creation page if unknown
            var createIfMissing = function (model, xhr) {
                if (xhr.status == 404) {
                    app.navigate(modelname + '/create', {trigger:true});
                }
            };
            this.definition.fetch({error: createIfMissing});

            // Do we know its token already ?
            var storage = window.localStorage || {};
            this.definition.set('token', storage["daybed.token." + modelname]);
        }
        this.definition.whenReady((function () {
            var view = new ListView(this.definition);
            $("#content").html(view.el);  // Leaflet needs its container in DOM
            view.render();
        }).bind(this));
    }
});
