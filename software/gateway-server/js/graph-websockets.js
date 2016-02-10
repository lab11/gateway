var readings = new TimeSeries();

var queryDict = {}
location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});

var ws_host = queryDict.ws_host || window.location.hostname + ':3001';
var id      = queryDict.id;
var field   = queryDict.field;

function createTimeline() {
    var chart = new SmoothieChart({
        timestampFormatter: SmoothieChart.timeFormatter,
        interpolation:'bezier',
        millisPerPixel: 100
    });
    chart.addTimeSeries(readings, {
        strokeStyle: 'rgba(0, 255, 0, 0.6)',
        fillStyle: 'rgba(0, 0, 255, 0.2)',
        lineWidth: 3
    });
    chart.streamTo(document.getElementById("chart"), 500);
}
var ws = new WebSocket('ws://' + ws_host);
ws.onopen = function() { };
ws.onclose = function() { };
ws.onmessage = function(event) {
    var data = JSON.parse(event.data);

    if (data.id == id) {
        var timestamp = Date.now();
        var value = data[field];

        readings.append(timestamp, value);
    }

};

// Resize the canvas to fit width wise
var ctx = document.getElementById("chart").getContext('2d');
ctx.canvas.width  = window.innerWidth;

createTimeline();
