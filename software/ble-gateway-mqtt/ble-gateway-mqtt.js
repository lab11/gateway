#!/usr/bin/env node

/*******************************************************************************
 * Publish parsed advertisements to MQTT topic
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var mqtt       = require('mqtt');


var MQTT_TOPIC_NAME = 'ble-gateway-advertisements';


var bleg   = new BleGateway();
var client = mqtt.connect('mqtt://127.0.0.1');

// Callback for when BLE discovers the advertisement
bleg.on('advertisement', function (adv_obj) {
	client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj))
});

// Run the Gateway
client.on('connect', function () {
	bleg.start();
});
