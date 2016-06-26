#!/usr/bin/env node

/*******************************************************************************
 * Publish BLE packets.
 *
 * On:
 *  - MQTT
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var mqtt       = require('mqtt');

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

var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
    debug('Connected to MQTT');

    // Start the gateway
    BleGateway.start();

    BleGateway.on('advertisement', function (adv_obj) {
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj));
    });
});
