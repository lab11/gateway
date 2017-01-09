#!/usr/bin/env node

//
// Restart the gateway if it fails to get packets for a certain amount
// of time.
//

var child_process = require('child_process');

var mqtt = require('mqtt');

// Amount of time in ms without packets before rebooting.
var MAXIMUM_PACKET_INTERVAL = 5 * 60 * 1000;

var last_packet_timestamp = new Date();


var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
	// Subscribe to all packets
	mqtt_client.subscribe('gateway-data');

	// Callback for each packet
	mqtt_client.on('message', function (topic, message) {
		last_packet_timestamp = new Date();
	});
});

// Check every 10 seconds
setInterval(function () {
	now = new Date();
	if (now - last_packet_timestamp >= MAXIMUM_PACKET_INTERVAL) {
		console.log('Been ' + now - last_packet_timestamp + ' ms since last packet. Rebooting.');
		// reboot
		cp.exec('sudo shutdown -r now', function (err, stderr, stdout) {
			console.log('Called reboot.');
		});
	}
}, 10 * 1000);
