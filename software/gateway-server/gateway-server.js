#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver that shows recent packets
 ******************************************************************************/

var dgram   = require('dgram');
var express = require('express');
var getmac  = require('getmac');
var async   = require('async');

var app  = express();
// Static
app.use('/js', express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/public'));
var client = dgram.createSocket({type: 'udp4', reuseAddr: true, reusePort: true});

// UDP broadcast port
var UDP_BROADCAST_PORT = 3002;

// How many of the most recent advertisements should be displayed.
var ADVERTISEMENTS_TO_KEEP = 10;

// Keep an object of devices and a list of their last couple packets
var devices = {};

// Really rough way to do HTML to write this app quickly.
var HTML_BEG = '<html><head><title>Swarm Gateway</title><style>p{margin:0;}</style></head><body>';
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

client.on('listening', function () {
    client.setBroadcast(true);
});

/*******************************************************************************
 * ROUTES
 ******************************************************************************/

// Display a list of found devices
app.get('/', function (req, res) {

	// Get IP addresses to show
	get_ip_addresses(function (addrs) {
		var out = HTML_BEG;

		out += '<h1>Local Machine Info</h1>';
		out += '<p>MAC Address: ' + macaddr + '</p>';
		out += addrs;

		out += '<h1>Devices</h1>';

		out += '<ul>'
		for (var key in devices) {
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

	out += '<h1>' + device + '</h1>';

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

			out += '<li>' + key + ': ' + val + graph + '</li>';
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

// Callback for when BLE discovers the advertisement
client.on('message', function (message, remote) {
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

// Start getting packets
client.bind(UDP_BROADCAST_PORT);

// Run the webserver
var server = app.listen(80, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening for devices at http://%s:%s', host, port);
});
