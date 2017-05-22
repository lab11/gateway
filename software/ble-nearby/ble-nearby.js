#! /usr/bin/env node
/*
 * Takes the stream of raw BLE advertisements from the gateway and determines
 *  which of them are nearby. A list of BLE addresses of nearby devices is
 *  posted to mqtt topic `ble-nearby`
 *
 */

// TODO
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

// TODO
// make a light controller script
//  probably just ends up running on nuclear
//  pull occupancy stream from 4908 gateway
//  control 4908 lights


// create our own debug stream
var debug = require('debug')('ble-nearby');

// various other libraries
var mqtt = require('mqtt');
var moment = require('moment');
var request = require('request');

// looking for BLE advertisements
var TOPIC_BLE_ADVERTISEMENTS = 'ble-advertisements';
var TOPIC_GATEWAY_DEVICES = 'device/SwarmGateway/+';
var TOPIC_NEARBY_DEVICES = 'ble-nearby';

// wearabouts configuration
var BLE_ADV_TIMEOUT = 75; // seconds
var BLE_DETERMINATION_INTERVAL = 10; // seconds
var BLE_TIME_DIFFS_LEN = 200;
var BLE_MIN_PKT_RECEPTION_RATE = 0.10; // % packet reception

// keep a dict of all devices found
//  <ble_address> : {
//      gateways: {
//          <gateway_id>: {
//              'rssis': [],
//              'avg_rssi': <float>,
//              'times': [],
//              'pkt_reception_rate': <float>,
//          },
//      nearby_gateway: <gateway_id>,
//      time_diffs: [],
//      adv_rate: <float>,
//  }
//
//  old RSSI values are removed when they have timed out
var devices = {};

// keep a timer for when all data in this device is invalid
var timeouts = {};
var determine_timeout = null;

// unique ID of primary gateway
var primary_gateway = '';

// unique IDs and IP addresses of gateways so we can know which we have already contacted
var gateways = [];

// keep list of BLE addresses for discovered gateways so they can be ignored
var gateway_ble_addrs = [];

// keep the main mqtt client `ble-nearby` can be published back to it
var primary_mqtt_client = null;


// connect to MQTT broker
var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
    console.log("Primary connected: localhost");
    primary_mqtt_client = mqtt_client;

    // get unique ID to identify the gateway
    get_gateway_id('localhost', function(gateway_id) {
        console.log('Primary Gateway: localhost ID: ' + gateway_id);

        // keep track of gateways we have discovered
        if (gateways.indexOf(gateway_id) == -1) {
            gateways.push(gateway_id);
            primary_gateway = gateway_id;
        }
        if (gateways.indexOf('localhost') == -1) {
            gateways.push('localhost');
        }

        // pull data from gateway
        connect_to_gateway(mqtt_client, gateway_id);

        // periodically determine which devices are "nearby" this gateway
        if (determine_timeout == null) {
            determine_timeout = setInterval(determine_locations, BLE_DETERMINATION_INTERVAL*1000);
        }
    });
});

function connect_to_gateway (mqtt_client, gateway_id) {

    // collect BLE advertisements from gateway
    record_ble(mqtt_client, gateway_id);

    // discover other gateways
    discover_gateways(mqtt_client.options.href);
}

function record_ble (mqtt_client, gateway_id) {
    // subscribe to all BLE advertisements
    mqtt_client.subscribe(TOPIC_BLE_ADVERTISEMENTS);

    // handle incoming packets
    mqtt_client.on('message', function (topic, message) {

        // new advertisement received, add device if necessary
        var adv = JSON.parse(message.toString());
        if (!(adv.address in devices)) {
            // no need to keep track of devices not seen by the primary gateway
            //  Only devices seen by the primary will ever be "nearby" it
            if (gateway_id != primary_gateway) {
                return;
            }
            debug("Discovered: " + adv.address);
            devices[adv.address] = {
                'gateways': {},
                'time_diffs': [],
                'adv_rate': null,
                'nearby': null,
            };
            timeouts[adv.address] = null;
        }
        var ble_dev = devices[adv.address];
        if (!(gateway_id in ble_dev.gateways)) {
            ble_dev.gateways[gateway_id] = {
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
        var dev = ble_dev.gateways[gateway_id];
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
            var time_diff = Math.round((dev.times[len-1]-dev.times[len-2])*1000)/1000;
            if (time_diff > 0.015) {
                // minimum time difference is 20 ms, but give a little wiggle room
                ble_dev.time_diffs.push(time_diff);
            }
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
        if (timeouts[adv.address] != null) {
            clearTimeout(timeouts[adv.address]);
        }
        timeouts[adv.address] = setTimeout(timeout_device, BLE_ADV_TIMEOUT*1000, adv.address);
    });
}

function timeout_device (ble_addr) {
    // if this timeout is called, all data in the object has timed out and it can be
    //  totally deleted
    debug("Deleting: " + ble_addr);
    delete devices[ble_addr];
}

function determine_locations () {
    debug("Making determination");

    var nearby_devices = [];
    for (var ble_addr in devices) {
        var ble_dev = devices[ble_addr];

        // calculate advertising rate for each device periodically
        if (ble_dev.time_diffs.length >= BLE_TIME_DIFFS_LEN) {
            // the median of the lower half of the data is probably close to
            //  the true advertisement rate
            //  Also, no, sorting does NOT naturally just work on integers
            //  Thanks javascript
            var srtd_diffs = ble_dev.time_diffs.sort(function (a,b) {return a-b;});
            var lower_diffs = srtd_diffs.slice(0,Math.round(srtd_diffs.length/2));
            var mid = Math.floor(lower_diffs.length/2);
            if (lower_diffs.length % 2 == 0) {
                ble_dev.adv_rate = (lower_diffs[mid-1]+lower_diffs[mid])/2;
            } else {
                ble_dev.adv_rate = lower_diffs[mid];
            }
            ble_dev.time_diffs = [];
        }

        // don't bother figuring out nearby for gateways
        if (gateway_ble_addrs.indexOf(ble_addr) != -1) {
            debug(ble_addr + ": Skipping gateway");
            continue;
        }

        // determine which gateway this device is "nearby"
        var min_rssi = -200;
        var nearby_gateway = null;
        var log_str = ble_addr + ": |"+ble_dev.adv_rate+"|";
        for (gateway in ble_dev.gateways) {
            var dev = ble_dev.gateways[gateway];
            log_str += '['+gateway+'] PRR='+dev.pkt_reception_rate+' RSSI='+dev.avg_rssi+' ';

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
        log_str += '<'+nearby_gateway+'>';
        debug(log_str);

        // broadcast out devices that are near the primary
        if (ble_dev.nearby_gateway == primary_gateway) {
            nearby_devices.push(ble_addr);
        }
    }

    // broadcast list of devices that are nearby the primary
    if (primary_mqtt_client) {
        primary_mqtt_client.publish(TOPIC_NEARBY_DEVICES, JSON.stringify(nearby_devices), {retain: true}, function (error) {
            if (error) {
                console.log("Disconnected... Reconnecting!");
                primary_mqtt_client = mqtt.connect(primary_mqtt_client.options.href);
                primary_mqtt_client.on('connect', function () {
                    debug("Reconnected to primary");
                    connect_to_gateway(primary_mqtt_client, primary_gateway);
                });
            }
        });
    }
}

function discover_gateways (mqtt_addr) {

    // create a second mqtt connection to the same host
    var mqtt_client = mqtt.connect(mqtt_addr);
    mqtt_client.on('connect', function () {
        console.log("Searching for gateways: " + mqtt_client.options.host);

        // subscribe to all gateways discovered
        mqtt_client.subscribe(TOPIC_GATEWAY_DEVICES);

        // handle incoming packets
        mqtt_client.on('message', function (topic, message) {
            var pkt = JSON.parse(message);

            // don't need to get the unique ID if we are already connected
            if (gateways.indexOf(pkt.ip_address) == -1) {
                gateways.push(pkt.ip_address);

                // get unique ID to identify the gateway
                get_gateway_id(pkt.ip_address, function(gateway_id) {

                    // keep track of gateways discovered and only care if this is a
                    //  new gateway to connect to. We also need the escape of
                    //  continuing to connect to devices where we couldn't get
                    //  a unique ID
                    if (gateways.indexOf(gateway_id) == -1 || gateway_id == pkt.ip_address) {
                        gateways.push(gateway_id);
                        console.log("Secondary Gateway: " + pkt.ip_address + ' ID: ' + gateway_id);

                        // make a mqtt connection to gateway for BLE data
                        var new_mqtt_addr = 'mqtt://' + pkt.ip_address;
                        var new_mqtt_client = mqtt.connect(new_mqtt_addr);
                        new_mqtt_client.on('connect', function () {

                            // pull data from gateway
                            connect_to_gateway(new_mqtt_client, gateway_id);
                        });
                    }

                    // also make sure to ignore this BLE address
                    var gateway_ble_addr = pkt._meta.device_id;
                    if (gateway_ble_addrs.indexOf(gateway_ble_addr) == -1) {
                        gateway_ble_addrs.push(pkt._meta.device_id);
                    }
                });
            }
        });
    });
}

// get the unique id for this gateway
function get_gateway_id (gateway_ip, cb) {
    //  http://<gateway_ip>/api/id has a unique ID for the device.
    //  This is the MAC address as provided by the gateway server.
    //  If that response cannot be obtained, default to ip address.
    //  Note that on the primary this is usually 'localhost'.
    var gateway_id = gateway_ip;
    request('http://'+gateway_ip+'/api/id', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            gateway_id = body;
        } else {
            debug("Error requesting ID from " + gateway_ip);
        }

        // callback
        cb(gateway_id);
    });
}

