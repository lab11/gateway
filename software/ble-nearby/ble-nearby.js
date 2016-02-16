#! /usr/bin/env node
/*
 * Takes the stream of raw BLE advertisements from the gateway and determines
 *  which of them are nearby
 *
 *  On:
 *  XXX
 */

// search for mqtt broker
//  pull BLE data from it
//
//  find other nearby gateways by their BLE advertisements
//      add those brokers too
//
//  run wearabouts on all of the devices
//      assigning each to its own gateway
//
//  make stream of nearby devices available at each gateway
//      probably just post to your own discovered broker
//      each gateway will run this script on its own

// make an eddystone parser for ble-gateway
//  allow ble-gateway to use bytes from a packet for keying
//  make a lookup for eddystone and make that a device type

// make a room-occupancy script
//  pull nearby streams from local gateway
//
//  find motion sensors
//      use data to determine occupied or not
//
//  find fitbits
//      use data to place certain people in room
//      additionally determine occupied or not
//
//  make data stream available as a topic

// make a light controller script
//  probably just ends up running on nuclear
//  pull occupancy stream from 4908 gateway
//  control 4908 lights


// create our own debug stream
var debug = require('debug')('ble-nearby');

// discover an MQTT broker
var MQTTDiscover = require('mqtt-discover');
MQTTDiscover.start();

// various other libraries
var mqtt = require('mqtt');
var moment = require('moment');

// looking for BLE advertisements
var TOPIC_BLE_ADVERTISEMENTS = 'ble-advertisements';
var TOPIC_GATEWAY_DEVICES = 'device/PowerBlade/+';

// keep a dict of all devices found
//  ble_address : {
//      gateway: {
//          'rssis': []
//          'times': []
//          'avg_rssi': <float>
//      }
//  }
//
//  old RSSI values are removed when they have timed out
var devices = {};
var callbacks = {};

// connect to MQTT broker
MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log("Connecting to MQTT broker at " + mqtt_client.options.href);

    var gateway_id = mqtt_client.options.hostname;

    // collect BLE advertisements from gateway
    record_ble(mqtt_client, gateway_id);

    // discover other gateways
    discover_gateways(mqtt_client.options.href);

    // periodically determine which devices are "nearby" this gateway
    //XXX: call this with setInterval to schedule it periodically
    determine_locations(gateway_id);
});


function record_ble (mqtt_client, gateway_id) {
    // subscribe to all BLE advertisements
    mqtt_client.subscribe(TOPIC_BLE_ADVERTISEMENTS);

    // handle incoming packets
    mqtt_client.on('message', function (topic, message) {
        console.log(JSON.parse(message));
        process.exit(1);

        // new advertisement received, add device if necessary
        var adv = JSON.parse(message.toString());
        if (!(adv.address in devices)) {
            console.log("New device: " + adv.address);
            devices[adv.address] = {};
            callbacks[adv.address] = null;
        }
        if (!(gateway_id in devices[adv.address])) {
            devices[adv.address][gateway_id] = {
                'rssis': [],
                'times': [],
                'avg_rssi': null,
            };
        }

        // timeout old data across all gateways if there is any
        var curr_time = moment().unix();
        for (var gateway in devices[adv.address]) {
            var dev = devices[adv.address][gateway];
            while ((dev.times[0] - curr_time) > BLE_ADV_TIMEOUT) {
                // pop oldest BLE data until caught up
                dev.rssis.shift();
                dev.times.shift();
            }
        }

        // add new data
        var dev = devices[adv.address][gateway_id];
        dev.rssis.push(adv.rssi);
        dev.times.push(mement(adv.receivedTime).unix());

        // calculate new RSSI average
        var rssi_sum = 0;
        for (var i=0; i<dev.rssis.length; i++) {
            rssi_sum += dev.rssis[i];
        }
        dev.avg_rssi = rssi_sum/dev.rssis.length;

        // register a timeout for the device
        //  this is a rolling timeout placed at the timeout period after the
        //  newest packet arrival. At each new arrival the old timeout is
        //  cleared and a new one is set. If packets ever totally cease from
        //  the device, it will be cleared when the timeout goes off. This may
        //  lead to brief periods where the location of the device is
        //  determined incorrectly, but since there is no new data coming in,
        //  it's more likely that all locations are invalid
        if (callbacks[adv.address] != null) {
            clearTimeout(callbacks[adv.address];
        }
        callbacks[adv.address] = setTimeout(timeout_device, BLE_ADV_TIMEOUT, adv.address);
    });
}

function timeout_device (ble_addr) {
    // if this timeout is called, all data in the object has timed out and it can be
    //  totally deleted
}

function determine_locations (gateway_id) {
    // lets just make periodic determinations here rather than
    //  re-determining at each packet for each device. Most of this stuff isn't
    //  moving at all

    //XXX: How do we determine "How much data is enough" when we don't know the advertisement rate of the device?

    // after that, comparing averages should be pretty easy
}

function discover_gateways (mqtt_addr) {

    // create a second mqtt connection to the same host
    var mqtt_client = mqtt.connect(mqtt_addr);
    mqtt_client.on('connect', function () {
        
        // subscribe to all gateways discovered
        mqtt_client.subscribe(TOPIC_GATEWAY_DEVICES);

        // handle incoming packets
        mqtt_client.on('message', function (topic, message) {
            pkt = JSON.parse(message);

            console.log("PowerBlade: " + pkt.id);
            //XXX: Do something with the new gateway you've found
            //  get its address, form a connection, call record_ble
            //  also discover_gateways on it!! checking if they are new first
        });
    });
}

