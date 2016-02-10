#!/usr/bin/env node

/*******************************************************************************
 * Publish the MAC addresses of all sniffed BLE packets.
 *
 * On:
 *  - MQTT (topic 'ble-advertisements')
 ******************************************************************************/

var BleAddrSniff = require('ble-address-sniffer');
var MQTTDiscover = require('mqtt-discover');

var debug = require('debug')('ble-address-sniffer-publish');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .option('mqtt', {
        describe: 'publish to MQTT. Use --no-mqtt to not.',
        boolean: true,
        default: true
    })
    .strict()
    .argv;

/*******************************************************************************
 * CONFIGURATION OPTIONS
 ******************************************************************************/
var MQTT_TOPIC_NAME = 'ble-advertisements';


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    debug('Connected to MQTT ' + mqtt_client.options.href);

    // Run the Gateway
    BleAddrSniff.start();

    // Callback for when BLE discovers the advertisement
    BleAddrSniff.on('advertisement', function (adv) {
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv))
    });
});

// Find MQTT server
MQTTDiscover.start();
