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

// Gets a list of devices for this awair account.
function get_awair_devices (token, start) {
    var s = '' + start.toISOString();
    // var e = '' + new Date(start.setDate(start.getDate() + 1)).toISOString();
    var e = '' + new Date(start.setHours(start.getHours() + 1)).toISOString();
    // var e = '' + new Date(start.setMinutes(start.getMinutes() + 5)).toISOString();

    // var e = new Date();
    // var e = new Date(new Date().setMinutes(start.getMinutes() + 3));

    // s = s.toISOString();
    // e = e.toISOString();

    console.log('retrieving from ' + s + ' to ' + e + ' for token ' + token);




    var request_obj = {
        headers: {
            'Authorization': 'Bearer ' + token
        },
        // uri: 'https://internal.awair.is/v1.1/users/self/devices'
        uri: 'http://developer-apis.awair.is/v1/users/self/devices'
    };

    request(request_obj, function (error, response, body) {
        if (error) {
            console.log(error)
            console.log(request_url)
        }

        try {
            data = JSON.parse(body);
            if ('devices' in data) {
                console.log('found ' + data.devices.length + ' devices');

                for (var device_index in data.devices) {
                    var device = data.devices[device_index];
                    // console.log('found device');
                    // console.log(device);

                    var device_type = device.deviceType;
                    var device_id = device.deviceId;
                    var mac_address = device.macAddress;

                    get_sensor_data(token, s,e, device_type, device_id, mac_address);
                }
            }
        } catch (err) {
            console.log(err)
            console.log(body)
        }


    });
}

function get_sensor_data (token, s, e, device_type, device_id, mac_address) {
    // now = new Date();
    // three_minutes_ago = new Date(new Date().setMinutes(now.getMinutes() - 3));






    var request_obj = {
        headers: {
            'Authorization': 'Bearer ' + token
        },
        // uri: 'https://internal.awair.is/v1.1/devices/'+device_type+'/'+device_id+'/events/score?desc=true&limit=1'
        // uri: 'http://developer-apis.awair.is/v1/users/self/devices/'+device_type+'/'+device_id+'/events/score?desc=true&limit=1'
        // uri: 'https://internal.awair.is/v1.1/users/self/devices'
        // uri: 'http://developer-apis.awair.is/v1/users/self/devices'
        // uri: 'https://internal.awair.is/v1.1/users/self/devices/8532/air-data/latest'
        // uri: 'https://internal.awair.is/v1.1/users/self/devices/awair-glow/8532/score/latest'
        // uri: 'http://developer-apis.awair.is/v1/users/self/devices/awair-glow/8532/air-data/latest'
        // uri: 'http://developer-apis.awair.is/v1/users/self/devices/'+device_type+'/'+device_id+'/air-data/latest'
        uri: 'http://developer-apis.awair.is/v1/users/self/devices/'+device_type+'/'+device_id+'/air-data/raw?from='+s+'&to='+e
        // uri: 'https://internal.awair.is/v1.1/users/self/devices/awair-r2/3301/air-data/latest'

        // uri: 'https://internal.awair.is/v1.1/devices/awair-glow/8532/events/score?desc=true&limit=1'
        // uri: 'https://internal.awair.is/v1.1/devices/awair-r2/3301/events/score?desc=true&limit=1'

        // uri: 'https://internal.awair.is/v1.2/devices/awair-glow/8532/timeline?from=2019-05-22T19:19:10.657076&to=2019-05-28T19:19:10.657076'
        // uri: 'https://internal.awair.is/v1.2/devices/awair-glow/8532/timeline'
    };

    // console.log(request_obj);

// http://developer-apis.awair.is/v1/users/self/devices/8532/air-data/latest"
// data_url = "/air-data/latest"

	request(request_obj, function (error, response, body) {
        if (error) {
            console.log(error)
            console.log(request_url)
        }

        // console.log(body)

        try {
            data = JSON.parse(body);
// console.log(data);

            // Awair gives use the values in reverse.
            datas = data.data.reverse();

            var count = 0;

            for (let device of datas) {

                var out = {};

                var timestamp = new Date().toISOString();

                if ('score' in device && 'sensors' in device) {
                    var mapping = {
                        'temp': 'Temperature_°C',
                        'humid': 'Humidity_%',
                        'co2': 'co2_ppm',
                        'voc': 'voc_ppb',
                        'pm25': 'pm2.5_μg/m3'
                    };

                    // Save the score
                    out.awair_score = device.score;

                    // Save the measured data
                    for (var measurement_index in device.sensors) {
                        measurement_name = device.sensors[measurement_index].comp;
                        measurement_value = device.sensors[measurement_index].value;
                        if (measurement_name in mapping) {
                            out[mapping[measurement_name]] = measurement_value;
                        } else {
                            console.log(out)
                            console.log(device.sensor)
                            out[measurement_name] = measurement_value;
                        }
                    }

                    // Get the timestamp if provided
                    if ('timestamp' in device) {
                        timestamp = device.timestamp;
                    }
                }

                if ('switch' in device) {
                    out.switch_on = device.switch.on;
                }

                // Add in the other fields that make the whole gateway system work.
                out.device = device_type;
                out._meta = {
                    received_time: timestamp,
                    device_id: 'awair-' + device_id,
                    receiver: 'http-awair-publish',
                    gateway_id: _gateway_id,
                    awair_mac_address: mac_address,
                }

                mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
                // console.log(out);
                count += 1;
            }

            console.log('got ' + count + ' data packets for ' + device_id);



        } catch (err) {
            console.log(err)
            console.log(body)
        }
	});
}

// function make_requests() {
//     for (var token of config.token) {
//         // get_sensor_data(token);
//         get_awair_devices(token);
//     }
// }
// make_requests();


// var next_start = new Date('2020-03-24T00:00:00');
var next_start = new Date('2020-02-15T00:00:00');
// var next_start = new Date('2019-11-09T00:00:00');


var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    function make_requests() {
        for (var token of config.token) {
            get_awair_devices(token, next_start);
        }

        next_start = new Date(next_start.setHours(next_start.getHours() + 1));
    }

    // Awair publishes every 10 seconds, but we are request limited, so update
    // every 5 minutes.
    setInterval(make_requests, 5*60*1000);

    make_requests();
});


