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

var mqtt = require('mqtt');


// Topic prefix for all data-specific topics that are created
var TOPIC_PREFIX_DEVICE = 'device/';

// List of all topics the BLE gateway is supporting
var TOPIC_TOPICS = 'gateway-topics';

// How long without hearing a timeout do we call the topic dead (in ms)
var TOPIC_TIMEOUT = 1000*60*5; // 5 minutes


// Keep track of the list of all topics are already advertising
var advertising_topics = [];

// Keep track of the timeouts to remove stale topics
var topic_timeouts = {};


// Receive the global list from other receivers to ensure we are not
// removing other valid devices.
var _mqtt_client = mqtt.connect('mqtt://localhost');
_mqtt_client.on('connect', function () {
    _mqtt_client.subscribe(TOPIC_TOPICS);

    _mqtt_client.on('message', function (topic, message) {

        var topic_list = [];
        try {
          JSON.parse(message.toString());
        }
        catch(err) {
          console.log(err)
        }
        advertising_topics = topic_list;
    });
});

// Called with packet to publish on /device topic
function publish (adv_obj) {

    // We only know how to handle packets in a certain format (contain
    // key named "device")
    if ('device' in adv_obj) {

        var topic_name_device = TOPIC_PREFIX_DEVICE + adv_obj.device + '/' + adv_obj._meta.device_id;
        if (advertising_topics.indexOf(topic_name_device) == -1) {
            advertising_topics.push(topic_name_device);

            // Publish new topics list
            publish_advertising_topics();
        }

        // Actually publish this to a topic stream
        _mqtt_client.publish(topic_name_device, JSON.stringify(adv_obj));

        // Keep track of this so we get rid of old, stale topics
        update_timeout(topic_name_device);
    }

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
        _mqtt_client.publish(TOPIC_TOPICS, JSON.stringify(advertising_topics), {retain: true});
    }

}


module.exports = {
    publish: publish
};
