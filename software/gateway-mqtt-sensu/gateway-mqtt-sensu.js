#!/usr/bin/env node
/*

Publish keep alives to a sensu server on behalf of all devices.

*/

// Try to shutup some of the annoying avahi warnings.
process.env['AVAHI_COMPAT_NOWARN'] = 1;

var fs        = require('fs');

var amqp      = require('amqp');
var gatewayId = require('lab11-gateway-id');
var ini       = require('ini');
var mqtt      = require('mqtt');

// Main data MQTT topic
var TOPIC_MAIN_STREAM = 'gateway-data';

// How long to wait before transmitting a new keepalive
var RATE_LIMIT_SECONDS = 60;

// Keep track of last transmission time to rate limit data packets
var last_transmission_times = {};


// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/sensu.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.host === undefined || config.host == '' ||
        config.port === undefined || config.port == '' ||
        config.vhost === undefined || config.vhost == '' ||
        config.user === undefined || config.user == '' ||
        config.password === undefined || config.password == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/sensu.conf or sensu not configured correctly.');
    process.exit(1);
}

var device_filters;
if (config.ignore) {
    device_filters = config.ignore.split(',');
}

// Start by getting an ID for this gateway
gatewayId.id(function (macaddr) {
    console.log('Using gateway address: ' + macaddr);

    // Then connect to the correct rabbitmq broker
    var amqp_conn = amqp.createConnection({host: config.host,
                                           port: config.port,
                                           vhost: config.vhost,
                                           login: config.user,
                                           password: config.password});

    amqp_conn.on('ready', function () {
        console.log('Connected to AMQP: ' + config.host);

        amqp_conn.exchange('keepalives', {type: 'direct', autoDelete: false}, function (exchange) {
            console.log('Connected to exchange "keepalives"');

            var mqtt_client = mqtt.connect('mqtt://localhost');
            mqtt_client.on('connect', function () {
                console.log('Connected to MQTT');

                mqtt_client.subscribe(TOPIC_MAIN_STREAM);

                // Called when we get a packet from MQTT
                mqtt_client.on('message', function (topic, message) {
                    // message is Buffer
                    var adv_obj = JSON.parse(message.toString());

                    // Get device id
                    var device_id = undefined;
                    if ('_meta' in adv_obj) {
                        device_id = adv_obj._meta.device_id;
                    } else if ('id' in adv_obj) {
                        device_id = adv_obj.id;
                    }

                    // Make sure the device id is only alpha numerical characters
                    device_id = device_id.replace(/\W/g, '');

                    // Get device name
                    var device_name = adv_obj.device;

                    // Continue on to send keepalive
                    if (device_id && device_name) {
                        // Sanitize device name for sensu
                        // Remove all non alphanumeric characters and make spaces hyphens
                        device_name = device_name.replace(/[^\w\ -]/g, '').replace(/\ /g, '-');

                        // Escape if this is a filtered device_name
                        if (device_filters && device_filters.indexOf(device_name) != -1) {
                            return;
                        }

                        // Init timestamp for new device
                        if (!(device_id in last_transmission_times)) {
                            last_transmission_times[device_id] = new Date(0);
                        }

                        // Make sure we don't flood keepalives
                        var now = new Date();
                        if (now - last_transmission_times[device_id] >= RATE_LIMIT_SECONDS*1000) {

                            // console.log('Publishing keepalive for ' + adv_obj.device + '-' + device_id + ' on ' + macaddr);

                            var out = {
                                name: device_name + '-' + device_id,
                                subscriptions: [],
                                address: macaddr,
                                version: '0.22.2',
                                timestamp: Math.floor(Date.now() / 1000)
                            };

                            exchange.publish('', out, {}, function (err) {
                                console.log('Error when publishing keepalive.');
                            });

                            // Update last transmit time
                            last_transmission_times[device_id] = now;
                        }
                    }

                });

            });

        });
    });
});
