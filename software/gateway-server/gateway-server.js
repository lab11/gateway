#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver that shows recent packets
 ******************************************************************************/

var mqtt       = require('mqtt');
var PPS        = require('./packets-per-second.js');
var express    = require('express');
var nunjucks   = require('nunjucks');
var bodyParser = require('body-parser');
var prettyjson = require('prettyjson');
var getmac     = require('getmac');
var async      = require('async');
var request    = require('request');

var accessorHost = require('@terraswarm/accessors/hosts/common/commonHost.js');

var expressWs  = require('express-ws')(express());
var app = expressWs.app;

// Static
app.use('/static', express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/public'));

// Provide the websocket server to any attached applications
app.use(function (req, res, next) {
	res.locals = {
		ws: expressWs.getWss(),
	};
	next();
});
// Include the status page app
app.use('/status', require('./status-app.js'));

// Need a dummy endpoint for things to work
app.ws('/ws', function (req, res) { });

var TOPIC_MAIN_STREAM = 'gateway-data';
var TOPIC_NEARBY_STREAM = 'ble-nearby';
var TOPIC_LOCAL_STREAM = 'gateway-local';

// How many of the most recent advertisements should be displayed.
var ADVERTISEMENTS_TO_KEEP = 10;

// Keep an object of devices and a list of their last couple packets
var devices = {};
var nearby_devices = {};
var other_devices = {};

// Keep a list of which devices are nearby
var nearby = [];

// Keep track of any local data for devices. This lets us use accessors.
var local = {};

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
var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    console.log('Connected to MQTT');

	// On connect we subscribe to all formatted data packets
	mqtt_client.subscribe(TOPIC_MAIN_STREAM);

	// Also subscribe to the list of nearby devices
	mqtt_client.subscribe(TOPIC_NEARBY_STREAM);

	// Also subscribe to the list of nearby devices
	mqtt_client.subscribe(TOPIC_LOCAL_STREAM + '/#');

	// Called when we get a packet from MQTT
	mqtt_client.on('message', function (topic, message) {
		if (topic == TOPIC_MAIN_STREAM) {
			// message is Buffer
			var adv_obj = JSON.parse(message.toString());

			// Keep track of speed
			PPS.add('overall');

			var name = '';
			if ('device' in adv_obj) {
				name = adv_obj.device + '_';
			}
			if ('_meta' in adv_obj) {
				name += adv_obj._meta.device_id;
			} else {
				name += adv_obj.id;
			}

			// Record the speed of each data stream
			PPS.add(name);

			if (!(name in devices)) {
				devices[name] = [];
			}

			devices[name].unshift(adv_obj);

			// Limit to only so many advertisements
			devices[name] = devices[name].slice(0, ADVERTISEMENTS_TO_KEEP);
		} else if (topic == TOPIC_NEARBY_STREAM) {
			// message is array of BLE addresses
			nearby = JSON.parse(message.toString());
		} else if (topic.startsWith(TOPIC_LOCAL_STREAM)) {
			var local_obj = JSON.parse(message.toString());
			var device_id = local_obj._meta.device_id;

			if (!(device_id in local)) {
				local[device_id] = {accessor: undefined};

				// If this is new, check for an accessor
				var options = {method: 'HEAD', url: local_obj._meta.base_url + 'accessor.js'}
    			console.log(options)
				request.get(local_obj._meta.base_url + 'accessor.js', function (err, inmsg, response) {
					if (inmsg.statusCode === 200) {
						console.log('found accessor.js!');
						// console.log(response);
						local[device_id].accessor = response;
					}
				});
			}
			local[device_id].data = local_obj;
		}
	});
});

// Clear out old devices
setInterval(function () {
	var now = new Date();

	for (device_name in devices) {
		var recent_pkt = devices[device_name][0];
		if ('_meta' in recent_pkt) {
			var then = new Date(recent_pkt._meta.received_time);
			var diff = now - then;

			// If we haven't seen a packet in a while, drop this device
			if (diff > 10*60*1000) {
				delete devices[device_name];
			}
		}
	}
}, 5*60*1000);


/*******************************************************************************
 * API Services
 ******************************************************************************/

// Unique device ID for the gateway (mac address)
app.get('/api/id', function (req, res) {
	res.send(macaddr);
});


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

		// split up devices by nearby-ness
		out += '<h2>Devices</h2>';
		nearby_str = '<h4>Nearby</h4>';
		nearby_str += '<ul>';
		other_str = '<h4>Other</h4>';
		other_str += '<ul>';
		var devices_sorted = Object.keys(devices).sort();
		for (var i=0; i<devices_sorted.length; i++) {
			var device = devices_sorted[i];
			var adv_obj = devices[device][0];

			// get the BLE address of each device
			var id;
			if ('_meta' in adv_obj) {
				id = adv_obj._meta.device_id;
			} else {
				id = adv_obj.id;
			}

			// add device to appropriate list
			if (nearby.indexOf(id) != -1) {
				// device is nearby
				nearby_str += '<li><a href="' + device + '">' + device + '</a></li>';
			} else {
				// device goes in other
				other_str += '<li><a href="' + device + '">' + device + '</a></li>';
			}
		}
		nearby_str += '</ul>';
		other_str += '</ul>';
		out += nearby_str + other_str;

		out += '<h2>Statistics</h2>';
		out += '<p>Incoming packets per second: ' + PPS.rate('overall').toFixed(2) + '</p>';

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
					<script type="text/javascript" src="static/js/smoothie.js"></script>
				</head>
				<body>
					<div id='charts'></div>
					<canvas id="chart" width="100%" height="400"></canvas>
					<script language='javascript' src='/static/js/graph-websockets.js'></script>
				</body>
			</html>`;

	res.send(out);
});

// Show a graph of a value in real time
app.get('/triumvi', function (req, res) {

	var out = `<html>
				 <head>
					<title>Triumvi Display</title>
					<style>p, body, html {margin:0;}</style>
					<script type="text/javascript" src="static/js/jquery-2.2.1.min.js"></script>
				</head>
				<body>
					<div id="meters"></div>
					<script language='javascript' src='/static/js/triumvi.js'></script>
				</body>
			</html>`;

	res.send(out);
});

// Handle accessor actions
app.get('/accessor/:device_id/:input_name/:value', function (req, res) {
	var device_id = req.params.device_id;
	var input_name = req.params.input_name;
	var value = req.params.value;


	if ('accessor_instance' in local[device_id]) {
		var accessor = local[device_id].accessor_instance;

		if (input_name in accessor.inputs) {
			var input = accessor.inputs[input_name];

			if (input.type === 'boolean') {
				var val = value === 'true';
				console.log('running input ' + input_name + ' with ' + val);

				accessor.provideInput(input_name, val);
				accessor.react()
			}

		}

		res.send('maybe did something');

	} else {
		res.send('accessor not found');
	}
});

// Show the unpacked advertisements for a device
app.get('/:device', function (req, res) {
	var device = req.params.device;

	var out = HTML_BEG;

	out += '<h2>' + device + '</h2>';

	if (device in devices) {

		out += '<h2>Most Recent Packet</h2><ul>';
		var last = devices[device][0];
		var device_id = last._meta.device_id;

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
		out += '<pre>' + prettyjson.render(devices[device], {noColor: true}) + '</pre>';

		out += '<h2>Statistics</h2>';
		out += '<p>Incoming packets per second: ' + PPS.rate(device).toFixed(2) + '</p>';


		// Accessors
		if (device_id in local && local[device_id].accessor) {
			// Oooh! We have an accessor for this device!
			out += '<h2>Accessor</h2>';

			// Load accessor into executable object
			function accessor_fetch (name) {
				return local[device_id].accessor
			}

			function require_remap (mod) {
				return require('@terraswarm/accessors/hosts/node/node_modules/' + mod);
			}

			var instance = new accessorHost.instantiateAccessor(device,
			                                                    local[device_id].data._meta.base_url + 'accessor.js',
			                                                    accessor_fetch,
			                                                    {require: require_remap});

			// Store it
			local[device_id].accessor_instance = instance;

			// Get it running
			instance.initialize();

			// Set its parameters based on local data
			for (var parameter_name in instance.parameters) {
				if (parameter_name in local[device_id].data) {
					console.log('setting parameter ' + parameter_name + ' to ' + local[device_id].data[parameter_name])
					instance.setParameter(parameter_name, local[device_id].data[parameter_name]);
				} else {
					console.log('Parameter not in the local data blob. Hope the default is OK!');
				}
			}

			// Create simple UI for interacting with it
			for (var input_name in instance.inputs) {
				var input = instance.inputs[input_name];
				if (input.type === 'boolean') {
					out += '<h3>' + input_name + '</h3>';
					out += '<a href="accessor/' + device_id + '/' + input_name + '/true">True</a><br />';
					out += '<a href="accessor/' + device_id + '/' + input_name + '/false">False</a><br />';
				}
			}

			out += '<pre>' + local[device_id].accessor + '</pre>';
		}
	} else {
		out += '<p>Not Found</p>'
	}

	out += HTML_END;

	res.send(out);
});


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

// Run the webserver
var server = app.listen(80, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening for devices at http://%s:%s', host, port);
});
