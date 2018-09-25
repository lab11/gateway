#!/usr/bin/env node

var async = require('async');
var os = require('os');
var mqtt  = require('mqtt');
var gatewayId = require('lab11-gateway-id');


var MQTT_TOPIC_NAME = 'gateway-data';

var gateway_id = '';


// Get IP address
//function get_ip_addresses (cb) {
//    var os = require('os');
//    var ifaces = os.networkInterfaces();
//
//    var local_ip_addresses = [];
//    async.eachSeries(Object.keys(ifaces), function (ifname, done) {
//        if (ifname != 'lo') {
//            async.forEachOfSeries(ifaces[ifname], function (iface, index, done2) {
//                local_ip_addresses.push({ifname: ifname, index: index, address: iface.address});
//                done2();
//            }, function (err) {
//                done();
//            });
//        } else {
//            done();
//        }
//    }, function (err) {
//        cb(local_ip_addresses);
//    });
//}


// Need to get the gateway ID to publish in the data packets.
gatewayId.id((id) => {
    gateway_id = id;
});

var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {

    // Publish IP addresses
    function publish () {
      loadavg = os.loadavg();
        metrics = {
          'uptime' : os.uptime(),
          'load' : {
            '1m' : loadavg[0],
            '5m' : loadavg[1],
            '15m': loadavg[2],
          },
          'mem' : {
            'free' : os.freemem(),
            'total' : os.totalmem(),
          }
        }
        metrics['_meta'] = {};
        metrics['_meta']['device_id'] = gateway_id.split(':').join('');
        metrics['_meta']['timestamp'] = new Date().getTime();
        metrics['device'] = 'gateway_metrics';
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(metrics));

        //get_ip_addresses(function (addresses) {
        //    var addr_str = addresses.map(el => el.address).join(', ');

        //    var adv_obj = {
        //        device: "GatewayAddresses",
        //        addresses: addr_str,
        //    };

        //    adv_obj._meta = {
        //        received_time: new Date().toISOString(),
        //        device_id:     gateway_id.replace(/:/g, ''),
        //        receiver:      'gateway-meta',
        //        gateway_id:    gateway_id
        //    };

        //    mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj));
        //});
    }

    // Do one at the start
    publish();

    // Every so often check for ip address changes.
    setInterval(function () {
        publish();
    }, 1000 * 60 * 5);

});
