#!/usr/bin/env node

/*
Collects raw BLE advertisements and publishes metadata about them to influxdb.
*/

var argv         = require('minimist')(process.argv.slice(2));
var fs           = require('fs');
var ini          = require('ini');
var InfluxPoster = require('influx-poster');
var noble        = require('noble');
var gatewayId    = require('lab11-gateway-id');

// How long to batch data for before posting
var DATA_LIMIT_LINES = 200000;
var DATA_LIMIT_TIME  = 15*1000;


// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/influxdb.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.host == undefined || config.host == '' ||
        config.database == undefined || config.database == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/influxdb.conf or influxdb not configured.');
    process.exit(1);
}

// Add some reasonable defaults where needed
if (! ('port'     in config) ) config.port     = 8086;
if (! ('protocol' in config) ) config.protocol = 'http';
if (! ('prefix'   in config) ) config.prefix   = '';

// Let the command line override conf file settings
if ('host'     in argv) config.host     = argv.host;
if ('port'     in argv) config.port     = argv.port;
if ('protocol' in argv) config.protocol = argv.protocol;
if ('database' in argv) config.database = argv.database;
if ('username' in argv) config.username = argv.username;
if ('password' in argv) config.password = argv.password;
if ('prefix'   in argv) config.prefix   = argv.prefix;

var influx_poster = new InfluxPoster({
    host: config.host,
    database: config.database,
    port: config.port,
    protocol: config.protocol,
    username: config.username,
    password: config.password,
    prefix: config.prefix,
}, DATA_LIMIT_LINES, DATA_LIMIT_TIME);

console.log("Using influx at " + config.protocol + "://" + config.host +
        ":" + config.port + "  db=" + config.database)


// Convert a field of the JSON object
// to a useful for format for publishing to InfluxDB.
// This tries to convert standalone values to the correct InfluxDB type,
// and creates a multi-element measurement if the field is an object.
function fix_measurement (field) {

    function fix_measurement_no_objects (subfield) {
        if (typeof subfield === 'object') {
            return JSON.stringify(field);
        } else if (subfield === null) {
            return 'null';
        } else if (typeof subfield === 'number') {
            return subfield;
        } else if (typeof subfield === 'boolean') {
            return subfield;
        } else if (typeof subfield === 'string') {
            if (field.lower() === 'true') {
                return true;
            } else if (field.lower() === 'false') {
                return false;
            } else if (isFloat(field)) {
                parseFloat(field);
            } else {
                return field;
            }
        } else {
            return JSON.stringify(field);
        }
    }

    // Taken from https://github.com/chriso/validator.js/blob/master/lib/isFloat.js
    function isFloat (str) {
        var float = /^(?:[-+]?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/;

        if (str === '' || str === '.') {
            return false;
        }
        return float.test(str);
    }

    if (Array.isArray(field)) {
        // We cannot pass an array to Influx, so we must make it a string
        // before sending it to Influx.
        return JSON.stringify(field);
    } else if (field === null) {
        // There is no "null" type in Influx, not really sure what the user
        // wants, so lets send a string. Seems better than forcing it to a
        // bool.
        return 'null';
    } else if (typeof field === 'object') {
        // Want to pass this as a complex measurement. Otherwise we would
        // try to store "[object object]".
        var out = {};
        for (var key in field) {
            out[key] = fix_measurement_no_objects(field[key]);
        }
        return out;
    } else if (typeof field === 'number') {
        // A number will get stored as a float.
        return {value: field};
    } else if (typeof field === 'boolean') {
        // Booleans are OK too.
        return {value: field};
    } else if (typeof field === 'string') {
        // Strings are fine, but we want to promote things which are obviously
        // bools or numbers to the proper type.
        if (field.toLowerCase() === 'true') {
            // Check for any of 'true', 'True', 'TRUE', etc.
            return {value: true};
        } else if (field.toLowerCase() === 'false') {
            return {value: false};
        } else if (isFloat(field)) {
            // If this looks like a valid number, make it an actual number.
            // Since JS doesn't really do integers, and the influx publishing
            // library doesn't use the integer data type, no need to bother
            // worrying about if the number is an integer or not.
            return {value: parseFloat(field)};
        } else {
            // Well, guess it's just a string!
            return {value: field};
        }
    } else {
        // Based on the allowed types in a JSON, we should never get to
        // this case.
        console.log('Error parsing type (' + typeof field + ') of: ' + field);
        return {value: JSON.stringify(field)};
    }

}

// Handle the callback when scanning parameters change out from beneath us.
// This gives us the ability to set them back to how we want them.
noble.on('scanChanged', function (enable, filter_dups) {
    try {
        noble.startScanning([], true);
    } catch (e) { }
});

// Receive raw advertisement packets
noble.on('discover', function (peripheral) {
    var now = new Date().toISOString();

    // form a JSON blob
    var adv_obj = {
        'device': 'BLEPacket',
        'ble_id': peripheral.id,
        'receive_time': now,
        'sequence_number': -1,
        'device_type': 'unknown',
        'rssi': peripheral.rssi,
    };

    // determine device type if possible
    if (peripheral.id.startsWith('c098e5')) {
        var advertisement = peripheral.advertisement;
        switch (peripheral.id.substring(6,8)) {
            case '44':
                adv_obj.device_type = 'tripoint';
                break;
            case '45':
                adv_obj.device_type = 'tritag';
                break;
            case '30':
                adv_obj.device_type = 'blees';

                // get sequence number
                if (advertisement.manufacturerData) {
                    if (advertisement.manufacturerData.length >= 14) {
                        var manufacturer_id = advertisement.manufacturerData.readUIntLE(0, 2);
                        var service_id = advertisement.manufacturerData.readUInt8(2);
                        if (manufacturer_id == 0x02E0 && service_id == 0x12) {
                            var sensor_data = advertisement.manufacturerData.slice(3);
                            if (sensor_data.length >= 15) {
                                adv_obj.sequence_number = sensor_data.readUIntLE(11,4);
                            }
                        }
                    }
                }
                break;
            case '40':
                adv_obj.device_type = 'squall';
                break;
            case '50':
                adv_obj.device_type = 'torch';
                break;
            case '70':
                adv_obj.device_type = 'powerblade';

                // get sequence number
                if (advertisement.manufacturerData) {
                    if (advertisement.manufacturerData.length >= 19) {
                        var company_id = advertisement.manufacturerData.readUIntLE(0,2);
                        var data = advertisement.manufacturerData.slice(3);
                        if (company_id == 0x4908) {
                            // allow backwards compatibility with old powerblade format
                            data = advertisement.manufacturerData.slice(2);
                        }

                        // check software version number
                        var version_num = data.readUIntBE(0,1);
                        if (version_num >= 1) {

                            // parse sequence number from advertisement
                            adv_obj.sequence_number = data.readUIntBE(1,4);
                        }
                    }
                }
                break;
            case '80':
                adv_obj.device_type = 'nucleum';
                break;
            case '90':
                adv_obj.device_type = 'blink';
                break;
            case 'df':
                adv_obj.device_type = 'dfu';
                break;
            case 'b0':
                adv_obj.device_type = 'shoes';
                break;
            case 'c0':
                adv_obj.device_type = 'gateway';
                break;
            case 'd0':
                adv_obj.device_type = 'monjolo';

                // get sequence number
                if (advertisement.manufacturerData) {
                    if (advertisement.manufacturerData.length >= 4) {
                        var manufacturer_id = advertisement.manufacturerData.readUIntLE(0, 2);
                        var service_id = advertisement.manufacturerData.readUInt8(2);
                        if (manufacturer_id == 0x02E0 && service_id == 0x18) {
                            var version = advertisement.manufacturerData.readUInt8(3);
                            var data = advertisement.manufacturerData.slice(4);
                            if (version == 1 && data.length == 9) {
                                adv_obj.sequence_number = data.readUIntLE(5,4);
                            }
                        }
                    }
                }
                break;
            case 'e0':
                adv_obj.device_type = 'coughdetect';
                break;
            case 'f0':
                adv_obj.device_type = 'eink';
                break;
            case '1d':
                adv_obj.device_type = 'bgauge';
                break;
            case '12':
                adv_obj.device_type = 'signpost';
                break;
            case '13':
                adv_obj.device_type = 'hail';
                break;
            default:
                adv_obj.device_type = 'umich';
                break;
        }
    }

    // Create meta section
    adv_obj._meta = {
        received_time: now,
        device_id:     peripheral.id,
        receiver:      'ble-influxdb',
        gateway_id:    this_gateway_id,
    };

    // Get device id
    var device_id = undefined;
    if ('_meta' in adv_obj) {
        device_id = adv_obj._meta.device_id;
    } else if ('id' in adv_obj) {
        device_id = adv_obj.id;
    }

    // Make sure the device id is only alpha numerical characters
    device_id.replace(/\W/g, '');

    var device_class = adv_obj['device'];
    delete adv_obj.device;

    var timestamp  = new Date(adv_obj['_meta']['received_time']).getTime();
    var receiver   = adv_obj['_meta']['receiver'];
    var gateway_id = adv_obj['_meta']['gateway_id'];

    // Continue on to post to influxdb
    if (device_id) {

        // Delete meta key and possible id key
        delete adv_obj._meta;
        delete adv_obj.id;

        // Only publish if there is some data
        if (Object.keys(adv_obj).length > 0) {
            for (var key in adv_obj) {
                var tags = {
                    device_id: device_id,
                    device_class: device_class,
                    receiver: receiver,
                    gateway_id: gateway_id,
                };

                var fields = fix_measurement(adv_obj[key]);

                var point = [
                    key,
                    tags,
                    fields,
                    timestamp
                ];

                influx_poster.write_data(point);
            }
        }
    }
});


// Start up BLE scanning
var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
        noble.startScanning([], true);
    } else {
        noble.once('stateChange', startScanningOnPowerOn);
    }
};

// Pre-fetch the gateway ID
var this_gateway_id = '';
gatewayId.id((addr) => {
    this_gateway_id = addr;

    // Now start BLE scanning.
    startScanningOnPowerOn();
});
