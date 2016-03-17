#!/usr/bin/env node

/*******************************************************************************
 * Publish gateway packets.
 *
 * On:
 *  - UDP Broadcast (port 3002)
 *  - WebSockets (port 3001)
 ******************************************************************************/

var MQTTDiscover = require('mqtt-discover');
var debug        = require('debug')('gateway-publish');
var fs           = require('fs');
var ini          = require('ini');

/*******************************************************************************
 * CONFIGURATION OPTIONS
 ******************************************************************************/

// Receive
var DEFAULT_MQTT_TOPIC_NAME = 'gateway-data';

// Publish
var DEFAULT_UDP_PUBLISH = false;
var DEFAULT_UDP_BROADCAST_PORT = 3002;
var DEFAULT_WS_PUBLISH = true;
var DEFAULT_WS_PORT = 3001;


// Read in the config file to get the parameters. If the parameters are not set
// we use defaults
var config;
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/publish.conf', 'utf-8');
    config = ini.parse(config_file);
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/publish.conf. Using defaults');
    config = {};
}
// Set defaults
if (config.udpPublish === undefined)        config.udpPublish        = DEFAULT_UDP_PUBLISH;
if (config.udpPort === undefined)           config.udpPort           = DEFAULT_UDP_BROADCAST_PORT;
if (config.websocketsPublish === undefined) config.websocketsPublish = DEFAULT_WS_PUBLISH;
if (config.websocketPort === undefined)     config.websocketPort     = DEFAULT_WS_PORT;
if (config.mqttTopic === undefined)         config.mqttTopic         = DEFAULT_MQTT_TOPIC_NAME;
// Type conversion
if (config.udpPublish === 'true')        config.udpPublish = true;
if (config.websocketsPublish === 'true') config.websocketsPublish = true;

/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    mqtt_client.subscribe(config.mqttTopic);

    // Setup UDP Broadcast
    if (config.udpPublish) {
        debug('Setting up UDP broadcast.');

        var dgram  = require('dgram');
        var server = dgram.createSocket("udp4");

        server.bind(function () {
            server.setBroadcast(true);
        });

        // Callback for when BLE discovers the advertisement
        mqtt_client.on('message', function (topic, message) {
            server.send(message, 0, message.length, config.udpPort, "255.255.255.255");
        });
    }

    // WebSockets
    if (config.websocketsPublish) {
        debug('Setting up WebSockets.');

        var ws       = require('ws');
        var wsserver = new ws.Server({port: config.websocketPort});

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
