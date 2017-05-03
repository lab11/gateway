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

var GatewayTopics = require('gateway-topics');

/*******************************************************************************
 * Constants
 ******************************************************************************/

// Type to listen on to get raw 15.4 packets for CC2520.
var ETH_P_IEEE802154 = 0x00F6;

var MQTT_TOPIC_NAME = 'gateway-data';


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
var TRIUMVI_STATUSREG_TIMESTAMP     = 0x02;
var TRIUMVI_STATUSREG_PKTCOUNTER    = 0x01;

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

	// Special function for parsing exponent in upper bits of encoded values
	function exponent_transform (buf, offset, len) {
		if (len == 4) {
			var reading = buf.readUInt32LE(offset);
			var exponent = (((reading & (0x3<<30))>>30) & 0x3);
			reading &= ~(0x3<<30);
		} else if (len == 2) {
			var reading = buf.readUInt16LE(offset);
			var exponent = (((reading & (0x3<<14))>>14) & 0x3);
			reading &= ~(0x3<<14);
		}
		reading <<= (2*exponent);
		return reading;
	}

	// We always have power
	out.Power = exponent_transform(data, 0, 4) / 1000.0;
	out.power_watts = out.Power;

	// Check if we have more
	if (data.length >= 5) {
		// Keep track of where we are processing in the Triumvi packet
		var offset = 5;

		// Get a list of what we should expect;
		var status_byte = data.readUInt8(4);

		if (status_byte & TRIUMVI_STATUSREG_EXTERNALVOLT) {
			out.external_voltage_waveform = true;
			out._meta.external_voltage_waveform = out.external_voltage_waveform;
		}

		if (status_byte & TRIUMVI_STATUSREG_BATTERYPACKET) {
			out.battery_pack_attached = true;
			out.panel_id = data.readUInt8(offset);
			out.circuit_id = data.readUInt8(offset+1);
			offset += 2;

			out._meta.battery_pack_attached = out.battery_pack_attached;
			out._meta.panel_id = out.panel_id;
			out._meta.circuit_id = out.circuit_id;
		}

		if (status_byte & TRIUMVI_STATUSREG_POWERFACTOR) {
			out.power_factor = data.readUInt16LE(offset) / 1000;
			out.voltage_rms_volts = data.readUInt8(offset+2);
			out.ina_gain = data.readUInt8(offset+3);
			out.current_rms_amps = exponent_transform(data, offset+4, 2) / 1000;
			offset += 6;
		}

		if (status_byte & TRIUMVI_STATUSREG_THREEPHASE) {
			out.three_phase_meter = true;
			out._meta.three_phase_meter = out.three_phase_meter;
		}

		if (status_byte & TRIUMVI_STATUSREG_FRAMWRITE) {
			out.fram_write = true;
		}

		if (status_byte & TRIUMVI_STATUSREG_TIMESTAMP) {
			year   = 2000 + data.readUInt8(offset);
			month  = data.readUInt8(offset+1)-1;
			day    = data.readUInt8(offset+2);
			hour   = data.readUInt8(offset+3);
			minute = data.readUInt8(offset+4);
			second = data.readUInt8(offset+5);
			out.sample_timestamp = new Date(year, month, day, hour, minute, second).toISOString();
			offset += 6;
		}

		if (status_byte & TRIUMVI_STATUSREG_PKTCOUNTER) {
			out.counter = data.readUInt32LE(offset);
			offset += 4;
		}
	}

	_mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
	GatewayTopics.publish(out);
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
				console.log('Pulling 15.4 packets from CC2538');

				var SPI = require('spi');
				var gpio = require('onoff');

				// Constants

				var CC2538_SPI_REQ_DATA = 0;
				var CC2538_SPI_GET_LENGTH = 1;
				var CC2538_SPI_GET_DATA = 2;
				var CC2538_SPI_MASTER_RADIO_ON = 3;
				var CC2538_SPI_MASTER_RADIO_OFF = 4;
				var CC2538_SPI_RF_PACKET_SEND = 5;
				var CC2538_SPI_MASTER_SET_TIME = 6;
				var CC2538_SPI_MASTER_RST_RF_FIFO = 7;

				var MIN_TRIUMVI_PKT_LEN = 14;

				// Init

				// Options for connecting to the CC2538
				var spi_options = {
					mode: SPI.MODE['MODE_3'],
					maxSpeed: 2000000
				};

				// Hopefully this path doesn't change
				var spi = new SPI.Spi('/dev/spidev5.1', spi_options);
				spi.open()

				// Need a GPIO for the CS line. Apparently the built in CS line won't work.
				// Also need to make sure it is in GPIO mode
				fs.writeFileSync('/sys/kernel/debug/gpio_debug/gpio110/current_pinmux', 'mode0');
				var spi_cs = gpio.Gpio(110, 'out');
				spi_cs.writeSync(1);

				// Need to make CS1 a GPIO for things to work. Don't know why.
				fs.writeFileSync('/sys/kernel/debug/gpio_debug/gpio111/current_pinmux', 'mode0');
				var spi_cs1 = gpio.Gpio(111, 'out');
				spi_cs1.writeSync(1);

				// Also have a GPIO that does a reset of sorts
				var cc2538_reset = gpio.Gpio(41, 'out');

				// And the "fifth SPI line" an interrupt line for the CC2538
				var cc2538_interrupt = new gpio.Gpio(43, 'in', 'rising');

				// Need this on init for some reason
				spi.write(new Buffer([0]));

				// Then do a CC2538 reset
				cc2538_reset.writeSync(0);
				cc2538_reset.writeSync(1);

				function handle_interrupt (err, value) {

					// This is magic that makes things work
					spi.write(new Buffer([0]));

					// Write a 0 to effectively wake the CC2538 up
					spi_cs.writeSync(0);
					spi.write(new Buffer([CC2538_SPI_REQ_DATA]));
					spi_cs.writeSync(1);

					// Wait for the CC2538 to be ready
					while (cc2538_interrupt.readSync() == 1);


					var length_buffer = new Buffer(1);

					spi.write(new Buffer([0]));
					spi_cs.writeSync(0);
					spi.transfer(new Buffer([CC2538_SPI_GET_LENGTH]), length_buffer);
					spi_cs.writeSync(1);


					if (length_buffer[0] < MIN_TRIUMVI_PKT_LEN) {

						// Flush
						spi.write(new Buffer([0]));

						spi_cs.writeSync(0);
						spi.write(new Buffer([CC2538_SPI_GET_DATA, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
						spi_cs.writeSync(1);


					} else {

						var len = length_buffer[0];

						var send = new Buffer(len);
						var recv = new Buffer(len);
						var to_read = len;
						var index = 0;

						send[0] = CC2538_SPI_GET_DATA;
						send[1] = len-1;

						spi.write(new Buffer(1));

						// Read the packet in 20 byte chunks.
						// Longer buffers cause the whole thing to hang.
						spi_cs.writeSync(0);
						while (to_read > 0) {

							var byte_count = 20;
							if (to_read < 20) {
								var byte_count = to_read;
							}
							to_read -= byte_count;

							spi.transfer(send.slice(index, index+byte_count), recv.slice(index, index+byte_count));

							index += byte_count
						}
						spi_cs.writeSync(1);

						watchdog.reset();
						parse_packet(recv);
					}

					if (cc2538_interrupt.readSync() == 1) {
						handle_interrupt(null, 10);
					}

				}

				// Wait for interrupts from the CC2538
				cc2538_interrupt.watch(handle_interrupt);

				// Check if the radio is already ready with a packet
				if (cc2538_interrupt.readSync() == 1) {
					handle_interrupt(null, 10);
				}

				// Setup a timer so that we update the CC2538 with the
				// correct time periodically.
				setInterval(function () {
					var now = new Date;

					// Write the timestamp out to the CC2538
					spi.write(new Buffer([0]));
					spi_cs.writeSync(0);
					spi.write(new Buffer([CC2538_SPI_MASTER_SET_TIME, 7,
						now.getUTCFullYear()-2000,
						now.getUTCMonth()+1,
						now.getUTCDate(),
						now.getUTCHours(),
						now.getUTCMinutes(),
						now.getUTCSeconds()]));
					spi_cs.writeSync(1);
				})
			}
		});
	});
});
