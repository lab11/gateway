#!/usr/bin/env node

var MQTTDiscover = require('../mqtt-discover');


MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    // Start the gateway
    console.log('Found MQTT client: ' + mqtt_client.options.href);
});

// Find MQTT server
MQTTDiscover.start();
