function App() {
    this.tards = [];
    this.chaseInterval = 1000;

    var self = this;
    document.getElementById('chaseBtn').addEventListener("click", function() {
        for (var i = 0; i < self.tards.length; i++) {
            self.tards[i].toggleChase();
        }
    });
}

App.prototype = {
    startSimulation:function(containers) {
        console.log("Starting simulation");

        for (var it in containers) {
            if (containers.hasOwnProperty(it)) {
                var tardis = this.newTardis(it, containers[it]);
                console.log("New tardis created: " + tardis.id);
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
    this.trend = null;
    this.tren2 = null;
    this.eventSource = new Timeline.DefaultEventSource();
    this.timeline = null;
    this.chartOverlay = null;
    this.durationEvents = [];
    this.generator = new App.Generator(this);
    this.paused = false;
    this._configureBands(this.container);
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

	var inners = dojo.query('> div .timeline-band-inner', this.container);

	if (inners.length > 0) {
	    this.initTrend1(inners[0]);
	}else{
	    throw new Error("could not locate timeline-band-inner within container");
	}	
    },
    
    initTrend1:function(inner){
	var chartOverlayId = this.id + "ChartContainer";
	this.chartOverlay = dojo.create("div", {id:chartOverlayId, class:'timeline-band-layer debug', style:{'z-index':'200'}}, inner);	    
	var pos = dojo.position(this.container);
	this.trend = new App.Trend(this.chartOverlay, pos.w*2, pos.h);
	this.trend.paint();
    },

    initTrend2:function(inner){	
	var chartOverlayId = this.id + "ChartContainer2";
	this.chartOverlay = dojo.create("div", {id:chartOverlayId, class:'timeline-band-layer', style:{'z-index':'201'}}, inner);	    
	var pos = dojo.position(this.container);
	this.trend2 = new App.Trend2(this.eventSource, chartOverlayId, pos.w, pos.h);
    },

    toggleChase:function() {
        this.paused = !this.paused;
        console.log('this.paused: ' + this.paused);
    },

    chase:function(chaseInterval) {
        if (this.paused) return;

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

	this.trend.generatePoint();
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

    destroy:function() {
        this.stop();
        console.log("Tardis <" + this.id + "> destroyed");
    },

    onGenerated:function(data) {
        console.log("Tardis <" + this.id + "> handling generated <" + data._text + ">");

        if (!data._instant) {
            this.durationEvents.push(data);
        }
        this.eventSource._events.add(data);
        this.eventSource._fire("onAddMany", []);
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
                this.timeline._bands[0]._eventPainter.paint();
            } else {
                maintained.push(event);
            }
        }

        this.durationEvents = maintained;
    }
}

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

    this.utils = new App.Utils();
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
        return this.utils.randRange(min, max);
    }
}

App.Utils = function(){}
App.Utils.prototype = {
    randRange:function(min, max){
	return (Math.floor(Math.random() * (max - min + 1)) + min);
    }
}

App.Trend = function(container, width, height){
    this._paper = null;    
    this._points = [];
    this._container = container;
    this.utils = new App.Utils();
    this._init(width, height);
}

App.Trend.prototype = {
    
    _init:function(width, height){
	this._paper = Raphael(this._container.getAttribute("id"), width, height);
	var x = 0
	for(var i=0;i<100;i++){
	    x += (i + this.utils.randRange(1, 10));
	    this.addPoint(x, this.utils.randRange(10, height-50));
	}
    },

    addPoint:function(x, y){
	this._points.push({x:x,y:y});
    },

    generatePoint:function(){
	return;
	var pp = this._points[this._points.length -1];
	var x = (pp.x + this.utils.randRange(1, 10));
	var y =  this.utils.randRange(10, this._paper.height-50);
	
	this.addPoint(x, y);
	
	var len = this._points.length;
	var p1 = this._points[len-2];
	var p2 = this._points[len-1];	    
	var path = "M" + p1.x + " " + p1.y + " L" + p2.x + " " + p2.y;
	var c = this._paper.circle(p.x, p.y, 10);
	c.attr("fill", "#000");
	c.attr("stroke", "#fff");
	c.attr("stroke-width", 3);
	var t = this._paper.text(p.x, p.y, i);
	t.attr("fill", "#fff");

	// update the width of the container and the paper to account for new points
	//this._paper.width += 20;	
	//var cwidth = dojo.style(this._container, "width");
	//dojo.style(this._container, "width", cwidth+20 + "px");
    },

    paint:function(){
	console.log('painting');
	var len = this._points.length;
	
	// edges
	for(var i=0;i<len;i++){
	    if(i+1 != len){
		var p1 = this._points[i];
		var p2 = this._points[i+1];	    
		var path = "M" + p1.x + " " + p1.y + " L" + p2.x + " " + p2.y;
		this._paper.path(path).attr("stroke-width", 1);
	    }
	}

	// nodes
	for(var i=0;i<len;i++){
	    var p = this._points[i];
	    var c = this._paper.circle(p.x, p.y, 10);
	    c.attr("fill", "#000");
	    c.attr("stroke", "#fff");
	    c.attr("stroke-width", 3);
	    var t = this._paper.text(p.x, p.y, i);
	    t.attr("fill", "#fff");
	}
    }   
}

App.Trend2 = function(eventSource, containerId, width, height){
    this._eventSource = eventSource;
    this._paper = Raphael(containerId, width, height);
}

App.Trend2.prototype = {
    update:function(){
	console.log(this._eventSource);
    }
}
