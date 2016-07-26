#!/usr/bin/env node

var exec = require('child_process').exec;

var async    = require('async');
var getmac   = require('getmac');
var raw      = require('raw-socket');
var watchout = require('watchout');
var crypto   = require('crypto');
var ccm      = require('node-aes-ccm');

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

					if (buffer.length === 31) {
						if (buffer[7] === 0x24) {
							if (buffer[15] === 0xa0) {
								var remainder = buffer.slice(16);
								console.log(buffer);
								console.log(remainder);


								// console.log(pw)

								var src_address = reverse(buffer.slice(7, 15));
								var zero_buf = new Buffer([0]);
								var nonce_counter = buffer.slice(16, 20);
								var nonce = Buffer.concat([src_address, zero_buf, nonce_counter]);

								var one_buf = new Buffer([1]);
								var iv = Buffer.concat([one_buf, nonce, zero_buf, zero_buf]);

								// var iv = new Buffer([0x01,
								//                      0x24, 0x00, 0xa0, 0x52, 0x54, 0xe5, 0x98, 0xc0,
								//                      0x00, 0x00, 0x00, 0x00, 0x00,
								//                      0x00, 0x00])

								// // put in nonce counter
								// iv[9] = buffer[16];
								// iv[10] = buffer[17];
								// iv[11] = buffer[18];
								// iv[12] = buffer[19];

								console.log('iv')
								console.log(iv)

								// Get add/mic thingy
								var auth_tag = buffer.slice(27);
								console.log('auth')
								console.log(auth_tag)

								// get nonce
								// var nonce = iv.slice(1, 14);
								console.log('nonce')
								console.log(nonce)

								var encrypted = buffer.slice(20, 27);
								console.log('encrypted')
								console.log(encrypted)

								// var done = ccm.decrypt(pw, iv, encrypted, src_address, auth_tag)
								var done = ccm.decrypt(pw, nonce, encrypted, src_address, auth_tag)
								console.log(done)


								// var decipher = crypto.createDecipher('AES-128-CBC', pw)
								// var dec = Buffer.concat([decipher.update(buffer) , decipher.final()]);
								// console.log(dec);


							} else {
								console.log(buffer[15])
							}
						}
					} else {
						// console.log(buffer.length)
						// if (buffer.length === 31) {
						// 	console.log(buffer)
						// }
					}
					// console.log(buffer);

					// i

					// var pw = new Buffer([0x46, 0xe2, 0xe5, 0x28, 0x9a, 0x65, 0x3c, 0xe9, 0x0, 0x2f, 0xc1, 0x6e, 0x65, 0xee, 0xc, 0x3e])
					// console.log(pw)

					// var decipher = crypto.createDecipher('aes-256-ctr', pw)
					// var dec = Buffer.concat([decipher.update(buffer) , decipher.final()]);
					// console.log(dec);

					watchdog.reset();
				});
			});
		});

	}
})
