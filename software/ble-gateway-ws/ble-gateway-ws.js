#!/usr/bin/env node

/*******************************************************************************
 * Publish parsed advertisements to all connected websockets
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var ws         = require('ws');


var bleg     = new BleGateway();
var wsserver = new ws.Server({port: 3001});


// Callback for when BLE discovers the advertisement
bleg.on('advertisement', function (adv_obj) {
	wsserver.clients.forEach(function (client) {
		client.send(JSON.stringify(adv_obj));
	});
});

// Run the Gateway
bleg.start();
