#!/usr/bin/env node

/*******************************************************************************
 * Broadcast packets as UDP packets on the local network
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var dgram      = require('dgram');


var bleg     = new BleGateway();
var server   = dgram.createSocket("udp4");


var PORT = 3002

server.bind(function () {
    server.setBroadcast(true);

    // Run the Gateway
    bleg.start();
});


// Callback for when BLE discovers the advertisement
bleg.on('advertisement', function (adv_obj) {
    var message = new Buffer(JSON.stringify(adv_obj));
    server.send(message, 0, message.length, PORT, "255.255.255.255");
});

// Run the Gateway
bleg.start();
