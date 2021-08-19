#!/usr/bin/env node

var fs        = require('fs');

var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('http-awairlocal-publish');
var ini       = require('ini');
var gatewayId = require('lab11-gateway-id');
var mqtt      = require('mqtt');
var request   = require('request');

var MQTT_TOPIC_NAME = 'gateway-data';

// Get the ID for this gateway
var _gateway_id = '';
gatewayId.id(function (addr) {
    _gateway_id = addr;
});

// Default config file path
var config_file = '/etc/swarm-gateway/awairlocal.conf';

// Check if the user wants to override that.
if ('config' in argv) {
    config_file = argv.config;
}

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync(config_file, 'utf-8');
    var config = ini.parse(config_file);
    if (config.arpscan_file == undefined) {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find ' + config_file + ' or awair not configured.');
    process.exit(1);
}

const AWAIR_MAC_PREFIX = '70:88:6b';

// These IP addresses start with '70:88:6b'. They may not support the local
// endpoints we are using in this script.
var awair_ip_addresses_matching_mac = [];

// These IP addresses support the local endpoints.
var awair_ip_addresses = [];

// Saved metadata for awair devices keyed by IP address.
var awair_metadata_byip = {};


// Parse a file from the arp-scan tool to determine possible awair devices
// on the network.
function get_awair_ip_addresses () {
    var lineReader = require('readline').createInterface({
        input: require('fs').createReadStream(config.arpscan_file)
    });

    lineReader.on('line', function (line) {
        var fields = line.split(/\s+/);

        // There are various other printed lines, but all we care about is
        // matching the awair mac address.
        if (fields.length > 2) {
            mac = fields[1];
            if (mac.startsWith(AWAIR_MAC_PREFIX)) {
                ip_address = fields[0];

                // Save IP address from discovered Awair device.
                awair_ip_addresses_matching_mac.push(ip_address);
            }
        }
    });
}

function get_awair_metadata (ipaddress) {
    var metadata_url = 'http://'+ipaddress+'/settings/config/data';

    // /settings/config/data
    //
    // {
    //     "device_uuid": "awair-omni_15891",
    //     "wifi_mac": "70:88:6B:12:3B:81",
    //     "ip": "172.27.145.147",
    //     "netmask": "255.255.254.0",
    //     "gateway": "172.27.144.1",
    //     "fw_version": "1.5.2",
    //     "timezone": "America/New_York",
    //     "display": "score",
    //     "led": {
    //         "mode": "auto",
    //         "brightness": 70
    //     },
    //     "power-status": {
    //         "battery": 100,
    //         "plugged": true
    //     }
    // }
    request(metadata_url, function (error, response, body) {
        if (error) {
            if (error.errno == -61) {
                // This is `ECONNREFUSED`, which means this awair does not
                // support the local mode.
                console.log('WARNING: Awair '+ipaddress+' does not support local API.');
                return;
            }
            console.log('ERROR: Could not get metadata from '+ipaddress)
            console.log('  URL: '+metadata_url)
            console.log(error)
            return;
        }

        try {
            var data = JSON.parse(body);

            // Get device id without ":"" and all lowercase.
            var device_id = data.wifi_mac.toLowerCase();
            device_id = device_id.replace(/\W/g, '');

            var metadata = {
                'device_uuid': data.device_uuid,
                'device_id': device_id,
            };

            // Save metadata to the global table.
            awair_metadata_byip[ipaddress] = metadata;

            // And since we were able to get metadata, add to known ip address
            // list.
            awair_ip_addresses.push(ipaddress);

        } catch (err) {
            console.log('ERROR: Could not parse metadata from '+ipaddress)
            console.log(err)
            console.log(body)
        }

    });
}

// Update metadata for all known awair IP addresses.
function get_all_awair_metadata () {
    for (ipaddress of awair_ip_addresses_matching_mac) {
        get_awair_metadata(ipaddress);
    }
}

function get_awair_data (ipaddress) {
    var data_url = 'http://'+ipaddress+'/air-data/latest';

    // /air-data/latest
    //
    // {
    //     "timestamp": "2021-08-19T16:47:44.519Z",
    //     "score": 97,
    //     "temp": 21.97,
    //     "humid": 51.00,
    //     "co2": 428,
    //     "voc": 70,
    //     "pm25": 1,
    //     "lux": 0.0,
    //     "spl_a": 48.6
    // }
    request(data_url, function (error, response, body) {
        if (error) {
            console.log('ERROR: Could not get data from '+ipaddress)
            console.log('  URL: '+data_url)
            console.log(error)
            return;
        }

        // Check that we know metadata about this awair. If not, don't bother
        // even trying to parse or anything.
        if (!(ipaddress in awair_metadata_byip)) {
            return;
        }

        try {
            var data = JSON.parse(body);

            var mapping = {
                'score': 'awair_score',
                'temp': 'Temperature_°C',
                'humid': 'Humidity_%',
                'co2': 'co2_ppm',
                'voc': 'voc_ppb',
                'pm25': 'pm2.5_μg/m3',
                'lux': 'Illumination_lx',
                'spl_a': 'spl_a',
            };

            var timestamp = data.timestamp;

            var out = {};

            // Save the measured data with correctly mapped names.
            for (const mname in data) {
                if (mname in mapping) {
                    out[mapping[mname]] = data[mname];
                }
            }

            // Get the saved metadata.
            metadata = awair_metadata_byip[ipaddress];

            // Add the _meta metadata to complete the standard lab11-gateway
            // format.
            out._meta = {
                received_time: timestamp,
                device_id: metadata.device_id,
                receiver: 'http-awairlocal-publish',
                gateway_id: _gateway_id,
                awair_device_uuid: metadata.device_uuid,
            }

            mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));

        } catch (err) {
            console.log('ERROR: Could not parse metadata from '+ipaddress)
            console.log(err)
            console.log(body)
        }

    });
}

// Get data for all known awair IP addresses.
function get_all_awair_data () {
    for (ipaddress of awair_ip_addresses) {
        get_awair_data(ipaddress);
    }
}



// Start of operations

function start () {

    // Get list of awair ip addresses, and updated every hour.
    get_awair_ip_addresses();

    setInterval(function () {
        // Reset known state.
        awair_ip_addresses_matching_mac = [];

        // Query metadata again.
        get_awair_ip_addresses();
    }, 60*60*1000);



    // Get all metadata initially, and every 10 minutes update it.
    setTimeout(function () {
        get_all_awair_metadata();
    }, 500);

    setInterval(function () {
        // Reset known state.
        awair_ip_addresses = [];
        awair_metadata_byip = {};

        // Query metadata again.
        get_all_awair_metadata();
    }, 10*60*1000);



    // Every 10 seconds get data from each known awair sensor.
    setInterval(function () {
        get_all_awair_data();
    }, 10*1000);

}



var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    start();
});
