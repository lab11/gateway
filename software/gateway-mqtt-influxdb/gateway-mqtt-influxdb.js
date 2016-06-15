#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and publishes them to
influxdb.
*/

// Try to shutup some of the annoying avahi warnings.
process.env['AVAHI_COMPAT_NOWARN'] = 1;

var argv         = require('minimist')(process.argv.slice(2));

var fs           = require('fs');

var ini          = require('ini');
//var MQTTDiscover = require('mqtt-discover');
var request      = require('request');

var mqtt         = require('mqtt');

var influx       = require('influx');

// Main data MQTT topic
var TOPIC_MAIN_STREAM = 'gateway-data';

// How long to batch data for before posting
var RATE_LIMIT_MILLISECONDS = 5000;

// Keep track of last transmission time to rate limit data packets
var last_transmission_times = {};

// Dictionary of points, indexed by measurement type
// n.b. on vocab:
//  - The node library uses the word 'series' where influxdb uses
//    'measurement', we use the influx terms here
//  - A 'point' is a single sample, it's made of a measurement (i.e.
//    temperature_celcius), a value (i.e. 27.2), and some tags (i.e.
//    device_class='BLEES',...)
//  - A 'series' in influxdb terms is automatically, dynamically created by the
//    db engine and is defined by a unique set of {measurement, {tags}}
var measurements = {};

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/influxdb.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.host == undefined || config.host == '' ||
            config.database == undefined || config.database == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/influxdb.conf or influxdb not configured.');
    process.exit(1);
}


var influx_client = influx({
    host : config.host,
    port : 443,
    protocol: 'https',
    database : config.database,
    username : config.username,
    password : config.password,
});


var mqtt_client;
function mqtt_on_connect() {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    mqtt_client.subscribe(TOPIC_MAIN_STREAM);
    //mqtt_client.subscribe('device/BLEES/+');

    // Called when we get a packet from MQTT
    mqtt_client.on('message', function (topic, message) {
        // message is Buffer
        var adv_obj = JSON.parse(message.toString());

        // Get device id
        device_id = undefined;
        if ('_meta' in adv_obj) {
            device_id = adv_obj._meta.device_id;
        } else if ('id' in adv_obj) {
            device_id = adv_obj.id;
        }

        // Make sure the device id is only alpha numerical characters
        device_id.replace(/\W/g, '');

        device_class = adv_obj['device'];
        delete adv_obj.device;

        timestamp  = adv_obj['_meta']['received_time'];
        receiver   = adv_obj['_meta']['receiver'];
        gateway_id = adv_obj['_meta']['gateway_id'];

        // Continue on to post to emoncms
        if (device_id) {

            // Delete meta key and possible id key
            delete adv_obj._meta;
            delete adv_obj.id;

            // Delete any non numeric keys
            for (var key in adv_obj) {
                if (isNaN(adv_obj[key])) {
                    delete adv_obj[key];
                } else if (adv_obj[key] === false || adv_obj[key] === true) {
                    // convert to 1 or 0
                    adv_obj[key] = adv_obj[key] | 0;
                }
            }

            // Only publish if there is some data
            if (Object.keys(adv_obj).length > 0) {
                for (measurement in adv_obj) {
                    var point = [
                            {value: adv_obj[measurement]},
                            {
                                device_id: device_id,
                                device_class: device_class,
                                receiver: receiver,
                                gateway_id: gateway_id,
                            },
                    ];
                    if (! (measurement in measurements) ) {
                        measurements[measurement] = [];
                    }
                    measurements[measurement].push(point);
                }
            }
        }
    });
};


function post_data() {
    // This API is comically poorly named. Sorry. This function is called
    // writeSeries, it does write a single series, rather, it writes arrays of
    // points, indexed by measurement type, worry not.
    influx_client.writeSeries(measurements, function(err,response) {
        if (err != null) {
            console.log(err);
            console.log(response);
        }
    });

    // Clear out array
    // XXX: Possibly should only do this if post succeeded?
    // Okay, remarkably it looks like the writeSeries function clears the array
    // automatically, which doesn't seem like the greatest idea to me, so we'll
    // clear it again ourselves, just in case this library ever stops doing
    // that
    measurements = {};

    setTimeout(post_data, RATE_LIMIT_MILLISECONDS);
}
setTimeout(post_data, RATE_LIMIT_MILLISECONDS);


if ('remote' in argv) {
    mqtt_client = mqtt.connect('mqtt://' + argv['remote']);
    mqtt_client.on('connect', mqtt_on_connect, mqtt_client);
} else {
    MQTTDiscover.on('mqttBroker', function (client) {
        mqtt_client = client;
        mqtt_on_connect();
    });

    MQTTDiscover.start();
}

