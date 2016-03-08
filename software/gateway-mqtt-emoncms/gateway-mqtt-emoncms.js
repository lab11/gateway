#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and publishes them to
emoncms.
*/

// Try to shutup some of the annoying avahi warnings.
process.env['AVAHI_COMPAT_NOWARN'] = 1;

var fs           = require('fs');

var ini          = require('ini');
var MQTTDiscover = require('mqtt-discover');
var request      = require('request');


// Main data MQTT topic
var TOPIC_MAIN_STREAM = 'gateway-data';

// How long to wait before transmitting a new EmonCMS packet
var RATE_LIMIT_SECONDS = 30;

// Keep track of last transmission time to rate limit data packets
var last_transmission_times = {};


// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/emoncms.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.url == undefined || config.url == '' ||
        config.api_key == undefined || config.api_key == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/emoncms.conf or emoncms not configured.');
    process.exit(1);
}


MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    mqtt_client.subscribe(TOPIC_MAIN_STREAM);

    // Called when we get a packet from MQTT
    mqtt_client.on('message', function (topic, message) {
        // message is Buffer
        var adv_obj = JSON.parse(message.toString());

        // Get device id
        device_id = undefined;
        if ('_meta' in adv_obj) {
            device_id = adv_obj._meta.device_id;
        } else if ('id' in adv_obj) {
            device_id = adv_obj.id;
        }

        // Make sure the device id is only alpha numerical characters
        device_id.replace(/\W/g, '');

        // Continue on to post to emoncms
        if (device_id) {
            var node = adv_obj.id;

            // Delete meta key and possible id key
            delete adv_obj._meta;
            delete adv_obj.id;

            // Delete any non numeric keys
            for (var key in adv_obj) {
                if (isNaN(adv_obj[key])) {
                    delete adv_obj[key];
                } else if (adv_obj[key] === false || adv_obj[key] === true) {
                    // convert to 1 or 0
                    adv_obj[key] = adv_obj[key] | 0;
                }
            }

            // Only publish if there is some data
            if (Object.keys(adv_obj).length > 0) {

                // Before we go to transmit, make sure we haven't transmitted
                // in a while.

                // Init
                if (!(device_id in last_transmission_times)) {
                    last_transmission_times[device_id] = new Date(0);
                }

                var now = new Date();
                if (now - last_transmission_times[device_id] >= RATE_LIMIT_SECONDS*1000) {

                    // Create blob for emoncms
                    var url = config.url + '/input/post.json?node=' + node + '&json=' + JSON.stringify(adv_obj) + '&apikey=' + config.api_key;
                    // console.log(url)

                    var p = request.post(url);
                    p.on('error', function (err) {
                        console.log('Error when posting to emoncms: ' + err);
                    });

                    // Update last transmit time
                    last_transmission_times[device_id] = now;
                }
            }
        }

    });

});

// Find MQTT server
MQTTDiscover.start();
