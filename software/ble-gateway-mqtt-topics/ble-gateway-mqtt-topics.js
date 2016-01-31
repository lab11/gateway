#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and makes individual
streams out of them.

- So, this packet from the gateway:

    {
      device: 'MyDevice',
      data1: 17,
      id: 4379289
    }

  gets published to the topic:

    device/MyDevice/4379289

  at the same MQTT broker.

- To get all devices of type "MyDevice", subscribe to:

    device/MyDevice/+

- This script uses mDNS-SD to find a nearby MQTT broker to use for
  this purpose.
*/

// Try to shutup some of the annoying avahi warnings.
process.env['AVAHI_COMPAT_NOWARN'] = 1;

var mdns = require('mdns');
var mqtt = require('mqtt');

// Topic prefix for all data-specific topics that are created
var TOPIC_PREFIX_DEVICE = 'device/';

// List of all topics the BLE gateway is supporting
var TOPIC_TOPICS = 'ble-gateway-topics';

// How long without hearing a timeout do we call the topic dead (in ms)
var TOPIC_TIMEOUT = 1000*60*5; // 5 minutes


// Keep track of the list of all topics are already advertising
var advertising_topics = [];

// Keep track of the timeouts to remove stale topics
var topic_timeouts = {};

// Keep track of possible MQTT servers to connect to
var possible_mqtt_servers = ['localhost'];

// Use this variable to direct flow in this script. Basically, we want to
// wait on a new MQTT server being found if we aren't already connected.
var waiting_on_mqtt_address = false;


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

            // We only know how to handle packets in a certain format (contain
            // key named "device")
            if ('device' in adv_obj) {

                var topic_name_device = TOPIC_PREFIX_DEVICE + adv_obj.device + '/' + adv_obj.id;
                if (advertising_topics.indexOf(topic_name_device) == -1) {
                    advertising_topics.push(topic_name_device);

                    // Publish new topics list
                    publish_advertising_topics();
                }

                // Actually publish this to a topic stream
                client.publish(topic_name_device, message);

                // Keep track of this so we get rid of old, stale topics
                update_timeout(topic_name_device);
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

        //
        // Helper functions for managing known topics
        //

        function remove_from_advertising_topics (topic_name) {
            var index = advertising_topics.indexOf(topic_name);
            if (index > -1) {
                advertising_topics.splice(index, 1);
            }
        }

        function update_timeout (topic_name) {
            if (topic_name in topic_timeouts) {
                clearTimeout(topic_timeouts[topic_name]);
            }

            topic_timeouts[topic_name] = setTimeout(function () {
                // If this ever fires, remove from array
                remove_from_advertising_topics(topic_name);

                // And publish new list
                publish_advertising_topics();
            }, TOPIC_TIMEOUT);
        }

        function publish_advertising_topics () {
            client.publish(TOPIC_TOPICS, JSON.stringify(advertising_topics), {retain: true});
        }

    } else {
        // Hmm, no MQTT servers to check. Wait and see if more appear
        waiting_on_mqtt_address = true;
    }
}

// We do want to try to connect to server
connect_to_mqtt_broker();
