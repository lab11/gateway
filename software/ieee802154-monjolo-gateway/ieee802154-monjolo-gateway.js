#!/usr/bin/env node

var exec = require('child_process').exec;

var async    = require('async');
var getmac   = require('getmac');
var raw      = require('raw-socket');
var watchout = require('watchout');

var mqtt     = require('mqtt');

var GatewayTopics = require('gateway-topics');

/*******************************************************************************
 * Constants
 ******************************************************************************/

// Type to listen on to get raw 15.4 packets
var ETH_P_IEEE802154 = 0x00F6;

// Identifiers for different monjolos
var MONJOLO_TYPES = ['unused',
		'Coilcube',
		'sEHnsor',
		'Impulse',
		'Coilcube (Splitcore)',
		'Solar Monjolo',
		'Buzz',
		'Thermes'];

var MQTT_TOPIC_NAME = 'gateway-data';

// These commands must be run to initialize the gateway
var COMMANDS = ['iwpan phy phy0 set channel 0 18',
		'ifconfig wpan0 down',
		'iwpan dev wpan0 set pan_id 0x0022',
		'ifconfig wpan0 up'];

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
var watchdog = new watchout(5*60*1000, function(didCancelWatchdog) {
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

				socket.on('message', function (buffer, source) {

					if (buffer.length == 54) {
						// Check that dest is broadcast (0xFFFF)
						var dest = buffer.readUInt16LE(5);
						if (dest != 0xFFFF) {
							return;
						}

						// Extract the source address
						var src_buf = reverse(buffer.slice(7, 15));
						// Verify that the node is one of ours (AKA eligible to be a monjolo)
						if (src_buf[0] != 0xc0 || src_buf[1] != 0x98 || src_buf[2] != 0xe5) {
							return;
						}
						var src = src_buf.toString('hex');

						// Extract the first 10 bytes of the UDP payload
						var gatd_v1_id = buffer.slice(41, 51).toString();
						// Check that the GATD id matches a monjolo packet
						if (gatd_v1_id != '7aiOPJapXF') {
							return;
						}

						// If we get here, this is likely definitely a monjolo packet
						var monjolo_version = buffer.readUInt8(51);
						var monjolo_counter = buffer.readUInt8(52);
						var monjolo_seq_no  = buffer.readUInt8(53);

						// Verify that we know what this version might be
						if (monjolo_version < 1 || monjolo_version > 7) {
							return;
						}

						// Create an output packet
						var out = {
							_meta: {
								received_time: new Date().toISOString(),
								device_id: src,
								receiver: 'ieee802154-monjolo-gateway',
								gateway_id: gateway_id
							},
							device: MONJOLO_TYPES[monjolo_version],
							counter: monjolo_counter,
							seq_no: monjolo_seq_no
						};

						mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
						GatewayTopics.publish(out);

						// ping the watchdog
						//  We're doing it here rather than at packet receieve because no
						//  monjolo packets means its not working. Monjolo's nature means
						//  that the watchdog might trip on its own occasionally, but
						//  that is not a problem
						watchdog.reset();
					}
				});
			});
		});

	}
})
