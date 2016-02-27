#! /usr/bin/env node
/*
 * Takes the stream of raw BLE advertisements from the gateway and determines
 *  which of them are nearby. A list of BLE addresses of nearby devices is
 *  posted to mqtt topic `ble-nearby`
 *
 */

//COMPLETE
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

//COMPLETE
//- make an eddystone parser for ble-gateway
//-  allow ble-gateway to use bytes from a packet for keying
//-  make a lookup for eddystone and make that a device type

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
var TOPIC_GATEWAY_DEVICES = 'device/SwarmGateway/+';
var TOPIC_NEARBY_DEVICES = 'ble-nearby';

// wearabouts configuration
var BLE_ADV_TIMEOUT = 75; // seconds
var BLE_DETERMINATION_INTERVAL = 10; // seconds
var BLE_TIME_DIFFS_LEN = 50;
var BLE_MIN_PKT_RECEPTION_RATE = 0.10; // % packet reception

// keep a dict of all devices found
//  <ble_address> : {
//      gateways: {
//          <gateway_ip>: {
//              'rssis': [],
//              'avg_rssi': <float>,
//              'times': [],
//              'pkt_reception_rate': <float>,
//          },
//      nearby_gateway: <gateway_ip>,
//      time_diffs: [],
//      adv_rate: <float>,
//  }
//
//  old RSSI values are removed when they have timed out
var devices = {};
var callbacks = {};
var primary_gateway = '';
var gateways = [];
var gateway_ble_addrs = [];
var primary_mqtt_client = null;

// connect to MQTT broker
MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log("Primary Gateway: " + mqtt_client.options.host);
    primary_mqtt_client = mqtt_client;

    // keep track of gateways we have discovered
    var gateway_ip = mqtt_client.options.host;
    if (gateways.indexOf(gateway_ip) == -1) {
        gateways.push(gateway_ip);
        primary_gateway = gateway_ip;
    }

    // pull data from gateway
    connect_to_gateway(mqtt_client);

    // periodically determine which devices are "nearby" this gateway
    setInterval(determine_locations, BLE_DETERMINATION_INTERVAL*1000);
});

function connect_to_gateway (mqtt_client) {

    // collect BLE advertisements from gateway
    record_ble(mqtt_client, mqtt_client.options.host);

    // discover other gateways
    discover_gateways(mqtt_client.options.href);
}


function record_ble (mqtt_client, gateway_ip) {
    // subscribe to all BLE advertisements
    mqtt_client.subscribe(TOPIC_BLE_ADVERTISEMENTS);

    // handle incoming packets
    mqtt_client.on('message', function (topic, message) {

        // new advertisement received, add device if necessary
        var adv = JSON.parse(message.toString());
        if (!(adv.address in devices)) {
            // no need to keep track of devices not seen by the primary gateway
            //  Only devices seen by the primary will ever be "nearby" it
            if (gateway_ip != primary_gateway) {
                return;
            }
            debug("Discovered: " + adv.address);
            devices[adv.address] = {
                'gateways': {},
                'time_diffs': [],
                'adv_rate': null,
                'nearby': null,
            };
            callbacks[adv.address] = null;
        }
        var ble_dev = devices[adv.address];
        if (!(gateway_ip in ble_dev.gateways)) {
            ble_dev.gateways[gateway_ip] = {
                'rssis': [],
                'avg_rssi': null,
                'times': [],
                'pkt_reception_rate': null,
            };
        }

        // timeout old data across all gateways if there is any
        var curr_time = moment().valueOf()/1000;
        for (var gateway in ble_dev.gateways) {
            var dev = ble_dev.gateways[gateway];
            while (dev.times.length > 0 && (curr_time - dev.times[0]) > BLE_ADV_TIMEOUT) {
                // pop oldest BLE data until caught up
                dev.rssis.shift();
                dev.times.shift();
            }
        }

        // add new data
        var dev = ble_dev.gateways[gateway_ip];
        dev.rssis.push(adv.rssi);
        dev.times.push(moment(adv.receivedTime).valueOf()/1000);

        // calculate new RSSI average
        var rssi_sum = 0;
        for (var i=0; i<dev.rssis.length; i++) {
            rssi_sum += dev.rssis[i];
        }
        dev.avg_rssi = rssi_sum/dev.rssis.length;

        // calculate new time diff
        if (dev.times.length >= 2) {
            var len = dev.times.length;
            var time_diff = dev.times[len-1]-dev.times[len-2];
            ble_dev.time_diffs.push(time_diff);
        }

        // track the percentage of packets that have been received
        if (ble_dev.adv_rate != null) {
            dev.pkt_reception_rate = dev.times.length/(BLE_ADV_TIMEOUT/ble_dev.adv_rate);
        }

        // register a timeout for the device
        //  this is a rolling timeout placed at the timeout period after the
        //  newest packet arrival. At each new arrival the old timeout is
        //  cleared and a new one is set. If packets ever totally cease from
        //  the device, it will be cleared when the timeout goes off. This may
        //  lead to brief periods where the location of the device is
        //  determined incorrectly, but since there is no new data coming in,
        //  it's more likely that all locations are invalid
        if (callbacks[adv.address] != null) {
            clearTimeout(callbacks[adv.address]);
        }
        callbacks[adv.address] = setTimeout(timeout_device, BLE_ADV_TIMEOUT*1000, adv.address);
    });
}

function timeout_device (ble_addr) {
    // if this timeout is called, all data in the object has timed out and it can be
    //  totally deleted
    debug("Deleting: " + ble_addr);
    delete devices[ble_addr];
}

function determine_locations () {

    var nearby_devices = [];
    for (var ble_addr in devices) {
        var ble_dev = devices[ble_addr];

        // calculate advertising rate for each device periodically
        if (ble_dev.time_diffs.length >= BLE_TIME_DIFFS_LEN) {
            // the minimum time difference is probably close to the true
            //  advertisement rate
            ble_dev.adv_rate = Math.min.apply(null, ble_dev.time_diffs);
            ble_dev.time_diffs = [];
        }

        // don't bother figuring out nearby for gateways
        if (gateway_ble_addrs.indexOf(ble_addr) != -1) {
            continue;
        }

        // determine which gateway this device is "nearby"
        var min_rssi = -200;
        var nearby_gateway = null;
        for (gateway in ble_dev.gateways) {
            var dev = ble_dev.gateways[gateway];

            // only accept devices that meet a minimum PRR
            if (dev.pkt_reception_rate != null &&
                    dev.pkt_reception_rate > BLE_MIN_PKT_RECEPTION_RATE) {

                // find gateway with strongest signal strength from device
                if (dev.avg_rssi > min_rssi) {
                    min_rssi = dev.avg_rssi;
                    nearby_gateway = gateway;

                // ties should maintain the current nearby gateway
                } else if (dev.avg_rssi == min_rssi && ble_dev.nearby_gateway == gateway) {
                    min_rssi = dev.avg_rssi;
                    nearby_gateway = gateway;
                }
            }
        }
        ble_dev.nearby_gateway = nearby_gateway;

        // broadcast out devices that are near the primary
        if (ble_dev.nearby_gateway == primary_gateway) {
            nearby_devices.push(ble_addr);
        }
    }

    // broadcast list of devices that are nearby the primary
    if (primary_mqtt_client) {
        primary_mqtt_client.publish(TOPIC_NEARBY_DEVICES, JSON.stringify(nearby_devices), {retain: true});
    }
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

            // keep track of gateways discovered and only care if this is a
            //  new gateway to connect to
            if (gateways.indexOf(pkt.ip_address) == -1) {
                gateways.push(pkt.ip_address);
                gateway_ble_addrs.push(pkt._meta.device_id);
                console.log("Secondary Gateway: " + pkt.ip_address);

                // make a mqtt connection to gateway for BLE data
                var new_mqtt_addr = 'mqtt://' + pkt.ip_address;
                var new_mqtt_client = mqtt.connect(new_mqtt_addr);
                new_mqtt_client.on('connect', function () {

                    // pull data from gateway
                    connect_to_gateway(new_mqtt_client);
                });
            }
        });
    });
}

