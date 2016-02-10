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

        if ('id' in adv_obj) {
            var node = adv_obj.id;
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

            // Delete meta key
            delete adv_obj._meta;

            // Only publish if there is some data
            if (Object.keys(adv_obj).length > 0) {

                // Create blob for emoncms
                var url = config.url + '/input/post.json?node=' + node + '&json=' + JSON.stringify(adv_obj) + '&apikey=' + config.api_key;
                // console.log(url)

                var p = request.post(url);
                p.on('error', function (err) {
                    console.log('Error when posting to emoncms: ' + err);
                });
            }
        }

    });

});

// Find MQTT server
MQTTDiscover.start();
