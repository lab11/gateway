#!/usr/bin/env node

/*******************************************************************************
 * Publish BLE packets.
 *
 * On:
 *  - MQTT
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var MQTTDiscover = require('mqtt-discover');

var debug = require('debug')('ble-gateway-mqtt');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .strict()
    .argv;

/*******************************************************************************
 * CONFIGURATION OPTIONS
 ******************************************************************************/
var MQTT_TOPIC_NAME = 'gateway-data';


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    // Start the gateway
    BleGateway.start();

    BleGateway.on('advertisement', function (adv_obj) {
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj));
    });
});

// Find MQTT server
MQTTDiscover.start();
