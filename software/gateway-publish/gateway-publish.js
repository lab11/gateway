#!/usr/bin/env node

/*******************************************************************************
 * Publish gateway packets.
 *
 * On:
 *  - UDP Broadcast (port 3002)
 *  - WebSockets (port 3001)
 ******************************************************************************/

var MQTTDiscover = require('mqtt-discover');

var debug = require('debug')('gateway-publish');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .option('udp-broadcast', {
        describe: 'publish UDP broadcast packets. Use --no-udp-broadcast to not.',
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

// Receive
var MQTT_TOPIC_NAME = 'gateway-data';

// Publish
var UDP_BROADCAST_PORT = 3002;
var WS_PORT = 3001;


/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    mqtt_client.subscribe(MQTT_TOPIC_NAME);

    // Setup UDP Broadcast
    if (argv.udpBroadcast) {
        debug('Setting up UDP broadcast.');

        var dgram  = require('dgram');
        var server = dgram.createSocket("udp4");

        server.bind(function () {
            server.setBroadcast(true);
        });

        // Callback for when BLE discovers the advertisement
        mqtt_client.on('message', function (topic, message) {
            server.send(message, 0, message.length, UDP_BROADCAST_PORT, "255.255.255.255");
        });
    }

    // WebSockets
    if (argv.websockets) {
        debug('Setting up WebSockets.');

        var ws       = require('ws');
        var wsserver = new ws.Server({port: WS_PORT});

        // Callback for when BLE discovers the advertisement
        mqtt_client.on('message', function (topic, message) {
            wsserver.clients.forEach(function (client) {
                try {
                    client.send(message.toString());
                } catch (e) {
                    // The send call can fail if the client has recently
                    // disconnected.
                }
            });
        });
    }
});

// Find MQTT server
MQTTDiscover.start();
