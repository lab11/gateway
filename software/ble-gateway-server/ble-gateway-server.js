#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver that shows recent packets
 ******************************************************************************/

var dgram   = require('dgram');
var express = require('express');
var getmac  = require('getmac');
var async   = require('async');

var app  = express();
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

// Show the unpacked advertisements for a device
app.get('/:device', function (req, res) {
	var device = req.params.device;

	var out = HTML_BEG;

	out += '<h1>' + device + '</h1>';

	if (device in devices) {
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
		name = adv_obj.device + '-' + adv_obj.id;
	} else {
		name = adv_obj.id;
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
