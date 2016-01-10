#!/usr/bin/env node

/*******************************************************************************
 * Publish BLE packets.
 *
 * On:
 *  - MQTT (topic 'ble-gateway-advertisements')
 *  - UDP Broadcast (port 3002)
 *  - WebSockets (port 3001)
 ******************************************************************************/

var BleGateway = require('ble-gateway');

var debug = require('debug')('ble-gateway-publish');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .option('udp-broadcast', {
        describe: 'publish UDP broadcast packets. Use --no-udp-broadcast to not.',
        boolean: true,
        default: true
    })
    .option('mqtt', {
        describe: 'publish to MQTT. Use --no-mqtt to not.',
        boolean: true,
        default: true
    })
    .option('websockets', {
        describe: 'publish to websockets. Use --no-websockets to not.',
        boolean: true,
        default: true
    })
    .strict()
    .argv;

/*******************************************************************************
 * CONFIGURATION OPTIONS
 ******************************************************************************/
var UDP_BROADCAST_PORT = 3002;

var MQTT_HOST = '127.0.0.1';
var MQTT_TOPIC_NAME = 'ble-gateway-advertisements';

var WS_PORT = 3001;


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

// Setup UDP Broadcast
if (argv.udpBroadcast) {
    debug('Setting up UDP broadcast.');

    var dgram  = require('dgram');
    var server = dgram.createSocket("udp4");

    server.bind(function () {
        server.setBroadcast(true);
    });

    // Callback for when BLE discovers the advertisement
    BleGateway.on('advertisement', function (adv_obj) {
        var message = new Buffer(JSON.stringify(adv_obj));
        server.send(message, 0, message.length, UDP_BROADCAST_PORT, "255.255.255.255");
    });
}

// MQTT
if (argv.mqtt) {
    debug('Setting up MQTT.');

    var mqtt   = require('mqtt');
    var client = mqtt.connect('mqtt://' + MQTT_HOST);

    // Callback for when BLE discovers the advertisement
    BleGateway.on('advertisement', function (adv_obj) {
        client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj))
    });
}

// WebSockets
if (argv.websockets) {
    debug('Setting up WebSockets.');

    var ws       = require('ws');
    var wsserver = new ws.Server({port: WS_PORT});

    // Callback for when BLE discovers the advertisement
    BleGateway.on('advertisement', function (adv_obj) {
        wsserver.clients.forEach(function (client) {
            client.send(JSON.stringify(adv_obj));
        });
    });
}

// Run the Gateway
BleGateway.start();
