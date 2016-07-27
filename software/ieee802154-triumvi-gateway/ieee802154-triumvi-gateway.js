#!/usr/bin/env node

var exec = require('child_process').exec;
var fs   = require('fs');

var async    = require('async');
var getmac   = require('getmac');
var raw      = require('raw-socket');
var watchout = require('watchout');
var ini      = require('ini');
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

var MQTT_CC2538_RAW = 'ieee802154-raw';


/*******************************************************************************
 * Global State
 ******************************************************************************/

var _mqtt_client = undefined;
var _gateway_id = '';
var _aes_key = undefined;

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

/*******************************************************************************
 * Main logic functions
 ******************************************************************************/

// Minimum raw packet size include the 15.4 header
var TRIUMVI_154_MIN_LEN = 28;

// Byte that starts the payload for triumvi packets.
var TRIUMVI_BYTE = 0xa0;

var TRIUMVI_STATUSREG_EXTERNALVOLT  = 0x80;
var TRIUMVI_STATUSREG_BATTERYPACKET = 0x40;
var TRIUMVI_STATUSREG_THREEPHASE    = 0x30;
var TRIUMVI_STATUSREG_FRAMWRITE     = 0x08;
var TRIUMVI_STATUSREG_POWERFACTOR   = 0x04;

// Parse a packet for a triumvi packet. We don't actually know this is triumvi,
// so we have to be picky.
function parse_packet (buffer) {

	// Check that the packet is at least the very shortest possible for triumvi.
	if (buffer.length < TRIUMVI_154_MIN_LEN) {
		return;
	}

	// Check that the destination was broadcast.
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

	// Ensure that the "Triumvi" byte is there
	if (buffer[15] !== TRIUMVI_BYTE) {
		return;
	}

	// OK, this is likely a Triumvi packet. Start processing.
	var zero_buf = new Buffer([0]);

	// Packet structure looks like:
	/*
	 *   | 15.4 header | Triumvi Byte | nonce counter | encrypted data | auth_tag |
	 *
	 */
	var nonce_counter = buffer.slice(16, 20);
	// This is how the nonce is created when encrypted
	var nonce = Buffer.concat([src_buf, zero_buf, nonce_counter]);

	// Get the actual encrypted data buffer.
	var encrypted = buffer.slice(20, buffer.length-4);

	// And the auth tag data thingy at the end of the packet.
	var auth_tag = buffer.slice(buffer.length-4);

	// Now we can decrypt!
	var decrypted = ccm.decrypt(_aes_key, nonce, encrypted, src_buf, auth_tag);

	// Check that we could successfully decrypt
	if (!decrypted.auth_ok) {
		return;
	}

	var data = decrypted.plaintext;

	// Build Triumvi gateway-data blob
	var out = {
		device: 'Triumvi',
		'Packet Type': 'Triumvi Packet',
		_meta: {
			received_time: new Date().toISOString(),
			device_id: src,
			receiver: 'ieee802154-triumvi-gateway',
			gateway_id: _gateway_id
		}
	};

	// We always have power
	out.Power = data.readUInt32LE(0) / 1000.0;
	out.power_watts = out.Power;

	// Check if we have more
	if (data.length >= 5) {
		// Keep track of where we are processing in the Triumvi packet
		var offset = 5;

		// Get a list of what we should expect;
		var status_byte = data.readUInt8(4);

		if (status_byte & TRIUMVI_STATUSREG_BATTERYPACKET) {
			out.battery_pack_attached = true;
			out.panel_id = data.readUInt8(offset);
			out.circuit_id = data.readUInt8(offset+1);
			offset += 2;
		}

		if (status_byte & TRIUMVI_STATUSREG_POWERFACTOR) {
			out.power_factor = data.readUInt16LE(offset);
			out.voltage_rms_volts = data.readUInt16LE(offset+2);
			out.current_rms_amps = data.readUInt16LE(offset+4);
			offset += 6;
		}

		if (status_byte & TRIUMVI_STATUSREG_THREEPHASE) {
			out.three_phase_meter = true;
		}

		if (status_byte & TRIUMVI_STATUSREG_FRAMWRITE) {
			out.fram_write = true;
		}
	}

	_mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
}



/*******************************************************************************
 * MAIN
 ******************************************************************************/



// There is a currently unknown issue where this script will hang sometimes,
// for the moment, we work around it with a watchdog timer
var watchdog = new watchout(1*60*1000, function(didCancelWatchdog) {
	if (!didCancelWatchdog) {
		console.log("Watchdog tripped");
		process.exit(1);
	}
});




// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/triumvi.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.key === undefined || config.key == '' ||
        config.channel === undefined || config.channel == '' ||
        config.panid === undefined || config.panid == '' ||
        config.wpanindex === undefined || config.wpanindex == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/triumvi.conf or triumvi not configured correctly.');
    process.exit(1);
}


// Get a buffer for the AES key
_aes_key = new Buffer(config.key.trim(), 'hex');


// Connect to MQTT
_mqtt_client = mqtt.connect('mqtt://localhost');
_mqtt_client.on('connect', function () {
    console.log('Connected to MQTT');

    // Get MAC address
    getmac.getMac(function (err, addr) {
    	_gateway_id = addr;

    	// Different setup procedure if using Linux/CC2520 or CC2538 pass through

		// Determine if any wlan devices exist
		exec('ifconfig -a', function (err, stdout, stderr) {
			if (err) {
				console.log('Error trying to get network interfaces to determine if wlan exists.');
				return;
			}

			if (stdout.indexOf('wpan' + config.wpanindex.trim()) > -1) {
				// OK! Use linux version.
				console.log('Using Linux method for getting 15.4 packets.');

				// These commands must be run to initialize the gateway
				var COMMANDS = [
					'iwpan phy phy' + config.wpanindex.trim() + ' set channel 0 ' + config.channel.trim(),
					'ifconfig wpan' + config.wpanindex.trim() + ' down',
					'iwpan dev wpan' + config.wpanindex.trim() + ' set pan_id 0x' + config.panid.trim(),
					'ifconfig wpan' + config.wpanindex.trim() + ' up'
				];

				async.eachSeries(COMMANDS, function (cmd, callback) {
					console.log('Running `' + cmd + '`');
					// Run the command as if a shell
					exec(cmd, function (err, stdout, stderr) {
						callback(err);
					});
				}, function (err) {
					if (err) {
						console.log('Error running commands to setup 15.4 interface.');
						console.log(err);
						return;
					}

					// Now open the socket to hear 15.4 packets
					var socket = raw.createSocket({
						protocol: raw.htons(ETH_P_IEEE802154),
						addressFamily: 17
					});

					// This will receive all 15.4 packets
					// Needs some sort of filtering
					socket.on('message', function (buffer, source) {
						watchdog.reset();

						parse_packet(buffer);
					});
				});

			} else {
				// Use the other (CC2538) version!
				console.log('Pulling 15.4 packets from MQTT. Topic: ' + MQTT_CC2538_RAW);

				// This pulls for a CC2538 topic.
				_mqtt_client.subscribe(MQTT_CC2538_RAW);
				_mqtt_client.on('message', function (topic, message) {
					if (topic === MQTT_CC2538_RAW) {
						watchdog.reset();

						parse_packet(message);
					}
				});
			}
		});
	});
});