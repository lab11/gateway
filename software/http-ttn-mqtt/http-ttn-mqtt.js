#!/usr/bin/env node

var fs        = require('fs');

var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('http-ttn-mqtt');
var ini       = require('ini');
var ttn       = require('ttn');
var Geohash   = require('latlon-geohash');
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


function ParseDMS(input) {
    var parts = input.split(/[^\d\w]+/);

    // Check if we got decimal minutes or seconds
    if (input.indexOf('.') >= 0) {
        return ConvertDMSToDD(parseInt(parts[0]), parseFloat(parts[1]+'.'+parts[2]), 0.0, parts[3]);
    } else {
        // Got minutes and seconds
        return ConvertDMSToDD(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), parts[3]);
    }
}

function ConvertDMSToDD(degrees, minutes, seconds, direction) {
    var dd = degrees + minutes/60 + seconds/(60*60);

    if (direction == "S" || direction == "W") {
        dd = dd * -1;
    } // Don't do anything for N or E
    return dd;
}




var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    var client = new ttn.DataClient(config.appID, config.accessKey, 'us-west.thethings.network:1883');
    debug('Connected to TTN')


    client.on("uplink", function (devID, payload) {
        console.log("Received uplink from ", devID)
        console.log(payload)
        console.log(payload.metadata.gateways)

        var out = {};

        // We definitely want the extracted data if it exists.
        if ('payload_fields' in payload) {
            out = payload.payload_fields;
        }

        // Other fields to plot as data
        out.counter = payload.counter;
        out.confirmed = payload.confirmed;
        out.lorawan_frequency = payload.metadata.frequency;
        out.lorawan_modulation = payload.metadata.modulation;
        out.lorawan_data_rate = payload.metadata.data_rate;
        out.lorawan_airtime = payload.metadata.airtime;
        out.lorawan_coding_rate = payload.metadata.coding_rate;
        out.number_receiving_gateways = payload.metadata.gateways.length;

        // Find the best RSSI gateway
        var best_rssi = -1000;
        var best_rssi_index = 0;
        for (var i=0; i<payload.metadata.gateways.length; i++) {
            if (payload.metadata.gateways[i].rssi > best_rssi) {
                best_rssi_index = i;
            }
        }

        // Extract gateway parameters
        out.rssi = payload.metadata.gateways[best_rssi_index].rssi;
        out.snr = payload.metadata.gateways[best_rssi_index].snr;
        out.channel = payload.metadata.gateways[best_rssi_index].channel;

        // Rest is metadata
        out._meta = {
            received_time: payload.metadata.time,
            device_id: payload.hardware_serial,
            receiver: 'http-ttn-mqtt'
        }

        out._meta.gateway_id = payload.metadata.gateways[best_rssi_index].gtw_id;

        // Convert lat/lon to geohash if it exists
        if ('lat' in out && 'lon' in out) {
            let ghash = '';
            if (out.lat.indexOf('°') >= 0) {
                let lat = ParseDMS(out.lat);
                let lon = ParseDMS(out.lon);
                ghash = Geohash.encode(lat, lon);
            } else {
                ghash = Geohash.encode(out.lat, out.lon);
            }
            out.geohash = ghash;
        }


        console.log(out);
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));

    });
});

