#!/usr/bin/env node

var exec = require('child_process').exec;

var async    = require('async');
var getmac   = require('getmac');
var raw      = require('raw-socket');
var watchout = require('watchout');

var mqtt     = require('mqtt');

/*******************************************************************************
 * Constants
 ******************************************************************************/

// One of 'edison' or 'BBB'
var GATEWAY_TYPE = 'BBB';

// Type to listen on to get raw 15.4 packets
var ETH_P_IEEE802154 = 0x00F6;

var MQTT_TOPIC_NAME = 'gateway-data';

// These commands must be run to initialize the gateway
var COMMANDS = [
		'iwpan phy phy1 set channel 0 11',
		'ifconfig wpan1 down',
		'iwpan dev wpan1 set pan_id 0x0022',
		'ifconfig wpan1 up'
	];

/*******************************************************************************
 * Helper functions
 ******************************************************************************/

function reverse (b) {
	var out = new Buffer(b);
	for (var i=0; i<b.length; i++) {
		out[i] = b[b.length-i-1];
	}
	return out;
}

// There is a currently unknown issue where this script will hang sometimes,
// for the moment, we work around it with a watchdog timer
var watchdog = new watchout(1*60*1000, function(didCancelWatchdog) {
	if (!didCancelWatchdog) {
		console.log("Watchdog tripped");
		process.exit(1);
	}
});

/*******************************************************************************
 * MAIN
 ******************************************************************************/

// First run setup commands
async.eachSeries(COMMANDS, function (cmd, callback) {
	// Run the command as if a shell
	exec(cmd, function (err, stdout, stderr) {
		callback(err);
	});
}, function (err) { // callback after setup commands are done
	if (err) {
		console.log(err);
	} else {

		// Pre-fetch the mac address
		var gateway_id = '';
		getmac.getMac(function (err, addr) {
			gateway_id = addr;


			// Callback after we have found a MQTT broker.
			var mqtt_client = mqtt.connect('mqtt://localhost');
			mqtt_client.on('connect', function () {
			    console.log('Connected to MQTT');

				// Then open the socket
				var socket = raw.createSocket({
					protocol: raw.htons(ETH_P_IEEE802154),
					addressFamily: 17
				});

				// This will receive all 15.4 packets
				// Needs some sort of filtering
				socket.on('message', function (buffer, source) {

					console.log(buffer);

					watchdog.reset();
				});
			});
		});

	}
})
