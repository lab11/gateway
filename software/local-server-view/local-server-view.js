#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver that shows recent packets
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var express = require('express');

var bleg = new BleGateway();
var app = express();

// How many of the most recent advertisements should be displayed.
var ADVERTISEMENTS_TO_KEEP = 10;

// Keep an object of devices and a list of their last couple packets
var devices = {};

// Really rough way to do HTML to write this app quickly.
var HTML_BEG = '<html><head><title>BLE Data</title></head><body>';
var HTML_END = '</body></html>';

// Display a list of found devices
app.get('/', function (req, res) {

	var out = HTML_BEG;

	out += '<h1>Devices</h1>';

	out += '<ul>'
	for (var key in devices) {
		out += '<li><a href="' + key + '">' + key + '</a></li>';
	}
	out += '</ul>';

	out += HTML_END;

	res.send(out);
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
bleg.on('advertisement', function (adv_obj) {
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

// Run the Gateway
bleg.start();

// Run the webserver
var server = app.listen(3000, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening for devices at http://%s:%s', host, port);
});
