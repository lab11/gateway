#!/usr/bin/env node

// Set advertisement rate to be once per second. This must be set before
// including the bleno library (which is included from eddystone-beacon).
process.env['BLENO_ADVERTISING_INTERVAL'] = 1000;

var os    = require('os');

var mqtt  = require('mqtt');
var bleno = require('bleno');
var debug = require('debug')('gateway-triumvi-ble');


var MQTT_TOPIC_NAME = 'device/Triumvi/+';

var DEVICE_NAME         = 'triumvi_gateway';
var SERVICE_UUID        = '774a035eb8d24f0c9d3247901afef8e0';
var CHARACTERISTIC_UUID = '774a035eb8d24f0c9d3247901afef8e1';

// At 12 bytes per triumvi, we can fit 42 data packets in a 512 byte
// characteristic.
var TRIUMVI_DATA_BUFFER_MAX_LEN = 42;

// Holding pond for triumvi data.
var _triumvi_data_buffers = [];

// Generated when a notification is generated. Since notifications only pass
// 20 bytes, this allows the master to call read to get the rest of the bytes.
var _current_read = Buffer.alloc(0);

// If there is a connected master that has subscribed to notifications, this
// will be a valid callback.
var _notify_callback = null;



var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
	// Subscribe to all Triumvi packets
	mqtt_client.subscribe(MQTT_TOPIC_NAME);

	// Callback for each Triumvi packet
	mqtt_client.on('message', (topic, message) => {
		try {
			var pkt = JSON.parse(message);

			// Get the Triumvi ID in a buffer.
			var id = Buffer.from(pkt._meta.device_id, 'hex');

			// Get the circuit, panel, and power data in a buffer.
			var end = Buffer.alloc(6);
			end.writeUInt8(pkt.panel_id, 0);
			end.writeUInt8(pkt.circuit_id, 1);
			end.writeInt32LE(pkt.power_watts, 2);

			// Make them one
			var all = Buffer.concat([id, end]);
			debug('incoming: '+pkt._meta.device_id+' '+pkt.panel_id+':'+pkt.circuit_id+' '+pkt.power_watts+'W');

			// Save this for delivering to a connected client.
			_triumvi_data_buffers.push(all);
		} catch (e) {
			console.log('Skipping packet: ' + e);
		}

		// If we are full, notify the client.
		if (_triumvi_data_buffers.length == 36) {
			notify_subscriber();
		}
	});
});

function advertise_ip_address (ip) {
	console.log('Advertising http://' + ip);

	// Ok lets generate some advertising data.
	// We just hack this in for now. No real reason to cobble all of
	// the code together to format this in a generic way.
	var buf_ip = Buffer.from(ip);
	var buf_flags = Buffer.from([2, 0x01, 0x06]);
	var buf_short_services = Buffer.from([3, 0x03, 0xAA, 0xFE]); // eddystone
	var buf_eddystone = Buffer.from([ip.length+6, 0x16, 0xAA, 0xFE, 0x10, 0xEB, 0x02]); // eddystone header
	var adv_data = Buffer.concat([buf_flags, buf_short_services, buf_eddystone, buf_ip]);

	// We also want a name, so generate a scan response.
	var name = DEVICE_NAME;
	var buf_name = Buffer.from(name);
	var buf_device_name = Buffer.from([name.length+1, 0x09]);
	var scan_data = Buffer.concat([buf_device_name, buf_name]);

	// Tell bleno to use this data.
	bleno.startAdvertisingWithEIRData(adv_data, scan_data);
}

function setup_advertisement () {
	var ifaces = os.networkInterfaces();
	var ifnames = Object.keys(ifaces);
	var found = false;

	for (var i=0; i<ifnames.length; i++) {
		if (found) break;

		var iface = ifaces[ifnames[i]];

		for (var j=0; j<iface.length; j++) {
			var addr = iface[j];

			if ('IPv4' !== addr.family || addr.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				continue;
			}

			// We have found the first non-local IPv4 address. Advertise it.
			found = true;
			advertise_ip_address(addr.address);
			break;
		}
	}

	// If we didn't find anything, we may very well not have an ip address
	// yet. Use a blank value and try again in 5 minutes.
	if (!found) {
		advertise_ip_address('0.0.0.0');
		console.log('Trying again to find IP in 1 minute');
		setTimeout(function () {
			setup_advertisement();
		}, 1*60*1000);
	}
}

bleno.on('stateChange', function(state) {
	debug('on -> stateChange: ' + state);

	if (state === 'poweredOn') {
		setup_advertisement();

	} else {
		bleno.stopAdvertising();
	}
});

bleno.on('advertisingStart', function(error) {
	debug('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

	if (!error) {
		// If we get this far, we should be good (let's hope).
		clearTimeout(startup_timeout);

		bleno.setServices([
			new bleno.PrimaryService({
				uuid: SERVICE_UUID,
				characteristics: [
					new bleno.Characteristic({
						uuid: CHARACTERISTIC_UUID,
						properties: ['read', 'notify'],
						onReadRequest: function (offset, callback) {
							if (offset == 0) {
								debug('Read characteristic.');
							}

							callback(bleno.Characteristic.RESULT_SUCCESS, _current_read.slice(offset));
						},
						onSubscribe: function (maxValueSize, updateValueCallback) {
							debug('subscribe characteristic');
							_notify_callback = updateValueCallback;
						},
						onUnsubscribe: function () {
							_notify_callback = null;
						}
					})
				]
			})
		]);
	}
});

bleno.on('advertisingStartError', function (err) {
	debug('adv start err: ' + err);
	debug(err);
})

bleno.on('disconnect', function (client_address) {
	debug('DISCONNECT ' + client_address);
});

bleno.on('advertisingStop', function () {
	debug('ADV STOPPED');
});

// Set a timer to allow us to exit if things don't get working. BLE can be
// finicky, and the library support just isn't robust enough.
// 2 minutes to get things going.
var startup_timeout = setTimeout(function () {
	console.log('Exiting because we never got things setup.');
	process.exit(1);
}, 2*60*1000);

// Trigger a notification every second (if there is data).
setInterval(function () {
	if (_triumvi_data_buffers.length > 0) {
		notify_subscriber();
	}
}, 1000);

function notify_subscriber () {
	_current_read = Buffer.concat(_triumvi_data_buffers);
	_triumvi_data_buffers = [];

	if (_notify_callback != null) {
		_notify_callback(_current_read);
	}
}
