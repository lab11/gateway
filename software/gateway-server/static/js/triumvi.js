
var queryDict = {}
location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});

var ws_host = queryDict.ws_host || window.location.hostname + ':9001';


var client = mqtt.connect('ws://' + ws_host);
client.subscribe('device/Triumvi/#');

var triumvis = {};

client.on("message", function(topic, payload) {
    var data = JSON.parse(payload.toString());

    // Get important values
    var panel_id = data['Panel ID'] || data.panel_id;
    var circuit_id = data['Circuit ID'] || data.circuit_id;
    var device_id = data._meta.device_id;
    var power = data.Power || data.power_watts;

    // Setup data structures, if needed
    if (!(panel_id in triumvis)) {
        triumvis[panel_id] = {
            circuits: {},
            max_circuit: 0
        };
    }
    if (!(circuit_id in triumvis[panel_id].circuits)) {
        triumvis[panel_id].circuits[circuit_id] = {};
    }

    // Add new measurement
    triumvis[panel_id].circuits[circuit_id][device_id] = {
        power: power,
        timestamp: new Date()
    };

    // We also need to know how big to make the table
    if (circuit_id > triumvis[panel_id].max_circuit) {
        triumvis[panel_id].max_circuit = circuit_id;
    }

    // Lookup the table for this meter and create it if it doesn't exist
    var table = $('#table-' + panel_id);
    if (table.length == 0) {
        // Need to create a new table for this panel
        var new_table = '<table id="table-'+panel_id+'" class="table table-bordered"></table>';
        $("#meters").append(new_table);
        table = $("#table-" + panel_id);
    }

    // Create rows for the table to be updated
    var html = '';

    html += '<thead>';
    html += '<tr><td colspan="8"><b>Panel ID: ' + panel_id + '</b></td></tr>';

    // Insert the devices on circuit 0
    html += '<tr>';
    html += '<td colspan="2">Main incoming feed</td>';

    var device_list = [];
    var power = 0;
    if ('0' in triumvis[panel_id].circuits) {
        for (var did in triumvis[panel_id].circuits['0']) {
            device_list.push(did);
            power += triumvis[panel_id].circuits['0'][did].power;
        }
    }
    html += '<td colspan="3">' + device_list.join(', ') + '</td>';
    html += '<td colspan="3">' + power.toFixed(2) + '</td>';
    html += '</tr>';

    // Add a header for everything else
    html += '<tr>';
    html += '<td>Power (W)</td>';
    html += '<td width="13%">Updated</td>';
    html += '<td width="15%">Device ID</td>';
    html += '<td width="10%" style="text-align:center;">Circuit Num</td>';
    html += '<td width="10%" style="text-align:center;">Circuit Num</td>';
    html += '<td width="15%">Device ID</td>';
    html += '<td width="13%">Updated</td>';
    html += '<td>Power (W)</td>';
    html += '</tr>';
    html += '</thead>';

    // Create the rows for circuits

    // Keep track of circuits that are multi phase or 240 V. These do not get
    // their own row
    var skips = [];
    for (var i=1; i<=((triumvis[panel_id].max_circuit+1)/2); i++) {
        html += '<tr>';

        for (var j=(i*2)-1; j<(i*2)+1; j++) {
            var device_list = [];
            var power = 0;
            var timestamp = undefined;
            if (j in triumvis[panel_id].circuits) {
                for (var did in triumvis[panel_id].circuits[j]) {
                    device_list.push(did);
                    power += triumvis[panel_id].circuits[j][did].power;
                    if (timestamp === undefined || triumvis[panel_id].circuits[j][did].timestamp < timestamp) {
                        timestamp = triumvis[panel_id].circuits[j][did].timestamp;
                    }
                }
            }

            // Add to skips
            for (k=j+2; k<j+(device_list.length*2); k+=2) {
                skips.push(k);
            }

            if (skips.indexOf(j) === -1) {
                if (j === (i*2)-1) {
                    html += '<td rowspan="' + device_list.length + '">' + power.toFixed(2) + '</td>';
                    html += '<td rowspan="' + device_list.length + '">' + timeAgo(timestamp) + '</td>';
                    html += '<td rowspan="' + device_list.length + '">' + device_list.join(', ') + '</td>';
                    html += '<td rowspan="' + device_list.length + '" style="text-align:center;">' + j + '</td>';
                } else {
                    html += '<td rowspan="' + device_list.length + '" style="text-align:center;">' + j + '</td>';
                    html += '<td rowspan="' + device_list.length + '">' + device_list.join(', ') + '</td>';
                    html += '<td rowspan="' + device_list.length + '">' + timeAgo(timestamp) + '</td>';
                    html += '<td rowspan="' + device_list.length + '">' + power.toFixed(2) + '</td>';
                }
            }
        }
        html += '</tr>';
    }

    table.html(html);
});

function timeAgo (before) {
    if (before === undefined) return '-';
    var units = [
        { name: "second", limit: 60, in_seconds: 1 },
        { name: "minute", limit: 3600, in_seconds: 60 },
        { name: "hour", limit: 86400, in_seconds: 3600  },
        { name: "day", limit: 604800, in_seconds: 86400 },
        { name: "week", limit: 2629743, in_seconds: 604800  },
        { name: "month", limit: 31556926, in_seconds: 2629743 },
        { name: "year", limit: null, in_seconds: 31556926 }
    ];
    var diff = (new Date() - before) / 1000;
    if (diff < 5) return "now";

    var i = 0, unit;
    while (unit = units[i++]) {
        if (diff < unit.limit || !unit.limit) {
            var diff =  Math.floor(diff / unit.in_seconds);
            return diff + " " + unit.name + (diff>1 ? "s" : "");
        }
    };
}
