#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver that shows recent packets
 ******************************************************************************/

var MQTTDiscover = require('mqtt-discover');
var express      = require('express');
var getmac       = require('getmac');
var async        = require('async');

var app  = express();
// Static
app.use('/js', express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/public'));

var TOPIC_MAIN_STREAM = 'gateway-data';

// How many of the most recent advertisements should be displayed.
var ADVERTISEMENTS_TO_KEEP = 10;

// Keep an object of devices and a list of their last couple packets
var devices = {};

// Really rough way to do HTML to write this app quickly.
var HTML_BEG = `
<html>
  <head>
    <title>Swarm Gateway</title>
    <style>p{margin:0;}</style>
  </head>
  <body>
    <h1>SwarmGateway</h1>
    <p>
      Learn more about the SwarmGateway in the <a href="https://github.com/terraswarm/urban-heartbeat-kit">Urban Heartbeat Kit</a>.
    </p>
    `;
var HTML_END = '</body></html>';

// Pre-fetch the mac address
var macaddr = '';
getmac.getMac(function (err, addr) {
	macaddr = addr;
});

// Get IP address
function get_ip_addresses (cb) {
	var os = require('os');
	var ifaces = os.networkInterfaces();

	var out = '';

	async.eachSeries(Object.keys(ifaces), function (ifname, done) {
		if (ifname != 'lo') {
			async.forEachOfSeries(ifaces[ifname], function (iface, index, done2) {
				out += '<p>' + ifname + ':' + index + ' - ' + iface.address + '</p>';
				done2();
			}, function (err) {
				done();
			});
		} else {
			done();
		}
	}, function (err) {
		cb(out);
	});
}


/*******************************************************************************
 * EVENTS
 ******************************************************************************/

// Callback after we have found a MQTT broker.
MQTTDiscover.on('mqttBroker', function (mqtt_client) {
	console.log('Connected to MQTT at ' + mqtt_client.options.href);

	// On connect we subscribe to all formatted data packets
	mqtt_client.subscribe(TOPIC_MAIN_STREAM);

	// Called when we get a packet from MQTT
	mqtt_client.on('message', function (topic, message) {
		// message is Buffer
		var adv_obj = JSON.parse(message.toString());

		var name = '';
		if ('device' in adv_obj) {
			name = adv_obj.device;
		}
		if ('_meta' in adv_obj) {
			name += adv_obj._meta.device_id;
		} else {
			name += adv_obj.id;
		}

		if (!(name in devices)) {
			devices[name] = [];
		}

		devices[name].unshift(adv_obj);

		// Limit to only so many advertisements
		devices[name] = devices[name].slice(0, ADVERTISEMENTS_TO_KEEP);
	});
});

// Clear out old devices
setInterval(function () {
	var now = new Date();

	for (device_name in devices) {
		var recent_pkt = devices[device_name][0];
		var then = new Date(recent_pkt._meta.received_time);
		var diff = now - then;

		// If we haven't seen a packet in a while, drop this device
		if (diff > 10*60*1000) {
			delete devices[device_name];
		}
	}
}, 5*60*1000);

/*******************************************************************************
 * ROUTES
 ******************************************************************************/

// Display a list of found devices
app.get('/', function (req, res) {

	// Get IP addresses to show
	get_ip_addresses(function (addrs) {
		var out = HTML_BEG;

		out += '<h2>Local Machine Info</h2>';
		out += '<p>MAC Address: ' + macaddr + '</p>';
		out += addrs;

		out += '<h2>Devices</h2>';

		out += '<ul>'
		var devices_sorted = Object.keys(devices).sort();
		for (var i=0; i<devices_sorted.length; i++) {
			var key = devices_sorted[i];
			out += '<li><a href="' + key + '">' + key + '</a></li>';
		}
		out += '</ul>';

		out += HTML_END;

		res.send(out);
	});
});

// Show a graph of a value in real time
app.get('/graph', function (req, res) {

	var out = `<html>
                 <head>
                  <title>Swarm Gateway Graph</title>
                  <style>p, body, html {margin:0;}</style>
                  <script type="text/javascript" src="js/smoothie.js"></script>
                </head>
                <body>
                  <div id='charts'></div>
                  <canvas id="chart" width="100%" height="400"></canvas>
                  <script language='javascript' src='/js/graph-websockets.js'></script>
                </body>
              </html>`;

	res.send(out);
});

// Show the unpacked advertisements for a device
app.get('/:device', function (req, res) {
	var device = req.params.device;

	var out = HTML_BEG;

	out += '<h2>' + device + '</h2>';

	if (device in devices) {

		out += '<h2>Most Recent Packet</h2><ul>';
		var last = devices[device][0];

		for (var key in last) {
			var val = last[key];

			// Decide if we should show a graph link
			var graph = '';
			if (key != 'id' && !isNaN(val)) {
				graph = ' (<a href="/graph?id=' + last._meta.device_id + '&field=' + key + '">graph</a>)';
			}

			if (typeof val === 'object') {
				// Display a JSON version of this
				out += '<li>' + key + ': ' + JSON.stringify(val) + '</li>';
			} else {
				out += '<li>' + key + ': ' + val + graph + '</li>';
			}
		}
		out += '</ul>'

		out += '<h2>Last 10 Packets</h2>';

		out += '<p>' + JSON.stringify(devices[device]) + '</p>';
	} else {
		out += '<p>Not Found</p>'
	}

	out += HTML_END;

	res.send(out);
});


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

// Find MQTT server to start getting packets
MQTTDiscover.start();

// Run the webserver
var server = app.listen(80, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening for devices at http://%s:%s', host, port);
});
