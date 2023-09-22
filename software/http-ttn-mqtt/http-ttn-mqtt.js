#!/usr/bin/env node

var fs        = require('fs');

var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('http-ttn-mqtt');
var ini       = require('ini');
var mqtt      = require('mqtt');


var MQTT_TOPIC_NAME = 'gateway-data';


// Default config file path
var config_file = '/etc/swarm-gateway/thethingsnetwork.conf';

// Check if the user wants to override that.
if ('config' in argv) {
    config_file = argv.config;
}

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync(config_file, 'utf-8');
    var config = ini.parse(config_file);
    if (config.appID == undefined || config.appID == '') {
        throw new Exception('no settings');
    }
    if (config.accessKey == undefined || config.accessKey == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find ' + config_file + ' or ttn not configured.');
    process.exit(1);
}

var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    console.log('Connected to local MQTT');
    var client  = mqtt.connect('mqtts://nam1.cloud.thethings.network:8883', {'username':config.appID, 'password':config.accessKey})
    client.on('connect', function () {
        console.log('Connected to TTN');

        client.subscribe('#');

        client.on("message", function (topic, message, packet) {
            var payload = JSON.parse(message);

            var out = {};

            // We definitely want the extracted data if it exists.
            if ('uplink_message' in payload) {
                if ('decoded_payload' in payload.uplink_message) {
                    out = payload.uplink_message.decoded_payload;
                }
            }

            Object.keys(out).forEach(function (key) {
                if (out[key] === null) {
                    delete out[key];
                }
            });

            // Other fields to plot as data
            out.counter = payload.uplink_message.f_cnt;
            out.confirmed = payload.uplink_message.confirmed;
            out.lorawan_frequency = payload.uplink_message.settings.frequency;
            out.lorawan_bandwidth = payload.uplink_message.settings.data_rate.lora.bandwidth;
            out.lorawan_spreading_factor = payload.uplink_message.settings.data_rate.lora.spreading_factor;
            out.lorawan_airtime = payload.uplink_message.consumed_airtime;
            out.lorawan_coding_rate = payload.uplink_message.settings.coding_rate;
            out.number_receiving_gateways = payload.uplink_message.rx_metadata.length;

            // Find the best RSSI gateway
            var best_rssi = -1000;
            var best_rssi_index = 0;
            for (var i=0; i<payload.uplink_message.rx_metadata.length; i++) {
                if (payload.uplink_message.rx_metadata[i].rssi > best_rssi) {
                    best_rssi_index = i;
                }
            }

            // Extract gateway parameters
            out.rssi = payload.uplink_message.rx_metadata[best_rssi_index].rssi;
            out.snr = payload.uplink_message.rx_metadata[best_rssi_index].snr;

            // Rest is metadata
            out._meta = {
                received_time: payload.uplink_message.received_at,
                device_id: payload.end_device_ids.dev_eui,
                receiver: 'http-ttn-mqtt'
            }
            out._meta.gateway_id = payload.uplink_message.rx_metadata[best_rssi_index].gateway_ids.gateway_id;

            // Make special measurement for mapping purposes.
            if ('payload' in out && 'geohash' in out.payload && 'rssi' in out) {
                out.rssimap = {rssi: out.rssi, geohash: out.payload.geohash};
            }

            mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
            // console.log(JSON.stringify(out))
        });
    });
});
