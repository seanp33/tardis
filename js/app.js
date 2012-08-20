function App() {
    this.tards = [];
    this.chaseInterval = 1000;
}

App.prototype = {
    startSimulation:function(containers) {
        console.log("Starting simulation");

        for (var it in containers) {
            if (containers.hasOwnProperty(it)) {
                var tardis = this.newTardis(it, containers[it]);
                //console.log("New tardis created: " + tardis.id);
                tardis.start();
            }
        }

        var self = this;
        this.tick = setInterval(function() {
            self.onTick.call(self)
        }, this.chaseInterval);

    },

    stopSimulation:function() {
        console.log("Stopping simulation");
        for (var i = 0; i < this.tards.length; i++) {
            var tardis = this.tards[i];
            tardis.destroy();
        }

        this.tards = [];
    },

    onTick:function() {
        for (var i = 0; i < this.tards.length; i++) {
            var tardis = this.tards[i];
            tardis.chase(this.chaseInterval);
        }
    },

    newTardis:function(id, container) {
        var tardis = new App.Tardis(id, container);
        this.tards.push(tardis);
        return tardis;
    },

    layout:function() {
        for (var i = 0; i < this.tards.length; i++) {
            var tardis = this.tards[i];
            tardis.layout();
        }
    }
}

App.Tardis = function(id, container) {
    this.id = id;
    this.container = container;
    this.eventSource = new Timeline.DefaultEventSource();
    this.timeline = null;
    this.durationEvents = [];
    this._configureBands(this.container);
    this.generator = new App.Generator(this);
    this.count = 0;
    this.trendDecorator = null;
}

App.Tardis.prototype = {

    _configureBands:function() {
        var theme = Timeline.ClassicTheme.create();
        theme.event.bubble.width = 250;
        theme.event.tape.height = 10;
        var date = new Date();
        var bandInfos = [
            Timeline.createBandInfo({
                width:          "85%",
                intervalUnit:   Timeline.DateTime.SECOND,
                intervalPixels: 60,

                eventSource:    this.eventSource,
                date:           date,
                timeZone:       -6,
                theme:theme
            }),
            Timeline.createBandInfo({
                width:          "15%",
                intervalUnit:   Timeline.DateTime.MINUTE,
                intervalPixels: 40,

                eventSource:    this.eventSource,
                date:           date,
                timeZone:       -6,
                overview:       true,
                theme:theme
            })
        ];

        bandInfos[1].syncWith = 0;
        bandInfos[1].highlight = true;
        this.timeline = Timeline.create(this.container, bandInfos, Timeline.HORIZONTAL);
        this._initializePrimaryBand();

    },

    chase:function(chaseInterval) {
        var now = new Date();
        this.expireDurationEvents(now);

        var bands = this.timeline._bands;

        var dragging = false;
        for (var i = 0; i < bands.length; i++) {
            if (bands[i]._dragging) {
                dragging = true;
                break;
            }
        }

        if (!dragging) {
            bands[0].scrollToCenter(now);
        }
    },

    start:function() {
        this.generator.start();
    },

    stop:function() {
        this.generator.stop();
        console.log("Tardis <" + this.id + "> stopped");
    },

    layout:function() {
        this.timeline.layout();
    },

    paint:function() {
        this.timeline.paint();
    },

    destroy:function() {
        this.stop();
        console.log("Tardis <" + this.id + "> destroyed");
    },

    onGenerated:function(data) {
        //console.log("Tardis <" + this.id + "> handling generated <" + data._text+ ">");

        if (!data._instant) {
            this.durationEvents.push(data);
        }
        this.eventSource._events.add(data);
        this.eventSource._fire("onAddMany", []);

        this.updateDecorator();

        this.paint();
    },

    expireDurationEvents:function(date) {
        var maintained = [];
        for (var i = 0; i < this.durationEvents.length; i++) {
            var event = this.durationEvents[i];
            if (date.getTime() >= event._end.getTime()) {
                event._tapeImage = null;
                event._tapeRepeat = null;
                event._color = 'black';

                // force a repaint so that style changes apply immediately
                // http://code.google.com/p/simile-widgets/wiki/Timeline_EventPainterClass
                this.b0._eventPainter.paint();
                //this.timeline._bands[0]._eventPainter.paint();
            } else {
                maintained.push(event);
            }
        }

        this.durationEvents = maintained;
    },

    updateDecorator:function() {

        if (this.trendDecorator == null) {
            this.trendDecorator = new App.Trend({startDate:new Date(), endDate:new Date()});
            this.trendDecorator.initialize(this.b0, this.timeline);
            this.b0._decorators.push(this.trendDecorator);
        } else {
            this.trendDecorator.update(new Date());
        }
    },

    _initializePrimaryBand:function() {
        this.b0 = this.timeline._bands[0];
        this.b0.addOnScrollListener(this._handleOnScroll);
    },

    _handleOnScroll:function(band) {
        //console.log('handling onscroll for band: ' + band.getViewOffset());
    }
}

App.Trend = function(params) {
    this._unit = params.unit != null ? params.unit : SimileAjax.NativeDateUnit;
    this._startDate = params.startDate || null;
    this._endDate = params.endDate;
    this._cssClass = 'trendDecorator';
};

App.Trend.prototype.initialize = function(band, timeline) {
    this._band = band;
    this._timeline = timeline;
    this._layerDiv = null;
    this._svgBase = null;
};

App.Trend.prototype.update = function(date) {
    this._endDate = date;
    this.paint();
}

App.Trend.prototype.paint = function() {

    if (this._layerDiv == null) {
        this._initLayerDiv();
    }

    this._updatePositionAndWidth();

    this._layerDiv.style.display = "block";
};

App.Trend.prototype._isValid = function(minDate, maxDate) {
    if (this._unit.compare(this._endDate, maxDate) < 0 &&
        this._unit.compare(this._endDate, minDate) > 0) {
        return true;
    } else {
        return false;
    }
};

App.Trend.prototype._initLayerDiv = function() {
    if (this._isValid(this._band.getMinDate(), this._band.getMaxDate())) {
        this._layerDiv = this._band.createLayerDiv(10);
        this._layerDiv.setAttribute("name", "span-highlight-decorator"); // for debugging
        this._layerDiv.style.display = "none";

        var doc = this._timeline.getDocument();
        this.div = doc.createElement("div");
        this.div.className = this._cssClass;
        this.div.innerHTML = "<h2 style='margin-top:200px'>trendDecorator</h2>";

        this._layerDiv.appendChild(this.div);

        this._svgBase = d3.select(this._layerDiv).append("svg")
            .append("rect")
            .attr("height", "100%")
            .attr("width", 100)
            .classed("trendDecoratorSvg", true);
    } else {
        throw new Error("min and/or max date are not valid. unable to initialize App.Trend layer div");
    }
};

App.Trend.prototype._updatePositionAndWidth = function() {
    var endPixel = this._band.dateToPixelOffset(this._endDate);
    var width = "3px";
    var left = endPixel + "px";

    if (this._startDate != null) {
        var startPixel = this._band.dateToPixelOffset(this._startDate);
        width = endPixel - startPixel + "px";
        left = startPixel + "px";
    }

    this.div.style.left = left;
    this.div.style.width = width;

    this._svgBase.attr("x", left).attr("width", width);
};

App.Trend.prototype.softPaint = function() {
};


App.Generator = function(tardis) {
    this.tardis = tardis;
    this.lastEvent = null;
    this.titles = ["#__s__ appears above Traffic.",
        "#__s__ revolts into Traffic.",
        " Why won't Traffic pitch #__s__?",
        "The bag resents #__s__ past our dummy.",
        " How will #__s__ cycle Balloons?",
        "Can Balloons lecture #__s__?",
        "When can #__s__ bridge the emphasized ecology?",
        "#__s__ migrates beneath its focus.",
        "#__s__ frustrates a shut chart on top of an apple.",
        " Peanuts listens before #__s__.",
        " Peanuts compresses #__s__ after the address.",
        "#__s__ attacks our seeking hero throughout the flexible scanner.",
        "#__s__ exercises against the censored researcher.",
        "The birth divides #__s__.",
        "#__s__ drowns an optimum hardship."];
}

App.Generator.icons = ["asterisk_orange.png","flag_yellow.png","lightning.png","tick.png","bomb.png","heart.png","rosette.png","bug.png","exclamation.png","help.png","star.png","eye.png","information.png","stop.png","flag_green.png","lightbulb.png","tag_blue_edit.png"];
App.Generator.colors = ['#0e3d59','brown','#b2d923','#f29f05','#f25c05','#d92525'];
App.Generator.prototype = {

    start:function() {
        this.running = true;
        this.schedule();
    },

    stop:function() {
        this.running = false;
        if (this.genTask != undefined) {
            clearTimeout(this.genTask);
        }
    },

    schedule:function() {
        var delay = this._rr(500, 8000);
        var self = this;
        var tardis = this.tardis;
        this.genTask = setTimeout(function() {
            tardis.onGenerated.call(tardis, self.generate())
        }, delay);


    },

    generate:function() {
        if (this.running) {
            this.schedule();
        }

        this.lastEvent = this._randomEvent();
        return this.lastEvent;
    },

    _randomEvent:function() {
        var date = new Date();
        var tlen = this.titles.length - 1;
        var lbl = this.titles[this._rr(0, tlen)].replace('__s__', this.tardis.id);
        var icon = this._randomIcon();
        var color = this._randomColor();
        var i = this._rr(0, 1000);

        if (i > 650) {
            var endDate = new Date();
            endDate.setMilliseconds(endDate.getMilliseconds() + this._rr(1000, 15000));

            return new Timeline.DefaultEventSource.Event({
                icon:icon,
                start:date,
                end:endDate,
                durationEvent:true,
                description:'generated for tardis ' + this.tardis.id,
                text:lbl,
                tapeImage:'images/progress-bar-indeterminate.gif',
                tapeRepeat:'x-repeat'
            });
        } else {
            return new Timeline.DefaultEventSource.Event({
                icon:icon,
                start:date,
                instant:true,
                description:'generated for tardis ' + this.tardis.id,
                text:lbl
            });
        }
    },

    _randomIcon:function() {
        var i = this._rr(0, App.Generator.icons.length - 1);
        return "images/" + App.Generator.icons[i];
    },

    _randomColor:function() {
        var i = this._rr(0, App.Generator.colors.length - 1);
        return App.Generator.colors[i];
    },

    _rr:function(min, max) {
        return (Math.floor(Math.random() * (max - min + 1)) + min);
    }
}
