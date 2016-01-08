#! /usr/bin/env node

var eddystoneBeacon = require('eddystone-beacon');
var bleno = require('eddystone-beacon/node_modules/bleno');
var os = require('os');

var ble_adv_options = {
    name: os.hostname(),
};

var ifaces  = os.networkInterfaces();
Object.keys(ifaces).forEach(function (ifname) {
    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }

        // we have found the first non-local IPv4 address. Advertise it
        console.log('Advertising http://' + iface.address + ' with device name "' + ble_adv_options.name +'"');
        eddystoneBeacon.advertiseUrl('http://' + iface.address, ble_adv_options);
    });
});

