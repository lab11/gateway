#! /usr/bin/env node

// set advertisement rate to be once per second. This must be set before
//  including the bleno library (which is included from eddystone-beacon)
process.env['BLENO_ADVERTISING_INTERVAL'] = 1000;

var eddystoneBeacon = require('eddystone-beacon');
var os = require('os');

var ble_adv_options = {
    name: os.hostname(),
};

// Whether or not we found an IP address to advertise
var advertising = false;

// Check in 1 minute to see if we started advertising.
// Otherwise exit so we restart to see if we have an IP then.
setTimeout(function () {
    if (advertising == false) {
        console.log('Could not find IP address. Exiting.');
        process.exit(-1);
    }
}, 1000*60);

// Main code for finding and advertising the correct IP address.
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
        advertising = true;
    });
});

// Set a long timeout to cause systemd to restart this process. This gives us
// a chance to update the advertisement in case the IP address changes.
setTimeout(function () {
    console.log('Exiting to restart.');
    process.exit(0);
}, 1000*60*60*2);
