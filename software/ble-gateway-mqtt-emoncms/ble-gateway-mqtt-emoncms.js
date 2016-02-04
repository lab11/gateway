#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and publishes them to
emoncms.
*/

// Try to shutup some of the annoying avahi warnings.
process.env['AVAHI_COMPAT_NOWARN'] = 1;

var fs      = require('fs');

var ini     = require('ini');
var mdns    = require('mdns');
var mqtt    = require('mqtt');
var request = require('request');

// Keep track of possible MQTT servers to connect to
var possible_mqtt_servers = ['localhost'];

// Use this variable to direct flow in this script. Basically, we want to
// wait on a new MQTT server being found if we aren't already connected.
var waiting_on_mqtt_address = false;


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


// Find a server running an MQTT broker
var browser = mdns.createBrowser(mdns.tcp('mqtt'));

// Called on discovering a MQTT service
browser.on('serviceUp', function(service) {

    service.addresses.forEach(function (address) {
        console.log('Found possible MQTT Broker on ' + address);

        // Check for IPv6 (AHHHH!!!!)
        if (address.indexOf(':') != -1) {
            address = '[' + address + ']';
        }

        possible_mqtt_servers.push(address);

        if (waiting_on_mqtt_address) {
            waiting_on_mqtt_address = false;
            connect_to_mqtt_broker();
        }
    });

    var address = service.addresses[0];
    console.log('Found possible MQTT Broker on ' + address);
});

browser.on('error', function (err) {
    console.log('mDNS search error')
    console.log(err);
});

// Start looking for MQTT brokers
browser.start();


function connect_to_mqtt_broker () {

    // Get a candidate
    var broker_address = possible_mqtt_servers.shift();

    // Make sure the array is not empty
    if (broker_address) {
        console.log('Trying to connect to MQTT at ' + broker_address);

        // Connect to that MQTT broker
        var client = mqtt.connect('mqtt://' + broker_address, {connectTimeout: 10*1000});

        // On connect we subscribe to all formatted BLE advertisements
        client.on('connect', function () {
            console.log('Connected to MQTT at ' + broker_address);
            client.subscribe('ble-gateway-advertisements');
        });

        // Called when we get a packet from MQTT
        client.on('message', function (topic, message) {
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

        // Check to see if there is actually an MQTT server to connect to
        client.on('offline', function () {
            // Could not connect for some reason
            console.log('Could not connect to ' + broker_address);

            // Stop trying to connect
            client.end();

            // Try a new server
            connect_to_mqtt_broker();
        });


    } else {
        // Hmm, no MQTT servers to check. Wait and see if more appear
        waiting_on_mqtt_address = true;
    }
}

// We do want to try to connect to server
connect_to_mqtt_broker();
