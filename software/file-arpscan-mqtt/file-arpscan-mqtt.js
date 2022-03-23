#!/usr/bin/env node

var fs        = require('fs');

var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('file-arpscan-mqtt');
var ini       = require('ini');
var gatewayId = require('lab11-gateway-id');
var mqtt      = require('mqtt');

var MQTT_TOPIC_NAME = 'gateway-data';

// Get the ID for this gateway
var _gateway_id = '';
gatewayId.id(function (addr) {
    _gateway_id = addr;
});

// Default config file path
var config_file = '/etc/swarm-gateway/arpscan.conf';

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

var hosts = [];


// Parse a file from the arp-scan tool to list hosts on network.
function get_host_ip_addresses () {
    var lineReader = require('readline').createInterface({
        input: require('fs').createReadStream(config.arpscan_file)
    });

    var ipaddrcheck = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
    var macaddrcheck = /^[0-9a-f]{1,2}([\.:-])(?:[0-9a-f]{1,2}\1){4}[0-9a-f]{1,2}$/;

    lineReader.on('line', function (line) {
        var fields = line.split(/\s+/);

        // Valid lines of found devices are at least 3 fields.
        if (fields.length >= 3) {
            var ipaddr = fields[0];
            var macaddr = fields[1];

            // Check valid IPv4 address.
            if (!ipaddrcheck.test(ipaddr)) return;
            // Check valid MAC address.
            if (!macaddrcheck.test(macaddr)) return;

            var out = {"ipv4_address": ipaddr};

            // Add the _meta metadata to complete the standard lab11-gateway
            // format.
            out._meta = {
                device_id: macaddr.replace(/:/g, '').toLowerCase(),
                receiver: 'file-arpscan-mqtt',
                gateway_id: _gateway_id,
            }

            console.log(out)
            // mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
        }
    });
}

var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {

    // Wait until we have the gateway id.
    var wait_for_gatway_id = setInterval(function () {
        console.log('check')
        if (_gateway_id != '') {
            clearInterval(wait_for_gatway_id);
            // Now do work;
            get_host_ip_addresses();
        }
    }, 500);

});
