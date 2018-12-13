#!/usr/bin/env node

var fs        = require('fs');

var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('http-awair-publish');
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
var config_file = '/etc/swarm-gateway/awair.conf';

// Check if the user wants to override that.
if ('config' in argv) {
    config_file = argv.config;
}

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync(config_file, 'utf-8');
    var config = ini.parse(config_file);
    if (config.token == undefined || config.token == []) {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find ' + config_file + ' or awair not configured.');
    process.exit(1);
}

function get_sensor_data (token) {
    var request_obj = {
        headers: {
            'Authorization': 'Bearer ' + token
        },
        uri: 'https://internal.awair.is/v1.1/users/self/devices'
    };

	request(request_obj, function (error, response, body) {
        if (error) {
            console.log(error)
            console.log(request_url)
        }

        try {
            data = JSON.parse(body);

            for (let device of data.data) {

                var out = {};

                var timestamp = new Date().toISOString();

                if ('score' in device) {
                    var mapping = {
                        'temp': 'Temperature_°C',
                        'humid': 'Humidity_%',
                        'co2': 'co2_ppm',
                        'voc': 'voc_ppb',
                        'pm25': 'pm2.5_μg/m3'
                    };

                    // Save the score
                    out.awair_score = device.score.score;

                    // Save the measured data
                    for (var measurement in device.score.sensor) {
                        if (measurement in mapping) {
                            out[mapping[measurement]] = device.score.sensor[measurement];
                        } else {
                            out[measurement] = device.score.sensor[measurement];
                        }
                    }

                    // Get the timestamp if provided
                    if ('timestamp' in device.score) {
                        timestamp = device.score.timestamp;
                    }
                }

                if ('switch' in device) {
                    out.switch_on = device.switch.on;
                }

                // Add in the other fields that make the whole gateway system work.
                out.device = device.type;
                out._meta = {
                    received_time: timestamp,
                    device_id: 'awair-' + device.id,
                    receiver: 'http-awair-publish',
                    gateway_id: _gateway_id
                }

                mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
                // console.log(out);
            }

        } catch (err) {
            console.log(err)
            console.log(body)
        }
	});
}

var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    function make_requests() {
        for (var token of config.token) {
            get_sensor_data(token);
        }
    }

    // Awair publishes every 10 seconds.
    setInterval(make_requests, 10*1000);
});
